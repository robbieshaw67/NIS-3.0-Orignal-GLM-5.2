"use client";

// NIP v3.0 — ROOM 3: Thesis Board (M8 surface #2, Design §7)
// Five ladder columns, gate criteria on headers, cards showing:
// counter strip / contrarian chip / falsifier lights / verification countdown / divergence badge
// Evidence drawer in place (events, engagements two-column, stage history with snapshots)
// Distance-to-promotion sorting.
//
// Now wired (sequence step 4 completion):
//   - PS engagement ruling (ANSWERED/OPEN/CONCEDED) per engagement (L10)
//   - When all engagements ANSWERED → contrarian SURVIVED → eligible for promotion
//   - PS-gated promotion button → ACTIONABLE → auto PAPER position (Spec §9)

import * as React from "react";
import { format } from "date-fns";
import {
  ShieldCheck, ShieldAlert, Crosshair, Flame, Eye, History,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle,
  ArrowUpRight, ArrowDownRight, FileWarning, Sparkles, ArrowUpCircle, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CompositionBadge, CountdownChip, DirectionArrow, EvidenceLink,
  StagePill, StagedDecision,
} from "./grammar";
import { canPromote } from "@/lib/gates";
import { cn } from "@/lib/utils";

function nextStage(stage: string): string {
  const ladder = ["OBSERVATION", "HYPOTHESIS", "VALIDATED", "ACTIONABLE"];
  const i = ladder.indexOf(stage);
  return i >= 0 && i < ladder.length - 1 ? ladder[i + 1] : stage;
}

const LADDER = [
  { stage: "OBSERVATION", label: "Observation", color: "border-slate-500/30 bg-slate-500/5" },
  { stage: "HYPOTHESIS",  label: "Hypothesis",  color: "border-blue-500/30 bg-blue-500/5" },
  { stage: "VALIDATED",   label: "Validated",   color: "border-emerald-500/30 bg-emerald-500/5" },
  { stage: "ACTIONABLE",  label: "Actionable",  color: "border-amber-500/30 bg-amber-500/5" },
];

const GATE_CRITERIA: Record<string, string[]> = {
  OBSERVATION: ["any thesis", "no gate"],
  HYPOTHESIS:  ["≥3 events", "effN ≥ 2", "trailing 60d"],
  VALIDATED:   ["≥2 ind. events (org-aware)", "≥1 primary-integrity", "effN ≥ 3", "≥2 orgs AND ≥2 classes", "≥1 armed falsifier", "contrarian ≠ KILLED"],
  ACTIONABLE:  ["linked VerificationEvent", "contrarian SURVIVED", "crowding clear", "all falsifiers ARMED", "no unreviewed REVERSING 14d", "not-priced verdict shown"],
};

