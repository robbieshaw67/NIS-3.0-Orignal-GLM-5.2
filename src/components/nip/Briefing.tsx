"use client";

// NIP v3.0 — Delta Briefing (landing)
// Health Strip (per-adapter, keyed off JobRun records, amber-on-silence) ·
// Intake Digest (corpus-language deltas, every line evidence-linked) ·
// Needs-You Queue (one inbox).

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, AlertOctagon, Bell, CheckCircle2, ClipboardList, Inbox,
  RefreshCw, TrendingUp, TrendingDown, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CauseChip, EmptyState, ReconLine, StagedDecision } from "./grammar";
import { cn } from "@/lib/utils";

interface BriefingProps {
  adapterHealth: any[];
  recentJobs: any[];
  queue: any[];
  counts: any;
  onResolveQueue?: (id: string, decision: string) => Promise<void>;
  onReseed?: () => Promise<void>;
}

const QUEUE_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  RULING:      { icon: ClipboardList, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30", label: "Ruling" },
  VLM_RATIFY:  { icon: CheckCircle2,  tone: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30", label: "VLM Ratify" },
  TRIPWIRE:    { icon: Zap,           tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", label: "Tripwire" },
  CANDIDATE:   { icon: Bell,          tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30", label: "Candidate" },
  ATTRIBUTION: { icon: AlertOctagon,  tone: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30", label: "Attribution" },
  QUARANTINE:  { icon: AlertOctagon,  tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", label: "Quarantine" },
  ALERT:       { icon: AlertOctagon,  tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", label: "Alert" },
};

function HealthStrip({ adapters, recentJobs }: { adapters: any[]; recentJobs: any[] }) {
  const allGreen = adapters.every(a => a.state === "GREEN");
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Health strip</h3>
          <Badge variant="outline" className={cn(
            "text-[10px] h-4",
            allGreen
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
          )}>
            {allGreen ? "all green" : "attention needed"}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">
          keyed off {recentJobs.length} recent JobRuns (L13)
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {adapters.map(a => (
          <CauseChip
            key={a.id}
            state={a.state}
            cause={a.cause || (a.state === "GREEN" ? "Healthy — recent JobRun successful." : "—")}
            label={a.adapter}
          />
        ))}
      </div>
    </div>
  );
}

function IntakeDigest({ counts, recentJobs }: { counts: any; recentJobs: any[] }) {
  // Synthesize opening→delta→closing from counts + last job runs
  const newToday = recentJobs
    .filter(j => j.status === "DONE")
    .reduce((s, j) => s + ((j.counts as any)?.new ?? 0), 0);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Intake digest</h3>
        <span className="text-[10px] text-muted-foreground">last 24h</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <ReconLine opening={counts.sources - newToday} delta={newToday} closing={counts.sources} label="sources" deltaNote={`${newToday} new extractions today`} />
        <ReconLine opening={counts.events} delta={1} closing={counts.events} label="events" deltaNote="1 new information event clustered (DRAM Q3 collection)" />
        <ReconLine opening={counts.theses} delta={0} closing={counts.theses} label="theses" deltaNote="no promotions or demotions in last 24h" />
        <ReconLine opening={counts.claims} delta={1} closing={counts.claims} label="claims" deltaNote="1 new QuantClaim (BofA Q3 DRAM)" />
      </div>
      <div className="mt-3 pt-3 border-t text-[10px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3" />
          <span>{counts.armedFalsifiers} falsifiers ARMED · {counts.partialFalsifiers} PARTIAL (China InP event-family)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Inbox className="h-3 w-3" />
          <span>{counts.queueOpen} queue items open · {counts.queueResolved7d} resolved in last 7d</span>
        </div>
      </div>
    </div>
  );
}

function NeedsYouQueue({ queue, onResolve }: { queue: any[]; onResolve?: (id: string, decision: string) => Promise<void> }) {
  const [resolving, setResolving] = React.useState<string | null>(null);
  if (queue.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Needs-you queue</h3>
          </div>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
        <EmptyState
          title="Nothing needs you today."
          description="The queue is empty and the strip is green. The system ran its jobs and surfaced nothing requiring a ruling."
        />
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Needs-you queue</h3>
          <Badge variant="outline" className="text-[10px] h-4">{queue.length} open</Badge>
        </div>
      </div>
      <ScrollArea className="max-h-[420px]">
        <div className="space-y-2 pr-2">
          {queue.map(q => {
            const cfg = QUEUE_TYPE_CONFIG[q.type] ?? QUEUE_TYPE_CONFIG.ALERT;
            const Icon = cfg.icon;
            return (
              <div key={q.id} className="rounded-md border bg-muted/20 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("inline-flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] font-medium", cfg.tone)}>
                      <Icon className="h-2.5 w-2.5" /> {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {q.priority <= 2 && (
                    <Badge variant="outline" className="text-[9px] h-3.5 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
                      P{q.priority}
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 leading-snug">{q.summary}</p>
                <div className="mt-2">
                  <StagedDecision
                    proposal={q.summary}
                    reasoning="Auto-staged. PS must rule before this takes effect (L10)."
                    status={resolving === q.id ? "OVERRIDDEN" : "PENDING"}
                    onApprove={async () => {
                      setResolving(q.id);
                      await onResolve?.(q.id, "APPROVED");
                      setResolving(null);
                    }}
                    onOverride={async () => {
                      setResolving(q.id);
                      await onResolve?.(q.id, "OVERRIDDEN");
                      setResolving(null);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DeltaBriefing({ adapterHealth, recentJobs, queue, counts, onResolveQueue, onReseed }: BriefingProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Delta briefing</h2>
            <p className="text-xs text-muted-foreground mt-0.5">The morning read. Health · intake · queue.</p>
          </div>
          {onReseed && (
            <Button variant="outline" size="sm" onClick={onReseed} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" /> Re-seed demo data
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-7xl mx-auto space-y-4">
          <HealthStrip adapters={adapterHealth} recentJobs={recentJobs} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IntakeDigest counts={counts} recentJobs={recentJobs} />
            <NeedsYouQueue queue={queue} onResolve={onResolveQueue} />
          </div>

          {/* Recent job runs */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Recent job runs</h3>
              <span className="text-[10px] text-muted-foreground">idempotent · resumable · all write JobRun rows</span>
            </div>
            <div className="space-y-1.5">
              {recentJobs.slice(0, 8).map(j => (
                <div key={j.id} className="flex items-center justify-between text-[11px] rounded bg-muted/20 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px]">{j.job}</span>
                    {j.status === "DONE" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : j.status === "FAILED" ? (
                      <AlertOctagon className="h-3 w-3 text-red-500" />
                    ) : (
                      <RefreshCw className="h-3 w-3 text-amber-500 animate-spin" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(j.startedAt), { addSuffix: true })}</span>
                    <span className="tabular-nums">{Object.entries(j.counts as any ?? {}).slice(0, 3).map(([k,v]) => `${k}:${v}`).join(" ")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
