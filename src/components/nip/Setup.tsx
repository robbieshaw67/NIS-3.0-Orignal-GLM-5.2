"use client";

// NIP v2.x — ROOM 0: Setup (Source Registry)
// The front door — where you constitute the ecosystem.
// One card per person/organization with all media identities, epistemic class,
// org affiliation, per-source health metrics, pause/resume controls.

import * as React from "react";
import { format } from "date-fns";
import {
  Users2, Rss, Mic2, Twitter, Anchor, Search, Pause, Play,
  Plus, ShieldCheck, Activity, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthorChip, CauseChip, EvidenceLink } from "./grammar";
import { SourceListManager } from "./SourceListManager";
import { cn } from "@/lib/utils";

interface SetupProps {
  authors: any[];
}

type MediaTab = "all" | "x" | "rss" | "channels" | "anchors";

function SourceCard({ author }: { author: any }) {
  // Author table has no 'active' column — default to not paused (active)
  // Only show paused if explicitly set via SourceList toggle
  const [paused, setPaused] = React.useState(false);

  const togglePause = async () => {
    const newActive = paused; // if currently paused, we want to resume (active=true)
    try {
      // Find the matching SourceList entry by handle (best-effort)
      const r = await fetch(`/api/sources/list?type=X`);
      const data = await r.json();
      const match = (data.sources || []).find((s: any) =>
        s.handle === author.handle || s.handle === `@${author.handle}`
      );
      if (match) {
        await fetch("/api/sources/list", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: match.id, active: newActive }),
        });
      }
      setPaused(!newActive);
    } catch {
      // Fallback: just toggle local state
      setPaused(!paused);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <AuthorChip
          handle={author.handle}
          realName={author.realName}
          epistemicClass={author.epistemicClass}
          orgAffiliation={author.orgAffiliation}
          avatarColor={author.avatarColor}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={togglePause}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </Button>
      </div>

      {author.bio && (
        <p className="text-[11px] text-muted-foreground mb-2">{author.bio}</p>
      )}

      {/* Media identities */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {author.handle && (
          <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
            <Twitter className="h-2.5 w-2.5" /> @{author.handle}
          </Badge>
        )}
        {author.cluster && author.cluster !== "" && (
          <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
            <Rss className="h-2.5 w-2.5" /> {author.cluster}
          </Badge>
        )}
      </div>

      {/* Health metrics */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        <div className="rounded bg-muted/20 p-1.5 text-center">
          <div className="text-muted-foreground">Forecasts</div>
          <div className="font-semibold tabular-nums">{author.forecastsMade ?? 0}</div>
        </div>
        <div className="rounded bg-muted/20 p-1.5 text-center">
          <div className="text-muted-foreground">Resolved</div>
          <div className="font-semibold tabular-nums">{author.forecastsResolved ?? 0}</div>
        </div>
        <div className="rounded bg-muted/20 p-1.5 text-center">
          <div className="text-muted-foreground">Correct</div>
          <div className="font-semibold tabular-nums">{author.forecastsCorrect ?? 0}</div>
        </div>
        <div className="rounded bg-muted/20 p-1.5 text-center">
          <div className="text-muted-foreground">Calib.</div>
          <div className="font-semibold tabular-nums">{Math.round((author.calibrationScore ?? 0.5) * 100)}%</div>
        </div>
      </div>

      {paused && (
        <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Pause className="h-2.5 w-2.5" /> Paused — not fetching
        </div>
      )}
    </div>
  );
}

export function Setup({ authors }: SetupProps) {
  const [search, setSearch] = React.useState("");
  const [mediaTab, setMediaTab] = React.useState<MediaTab>("all");

  const filtered = React.useMemo(() => {
    let list = authors;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.handle?.toLowerCase().includes(q) ||
        a.realName?.toLowerCase().includes(q) ||
        a.orgAffiliation?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [authors, search]);

  const grouped = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of filtered) {
      const org = a.orgAffiliation ?? "Independent";
      const list = m.get(org) ?? [];
      list.push(a);
      m.set(org, list);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Setup <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">[v3.1]</span></h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Source registry — manage your analyst ecosystem. One card per person/org with all media identities,
            epistemic class, health metrics, and pause/resume controls.
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-7xl mx-auto space-y-4">
          {/* Source List Manager — add/remove/toggle sources from the registry */}
          <SourceListManager />

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by handle, name, or org…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "x", "rss", "channels", "anchors"] as MediaTab[]).map(tab => (
                <Button
                  key={tab}
                  size="sm"
                  variant={mediaTab === tab ? "default" : "outline"}
                  className="h-7 text-xs capitalize"
                  onClick={() => setMediaTab(tab)}
                >
                  {tab}
                </Button>
              ))}
            </div>
          </div>

          {/* Discovery candidates */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium">Discovery loop candidates</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Handles cited ≥3× by ingested content arrive here for PS admission. Nothing auto-admits (L10).
            </p>
          </div>

          {/* Source cards grouped by org */}
          {grouped.map(([org, group]) => (
            <div key={org}>
              <div className="flex items-center gap-2 mb-2">
                <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{org}</h3>
                <Badge variant="outline" className="text-[10px] h-4">{group.length}</Badge>
                {group.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    · same org → never independent (L5)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.map(a => (
                  <SourceCard key={a.id} author={a} />
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              No sources match this filter.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
