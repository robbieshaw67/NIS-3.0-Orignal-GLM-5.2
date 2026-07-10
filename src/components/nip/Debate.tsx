"use client";

// NIP v3.0 — ROOM 2: The Debate Theater (v2.1 §2)
// Where jukan-vs-Dylan-vs-TrendForce exists as a RENDERED ARGUMENT, not a query result.
// Two columns and a spine: positions side-by-side, stakes + resolution clock between.

import * as React from "react";
import { format } from "date-fns";
import {
  Flame, ArrowRight, Quote, ChevronRight, Trophy, Pause, Scale, Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AuthorChip, CompositionBadge, CountdownChip, DirectionArrow,
  EvidenceLink, OriginalLink, RangeBar, StagePill,
} from "./grammar";
import { cn } from "@/lib/utils";

interface DebateProps {
  debate: any;
  authorsById: Record<string, any>;
  onSelectDebate?: (id: string) => void;
  active?: boolean;
}

const DEBATE_TYPE_TONE: Record<string, string> = {
  MAGNITUDE: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DIRECTION: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  TIMING:    "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  MECHANISM: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
    LIVE:         { tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", label: "Live",        icon: Flame },
    RESOLVING:    { tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30", label: "Resolving", icon: Pause },
    RESOLVED_A:   { tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", label: "Resolved → A", icon: Trophy },
    RESOLVED_B:   { tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", label: "Resolved → B", icon: Trophy },
    RESOLVED_MIXED:{tone: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30", label: "Mixed", icon: Scale },
    DORMANT:      { tone: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30", label: "Dormant", icon: Pause },
  };
  const cfg = map[status] ?? map.LIVE;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", cfg.tone)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

// ── the debate index card ──
export function DebateIndexCard({ debate, authorsById, onSelectDebate }: DebateProps) {
  const sideA = debate.positions?.filter((p: any) => p.side === "A") ?? [];
  const sideB = debate.positions?.filter((p: any) => p.side === "B") ?? [];
  const aOrgs = new Set(sideA.map((p: any) => p.orgId)).size;
  const bOrgs = new Set(sideB.map((p: any) => p.orgId)).size;
  const nextResolution = debate.resolutionEvents?.[0];

  return (
    <button
      onClick={() => onSelectDebate?.(debate.id)}
      className="w-full text-left rounded-lg border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="outline" className={cn("text-[10px] h-5", DEBATE_TYPE_TONE[debate.debateType])}>
          {debate.debateType}
        </Badge>
        <StatusPill status={debate.status} />
      </div>
      <h3 className="text-sm font-semibold leading-tight mb-2">{debate.question}</h3>
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="font-semibold tabular-nums">{sideA.length}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="font-semibold tabular-nums">{sideB.length}</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{aOrgs} vs {bOrgs} orgs</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        {nextResolution ? (
          <CountdownChip date={nextResolution.date} label={nextResolution.eventType} />
        ) : (
          <span className="text-[10px] text-muted-foreground">no resolution scheduled</span>
        )}
      </div>
      {debate.theses?.length > 0 && (
        <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
          {debate.theses.slice(0, 3).map((t: any) => (
            <span key={t.id} className="inline-flex items-center gap-1">
              <StagePill stage={t.stage} />
              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{t.title.slice(0, 40)}…</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── position card (one side of a debate) ──
function PositionCard({ position, authorsById }: { position: any; authorsById: Record<string, any> }) {
  const author = authorsById[position.authorId];
  const [showEvidence, setShowEvidence] = React.useState(false);
  const evidenceRef = position.evidenceRefs?.[0];
  const source = position.source;
  const claim = position.quantClaims?.[0];
  const body = source?.rawContent?.bodyText ?? "";
  const quote = evidenceRef && body
    ? body.slice(evidenceRef.spanStart, evidenceRef.spanEnd)
    : position.statement;

  return (
    <div className={cn(
      "rounded-lg border p-3 bg-card",
      position.side === "A" ? "border-emerald-500/30" : "border-red-500/30",
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={cn(
          "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
          position.side === "A" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400",
        )}>
          Side {position.side}
        </span>
        {position.stanceWeight !== 1.0 && (
          <Badge variant="outline" className="text-[10px] h-4 tabular-nums">w {position.stanceWeight.toFixed(2)}</Badge>
        )}
      </div>

      {author && (
        <AuthorChip
          handle={author.handle}
          realName={author.realName}
          epistemicClass={author.epistemicClass}
          orgAffiliation={author.orgAffiliation}
          avatarColor={author.avatarColor}
          size="sm"
        />
      )}

      <div className="mt-2 rounded-md bg-muted/30 p-2.5 border-l-2 border-primary/40">
        <Quote className="h-3 w-3 text-muted-foreground mb-1" />
        <p className="text-xs italic leading-relaxed">"{quote}"</p>
      </div>

      {claim && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{claim.metricName}:</span>
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {claim.valueLow}–{claim.valueHigh}{claim.unit === "PERCENT" ? "%" : ""}
          </Badge>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="text-[10px] text-primary hover:underline inline-flex items-center"
        >
          {showEvidence ? "Hide" : "Show"} evidence <ChevronRight className={cn("ml-0.5 h-2.5 w-2.5 transition-transform", showEvidence && "rotate-90")} />
        </button>
        {evidenceRef && <OriginalLink url={evidenceRef.url} label="Source" />}
      </div>

      {showEvidence && source && (
        <div className="mt-2 rounded-md border bg-muted/20 p-2 text-[11px] space-y-1.5">
          <div>
            <span className="text-muted-foreground">Insight: </span>
            <span>{source.keyInsight ?? position.statement}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Confidence:</span>
            <Badge variant="outline" className="text-[10px] h-4">{source.confidence ?? "MEDIUM"}</Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Extraction: </span>
            <span className="text-[10px]">{source.extractionVersion ?? "—"}</span>
          </div>
          {position.lastAffirmedAt && (
            <div className="text-[10px] text-muted-foreground">
              Last affirmed: {format(new Date(position.lastAffirmedAt), "MMM d, HH:mm")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── the spine (between the two columns) ──
function DebateSpine({ debate }: { debate: any }) {
  const resolutions = debate.resolutionEvents ?? [];
  return (
    <div className="flex flex-col gap-3 px-1">
      {/* Stakes */}
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-1">
          <Scale className="h-3 w-3" /> What's at stake
        </div>
        <p className="text-xs leading-relaxed">{debate.stakes}</p>
      </div>

      {/* Resolution clock */}
      <div className="rounded-md border bg-card p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium mb-2">
          <CountdownChip date={resolutions[0]?.date ?? new Date()} />
          <span className="text-muted-foreground">resolution clock</span>
        </div>
        <div className="space-y-1.5">
          {resolutions.map((ev: any) => (
            <div key={ev.id} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <Link2 className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{ev.eventType}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{format(new Date(ev.date), "MMM d")}</span>
              </div>
              <CountdownChip date={ev.date} />
            </div>
          ))}
        </div>
      </div>

      {/* Decides */}
      {debate.theses?.length > 0 && (
        <div className="rounded-md border bg-card p-3">
          <div className="text-[11px] font-medium text-muted-foreground mb-2">Decides</div>
          <div className="space-y-1.5">
            {debate.theses.map((t: any) => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs">
                <StagePill stage={t.stage} />
                <DirectionArrow direction={t.direction} size={10} />
                <span className="truncate text-muted-foreground" title={t.title}>{t.title.slice(0, 35)}…</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── the full debate page ──
export function DebatePage({ debate, authorsById }: DebateProps) {
  if (!debate) return null;
  const sideA = debate.positions?.filter((p: any) => p.side === "A") ?? [];
  const sideB = debate.positions?.filter((p: any) => p.side === "B") ?? [];
  const nuance = debate.positions?.filter((p: any) => p.side === "NUANCED") ?? [];

  // For MAGNITUDE debates, build the range bar
  const rangeData = debate.debateType === "MAGNITUDE" && debate.positions
    ? debate.positions
        .filter((p: any) => p.quantClaims?.length > 0)
        .map((p: any) => {
          const c = p.quantClaims[0];
          const author = authorsById[p.authorId];
          return {
            label: author?.realName ?? p.authorName,
            low: c.valueLow,
            high: c.valueHigh,
            anchor: author?.handle === "TrendForce" || p.orgId === "TrendForce",
          };
        })
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] h-5", DEBATE_TYPE_TONE[debate.debateType])}>
                {debate.debateType}
              </Badge>
              <StatusPill status={debate.status} />
              {debate.metricName && (
                <Badge variant="outline" className="text-[10px] h-5">{debate.metricName}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Flame className="h-3 w-3 text-orange-500" />
              heat <span className="font-semibold tabular-nums">{debate.heatScore.toFixed(1)}</span>
            </div>
          </div>
          <h2 className="text-base sm:text-lg font-semibold leading-tight">{debate.question}</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-6xl mx-auto space-y-4">
          {/* Range bar for magnitude debates */}
          {rangeData.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Claim dispersion</h3>
                <EvidenceLink
                  label="tail"
                  value={`${Math.min(...rangeData.map(r => r.low))}–${Math.max(...rangeData.map(r => r.high))}${debate.metricName?.includes("QoQ") || debate.metricName?.includes("YoY") ? "%" : ""}`}
                  evidence={
                    <div className="space-y-1">
                      <p>The full claim range, low-tail to high-tail. A wide range with credible tails on both sides is the strongest debate trigger.</p>
                      <p className="text-muted-foreground">Synthesized from {rangeData.length} positions on this debate.</p>
                    </div>
                  }
                />
              </div>
              <RangeBar ranges={rangeData} unit={debate.metricName?.includes("QoQ") || debate.metricName?.includes("YoY") ? "%" : ""} height={Math.max(40, rangeData.length * 16)} />
            </div>
          )}

          {/* two-column + spine layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px_1fr] gap-4">
            {/* Side A */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Side A — high</h3>
                <Badge variant="outline" className="text-[10px] h-4">{sideA.length} positions</Badge>
              </div>
              {sideA.map((p: any) => (
                <PositionCard key={p.id} position={p} authorsById={authorsById} />
              ))}
              {sideA.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No positions yet.</p>
              )}
            </div>

            {/* Spine */}
            <div className="lg:order-none order-first lg:block">
              <DebateSpine debate={debate} />
            </div>

            {/* Side B */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Side B — low</h3>
                <Badge variant="outline" className="text-[10px] h-4">{sideB.length} positions</Badge>
              </div>
              {sideB.map((p: any) => (
                <PositionCard key={p.id} position={p} authorsById={authorsById} />
              ))}
              {sideB.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No positions yet.</p>
              )}
            </div>
          </div>

          {nuance.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Nuanced positions</h3>
                {nuance.map((p: any) => (
                  <PositionCard key={p.id} position={p} authorsById={authorsById} />
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── the debate list (index) ──
export function DebateList({ debates, authorsById, onSelectDebate, selectedId }: {
  debates: any[];
  authorsById: Record<string, any>;
  onSelectDebate: (id: string) => void;
  selectedId?: string;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 max-w-3xl mx-auto space-y-3">
        <div className="mb-2">
          <h2 className="text-lg font-semibold">Debate Theater</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Disagreement as a first-class object. Every debate answers five questions on one screen:
            what's the question, who says what, what's at stake, what resolves it, where it stands.
          </p>
        </div>
        {debates.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            No live debates. Disagreement will assemble itself as claims disperse and engagements file.
          </div>
        ) : (
          debates.map(d => (
            <DebateIndexCard key={d.id} debate={d} authorsById={authorsById} onSelectDebate={onSelectDebate} active={selectedId === d.id} />
          ))
        )}
      </div>
    </ScrollArea>
  );
}
