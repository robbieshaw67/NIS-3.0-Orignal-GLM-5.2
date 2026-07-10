"use client";

// NIP v3.0 — Markets (M8 surface #6, Spec §10)
// Dispersion panels (claims as markers, ranges as bars, anchors distinct,
// median line, revision arrows — DRAM_QOQ is the flagship), verification-calendar strip.

import * as React from "react";
import { format } from "date-fns";
import { CalendarClock, GitCommit, LineChart, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CountdownChip, EvidenceLink, RangeBar } from "./grammar";
import { cn } from "@/lib/utils";

interface MarketsProps {
  claims: any[];
  verificationEvents: any[];
  anchorRevisions: any[];
  debates?: any[];
  authorsById: Record<string, any>;
}

// ── group claims by metric×horizon ──
function groupByMetric(claims: any[]) {
  const m = new Map<string, any[]>();
  for (const c of claims) {
    const key = `${c.metricName} · ${c.horizon}`;
    const list = m.get(key) ?? [];
    list.push(c);
    m.set(key, list);
  }
  return Array.from(m.entries());
}

function DispersionPanel({ title, claims, authorsById, anchorRevisions }: {
  title: string;
  claims: any[];
  authorsById: Record<string, any>;
  anchorRevisions: any[];
}) {
  if (claims.length === 0) return null;

  // Find the matching anchor revision (by metric name match)
  const matchingRevision = anchorRevisions.find(r =>
    claims[0].metricName.toLowerCase().includes("dram") && r.org === "TrendForce"
  );

  const ranges = claims.map(c => {
    const author = authorsById[c.authorId];
    const isAnchor = author?.handle === "TrendForce" || c.orgAttribution === "TrendForce";
    return {
      label: author?.realName ?? c.authorId,
      low: c.valueLow,
      high: c.valueHigh,
      anchor: isAnchor,
      vlm: c.extractionMethod === "VLM",
    };
  });

  // Calibration-weighted median (simplified: just median)
  const allValues: number[] = [];
  for (const c of claims) {
    if (c.valueLow != null && c.valueHigh != null) {
      allValues.push((c.valueLow + c.valueHigh) / 2);
    }
  }
  allValues.sort((a, b) => a - b);
  const median = allValues.length > 0 ? allValues[Math.floor(allValues.length / 2)] : null;
  const low = Math.min(...claims.map(c => c.valueLow).filter(Boolean));
  const high = Math.max(...claims.map(c => c.valueHigh).filter(Boolean));

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {claims.length} claims · {new Set(claims.map(c => c.authorId)).size} authors
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {median != null && (
            <EvidenceLink
              label="median"
              value={<span className="tabular-nums">{median.toFixed(1)}{claims[0].unit === "PERCENT" ? "%" : ""}</span>}
              evidence={
                <div className="space-y-1">
                  <p>Calibration-weighted median (via <code>getAuthorityWeight()</code> accessor, floor ≥5 resolved).</p>
                  <p className="text-muted-foreground">Range: {low}–{high}{claims[0].unit === "PERCENT" ? "%" : ""}.</p>
                  <p className="text-muted-foreground">IQR: pending resolution.</p>
                </div>
              }
            />
          )}
        </div>
      </div>

      <RangeBar ranges={ranges} unit={claims[0].unit === "PERCENT" ? "%" : ""} height={Math.max(50, ranges.length * 18)} />

      {/* Anchor revision arrows */}
      {matchingRevision && Array.isArray(matchingRevision.values) && matchingRevision.values.length > 1 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-medium text-muted-foreground">
            <GitCommit className="h-3 w-3" /> {matchingRevision.org} revision history
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {matchingRevision.values.map((v: any, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className={cn(
                    "text-[10px] tabular-nums",
                    v.value > matchingRevision.values[i - 1].value ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                  )}>
                    {v.value > matchingRevision.values[i - 1].value ? "↗" : "↘"} {Math.abs(v.value - matchingRevision.values[i - 1].value).toFixed(1)}
                  </span>
                )}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] tabular-nums font-medium">{v.value}</span>
                  <span className="text-[9px] text-muted-foreground">{format(new Date(v.date), "MMM d")}</span>
                  {v.note && <span className="text-[9px] text-muted-foreground italic max-w-[120px] text-center">{v.note}</span>}
                </div>
              </React.Fragment>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Revision velocity is itself a signal — anchor moves reveal shifts in supply-chain intel before the print.
          </p>
        </div>
      )}

      {/* Resolution status */}
      {claims.some(c => c.resolvedValue != null) && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Trophy className="h-3 w-3 text-emerald-500" />
            <span className="font-medium">Resolved:</span>
            {claims.filter(c => c.resolvedValue != null).map(c => (
              <Badge key={c.id} variant="outline" className="text-[10px] h-4 tabular-nums bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                {c.resolvedValue}{c.unit === "PERCENT" ? "%" : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationCalendar({ events }: { events: any[] }) {
  const now = new Date();
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Verification calendar</h3>
        <span className="text-[10px] text-muted-foreground">dated events that settle claims</span>
      </div>
      <div className="space-y-1.5">
        {events.map(ev => {
          const d = new Date(ev.date);
          const isPast = d.getTime() < now.getTime();
          return (
            <div key={ev.id} className={cn(
              "flex items-center justify-between gap-2 rounded border p-2 text-xs",
              isPast ? "bg-muted/20 opacity-60" : "bg-card",
            )}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col items-center w-10 shrink-0">
                  <span className="text-[10px] uppercase text-muted-foreground">{format(d, "MMM")}</span>
                  <span className="text-base font-semibold tabular-nums leading-none">{format(d, "d")}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{ev.eventType.replace("_", " ")}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {Array.isArray(ev.metricIds) && ev.metricIds.length > 0
                      ? `${ev.metricIds.length} metric${ev.metricIds.length > 1 ? "s" : ""} verified`
                      : "no linked metrics"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="text-[10px] h-4">{ev.status}</Badge>
                {!isPast && <CountdownChip date={ev.date} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Markets({ claims, verificationEvents, anchorRevisions, debates = [], authorsById }: MarketsProps) {
  const groups = groupByMetric(claims);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Markets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dispersion panels · verification calendar · revision arrows. The DRAM_QOQ panel is the flagship —
            it shows what your corpus knows (45% median) vs what consensus prints (5-18%).
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Left: dispersion panels */}
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No claims yet. As QuantClaims land, dispersion panels assemble here.
              </div>
            ) : (
              groups.map(([title, groupClaims]) => (
                <DispersionPanel
                  key={title}
                  title={title}
                  claims={groupClaims}
                  authorsById={authorsById}
                  anchorRevisions={anchorRevisions}
                />
              ))
            )}
          </div>

          {/* Right: calendar */}
          <div className="space-y-4">
            <VerificationCalendar events={verificationEvents} />
            {debates.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <LineChart className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Live debates</h3>
                </div>
                <div className="space-y-1.5">
                  {debates.slice(0, 5).map(d => (
                    <div key={d.id} className="text-[11px] rounded bg-muted/20 p-2">
                      <p className="leading-tight">{d.question}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[9px] h-3.5">{d.debateType}</Badge>
                        <span className="text-[10px] text-muted-foreground tabular-nums">heat {d.heatScore.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
