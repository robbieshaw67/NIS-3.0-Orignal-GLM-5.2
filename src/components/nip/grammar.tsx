"use client";

// NIP v3.0 — Component grammar (Design §7, L14)
// Reused everywhere: EvidenceLink, CompositionBadge, CauseChip, CountdownChip,
// RangeBar, StagedDecision, ReconLine.
// States designed first-class: empty, loading, degraded, stale.

import * as React from "react";
import {
  AlertTriangle, Clock, ExternalLink, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, CircleDot, Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────
// EvidenceLink — every synthesized number is a click-to-expand-in-place
// drawer to its inputs. No dead-end numbers anywhere in the app.
// ─────────────────────────────────────────────────────────────────────

export function EvidenceLink({
  label,
  value,
  evidence,
  children,
}: {
  label?: string;
  value: React.ReactNode;
  evidence?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  if (!evidence && !children) return <span className="font-medium tabular-nums">{value}</span>;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="inline">
      <CollapsibleTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums hover:bg-accent transition-colors border border-transparent hover:border-border"
          aria-expanded={open}
        >
          {label && <span className="text-muted-foreground">{label}:</span>}
          <span>{value}</span>
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="not-prose">
        <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
          {evidence ?? children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CompositionBadge — conviction/confidence always rendered as parts
// (n events · effN · orgs · classes · contrarian state), never a lone word.
// ─────────────────────────────────────────────────────────────────────

export function CompositionBadge({
  parts,
  tone = "default",
}: {
  parts: Array<{ label: string; value?: React.ReactNode; tone?: "default" | "warn" | "danger" | "good" }>;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  const toneClass = {
    default: "bg-muted text-foreground",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    danger: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  }[tone];
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 text-xs", toneClass)}>
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/40">·</span>}
          <span className="text-muted-foreground">{p.label}</span>
          {p.value !== undefined && (
            <span className={cn(
              "font-semibold tabular-nums",
              p.tone === "warn" && "text-amber-600 dark:text-amber-400",
              p.tone === "danger" && "text-red-600 dark:text-red-400",
              p.tone === "good" && "text-emerald-600 dark:text-emerald-400",
            )}>{p.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CauseChip — failures in cause language, color-coded
// RED = action needed, AMBER = silence or degradation
// ─────────────────────────────────────────────────────────────────────

export function CauseChip({
  state,
  cause,
  label,
}: {
  state: "GREEN" | "AMBER" | "RED";
  cause?: string;
  label?: string;
}) {
  const config = {
    GREEN: { color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
    AMBER: { color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30", icon: AlertCircle },
    RED:   { color: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30", icon: AlertTriangle },
  }[state];
  const Icon = config.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium", config.color)}>
            <Icon className="h-3 w-3" />
            {label ?? state}
          </span>
        </TooltipTrigger>
        {cause && (
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{cause}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CountdownChip — verification dates as clocks
// ─────────────────────────────────────────────────────────────────────

export function CountdownChip({ date, label }: { date: Date | string; label?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const days = Math.round(diffMs / 86400_000);
  const isPast = diffMs < 0;
  const tone = isPast
    ? "text-muted-foreground bg-muted border-border"
    : days <= 3
      ? "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30"
      : days <= 7
        ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
        : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums", tone)}>
      <Clock className="h-3 w-3" />
      {label && <span className="text-muted-foreground">{label}</span>}
      {isPast ? `${Math.abs(days)}d ago` : `${days}d`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// RangeBar — QuantClaims render ranges as bars, points as markers
// VLM-derived visually distinct; a [7,60]-style absurdity should LOOK absurd
// ─────────────────────────────────────────────────────────────────────

export function RangeBar({
  ranges,
  domain,
  unit = "%",
  height = 32,
  showAxis = true,
}: {
  ranges: Array<{
    label: string;
    low: number;
    high: number;
    color?: string;
    vlm?: boolean;
    anchor?: boolean;
  }>;
  domain?: [number, number];
  unit?: string;
  height?: number;
  showAxis?: boolean;
}) {
  const lows = ranges.map(r => r.low);
  const highs = ranges.map(r => r.high);
  const d: [number, number] = domain ?? [
    Math.min(...lows) - Math.ceil((Math.max(...highs) - Math.min(...lows)) * 0.1),
    Math.max(...highs) + Math.ceil((Math.max(...highs) - Math.min(...lows)) * 0.1),
  ];
  const span = d[1] - d[0] || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - d[0]) / span) * 100))}%`;

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        {/* axis ticks */}
        {showAxis && [0, 0.25, 0.5, 0.75, 1].map((t) => (
          <div key={t} className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/15"
            style={{ left: `${t * 100}%` }}>
            <span className="absolute -bottom-4 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums">
              {Math.round(d[0] + t * span)}{unit}
            </span>
          </div>
        ))}
        {/* range rows */}
        <div className="flex flex-col justify-around h-full pt-1 pb-3">
          {ranges.map((r, i) => {
            const left = pct(r.low);
            const width = `calc(${pct(r.high)} - ${pct(r.low)})`;
            return (
              <div key={i} className="relative flex items-center gap-2 text-[11px]">
                <div className="w-28 shrink-0 truncate text-muted-foreground" title={r.label}>{r.label}</div>
                <div className="relative flex-1 h-2.5 rounded-sm bg-muted/40">
                  <div
                    className={cn(
                      "absolute h-full rounded-sm",
                      r.anchor
                        ? "bg-red-500/40 border border-red-500"
                        : r.vlm
                          ? "bg-purple-500/40 border border-purple-500 border-dashed"
                          : "bg-emerald-500/40 border border-emerald-500",
                    )}
                    style={{ left, width }}
                  >
                    {r.anchor && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-red-600 text-[9px]">▲</span>}
                  </div>
                  <span className="absolute -bottom-3.5 tabular-nums" style={{ left: `calc(${left} + ${width})` }}>
                    <span className={cn("text-[10px]", r.vlm ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground")}>
                      {r.low}–{r.high}{unit}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="h-3" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StagedDecision — the PS-gate pattern: proposal + reasoning + APPROVE/OVERRIDE
// nothing effective until ruled (L10)
// ─────────────────────────────────────────────────────────────────────

export function StagedDecision({
  proposal,
  reasoning,
  status,
  onApprove,
  onOverride,
  overrideNote,
}: {
  proposal: string;
  reasoning?: string;
  status: "PENDING" | "APPROVED" | "OVERRIDDEN";
  onApprove?: () => void;
  onOverride?: () => void;
  overrideNote?: string;
}) {
  const [open, setOpen] = React.useState(false);
  if (status !== "PENDING") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
        status === "APPROVED"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      )}>
        {status === "APPROVED" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {status === "APPROVED" ? "PS approved" : "PS overridden"}
        {overrideNote && <span className="text-muted-foreground">— {overrideNote}</span>}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
            <CircleDot className="h-3 w-3" /> Staged — awaiting PS ruling
          </div>
          <p className="mt-1 text-foreground">{proposal}</p>
          {reasoning && <p className="mt-1 text-muted-foreground"><Info className="inline h-3 w-3" /> {reasoning}</p>}
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              Rule {open ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronRight className="ml-1 h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onApprove}>
                <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" onClick={onOverride}>
                <XCircle className="mr-1 h-3 w-3" /> Override
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ReconLine — any surfaced count that moved shows opening → delta → closing
// on hover (L12)
// ─────────────────────────────────────────────────────────────────────

export function ReconLine({
  opening,
  delta,
  closing,
  label,
  deltaNote,
}: {
  opening: number;
  delta: number;
  closing: number;
  label: string;
  deltaNote?: string;
}) {
  const deltaTone = delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{closing}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-muted-foreground">{opening}</span>
            <span className={deltaTone}>{delta > 0 ? "+" : ""}{delta}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold">{closing}</span>
          </div>
          {deltaNote && <p className="mt-1 text-muted-foreground">{deltaNote}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ExternalLink — link to the original content (always)
// ─────────────────────────────────────────────────────────────────────

export function OriginalLink({ url, label = "Original" }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <ExternalLink className="h-3 w-3" /> {label}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StagePill — ladder stage with tone
// ─────────────────────────────────────────────────────────────────────

export function StagePill({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    OBSERVATION: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
    HYPOTHESIS:  "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    VALIDATED:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    ACTIONABLE:  "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", map[stage] ?? map.OBSERVATION)}>
      {stage}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DirectionArrow — bullish/bearish/neutral with arrow
// ─────────────────────────────────────────────────────────────────────

export function DirectionArrow({ direction, size = 14 }: { direction: string; size?: number }) {
  const map: Record<string, { color: string; sym: string }> = {
    BULLISH: { color: "text-emerald-600 dark:text-emerald-400", sym: "▲" },
    BEARISH: { color: "text-red-600 dark:text-red-400", sym: "▼" },
    NEUTRAL: { color: "text-muted-foreground", sym: "◆" },
  };
  const cfg = map[direction] ?? map.NEUTRAL;
  return <span className={cfg.color} style={{ fontSize: size }}>{cfg.sym}</span>;
}

// ─────────────────────────────────────────────────────────────────────
// AuthorChip — handle + real name + class + org chips
// ─────────────────────────────────────────────────────────────────────

const EPISTEMIC_CLASS_TONE: Record<string, string> = {
  CHANNEL_PRIMARY:    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  ACCESS_ANALYST:     "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  MODEL_BUILDER:      "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  POSITIONED_MANAGER: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  SYNTHESIZER:        "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30",
  UNRESOLVED:         "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export function AuthorChip({
  handle,
  realName,
  epistemicClass,
  orgAffiliation,
  avatarColor,
  size = "default",
}: {
  handle: string;
  realName?: string;
  epistemicClass?: string;
  orgAffiliation?: string | null;
  avatarColor?: string;
  size?: "sm" | "default";
}) {
  const sz = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={cn("shrink-0 rounded-full flex items-center justify-center text-white font-semibold", sz)}
        style={{ backgroundColor: avatarColor ?? "#64748b" }}
      >
        {(realName ?? handle).slice(0, 1).toUpperCase()}
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium">{realName ?? handle}</span>
          <span className="text-[10px] text-muted-foreground">@{handle}</span>
        </div>
        <div className="flex items-center gap-1">
          {epistemicClass && (
            <span className={cn("rounded border px-1 text-[9px] font-medium uppercase tracking-wide", EPISTEMIC_CLASS_TONE[epistemicClass] ?? EPISTEMIC_CLASS_TONE.UNRESOLVED)}>
              {epistemicClass.replace("_", " ")}
            </span>
          )}
          {orgAffiliation && (
            <span className="text-[10px] text-muted-foreground">{orgAffiliation}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EmptyState — "nothing needs you today" rendered literally
// ─────────────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  icon: Icon = CheckCircle2,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>}
    </div>
  );
}