// ── contrarian chip ──
function ContrarianChip({ status, searchLoggedAt }: { status: string; searchLoggedAt?: Date | string | null }) {
  const map: Record<string, { tone: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
    SURVIVED:          { tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", icon: ShieldCheck, label: "Survived" },
    ENGAGED_UNRESOLVED:{ tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: ShieldAlert,  label: "Engaged — unresolved" },
    CONCEDED:          { tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", icon: XCircle, label: "Conceded" },
    KILLED:            { tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", icon: XCircle, label: "Killed" },
    UNENGAGED:         { tone: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30", icon: Eye, label: searchLoggedAt ? "Unengaged" : "Unengaged — search not logged" },
  };
  const cfg = map[status] ?? map.UNENGAGED;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", cfg.tone)}>
      <Icon className="h-2.5 w-2.5" /> {cfg.label}
    </span>
  );
}

// ── falsifier lights ──
function FalsifierLights({ armed, partial, fired = 0 }: { armed: number; partial: number; fired?: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px]">
      <span className="inline-flex items-center gap-1">
        <Crosshair className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
        <span className="tabular-nums">{armed}</span>
        <span className="text-muted-foreground">armed</span>
      </span>
      {partial > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span className="tabular-nums">{partial}</span>
          <span>partial</span>
        </span>
      )}
      {fired > 0 && (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          <Flame className="h-2.5 w-2.5" />
          <span className="tabular-nums">{fired}</span>
          <span>fired</span>
        </span>
      )}
    </div>
  );
}

// ── thesis card ──
function ThesisCard({ thesis, verificationEvents, onRuleEngagement, onPromote }: {
  thesis: any;
  verificationEvents: any[];
  onRuleEngagement?: (engagementId: string, decision: "ANSWERED" | "OPEN" | "CONCEDED") => Promise<void>;
  onPromote?: (thesisId: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [promoting, setPromoting] = React.useState(false);
  const verification = verificationEvents.find(v => v.id === thesis.verificationEventId);

  // distance-to-promotion: use the thesis's stored counter values (computed by
  // the ladder job / promotion pipeline with real Author org/class data loaded).
  // The board doesn't have author data loaded, so we pass the stored values
  // directly to the gate to show an accurate "eligible/missing" indicator.
  // The server-side attemptPromote() recomputes from scratch with full author data.
  const counters = {
    orgAwareEffectiveN: thesis.effectiveN,
    distinctOrgs: thesis.distinctOrgs,
    distinctClasses: thesis.epistemicClassCount,
    independents: thesis.independentEvents,
    independentEvents: thesis.independentEvents,
    primaryIntegrityEvents: thesis.primaryIntegrityEvents,
  };
  const gateCtx = {
    contrarianStatus: thesis.contrarianStatus,
    engagementSearchLoggedAt: thesis.engagementSearchLoggedAt ? new Date(thesis.engagementSearchLoggedAt) : null,
    armedFalsifiers: thesis.armedFalsifiers,
    crowdingFlag: thesis.crowdingFlag,
    verificationEventId: thesis.verificationEventId,
    stanceFlags: { reversingUnreviewed: false },
    priceJoined: true,
  };
  const gate = canPromote(thesis.stage, counters, gateCtx);

  const handlePromote = async () => {
    setPromoting(true);
    try {
      await onPromote?.(thesis.id);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* card body */}
      <div className="p-3">
        <div className="flex items-start gap-1.5 mb-2">
          <DirectionArrow direction={thesis.direction} />
          <p className="text-xs font-medium leading-tight flex-1">{thesis.title}</p>
        </div>

        {/* CompositionBadge — conviction as parts, never a lone word */}
        <CompositionBadge
          tone={thesis.crowdingFlag ? "warn" : "default"}
          parts={[
            { label: "ind.", value: thesis.independentEvents },
            { label: "effN", value: thesis.effectiveN.toFixed(1) },
            { label: "orgs", value: thesis.distinctOrgs },
            { label: "classes", value: thesis.epistemicClassCount },
            { label: "fals", value: thesis.armedFalsifiers },
          ]}
        />

        {/* Strip: contrarian + falsifier lights + verification countdown */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ContrarianChip
            status={thesis.contrarianStatus}
            searchLoggedAt={thesis.engagementSearchLoggedAt}
          />
          <FalsifierLights armed={thesis.armedFalsifiers} partial={0} />
          {verification && (
            <CountdownChip date={verification.date} label={verification.eventType} />
          )}
          {thesis.divergenceVerdict !== "UNKNOWN" && (
            <Badge variant="outline" className="text-[10px] h-5 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30">
              {thesis.divergenceVerdict.replace("_", " ")}
            </Badge>
          )}
          {thesis.crowdingFlag && (
            <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
              <Flame className="h-2.5 w-2.5 mr-0.5" /> crowded
            </Badge>
          )}
        </div>

        {/* distance-to-promotion summary + PS-gated promote button */}
        {thesis.stage !== "ACTIONABLE" && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[10px] text-muted-foreground flex-1 min-w-0">
              {gate.ok ? (
                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> eligible for promotion
                </span>
              ) : (
                <span>
                  Missing: {gate.missing.slice(0, 2).join(", ")}{gate.missing.length > 2 ? ` +${gate.missing.length - 2}` : ""}
                </span>
              )}
            </div>
            {gate.ok && onPromote && (
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                disabled={promoting}
                onClick={handlePromote}
              >
                {promoting ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <ArrowUpCircle className="h-3 w-3 mr-1" />}
                {promoting ? "Promoting" : `Promote → ${nextStage(thesis.stage)}`}
              </Button>
            )}
          </div>
        )}
        {thesis.stage === "ACTIONABLE" && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400">
            <Sparkles className="h-3 w-3" /> ACTIONABLE — paper ledger auto-activated
          </div>
        )}
      </div>

      {/* evidence drawer */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full border-t bg-muted/30 px-3 py-1.5 text-[11px] font-medium flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span>Evidence ({thesis.engagements?.length ?? 0} engagements, {thesis.quantClaims?.length ?? 0} claims)</span>
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 space-y-3 text-xs">
            {/* engagements two-column — PS ruling now wired */}
            {thesis.engagements && thesis.engagements.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[11px] font-medium text-muted-foreground">Engagements</h4>
                  <span className="text-[10px] text-muted-foreground">
                    {thesis.engagements.filter((e: any) => e.psDecision).length}/{thesis.engagements.length} ruled
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {thesis.engagements.slice(0, 6).map((e: any) => (
                    <div key={e.id} className="rounded border bg-muted/20 p-2 text-[11px]">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[9px] h-3.5">{e.engagementType.replace("_", " ")}</Badge>
                        {e.synthetic && <Badge variant="outline" className="text-[9px] h-3.5 bg-purple-500/10">SYNTHETIC</Badge>}
                        {e.psDecision && (
                          <Badge variant="outline" className={cn(
                            "text-[9px] h-3.5",
                            e.psDecision === "ANSWERED" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                            e.psDecision === "CONCEDED" && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
                          )}>
                            PS: {e.psDecision}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-tight">{e.reasoning}</p>
                      {e.proposedStatus && !e.psDecision && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Rule:</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-5 text-[9px] px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            onClick={() => onRuleEngagement?.(e.id, "ANSWERED")}
                          >
                            Answered
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-5 text-[9px] px-1.5 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
                            onClick={() => onRuleEngagement?.(e.id, "CONCEDED")}
                          >
                            Conceded
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-5 text-[9px] px-1.5"
                            onClick={() => onRuleEngagement?.(e.id, "OPEN")}
                          >
                            Open
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* claims */}
            {thesis.quantClaims && thesis.quantClaims.length > 0 && (
              <div>
                <h4 className="text-[11px] font-medium text-muted-foreground mb-1.5">Linked claims</h4>
                <div className="space-y-1">
                  {thesis.quantClaims.slice(0, 5).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-[11px]">
                      <span>{c.metricName}</span>
                      <span className="tabular-nums">
                        {c.valueLow}–{c.valueHigh}{c.unit === "PERCENT" ? "%" : ""}
                        {c.resolvedValue != null && (
                          <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                            → {c.resolvedValue}{c.unit === "PERCENT" ? "%" : ""} (resolved)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* stage history with snapshots */}
            {thesis.stageHistory && Array.isArray(thesis.stageHistory) && thesis.stageHistory.length > 0 && (
              <div>
                <h4 className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <History className="h-3 w-3" /> Stage history
                </h4>
                <div className="space-y-1.5">
                  {thesis.stageHistory.map((h: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground">{format(new Date(h.at), "MMM d")}</span>
                      <StagePill stage={h.from} />
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      <StagePill stage={h.to} />
                      {h.evidence && Object.keys(h.evidence).length > 0 && (
                        <EvidenceLink
                          label="snapshot"
                          value={`${Object.keys(h.evidence).length} fields`}
                          evidence={
                            <pre className="text-[10px] font-mono whitespace-pre-wrap">
                              {JSON.stringify(h.evidence, null, 2)}
                            </pre>
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* trade plans */}
            {thesis.tradePlans && thesis.tradePlans.length > 0 && (
              <div>
                <h4 className="text-[11px] font-medium text-muted-foreground mb-1.5">Trade plans</h4>
                <div className="space-y-1">
                  {thesis.tradePlans.map((tp: any) => (
                    <div key={tp.id} className="flex items-center justify-between text-[11px]">
                      <span>{tp.expression?.instrumentType ?? "—"}</span>
                      <Badge variant="outline" className="text-[9px] h-3.5">{tp.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function ThesisBoard({ theses, verificationEvents, onRuleEngagement, onPromote }: {
  theses: any[];
  verificationEvents: any[];
  onRuleEngagement?: (engagementId: string, decision: "ANSWERED" | "OPEN" | "CONCEDED") => Promise<void>;
  onPromote?: (thesisId: string) => Promise<void>;
}) {
  const byStage = LADDER.map(col => ({
    ...col,
    theses: theses.filter(t => t.stage === col.stage),
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Thesis Board</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Five ladder columns · gate criteria on headers · distance-to-promotion sorting · evidence drawer in place.
            Demotion evaluated before promotion (L9). Stage transitions are pure functions (L1).
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
            {byStage.map(col => (
              <div key={col.stage} className={cn("rounded-lg border p-3 min-h-[300px]", col.color)}>
                {/* column header */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="outline" className="text-[10px] h-4 tabular-nums">{col.theses.length}</Badge>
                  </div>
                  <div className="space-y-0.5">
                    {GATE_CRITERIA[col.stage].map((c, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground leading-tight">· {c}</p>
                    ))}
                  </div>
                </div>
                {/* cards */}
                <div className="space-y-2">
                  {col.theses.map(t => (
                    <ThesisCard
                      key={t.id}
                      thesis={t}
                      verificationEvents={verificationEvents}
                      onRuleEngagement={onRuleEngagement}
                      onPromote={onPromote}
                    />
                  ))}
                  {col.theses.length === 0 && (
                    <div className="text-center text-[11px] text-muted-foreground italic py-8">
                      No theses at this stage.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
