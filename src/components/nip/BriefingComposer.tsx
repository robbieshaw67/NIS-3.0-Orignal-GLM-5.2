"use client";

// NIP v2.x — ROOM 0.5: Briefing Composer
// Synthesize audited intelligence into a written narrative.
// Prose layer only — no new analysis, no LLM judgment, no gate-making.

import * as React from "react";
import {
  FileText, Sparkles, Search, Calendar, Download, RefreshCw,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SimpleMarkdown } from "./SimpleMarkdown";

const TEMPLATES = [
  { id: "daily-standup", label: "Daily Standup", desc: "What I missed in 24–48h", prose: "fast" },
  { id: "debate-briefing", label: "Debate Briefing", desc: "Focused disagreement", prose: "analytical" },
  { id: "thesis-update", label: "Thesis Update", desc: "Status of one or a few ideas", prose: "structured" },
  { id: "topic-deepdive", label: "Topic Deep-Dive", desc: "Indium phosphate, memory capex, etc.", prose: "analytical" },
  { id: "custom", label: "Custom", desc: "User writes the brief", prose: "custom" },
] as const;

const PROSE_STYLES = [
  { id: "fast", label: "Fast", desc: "Bloomberg terminal, 300-400 words" },
  { id: "analytical", label: "Analytical", desc: "WSJ op-ed, 600-900 words" },
  { id: "structured", label: "Structured", desc: "Investment memo, 400-600 words" },
  { id: "custom", label: "Custom", desc: "Respect user's structure" },
] as const;

export function BriefingComposer() {
  const [template, setTemplate] = React.useState<string>("daily-standup");
  const [proseStyle, setProseStyle] = React.useState<string>("fast");
  const [search, setSearch] = React.useState("");
  const [authors, setAuthors] = React.useState("");
  const [since, setSince] = React.useState("");
  const [until, setUntil] = React.useState("");
  const [includeDebates, setIncludeDebates] = React.useState(true);
  const [includeTheses, setIncludeTheses] = React.useState(true);
  const [includeClaims, setIncludeClaims] = React.useState(true);
  const [includeStanceChanges, setIncludeStanceChanges] = React.useState(true);
  const [length, setLength] = React.useState("medium");
  const [composing, setComposing] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [history, setHistory] = React.useState<any[]>([]);

  const handleCompose = async () => {
    setComposing(true);
    setResult(null);
    try {
      const r = await fetch("/api/briefing/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          proseTemplate: proseStyle,
          search,
          authors: authors ? authors.split(",").map((s) => s.trim()) : [],
          since: since || undefined,
          until: until || undefined,
          includeDebates,
          includeTheses,
          includeClaims,
          includeStanceChanges,
          length,
          format: "html",
          includeLinks: true,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        setResult(data);
        setHistory((prev) => [
          { template, search, wordCount: data.wordCount, at: new Date().toISOString() },
          ...prev,
        ].slice(0, 5));
        toast.success(`Briefing composed: ${data.wordCount} words, ${data.sourcesCited} sources, ${data.dedupedCount} deduped`);
      } else {
        toast.error(`Composition failed: ${data.error}`);
      }
    } catch (e: any) {
      toast.error("Composition failed");
    } finally {
      setComposing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Briefing Composer <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">[v3.1]</span></h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Synthesize audited intelligence into written narrative. Prose layer only — no new analysis,
            no LLM judgment, no gate-making. Every claim appears verbatim in the corpus.
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] overflow-hidden">
        {/* Left: Request panel */}
        <div className="border-r overflow-y-auto p-4 space-y-4">
          {/* Template selection */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Template</label>
            <div className="mt-1.5 space-y-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTemplate(t.id);
                    setProseStyle(t.prose);
                  }}
                  className={cn(
                    "w-full text-left rounded-md border p-2.5 transition-colors",
                    template === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{t.label}</span>
                    {template === t.id && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Prose style */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Prose Style</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {PROSE_STYLES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProseStyle(p.id)}
                  className={cn(
                    "rounded-md border p-2 text-left transition-colors",
                    proseStyle === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                  )}
                >
                  <div className="text-xs font-medium">{p.label}</div>
                  <div className="text-[9px] text-muted-foreground">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Filters */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Filters</label>
            <Input
              placeholder="Search (e.g. 'indium phosphate')"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Authors (comma-separated handles)"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                placeholder="Since"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                type="date"
                placeholder="Until"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Include toggles */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Include</label>
            {[
              { label: "Debates", state: includeDebates, set: setIncludeDebates },
              { label: "Theses", state: includeTheses, set: setIncludeTheses },
              { label: "Claims", state: includeClaims, set: setIncludeClaims },
              { label: "Stance changes", state: includeStanceChanges, set: setIncludeStanceChanges },
            ].map((item) => (
              <label key={item.label} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.state}
                  onChange={(e) => item.set(e.target.checked)}
                  className="h-3 w-3"
                />
                {item.label}
              </label>
            ))}
          </div>

          <Separator />

          {/* Length */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Length</label>
            <div className="mt-1.5 flex gap-1.5">
              {["short", "medium", "long"].map((l) => (
                <Button
                  key={l}
                  size="sm"
                  variant={length === l ? "default" : "outline"}
                  className="h-7 text-xs capitalize"
                  onClick={() => setLength(l)}
                >
                  {l}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <Button
            className="w-full"
            disabled={composing}
            onClick={handleCompose}
          >
            {composing ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Composing…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Compose Briefing</>
            )}
          </Button>
        </div>

        {/* Right: Output panel */}
        <div className="overflow-y-auto">
          {result ? (
            <div className="p-6 max-w-3xl mx-auto">
              {/* Stats bar */}
              <div className="flex items-center gap-3 mb-4 text-xs">
                <Badge variant="outline" className="h-5">
                  <FileText className="h-2.5 w-2.5 mr-1" />
                  {result.wordCount} words
                </Badge>
                <Badge variant="outline" className="h-5">
                  {result.sourcesCited} sources cited
                </Badge>
                <Badge variant="outline" className="h-5">
                  {result.claimsCited} claims
                </Badge>
                {result.dedupedCount > 0 && (
                  <Badge variant="outline" className="h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    {result.dedupedCount} echoes deduped
                  </Badge>
                )}
              </div>

              {/* Briefing content — rendered as Markdown (headings, bold, lists, links) */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <SimpleMarkdown content={result.content} />
              </div>

              <Separator className="my-4" />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([result.content], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `briefing-${new Date().toISOString().slice(0,10)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Briefing downloaded.");
                  }}
                >
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(result.content);
                    toast.success("Markdown copied to clipboard.");
                  }}
                >
                  <FileText className="h-3 w-3 mr-1" /> Copy as Markdown
                </Button>
              </div>
            </div>
          ) : history.length > 0 ? (
            <div className="p-6 max-w-3xl mx-auto">
              <h3 className="text-sm font-semibold mb-3">Recent briefings</h3>
              {history.map((h, i) => (
                <div key={i} className="rounded-md border p-3 mb-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{h.template}</span>
                    <span className="text-muted-foreground">{h.wordCount} words</span>
                  </div>
                  {h.search && <p className="text-muted-foreground mt-1">Search: "{h.search}"</p>}
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-4">
                Select a template and click "Compose Briefing" to generate a new one.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-sm font-medium">No briefing composed yet</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a template, set your filters, and click "Compose Briefing" to synthesize
                  audited intelligence into a written narrative.
                </p>
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                  Every claim in the briefing appears verbatim in the corpus. No invented facts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
