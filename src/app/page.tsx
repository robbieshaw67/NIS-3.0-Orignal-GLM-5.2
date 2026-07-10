"use client";

// NIP v3.0 — Operator Surface (M8)
// Four rooms the operator walks through in order: Reality → Disagreement → Judgment → Action.
// Plus supporting surfaces: Delta Briefing, Authors, Markets, Ingestion.
// Navigation is flat. The Needs-You badge is global.

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, MessagesSquare, Gavel, Target, LayoutDashboard,
  Users2, LineChart, Upload, Bell, CircleDot, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { Stream } from "@/components/nip/Stream";
import { DebateList, DebatePage } from "@/components/nip/Debate";
import { ThesisBoard } from "@/components/nip/ThesisBoard";
import { ActionSurface } from "@/components/nip/Action";
import { DeltaBriefing } from "@/components/nip/Briefing";
import { Authors } from "@/components/nip/Authors";
import { Markets } from "@/components/nip/Markets";
import { IngestionConsole } from "@/components/nip/Ingestion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── room definitions — the four-room inversion (v2.1 §0) ──
const ROOMS = [
  { id: "briefing",  label: "Briefing",     icon: LayoutDashboard, group: "intro",     desc: "Health · intake · queue" },
  { id: "stream",    label: "Stream",       icon: BookOpen,        group: "room",      desc: "ROOM 1 — Reality" },
  { id: "debates",   label: "Debates",      icon: MessagesSquare,  group: "room",      desc: "ROOM 2 — Disagreement" },
  { id: "board",     label: "Thesis Board", icon: Gavel,           group: "room",      desc: "ROOM 3 — Judgment" },
  { id: "action",    label: "Action",       icon: Target,          group: "room",      desc: "ROOM 4 — Trade layer" },
  { id: "authors",   label: "Authors",      icon: Users2,          group: "support",   desc: "Class + org + calibration" },
  { id: "markets",   label: "Markets",      icon: LineChart,       group: "support",   desc: "Dispersion + calendar" },
  { id: "ingestion", label: "Ingestion",    icon: Upload,          group: "support",   desc: "Visual + adapters + CP10" },
] as const;

type RoomId = typeof ROOMS[number]["id"];

async function fetchSnapshot() {
  const r = await fetch("/api/snapshot", { cache: "no-store" });
  if (!r.ok) throw new Error(`snapshot failed: ${r.status}`);
  return r.json();
}

