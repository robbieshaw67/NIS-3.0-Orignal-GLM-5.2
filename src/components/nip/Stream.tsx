"use client";

// NIP v3.0 — ROOM 1: The Stream
// Native content feed with span highlights + margin chips + saved views.
// Mobile-first — this is the surface that must be excellent on a phone.

import * as React from "react";
import { format } from "date-fns";
import {
  Rss, FileText, Image as ImageIcon, Mic2, Anchor, Filter, Search,
  Bookmark, Hash, MessageSquare, TrendingUp, AlertCircle, Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthorChip, CompositionBadge, DirectionArrow, OriginalLink } from "./grammar";
import { cn } from "@/lib/utils";

type RawContentT = any;
type SourceT = any;
type AuthorT = any;

interface StreamProps {
  rawContents: RawContentT[];
  authors: AuthorT[];
}

const SAVED_VIEWS = [
  { id: "morning",   label: "Morning read", filter: (r: RawContentT) => isLast24h(r.fetchedAt) && r.adapterType !== "MANUAL" },
  { id: "anchors",   label: "Anchors only", filter: (r: RawContentT) => r.adapterType === "ANCHOR" },
  { id: "claims",    label: "Has claim",    filter: (r: RawContentT) => r.sources?.some((s: SourceT) => s.quantClaims?.length > 0) },
  { id: "debates",   label: "Has stance event", filter: (r: RawContentT) => r.sources?.some((s: SourceT) => s.direction !== "NEUTRAL") },
  { id: "all",       label: "All",          filter: () => true },
];

function isLast24h(d: Date | string) {
  return Date.now() - new Date(d).getTime() < 24 * 60 * 60 * 1000;
}

function AdapterIcon({ type }: { type: string }) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    X: Hash, RSS: Rss, TRANSCRIPT: Mic2, ANCHOR: Anchor, IMAGE: ImageIcon, MANUAL: FileText,
  };
  const Icon = map[type] ?? FileText;
  return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
}

