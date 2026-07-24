"use client";

// NIP v3.0 — Authors surface (M8 surface #4, Spec §10)
// Class + org clustering (the Citrini trio renders as one shop), calibration
// counters, stance sparklines, read-first rank, book-talk indicator.

import * as React from "react";
import {
  TrendingUp, TrendingDown, Award, BookMarked, Users2, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthorChip, CompositionBadge, DirectionArrow, EvidenceLink } from "./grammar";
import { getAuthorityWeight, hasAuthorityFloor } from "@/lib/author";
import { cn } from "@/lib/utils";

interface AuthorsProps {
  authors: any[];
}

// ── stance sparkline (simple inline SVG) ──
function StanceSparkline({ values, width = 80, height = 20 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <span className="text-[10px] text-muted-foreground italic">—</span>;
  }
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const tone = values[values.length - 1] > values[0] ? "#10b981" : values[values.length - 1] < values[0] ? "#ef4444" : "#64748b";
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.5" />
    </svg>
  );
}

// ── group authors by org (the Citrini trio renders as one shop) ──
function groupByOrg(authors: any[]) {
  const m = new Map<string, any[]>();
  for (const a of authors) {
    const org = a.orgAffiliation ?? "Independent";
    const list = m.get(org) ?? [];
    list.push(a);
    m.set(org, list);
  }
  return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
}

function AuthorCard({ author }: { author: any }) {
  const stances = author.stances ?? [];
  const changes = author.stanceChanges ?? [];
  const stanceValues = [0.5, ...stances.map((s: any) => (s.rollingDirection + 1) / 2)]; // normalize -1..1 to 0..1
  const isBookTalk = author.epistemicClass === "POSITIONED_MANAGER";
  const isSynthesizer = author.epistemicClass === "SYNTHESIZER";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <AuthorChip
          handle={author.handle}
          realName={author.realName}
          epistemicClass={author.epistemicClass}
          orgAffiliation={author.orgAffiliation}
          avatarColor={author.avatarColor}
        />
        {(isBookTalk || isSynthesizer) && (
          <Badge variant="outline" className="text-[10px] h-4 bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30">
            <BookMarked className="h-2.5 w-2.5 mr-0.5" />
            {isBookTalk ? "book-talk" : "read-second"}
          </Badge>
        )}
      </div>

      {author.bio && (
        <p className="text-[11px] text-muted-foreground leading-snug mb-3">{author.bio}</p>
      )}

      {/* Calibration counters */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="rounded bg-muted/20 p-2">
          <div className="text-[10px] text-muted-foreground">Forecasts</div>
          <div className="font-semibold tabular-nums">{author.forecastsMade}</div>
        </div>
        <div className="rounded bg-muted/20 p-2">
          <div className="text-[10px] text-muted-foreground">Resolved</div>
          <div className="font-semibold tabular-nums">{author.forecastsResolved}</div>
        </div>
        <div className="rounded bg-muted/20 p-2">
          <div className="text-[10px] text-muted-foreground">Correct</div>
          <div className="font-semibold tabular-nums">{author.forecastsCorrect}</div>
        </div>
      </div>

      {/* Authority weight — readable ONLY via the ≥5-resolved floor accessor */}
      <CompositionBadge
        tone="default"
        parts={[
          { label: "authorityWeight", value: getAuthorityWeight(author).toFixed(2), tone: hasAuthorityFloor(author) ? "good" : "warn" },
          ...(author.brierScore != null ? [{ label: "Brier", value: author.brierScore.toFixed(2) }] : []),
        ]}
      />
      {!hasAuthorityFloor(author) && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
          Floor rule: ≥5 resolved required (has {author.forecastsResolved}). Readable via accessor only.
        </p>
      )}

      {/* Stance sparklines */}
      {stances.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Stance per family (rolling, decay ~45d)</div>
          <div className="space-y-1">
            {stances.map((s: any) => {
              const relatedChange = changes.find((c: any) => c.narrativeFamily === s.narrativeFamily);
              const sparkVals = [s.rollingDirection - 0.1, s.rollingDirection, s.rollingDirection + 0.05, s.rollingDirection];
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <DirectionArrow direction={s.rollingDirection > 0 ? "BULLISH" : s.rollingDirection < 0 ? "BEARISH" : "NEUTRAL"} size={10} />
                    <span className="truncate">{s.narrativeFamily}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StanceSparkline values={sparkVals} />
                    {relatedChange && (
                      <Badge variant="outline" className={cn("text-[9px] h-3.5", relatedChange.changeType === "REVERSING" && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30")}>
                        {relatedChange.changeType}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                      {s.rollingDirection > 0 ? "+" : ""}{s.rollingDirection.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insight count */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{stances.reduce((s: number, st: any) => s + st.insightCount, 0)} insights</span>
        {author.mergedInto && (
          <Badge variant="outline" className="text-[9px] h-3.5 bg-slate-500/10">
            merged → @{author.mergedInto}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function Authors({ authors }: AuthorsProps) {
  const [search, setSearch] = React.useState("");
  const [classFilter, setClassFilter] = React.useState<string>("all");

  // Get all epistemic classes for the filter
  const allClasses = React.useMemo(() => {
    const s = new Set<string>();
    for (const a of authors) {
      if (a.epistemicClass) s.add(a.epistemicClass);
    }
    return Array.from(s).sort();
  }, [authors]);

  const filtered = React.useMemo(() => {
    let list = authors;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.handle?.toLowerCase().includes(q) ||
        a.realName?.toLowerCase().includes(q) ||
        a.orgAffiliation?.toLowerCase().includes(q) ||
        a.bio?.toLowerCase().includes(q)
      );
    }
    if (classFilter !== "all") {
      list = list.filter(a => a.epistemicClass === classFilter);
    }
    return list;
  }, [authors, search, classFilter]);

  const grouped = groupByOrg(filtered);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Authors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Class + org clustering (the Citrini trio renders as one shop). Calibration counters.
            Stance sparklines. Book-talk discount. Read-first rank.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 max-w-7xl mx-auto space-y-4">
          {/* Search + filter controls */}
          <div className="flex items-center gap-2 sticky top-0 bg-card/80 backdrop-blur z-10 pb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by handle, name, org, or bio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={classFilter === "all" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setClassFilter("all")}
              >
                All ({authors.length})
              </Button>
              {allClasses.map(cls => (
                <Button
                  key={cls}
                  size="sm"
                  variant={classFilter === cls ? "default" : "outline"}
                  className="h-7 text-[10px] px-2"
                  onClick={() => setClassFilter(cls)}
                >
                  {cls.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div className="text-[10px] text-muted-foreground">
            {filtered.length} of {authors.length} authors
            {search && ` matching "${search}"`}
            {classFilter !== "all" && ` in class ${classFilter}`}
          </div>

          {/* Author cards grouped by org */}
          {grouped.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No authors match this filter.
            </div>
          ) : (
            grouped.map(([org, group]) => (
              <div key={org}>
                <div className="flex items-center gap-2 mb-2">
                  <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{org}</h3>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {group.length} author{group.length > 1 ? "s" : ""}
                  </Badge>
                  {group.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      · same org → never independent of each other (L5)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map(a => (
                    <AuthorCard key={a.id} author={a} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
