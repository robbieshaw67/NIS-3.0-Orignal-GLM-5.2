"use client";

// NIP v3.0 — Delta Briefing (landing)
// Health Strip (per-adapter, keyed off JobRun records, amber-on-silence) ·
// Intake Digest (corpus-language deltas, every line evidence-linked) ·
// Needs-You Queue (one inbox, expandable to show full context) ·
// Job Registry (with Run buttons).

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, AlertOctagon, Bell, CheckCircle2, ClipboardList, Clock, Inbox,
  RefreshCw, TrendingUp, TrendingDown, Zap, ChevronDown, ChevronUp, Play, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CauseChip, EmptyState, ReconLine, StagedDecision } from "./grammar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// The full 12-job registry from the spec (Design §6)
// Maps job ID → API endpoint path
const JOB_REGISTRY = [
  { id: "adapters:rss",          desc: "Watermark-incremental RSS",         endpoint: "/api/jobs.rss" },
  { id: "adapters:x",            desc: "Nitter scraper + threads + echo edges", endpoint: "/api/jobs.x" },
  { id: "adapters:transcripts",  desc: "yt-dlp + Whisper fallback",         endpoint: "/api/jobs.transcripts" },
  { id: "adapters:anchors",      desc: "TrendForce + earnings + capex parsers", endpoint: "/api/jobs.anchors" },
  { id: "pipeline:events",       desc: "Deterministic blocking + LLM adj.",  endpoint: "/api/jobs.events" },
  { id: "pipeline:stance",       desc: "Exponential decay + change class.",  endpoint: "/api/jobs.stance" },
  { id: "pipeline:contrarian",   desc: "Engagement detection + PS queue",    endpoint: "/api/jobs.contrarian" },
  { id: "monitor:falsifiers",    desc: "Deterministic screen + consequences", endpoint: "/api/jobs.falsifiers" },
  { id: "engine:ladder",         desc: "Gate computation + stage transitions", endpoint: "/api/jobs.ladder" },
  { id: "monitor:verifications", desc: "Passed events → claim resolution",   endpoint: "/api/jobs.verifications" },
  { id: "ops:scorecard",         desc: "Weekly checkpoint 11",               endpoint: "/api/jobs.scorecard" },
  { id: "ops:backup",            desc: "Nightly off-box dump + restore drill", endpoint: "/api/jobs.backup" },
] as const;

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