function AnnotatedBody({ raw, sources }: { raw: RawContentT; sources: SourceT[] }) {
  const [activeSpan, setActiveSpan] = React.useState<string | null>(null);
  if (!raw.bodyText) {
    return <p className="text-xs text-muted-foreground italic">No stored text — extraction only.</p>;
  }
  const spans = (sources ?? [])
    .filter(s => s.spanStart != null && s.spanEnd != null)
    .sort((a, b) => a.spanStart - b.spanStart);

  if (spans.length === 0) {
    return <p className="text-sm whitespace-pre-wrap">{raw.bodyText}</p>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.spanStart > cursor) {
      parts.push(<span key={`t${i}`}>{raw.bodyText.slice(cursor, s.spanStart)}</span>);
    }
    const isActive = activeSpan === s.id;
    parts.push(
      <mark
        key={`s${i}`}
        onClick={() => setActiveSpan(isActive ? null : s.id)}
        className={cn(
          "cursor-pointer rounded px-0.5 transition-colors",
          s.direction === "BULLISH" && "bg-emerald-500/20 hover:bg-emerald-500/40",
          s.direction === "BEARISH" && "bg-red-500/20 hover:bg-red-500/40",
          s.direction === "NEUTRAL" && "bg-blue-500/20 hover:bg-blue-500/40",
          isActive && "ring-2 ring-offset-1 ring-primary",
        )}
      >
        {raw.bodyText.slice(s.spanStart, s.spanEnd)}
      </mark>
    );
    cursor = s.spanEnd;
  });
  if (cursor < raw.bodyText.length) {
    parts.push(<span key="end">{raw.bodyText.slice(cursor)}</span>);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{parts}</p>
      {activeSpan && (() => {
        const s = spans.find(x => x.id === activeSpan);
        if (!s) return null;
        return (
          <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <DirectionArrow direction={s.direction} />
                <span>{s.insightType}</span>
                <Badge variant="outline" className="text-[10px] h-4">{s.confidence}</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">{s.extractionVersion}</span>
            </div>
            <p className="italic"><Quote className="inline h-3 w-3 mr-1" />{s.verbatimQuote}</p>
            <p className="text-foreground">{s.keyInsight}</p>
            <CompositionBadge
              tone="default"
              parts={[
                { label: "conviction", value: s.conviction },
                { label: "ind.", value: s.independenceClass },
                ...(s.carrierAuthorId ? [{ label: "carrier", value: "≠ speaker" }] : []),
              ]}
            />
            {s.quantClaims?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.quantClaims.map((q: any) => (
                  <Badge key={q.id} variant="secondary" className="text-[10px] tabular-nums">
                    {q.metricName}: {q.valueLow}–{q.valueHigh}{q.unit === "PERCENT" ? "%" : ` ${q.unit}`}
                  </Badge>
                ))}
              </div>
            )}
            {s.informationEvent && (
              <p className="text-muted-foreground text-[11px]">
                Event: {s.informationEvent.canonicalTitle} · {s.informationEvent.independentCount} independent
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function MarginChips({ raw, sources }: { raw: RawContentT; sources: SourceT[] }) {
  const eventCount = new Set(sources.filter(s => s.informationEventId).map(s => s.informationEventId)).size;
  const hasClaim = sources.some(s => s.quantClaims?.length > 0);
  const hasStanceChange = sources.some(s => s.direction !== "NEUTRAL");
  return (
    <div className="flex flex-wrap gap-1.5">
      {eventCount > 0 && (
        <Badge variant="outline" className="text-[10px] h-5 gap-1">
          <MessageSquare className="h-2.5 w-2.5" />
          {eventCount} event{eventCount > 1 ? "s" : ""}
        </Badge>
      )}
      {hasClaim && (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-amber-500/5">
          <Hash className="h-2.5 w-2.5" />has claim
        </Badge>
      )}
      {hasStanceChange && (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-blue-500/5">
          <TrendingUp className="h-2.5 w-2.5" />stance event
        </Badge>
      )}
      {raw.adapterType === "ANCHOR" && (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
          <Anchor className="h-2.5 w-2.5" />anchor
        </Badge>
      )}
      {sources.length === 0 && (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 text-muted-foreground">
          <AlertCircle className="h-2.5 w-2.5" />untriaged
        </Badge>
      )}
    </div>
  );
}

function StreamCard({ raw, authorsById }: { raw: RawContentT; authorsById: Record<string, AuthorT> }) {
  const sources = raw.sources ?? [];
  const firstAuthorId = sources[0]?.authorId;
  const carrierAuthorId = sources[0]?.carrierAuthorId;
  const author = firstAuthorId ? authorsById[firstAuthorId] : null;
  const carrier = carrierAuthorId ? authorsById[carrierAuthorId] : null;

  return (
    <article className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <AdapterIcon type={raw.adapterType} />
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
          {carrier && (
            <span className="text-[10px] text-muted-foreground">
              via <span className="font-medium">@{carrier.handle}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
          <span>{format(new Date(raw.fetchedAt), "MMM d, HH:mm")}</span>
          {raw.threadId && <Badge variant="outline" className="text-[10px] h-4">thread</Badge>}
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-1.5 leading-tight">{raw.title}</h3>
      <AnnotatedBody raw={raw} sources={sources} />
      <div className="mt-3">
        <MarginChips raw={raw} sources={sources} />
      </div>
      <div className="mt-3 pt-2 border-t flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wide">{raw.adapterType}</span>
          {raw.extractionStatus !== "EXTRACTED" && (
            <Badge variant="outline" className="text-[10px] h-4 bg-amber-500/5">{raw.extractionStatus}</Badge>
          )}
          {sources.length > 0 && (
            <span>{sources.length} extraction{sources.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <OriginalLink url={raw.url} />
      </div>
    </article>
  );
}

export function Stream({ rawContents, authors }: StreamProps) {
  const [view, setView] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const authorsById = React.useMemo(() => {
    const m: Record<string, AuthorT> = {};
    for (const a of authors) m[a.id] = a;
    return m;
  }, [authors]);

  const filtered = React.useMemo(() => {
    const v = SAVED_VIEWS.find(v => v.id === view) ?? SAVED_VIEWS[SAVED_VIEWS.length - 1];
    let list = rawContents.filter(v.filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.bodyText?.toLowerCase().includes(q) ||
        r.sources?.some((s: any) => s.verbatimQuote?.toLowerCase().includes(q) || s.keyInsight?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rawContents, view, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search verbatim text, insights…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {SAVED_VIEWS.map(v => (
              <Button
                key={v.id}
                size="sm"
                variant={view === v.id ? "default" : "outline"}
                className="h-7 text-xs shrink-0"
                onClick={() => setView(v.id)}
              >
                {v.id === "morning" && <Bookmark className="mr-1 h-3 w-3" />}
                {v.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-3 max-w-3xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No content matches this view.
            </div>
          ) : (
            filtered.map((raw, i) => {
              const prev = filtered[i - 1];
              const showDaySeparator = !prev || !sameDay(prev.fetchedAt, raw.fetchedAt);
              return (
                <React.Fragment key={raw.id}>
                  {showDaySeparator && (
                    <div className="flex items-center gap-2 my-4 first:mt-0">
                      <div className="h-px bg-border flex-1" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        {format(new Date(raw.fetchedAt), "EEEE, MMM d")}
                      </span>
                      <div className="h-px bg-border flex-1" />
                    </div>
                  )}
                  <StreamCard raw={raw} authorsById={authorsById} />
                </React.Fragment>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function sameDay(a: Date | string, b: Date | string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
