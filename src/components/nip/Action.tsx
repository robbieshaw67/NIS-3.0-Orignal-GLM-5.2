"use client";

// NIP v3.0 — ROOM 4: Action (M7 trade layer)
// Expressions, TradePlan (fully deterministic), Narrative family caps,
// Paper ledger, Risk/stress table.
// L1: prices only from priceSource ∈ {market-data, manual} — no third value.

import * as React from "react";
import { format } from "date-fns";
import {
  TrendingUp, BookOpen, AlertOctagon, Layers, Activity, Wallet,
  Target, Shield, Calculator,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EvidenceLink, StagePill, DirectionArrow, CompositionBadge } from "./grammar";
import { cn } from "@/lib/utils";

interface ActionProps {
  tradePlans: any[];
  expressions: any[];
  families: any[];
  theses: any[];
  auditLog?: any[];
}

// ── TradePlan card — fully deterministic, every plan reproducible ──
function TradePlanCard({ plan, thesis }: { plan: any; thesis?: any }) {
  const expr = plan.expression;
  const isPaper = plan.positions?.some((p: any) => p.ledgerType === "PAPER");
  const isActual = plan.positions?.some((p: any) => p.ledgerType === "ACTUAL");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <DirectionArrow direction={thesis?.direction ?? "NEUTRAL"} />
            <span className="text-sm font-semibold">{expr?.instrumentType ?? "—"}</span>
            {expr && (
              <Badge variant="outline" className="text-[10px] h-4">
                beta {expr.thesisBeta}
              </Badge>
            )}
          </div>
          {thesis && (
            <p className="text-[11px] text-muted-foreground leading-tight">{thesis.title.slice(0, 80)}…</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="text-[10px] h-4">{plan.status}</Badge>
          {isPaper && <Badge variant="outline" className="text-[10px] h-4 bg-blue-500/10 text-blue-700 dark:text-blue-400">PAPER</Badge>}
          {isActual && <Badge variant="outline" className="text-[10px] h-4 bg-amber-500/10 text-amber-700 dark:text-amber-400">ACTUAL</Badge>}
        </div>
      </div>

      {/* The deterministic plan table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <PlanCell
          label="Entry"
          value={plan.entryLow && plan.entryHigh ? `${plan.entryLow}–${plan.entryHigh}` : "—"}
          sub={`± 0.5×ATR`}
          icon={Target}
        />
        <PlanCell
          label="Stop"
          value={plan.stopPrice ? plan.stopPrice.toFixed(2) : "—"}
          sub={`max(2×ATR, corpus)`}
          icon={Shield}
          tone="danger"
        />
        <PlanCell
          label="Target"
          value={plan.targetBase ? `${plan.targetBase}${plan.targetBull ? ` / ${plan.targetBull}` : ""}` : "—"}
          sub={`QuantClaim | R-mult`}
          icon={TrendingUp}
          tone="good"
        />
        <PlanCell
          label="ATR"
          value={plan.atrValue?.toFixed(2) ?? "—"}
          sub={`risk/unit ${plan.riskPerUnit?.toFixed(2) ?? "—"}`}
          icon={Activity}
        />
      </div>

      {/* L1: priceSource ∈ {market-data, manual} — no third value, ever */}
      <div className="mt-3 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">priceSource:</span>
          <EvidenceLink
            value={<Badge variant="outline" className="text-[10px] h-4 font-mono">{plan.priceSource}</Badge>}
            label="L1"
            evidence={
              <div className="space-y-1">
                <p><strong>L1 — Language from the model, numbers from math, judgment from PS.</strong></p>
                <p className="text-muted-foreground">priceSource ∈ {'{'} market-data, manual {'}'} — no third value. The regex-price path that produced the MU-$1 bug (+17,900% upside) is killed by this constraint at the type level.</p>
                {plan.priceAsOfDate && (
                  <p className="text-muted-foreground">As of: {format(new Date(plan.priceAsOfDate), "MMM d, yyyy")}</p>
                )}
              </div>
            }
          />
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">constructionLog:</span>
          <EvidenceLink
            value={<span className="text-primary underline-offset-2 hover:underline">{Object.keys(plan.constructionLog ?? {}).length} rules</span>}
            evidence={
              <pre className="text-[10px] font-mono whitespace-pre-wrap">
                {JSON.stringify(plan.constructionLog, null, 2)}
              </pre>
            }
          />
        </div>
        {plan.falsifierStopIds?.length > 0 && (
          <Badge variant="outline" className="text-[10px] h-4 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
            <AlertOctagon className="h-2.5 w-2.5 mr-0.5" />
            {plan.falsifierStopIds.length} falsifier stop{plan.falsifierStopIds.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Positions / paper ledger */}
      {plan.positions && plan.positions.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> Positions ({plan.positions.length})
          </div>
          <div className="space-y-1">
            {plan.positions.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-[11px] rounded bg-muted/30 px-2 py-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] h-3.5">{p.ledgerType}</Badge>
                  <span className="tabular-nums">{p.entryPrice} × {p.units}u</span>
                  <span className="text-muted-">@ {format(new Date(p.entryDate), "MMM d")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">{p.riskR}R</span>
                  {p.rMultiple != null && (
                    <Badge variant="outline" className={cn("text-[9px] h-3.5 tabular-nums", p.rMultiple >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400")}>
                      {p.rMultiple >= 0 ? "+" : ""}{p.rMultiple.toFixed(2)}R
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCell({
  label, value, sub, icon: Icon, tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "good" | "danger";
}) {
  return (
    <div className="rounded border bg-muted/20 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className={cn(
        "mt-0.5 font-semibold tabular-nums",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
        tone === "danger" && "text-red-600 dark:text-red-400",
      )}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Narrative family caps ──
function FamilyCaps({ families, theses }: { families: any[]; theses: any[] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Narrative family caps</h3>
      </div>
      <div className="space-y-2">
        {families.map(f => {
          const ids = (f.thesisIds as any[]) ?? [];
          const linked = theses.filter(t => ids.includes(t.id));
          return (
            <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {linked.length} thesis{linked.length !== 1 ? "es" : ""}: {linked.map(t => t.stage).join(", ") || "none"}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">cap</span>
                <Badge variant="outline" className="text-[10px] h-4 tabular-nums bg-amber-500/5">
                  <Wallet className="h-2.5 w-2.5 mr-0.5" />{f.riskCapR}R
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
      <Separator className="my-3" />
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        MU + Hynix proxies + equipment share one budget. Breach rejected with the arithmetic shown (Spec §9).
      </p>
    </div>
  );
}

// ── Stress table — deterministic traversal of falsifier→thesis→plan→position ──
function StressTable({ tradePlans }: { tradePlans: any[] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Stress table</h3>
        <Badge variant="outline" className="text-[10px] h-4">deterministic</Badge>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">
        Traversal of falsifier → thesis → plan → position with event-family grouping. Same-trigger falsifiers grouped.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-[10px] text-muted-foreground border-b">
              <th className="py-1.5 pr-2">Family</th>
              <th className="py-1.5 pr-2">Plan</th>
              <th className="py-1.5 pr-2 text-right">Risk</th>
              <th className="py-1.5 pr-2 text-right">Stop</th>
              <th className="py-1.5 text-right">Consequence</th>
            </tr>
          </thead>
          <tbody>
            {tradePlans.map(tp => (
              <tr key={tp.id} className="border-b last:border-0">
                <td className="py-1.5 pr-2">
                  <Badge variant="outline" className="text-[9px] h-3.5">{(tp.falsifierStopIds as any[])?.[0] ?? "—"}</Badge>
                </td>
                <td className="py-1.5 pr-2">
                  <span className="font-mono text-[10px]">{tp.expression?.instrumentType}</span>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{tp.riskPerUnit?.toFixed(2)}R</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{tp.stopPrice?.toFixed(2)}</td>
                <td className="py-1.5 text-right">
                  <Badge variant="outline" className="text-[9px] h-3.5 bg-red-500/10 text-red-700 dark:text-red-400">
                    EXIT_REVIEW
                  </Badge>
                </td>
              </tr>
            ))}
            {tradePlans.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-muted-foreground italic">No armed plans.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ActionSurface({ tradePlans, expressions, families, theses }: ActionProps) {
  const plansByThesis = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of tradePlans) {
      const list = m.get(p.thesisId) ?? [];
      list.push(p);
      m.set(p.thesisId, list);
    }
    return m;
  }, [tradePlans]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Action</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trade layer (M7). Expressions ranked, PS picks. TradePlan fully deterministic.
            Paper ledger activates on first ACTIONABLE. Narrative family caps enforced.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 max-w-7xl mx-auto space-y-4">
          {/* Top metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBox label="Trade plans" value={tradePlans.length} sub={`${tradePlans.filter(p => p.status === "ARMED").length} armed`} />
            <MetricBox label="Expressions" value={expressions.length} sub="ranked candidates" />
            <MetricBox label="Families" value={families.length} sub={`${families.reduce((s, f) => s + (f.riskCapR ?? 0), 0).toFixed(1)}R total cap`} />
            <MetricBox label="Paper positions" value={tradePlans.reduce((s, p) => s + (p.positions?.length ?? 0), 0)} sub="auto on ACTIONABLE" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            {/* Trade plans */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Trade plans</h3>
                <CompositionBadge
                  parts={[
                    { label: "L1", value: "enforced" },
                    { label: "priceSource", value: "manual|market-data" },
                  ]}
                  tone="good"
                />
              </div>
              {tradePlans.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No trade plans yet. The first plan activates when a thesis reaches ACTIONABLE.
                </div>
              ) : (
                tradePlans.map(p => (
                  <TradePlanCard key={p.id} plan={p} thesis={theses.find(t => t.id === p.thesisId)} />
                ))
              )}
            </div>

            {/* Side rail */}
            <div className="space-y-4">
              <FamilyCaps families={families} theses={theses} />
              <StressTable tradePlans={tradePlans} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