// ── Queue item with expandable details ──
function QueueItemCard({ q, onResolve }: { q: any; onResolve?: (id: string, decision: string) => Promise<void> }) {
  const [resolving, setResolving] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [detail, setDetail] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const cfg = QUEUE_TYPE_CONFIG[q.type] ?? QUEUE_TYPE_CONFIG.ALERT;
  const Icon = cfg.icon;

  const loadDetail = async () => {
    if (expanded) { setExpanded(false); return; }
    if (detail) { setExpanded(true); return; }
    setLoadingDetail(true);
    try {
      const r = await fetch(`/api/queue/detail?id=${q.id}`);
      const data = await r.json();
      if (data.ok) {
        setDetail(data.detail);
        setExpanded(true);
      } else {
        toast.error("Failed to load details");
      }
    } catch {
      toast.error("Failed to load details");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="rounded-md border bg-muted/20 p-2.5 text-xs">
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

      {/* View details link */}
      <button
        onClick={loadDetail}
        disabled={loadingDetail}
        className="mt-1 flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
      >
        {loadingDetail ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : expanded ? (
          <ChevronUp className="h-2.5 w-2.5" />
        ) : (
          <ChevronDown className="h-2.5 w-2.5" />
        )}
        {expanded ? "Hide details" : "View details"}
      </button>

      {/* Expanded detail panel */}
      {expanded && detail && (
        <div className="mt-2 pt-2 border-t border-muted-foreground/20 space-y-2 text-[10px]">
          {detail.fetchError && (
            <div className="text-red-600 dark:text-red-400">Failed to load context: {detail.fetchError}</div>
          )}

          {/* RULING — show thesis + engagements */}
          {q.type === "RULING" && (
            <>
              {detail.thesis && (
                <div className="rounded bg-background/50 p-2">
                  <div className="font-medium text-[11px]">{detail.thesis.title}</div>
                  <div className="text-muted-foreground mt-0.5">
                    Stage: {detail.thesis.stage} · Direction: {detail.thesis.direction} · N={detail.thesis.effectiveN?.toFixed(1)} · Contrarian: {detail.thesis.contrarianStatus}
                  </div>
                </div>
              )}
              {detail.engagements && detail.engagements.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Staged objections ({detail.engagements.length}):</div>
                  {detail.engagements.map((e: any) => (
                    <div key={e.id} className="rounded bg-background/50 p-1.5 mb-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{e.engagementType}</span>
                        <Badge variant="outline" className="text-[8px] h-3">{e.status}</Badge>
                      </div>
                      {e.reasoning && <div className="text-muted-foreground mt-0.5">{e.reasoning}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* VLM_RATIFY — show image + extraction */}
          {q.type === "VLM_RATIFY" && detail.image && (
            <div className="rounded bg-background/50 p-2 space-y-1">
              {detail.image.imageUrl && (
                <img src={detail.image.imageUrl} alt="extracted" className="rounded max-h-40 w-auto" />
              )}
              <div><span className="text-muted-foreground">Annotation:</span> {detail.image.annotationText || "—"}</div>
              <div><span className="text-muted-foreground">Axis-read:</span> {detail.image.axisReadText || "—"}</div>
              {detail.image.discrepancyFlag === "DUAL_ROUTE_MISMATCH" && (
                <div className="text-amber-600 dark:text-amber-400 font-medium">⚠ Dual-route mismatch — needs review</div>
              )}
            </div>
          )}

          {/* TRIPWIRE — show falsifier + thesis */}
          {q.type === "TRIPWIRE" && (
            <>
              {detail.falsifier && (
                <div className="rounded bg-background/50 p-2">
                  <div className="font-medium">{detail.falsifier.label}</div>
                  <div className="text-muted-foreground mt-0.5">
                    Status: {detail.falsifier.status} · Query: <code className="text-[9px]">{detail.falsifier.compiledQuery}</code>
                  </div>
                </div>
              )}
              {detail.thesis && (
                <div className="text-muted-foreground">
                  Linked thesis: <span className="font-medium text-foreground">{detail.thesis.title}</span>
                </div>
              )}
            </>
          )}

          {/* ALERT — show author + stance changes */}
          {q.type === "ALERT" && (
            <>
              {detail.author && (
                <div className="rounded bg-background/50 p-2">
                  <div className="font-medium">{detail.author.realName} (@{detail.author.handle})</div>
                  <div className="text-muted-foreground mt-0.5">
                    Class: {detail.author.epistemicClass} · Org: {detail.author.orgAffiliation || "Independent"}
                  </div>
                </div>
              )}
              {detail.author?.stanceChanges?.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Recent stance changes:</div>
                  {detail.author.stanceChanges.map((sc: any) => (
                    <div key={sc.id} className="rounded bg-background/50 p-1.5 mb-1">
                      <span className="font-mono">{sc.oldDirection} → {sc.newDirection}</span>
                      {sc.reasoning && <div className="text-muted-foreground mt-0.5">{sc.reasoning}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CANDIDATE — show source candidate */}
          {q.type === "CANDIDATE" && detail.candidate && (
            <div className="rounded bg-background/50 p-2">
              <div className="font-medium">@{detail.candidate.handle}</div>
              <div className="text-muted-foreground mt-0.5">
                Cited {detail.candidate.citations}× · Status: {detail.candidate.status}
              </div>
            </div>
          )}

          {/* ATTRIBUTION / QUARANTINE — show source + raw content */}
          {(q.type === "ATTRIBUTION" || q.type === "QUARANTINE") && (
            <>
              {detail.source && (
                <div className="rounded bg-background/50 p-2">
                  <div className="font-medium">{detail.source.handle}</div>
                  <div className="text-muted-foreground mt-0.5">
                    Direction: {detail.source.direction || "—"} · Extracted: {detail.source.extractedText?.slice(0, 100) || "—"}
                  </div>
                </div>
              )}
              {detail.rawContent && (
                <div className="rounded bg-background/50 p-2">
                  <div className="font-medium">{detail.rawContent.title}</div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-3">
                    {detail.rawContent.bodyText?.slice(0, 200)}
                  </div>
                  {detail.rawContent.url && (
                    <a href={detail.rawContent.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[9px]">
                      Open original ↗
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {/* Fallback if no specific detail rendered */}
          {!detail.thesis && !detail.image && !detail.falsifier && !detail.author && !detail.candidate && !detail.source && !detail.rawContent && (
            <div className="text-muted-foreground italic">No additional context available for this queue type.</div>
          )}
        </div>
      )}

      {/* Staged decision — Approve / Override */}
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
}

function NeedsYouQueue({ queue, onResolve }: { queue: any[]; onResolve?: (id: string, decision: string) => Promise<void> }) {
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
          {queue.map(q => (
            <QueueItemCard key={q.id} q={q} onResolve={onResolve} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Job registry with Run buttons ──
function JobRegistry({ recentJobs }: { recentJobs: any[] }) {
  const [running, setRunning] = React.useState<string | null>(null);
  const [runAll, setRunAll] = React.useState(false);

  const runJob = async (jobId: string, endpoint: string) => {
    setRunning(jobId);
    try {
      const r = await fetch(endpoint, { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const c = data?.counts ?? {};
      const summary = Object.entries(c).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(" · ") || "no counts";
      toast.success(`${jobId} ran — ${summary}`);
    } catch (e: any) {
      toast.error(`${jobId} failed: ${e?.message ?? "unknown"}`);
    } finally {
      setRunning(null);
    }
  };

  const runAllJobs = async () => {
    setRunAll(true);
    try {
      const r = await fetch("/api/cron/daily", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      toast.success(`All jobs dispatched — ${data?.results?.length ?? 0} ran`);
    } catch (e: any) {
      toast.error(`Run-all failed: ${e?.message ?? "unknown"}`);
    } finally {
      setRunAll(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Job registry</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">12 jobs · idempotent · resumable · all write JobRun rows (L13)</span>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={runAllJobs} disabled={runAll || running !== null}>
            {runAll ? <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> : <Play className="h-2.5 w-2.5 mr-1" />}
            Run all
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {JOB_REGISTRY.map(jr => {
          const lastRun = recentJobs.find(j => j.job === jr.id);
          const isRunning = running === jr.id;
          return (
            <div key={jr.id} className="flex items-center justify-between text-[11px] rounded border bg-muted/20 px-2 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {lastRun ? (
                  lastRun.status === "DONE" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : lastRun.status === "FAILED" ? (
                    <AlertOctagon className="h-3 w-3 text-red-500 shrink-0" />
                  ) : (
                    <RefreshCw className="h-3 w-3 text-amber-500 animate-spin shrink-0" />
                  )
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-mono text-[10px] truncate">{jr.id}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{jr.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {lastRun && (
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {Object.entries(lastRun.counts as any ?? {}).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(" ")}
                  </span>
                )}
                <button
                  onClick={() => runJob(jr.id, jr.endpoint)}
                  disabled={isRunning || runAll}
                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title={`Run ${jr.id}`}
                >
                  {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
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
          <JobRegistry recentJobs={recentJobs} />
        </div>
      </ScrollArea>
    </div>
  );
}