export default function Page() {
  const qc = useQueryClient();
  const [room, setRoom] = React.useState<RoomId>("briefing");
  const [selectedDebateId, setSelectedDebateId] = React.useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["snapshot"],
    queryFn: fetchSnapshot,
    refetchInterval: 30_000,
  });

  const resolveQueue = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: string }) => {
      const r = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      if (!r.ok) throw new Error("resolve failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      toast.success("Ruling recorded — audit log updated.");
    },
    onError: () => toast.error("Failed to record ruling."),
  });

  const reseed = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/seed", { method: "POST" });
      if (!r.ok) throw new Error("seed failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      toast.success("Demo data re-seeded.");
    },
    onError: () => toast.error("Seed failed."),
  });

  // Run an adapter job (RSS / X / transcripts / anchors / events)
  const runAdapter = useMutation({
    mutationFn: async ({ adapter }: { adapter: string }) => {
      const endpoint = `/api/jobs.${adapter === "transcripts" ? "transcripts" : adapter === "events" ? "events" : adapter}`;
      const r = await fetch(endpoint, { method: "POST" });
      if (!r.ok) throw new Error(`adapter ${adapter} failed`);
      return r.json();
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      const c = data?.counts ?? {};
      const summary = Object.entries(c).map(([k, v]) => `${k}:${v}`).join(" · ") || "no counts";
      toast.success(`${vars.adapter} job ran — ${summary}`);
    },
    onError: (_e, vars) => toast.error(`${vars.adapter} job failed.`),
  });

  // Rule on a staged engagement (L10) — ANSWERED / OPEN / CONCEDED
  const ruleEngagement = useMutation({
    mutationFn: async ({ engagementId, decision }: { engagementId: string; decision: "ANSWERED" | "OPEN" | "CONCEDED" }) => {
      const r = await fetch("/api/engagement/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId, psDecision: decision }),
      });
      if (!r.ok) throw new Error("engagement ruling failed");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      if (data?.contrarianUpdated) {
        toast.success(`Ruling recorded. Contrarian → ${data.newContrarianStatus}. Eligible for promotion if gates pass.`);
      } else {
        toast.success("Ruling recorded.");
      }
    },
    onError: () => toast.error("Engagement ruling failed."),
  });

  // Promote a thesis (PS-gated) — gate check → ACTIONABLE → auto PAPER position
  const promoteThesis = useMutation({
    mutationFn: async ({ thesisId }: { thesisId: string }) => {
      const r = await fetch("/api/thesis/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesisId }),
      });
      if (!r.ok) throw new Error("promotion failed");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      if (data?.promoted) {
        const extra = data.paperPositionCreated ? ` · PAPER position auto-created` : "";
        toast.success(`Promoted: ${data.from} → ${data.to}${extra}`);
      } else {
        toast.error(`Cannot promote — missing: ${data?.missing?.join(", ") ?? "unknown"}`);
      }
    },
    onError: () => toast.error("Promotion failed."),
  });

  // CP10 dry-run re-extraction
  const reextractDryRun = useMutation({
    mutationFn: async ({ targetVersion, degradedOnly }: { targetVersion: string; degradedOnly: boolean }) => {
      const r = await fetch("/api/reextraction/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetVersion, degradedOnly }),
      });
      if (!r.ok) throw new Error("dry-run failed");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      toast.success(`Dry-run complete: ${data?.counts?.scanned ?? 0} scanned · ${data?.counts?.changed ?? 0} changed · ${data?.counts?.quarantined ?? 0} quarantined`);
    },
    onError: () => toast.error("Dry-run failed."),
  });

  // CP10 apply (PS-approved diffs → write to Source rows)
  const reextractApply = useMutation({
    mutationFn: async ({ diffs }: { diffs: any[] }) => {
      const r = await fetch("/api/reextraction/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffs }),
      });
      if (!r.ok) throw new Error("apply failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
    },
    onError: () => toast.error("Apply failed."),
  });

  const authorsById = React.useMemo(() => {
    const m: Record<string, any> = {};
    for (const a of data?.authors ?? []) m[a.id] = a;
    return m;
  }, [data?.authors]);

  // ── loading skeleton ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 max-w-md w-full px-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 max-w-md">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Failed to load snapshot</h2>
          <p className="text-xs text-muted-foreground mt-1">{String(error ?? "unknown")}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => qc.invalidateQueries({ queryKey: ["snapshot"] })}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const queueOpen = data.counts?.queueOpen ?? 0;

  // ── render the active room ──
  const renderRoom = () => {
    switch (room) {
      case "briefing":
        return (
          <DeltaBriefing
            adapterHealth={data.adapterHealth}
            recentJobs={data.recentJobs}
            queue={data.queue}
            counts={data.counts}
            onResolveQueue={(id, decision) => resolveQueue.mutateAsync({ id, decision })}
            onReseed={() => reseed.mutateAsync()}
          />
        );
      case "stream":
        return <Stream rawContents={data.rawContents} authors={data.authors} />;
      case "debates":
        return selectedDebateId
          ? (() => {
              const d = data.debates.find((x: any) => x.id === selectedDebateId);
              return (
                <div className="flex flex-col h-full">
                  <button
                    onClick={() => setSelectedDebateId(null)}
                    className="border-b px-4 py-2 text-xs text-muted-foreground hover:bg-muted/30 flex items-center gap-1 text-left"
                  >
                    <ChevronRight className="h-3 w-3 rotate-180" /> Back to debates
                  </button>
                  <DebatePage debate={d} authorsById={authorsById} />
                </div>
              );
            })()
          : (
            <DebateList
              debates={data.debates}
              authorsById={authorsById}
              onSelectDebate={(id) => setSelectedDebateId(id)}
              selectedId={selectedDebateId ?? undefined}
            />
          );
      case "board":
        return (
          <ThesisBoard
            theses={data.theses}
            verificationEvents={data.verificationEvents}
            onRuleEngagement={(engagementId, decision) => ruleEngagement.mutateAsync({ engagementId, decision })}
            onPromote={(thesisId) => promoteThesis.mutateAsync({ thesisId })}
          />
        );
      case "action":
        return (
          <ActionSurface
            tradePlans={data.tradePlans}
            expressions={data.expressions}
            families={data.families}
            theses={data.theses}
          />
        );
      case "authors":
        return <Authors authors={data.authors} />;
      case "markets":
        return (
          <Markets
            claims={data.claims}
            verificationEvents={data.verificationEvents}
            anchorRevisions={data.anchorRevisions}
            debates={data.debates}
            authorsById={authorsById}
          />
        );
      case "ingestion":
        return (
          <IngestionConsole
            adapterHealth={data.adapterHealth}
            rawContents={data.rawContents}
            watermarks={data.watermarks}
            counts={data.counts}
            onAdapterRun={(adapter) => runAdapter.mutateAsync({ adapter })}
            onReextract={(targetVersion, degradedOnly) => reextractDryRun.mutateAsync({ targetVersion, degradedOnly })}
            onApply={(diffs) => reextractApply.mutateAsync({ diffs })}
          />
        );
      default:
        return null;
    }
  };

  // ── nav sidebar (shared between desktop rail and mobile sheet) ──
  const navList = (
    <nav className="space-y-1">
      {ROOMS.map((r, i) => {
        const Icon = r.icon;
        const isActive = room === r.id;
        const showGroup = i === 0 || ROOMS[i - 1].group !== r.group;
        return (
          <React.Fragment key={r.id}>
            {showGroup && i > 0 && (
              <div className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                {r.group === "room" ? "Four Rooms" : r.group === "support" ? "Supporting" : "Start"}
              </div>
            )}
            <button
              onClick={() => {
                setRoom(r.id);
                setSelectedDebateId(null);
                setMobileNavOpen(false);
              }}
              className={cn(
                "w-full flex items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{r.label}</span>
                  {r.id === "briefing" && queueOpen > 0 && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 tabular-nums">
                      {queueOpen}
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight truncate">{r.desc}</div>
              </div>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r bg-card/30 flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              N
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">NIP v3.0</h1>
              <p className="text-[10px] text-muted-foreground">Narrative Intelligence</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-2 py-2">
          {navList}
        </ScrollArea>

        <div className="border-t p-3 text-[10px] text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>asOf</span>
            <span className="tabular-nums">{new Date(data.asOf).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>corpus</span>
            <span className="tabular-nums">{data.counts?.rawContents ?? 0} raw</span>
          </div>
          <div className="flex items-center justify-between">
            <span>falsifiers</span>
            <span className="tabular-nums">{data.counts?.armedFalsifiers ?? 0} ARMED · {data.counts?.partialFalsifiers ?? 0} PARTIAL</span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-3 py-2 flex items-center justify-between">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <CircleDot className="h-4 w-4 mr-1" /> Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="p-4 border-b">
              <h1 className="text-sm font-semibold">NIP v3.0</h1>
              <p className="text-[10px] text-muted-foreground">Narrative Intelligence</p>
            </div>
            <ScrollArea className="px-2 py-2 h-[calc(100vh-64px)]">
              {navList}
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{ROOMS.find(r => r.id === room)?.label}</span>
          {queueOpen > 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 tabular-nums">
              <Bell className="h-2.5 w-2.5 mr-0.5" />{queueOpen}
            </Badge>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col pt-12 md:pt-0">
        {renderRoom()}
      </main>
    </div>
  );
}
