"use client";

// NIP v3.0 — Ingestion Console (M8 surface #5, Spec §10)
// Visual Intake (drop / multi-image batch / paste / mobile), adapters,
// re-extraction console (CP10 — dry-run AND apply now wired), batch forensics,
// jobs runner (manual trigger of adapter jobs).

import * as React from "react";
import {
  Upload, ImagePlus, Clipboard, RefreshCw, AlertTriangle,
  FileSearch, Settings2, Play, CheckCircle2, Database,
  Layers3, Activity, Mic2, History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CauseChip, EvidenceLink, ReconLine } from "./grammar";
import { SourceListManager } from "./SourceListManager";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface IngestionProps {
  adapterHealth: any[];
  rawContents?: any[];
  watermarks?: any[];
  counts?: any;
  onAdapterRun?: (adapter: string) => Promise<void>;
  onReextract?: (targetVersion: string, degradedOnly: boolean) => Promise<any>;
  onApply?: (diffs: any[]) => Promise<any>;
}

const ADAPTER_JOBS = [
  { id: "rss",         label: "RSS",         endpoint: "/api/jobs.rss",         icon: RefreshCw },
  { id: "x",           label: "X scraper",   endpoint: "/api/jobs.x",           icon: Activity },
  { id: "transcripts", label: "Transcripts", endpoint: "/api/jobs.transcripts", icon: FileSearch },
  { id: "anchors",     label: "Anchors",     endpoint: "/api/jobs.anchors",     icon: Database },
  { id: "events",      label: "Events",      endpoint: "/api/jobs.events",      icon: Layers3 },
];

const PIPELINE_JOBS = [
  { id: "stance",      label: "Stance",       endpoint: "/api/jobs.stance" },
  { id: "contrarian",  label: "Contrarian",   endpoint: "/api/jobs.contrarian" },
  { id: "falsifiers",  label: "Falsifiers",   endpoint: "/api/jobs.falsifiers" },
  { id: "debates",     label: "Debates",      endpoint: "/api/jobs.debates" },
  { id: "ladder",      label: "Ladder",       endpoint: "/api/jobs.ladder" },
  { id: "verifications", label: "Verifications", endpoint: "/api/jobs.verifications" },
  { id: "scorecard",   label: "Scorecard",    endpoint: "/api/jobs.scorecard" },
];

// ── Visual Intake ──
function VisualIntake() {
  const [pastedUrl, setPastedUrl] = React.useState("");
  const [pastedText, setPastedText] = React.useState("");
  const [transcriptUrl, setTranscriptUrl] = React.useState("");
  const [transcriptChannel, setTranscriptChannel] = React.useState("");
  const [files, setFiles] = React.useState<string[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Array<{ type: string; ok: boolean; message: string }>>([]);

  const addResult = (type: string, ok: boolean, message: string) => {
    setResults(prev => [{ type, ok, message }, ...prev].slice(0, 5));
  };

  const handleUrl = async () => {
    if (!pastedUrl) return;
    setSubmitting("url");
    try {
      const r = await fetch("/api/ingest/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pastedUrl }),
      });
      const data = await r.json();
      if (data.ok) {
        addResult("URL", true, `Ingested: ${data.title || pastedUrl} (${data.bodyLength || 0} chars)`);
        toast.success("URL fetched + extracted");
      } else {
        addResult("URL", false, data.error || "failed");
        toast.error(`URL ingest failed: ${data.error}`);
      }
    } catch (e: any) {
      addResult("URL", false, e.message);
      toast.error("URL ingest failed");
    } finally {
      setSubmitting(null);
    }
  };

  const handleText = async () => {
    if (!pastedText.trim()) return;
    setSubmitting("text");
    try {
      const r = await fetch("/api/ingest/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText }),
      });
      const data = await r.json();
      if (data.ok) {
        addResult("Text", true, `Extracted (${data.bodyLength} chars, ${data.dedup ? "dedup" : "new"})`);
        toast.success("Text triaged + extracted");
      } else {
        addResult("Text", false, data.error || "failed");
        toast.error(`Text ingest failed: ${data.error}`);
      }
    } catch (e: any) {
      addResult("Text", false, e.message);
      toast.error("Text ingest failed");
    } finally {
      setSubmitting(null);
    }
  };

  const handleTranscript = async () => {
    if (!transcriptUrl) return;
    setSubmitting("transcript");
    try {
      const r = await fetch("/api/ingest/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: transcriptUrl, channel: transcriptChannel || undefined }),
      });
      const data = await r.json();
      if (data.ok) {
        addResult("Transcript", true, `${data.isYouTube ? "YouTube" : "Podcast"}: ${data.title} (${data.transcriptLength} chars)`);
        toast.success("Transcript fetched + extracted");
      } else {
        addResult("Transcript", false, data.error || "failed");
        toast.error(`Transcript ingest failed: ${data.error}`);
      }
    } catch (e: any) {
      addResult("Transcript", false, e.message);
      toast.error("Transcript ingest failed");
    } finally {
      setSubmitting(null);
    }
  };

  const handleDrop = async (droppedFiles: File[]) => {
    for (const file of droppedFiles) {
      setFiles(prev => [...prev, file.name]);
      // Convert to base64 and send to image ingestion
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const r = await fetch("/api/images/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, processImmediately: true }),
          });
          const data = await r.json();
          if (data.ok) {
            addResult("Image", true, `${file.name} → ${data.dedup ? "dedup (virality " + data.viralityCount + ")" : "new, VLM processed"}`);
            toast.success(`Image ingested: ${file.name}`);
          } else {
            addResult("Image", false, `${file.name}: ${data.error}`);
          }
        };
        reader.readAsDataURL(file);
      } catch (e: any) {
        addResult("Image", false, `${file.name}: ${e.message}`);
      }
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <ImagePlus className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Visual intake</h3>
        <Badge variant="outline" className="text-[10px] h-4">VLM dual-route</Badge>
      </div>

      {/* Image drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleDrop(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-muted-foreground/50",
        )}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = "image/*";
          input.onchange = () => handleDrop(Array.from(input.files ?? []));
          input.click();
        }}
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">
          Drop images, charts, or screenshots here — multi-image batch supported
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Mobile: tap to upload · each image classified, dual-route VLM, ratification queue
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] rounded bg-muted/20 px-2 py-1">
              <span className="truncate">{f}</span>
              <Badge variant="outline" className="text-[9px] h-3.5 bg-amber-500/10">PENDING VLM</Badge>
            </div>
          ))}
        </div>
      )}

      <Separator className="my-3" />

      {/* YouTube / Podcast URL */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Mic2 className="h-3 w-3" /> YouTube / Podcast URL
        </div>
        <Input
          placeholder="https://youtube.com/watch?v=… or podcast URL"
          value={transcriptUrl}
          onChange={(e) => setTranscriptUrl(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          placeholder="channel handle (optional, e.g. semi_analysis)"
          value={transcriptChannel}
          onChange={(e) => setTranscriptChannel(e.target.value)}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full"
          disabled={!transcriptUrl || submitting === "transcript"}
          onClick={handleTranscript}
        >
          {submitting === "transcript" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Mic2 className="h-3 w-3 mr-1" />}
          {submitting === "transcript" ? "Fetching…" : "Fetch transcript + extract"}
        </Button>
      </div>

      <Separator className="my-3" />

      {/* URL deep-examine */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground">Deep-examine URL</div>
        <Input
          placeholder="https://… (article, blog post, press release)"
          value={pastedUrl}
          onChange={(e) => setPastedUrl(e.target.value)}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full"
          disabled={!pastedUrl || submitting === "url"}
          onClick={handleUrl}
        >
          {submitting === "url" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <FileSearch className="h-3 w-3 mr-1" />}
          {submitting === "url" ? "Fetching…" : "Fetch + extract"}
        </Button>
      </div>

      <Separator className="my-3" />

      {/* Paste raw text */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Clipboard className="h-3 w-3" /> Paste raw content
        </div>
        <Textarea
          placeholder="Paste tweet, transcript excerpt, or article text…"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          className="text-xs min-h-[80px]"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full"
          disabled={!pastedText.trim() || submitting === "text"}
          onClick={handleText}
        >
          {submitting === "text" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Clipboard className="h-3 w-3 mr-1" />}
          {submitting === "text" ? "Extracting…" : "Triage → extract"}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Recent ingestions</div>
          {results.map((r, i) => (
            <div key={i} className={cn(
              "text-[10px] rounded px-2 py-1 flex items-center gap-1.5",
              r.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400",
            )}>
              {r.ok ? <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> : <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
              <span className="font-mono">{r.type}</span>
              <span className="truncate">{r.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Adapter status + run buttons ──
function AdapterStatus({ adapters, watermarks, onAdapterRun }: {
  adapters: any[];
  watermarks: any[];
  onAdapterRun?: (adapter: string) => Promise<void>;
}) {
  const [running, setRunning] = React.useState<string | null>(null);
  const wmsByAdapter = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const w of watermarks) m[w.adapterType] = (m[w.adapterType] ?? 0) + 1;
    return m;
  }, [watermarks]);

  const handleRun = async (adapter: string) => {
    setRunning(adapter);
    try {
      await onAdapterRun?.(adapter);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Adapters</h3>
        <span className="text-[10px] text-muted-foreground">watermark-incremental · store-raw-first (L2)</span>
      </div>
      <div className="space-y-2">
        {adapters.map(a => {
          const isRunning = running === a.adapter;
          return (
            <div key={a.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[11px]">{a.adapter}</span>
                <span className="text-[10px] text-muted-foreground">
                  {wmsByAdapter[a.adapter.toUpperCase()] ?? wmsByAdapter[a.adapter] ?? 0} watermarks
                </span>
                {a.lastRunAt && (
                  <span className="text-[10px] text-muted-foreground">
                    ran {new Date(a.lastRunAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <CauseChip state={a.state} cause={a.cause} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  disabled={isRunning}
                  onClick={() => handleRun(a.adapter)}
                >
                  {isRunning ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                  {isRunning ? "Running" : "Run"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline jobs — stance, contrarian, falsifiers, ladder, etc. */}
      <Separator className="my-3" />
      <div className="flex items-center gap-1.5 mb-2">
        <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium">Pipeline jobs</span>
        <span className="text-[10px] text-muted-foreground">manually trigger processing stages</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PIPELINE_JOBS.map(job => {
          const isRunning = running === job.id;
          return (
            <Button
              key={job.id}
              size="sm"
              variant="outline"
              className="h-7 text-[10px] justify-start"
              disabled={isRunning}
              onClick={async () => {
                setRunning(job.id);
                try {
                  const r = await fetch(job.endpoint, { method: "POST" });
                  const data = await r.json();
                  if (data.ok !== false) {
                    const c = data?.counts ?? {};
                    const summary = Object.entries(c).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(" · ") || "done";
                    toast.success(`${job.label}: ${summary}`);
                  } else {
                    toast.error(`${job.label} failed: ${data?.error || "unknown"}`);
                  }
                } catch (e: any) {
                  toast.error(`${job.label} failed: ${e.message}`);
                } finally {
                  setRunning(null);
                }
              }}
            >
              {isRunning ? <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" /> : <Play className="h-2.5 w-2.5 mr-1" />}
              {job.label}
            </Button>
          );
        })}
      </div>

      {/* Run all jobs (daily dispatcher) */}
      <Separator className="my-3" />
      <Button
        size="sm"
        className="w-full h-8 text-xs"
        disabled={running === "all"}
        onClick={async () => {
          setRunning("all");
          try {
            const r = await fetch("/api/cron/daily", { method: "POST" });
            const data = await r.json();
            if (data.ok !== false) {
              const results = data?.results || {};
              const count = Object.keys(results).length;
              toast.success(`All ${count} jobs dispatched`);
            } else {
              toast.error(`Run-all failed: ${data?.error || "unknown"}`);
            }
          } catch (e: any) {
            toast.error(`Run-all failed: ${e.message}`);
          } finally {
            setRunning(null);
          }
        }}
      >
        {running === "all" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
        {running === "all" ? "Running all jobs…" : "Run all jobs (daily batch)"}
      </Button>
    </div>
  );
}

// ── Re-extraction console (CP10) — dry-run + apply ──
function ReExtractionConsole({ rawContents = [], degradedCount = 0, onReextract, onApply }: {
  rawContents?: any[];
  degradedCount?: number;
  onReextract?: (targetVersion: string, degradedOnly: boolean) => Promise<any>;
  onApply?: (diffs: any[]) => Promise<any>;
}) {
  const [selectedVersion, setSelectedVersion] = React.useState("deep_extract/v3");
  const [degradedOnly, setDegradedOnly] = React.useState(true);
  const [diffs, setDiffs] = React.useState<any[] | null>(null);
  const [diffing, setDiffing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [applyResult, setApplyResult] = React.useState<any>(null);

  const handleDryRun = async () => {
    setDiffing(true);
    setDiffs(null);
    setApplyResult(null);
    try {
      const result = await onReextract?.(selectedVersion, degradedOnly);
      setDiffs(result?.diffs ?? []);
    } catch (e: any) {
      toast.error(`Dry-run failed: ${e.message}`);
    } finally {
      setDiffing(false);
    }
  };

  const handleApply = async () => {
    if (!diffs || diffs.length === 0) return;
    setApplying(true);
    try {
      const result = await onApply?.(diffs);
      setApplyResult(result);
      toast.success(`Applied: ${result?.applied ?? 0} sources · ${result?.skipped ?? 0} skipped`);
      setDiffs(null);
    } catch (e: any) {
      toast.error(`Apply failed: ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Re-extraction console (CP10)</h3>
        </div>
        <Badge variant="outline" className="text-[10px] h-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          dry-run + apply wired
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        Source-set × prompt-version → dry-run diff → PS approves → applies (L2 made operable).
        The <span className="font-semibold">{degradedCount} degraded sources</span> are its first customer.
        CP3 violations quarantine; L1 strip-and-log enforces no LLM stage/price leakage.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[11px] text-muted-foreground">Target version:</span>
        <select
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(e.target.value)}
          className="h-7 text-xs rounded border bg-background px-2"
        >
          <option value="deep_extract/v3">deep_extract/v3 (current)</option>
          <option value="deep_extract/v4">deep_extract/v4 (proposed)</option>
          <option value="deep_extract/v5">deep_extract/v5 (experimental)</option>
        </select>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={degradedOnly}
            onChange={(e) => setDegradedOnly(e.target.checked)}
            className="h-3 w-3"
          />
          degraded only
        </label>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleDryRun} disabled={diffing}>
          <RefreshCw className={cn("h-3 w-3 mr-1", diffing && "animate-spin")} /> Dry-run diff
        </Button>
        {diffs && diffs.length > 0 && (
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleApply} disabled={applying}>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {applying ? "Applying…" : `Apply ${diffs.length} diffs`}
          </Button>
        )}
      </div>

      {/* Diff results */}
      {diffs && (
        <div className="space-y-2">
          {applyResult && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Apply complete
              </div>
              <div className="mt-1 text-muted-foreground">
                {applyResult.applied} applied · {applyResult.skipped} skipped (quarantined)
              </div>
            </div>
          )}
          {!applyResult && diffs.length > 0 && (
            <>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {diffs.length} diffs · {diffs.filter(d => d.changedFields.length > 0).length} changed · {diffs.filter(d => d.quarantined).length} quarantined
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {diffs.map((d, i) => (
                  <div key={i} className={cn(
                    "rounded border p-2 text-[10px]",
                    d.quarantined ? "border-red-500/30 bg-red-500/5" : d.changedFields.length > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-muted bg-muted/20",
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono">{d.sourceId.slice(-8)}</span>
                      {d.quarantined ? (
                        <Badge variant="outline" className="text-[9px] h-3.5 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
                          QUARANTINED
                        </Badge>
                      ) : d.changedFields.length > 0 ? (
                        <Badge variant="outline" className="text-[9px] h-3.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          {d.changedFields.length} field{d.changedFields.length > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-3.5">no change</Badge>
                      )}
                    </div>
                    {d.quarantined && (
                      <p className="text-red-600 dark:text-red-400 italic">{d.quarantineReason}</p>
                    )}
                    {d.changedFields.length > 0 && (
                      <div className="text-muted-foreground">
                        Changed: {d.changedFields.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {diffs.length === 0 && (
            <div className="text-[11px] text-muted-foreground italic py-4 text-center">
              No sources matched this filter.
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t flex items-center justify-between text-[10px]">
        <EvidenceLink
          label="L2"
          value="raw stored"
          evidence={
            <p>Every extraction is a versioned, reprocessable transform over stored raw.
            Phase-5&apos;s prompt upgrade orphaned 515 insights because raw pages were discarded — that&apos;s the failure this checkpoint prevents.</p>
          }
        />
        <span className="text-muted-foreground">{degradedCount} degraded sources awaiting apply</span>
      </div>
    </div>
  );
}

// ── Batch forensics ──
function BatchForensics({ rawContents = [] }: { rawContents?: any[] }) {
  const byStatus = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rawContents) {
      m[r.extractionStatus] = (m[r.extractionStatus] ?? 0) + 1;
    }
    return m;
  }, [rawContents]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Batch forensics</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="rounded bg-muted/20 p-2">
            <div className="text-[10px] text-muted-foreground truncate">{status}</div>
            <div className="font-semibold tabular-nums">{count}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Checkpoint 3 (sampled extraction verification) quarantines batches on verbatim-quote mismatch (L3 demonstrated).
      </p>
    </div>
  );
}

// ── VLM Image Gallery — shows ingested images + VLM analysis results ──
function VLMImageGallery() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | "PENDING" | "RATIFIED" | "PENDING_RETRY">("all");
  const [selected, setSelected] = React.useState<string | null>(null);

  const fetch_ = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/images/list?status=${filter}`);
      const d = await r.json();
      if (d.ok) setData(d);
    } catch {}
    setLoading(false);
  }, [filter]);

  React.useEffect(() => { fetch_(); }, [fetch_]);

  const summary = data?.summary;
  const images = data?.images || [];
  const selectedImg = images.find((i: any) => i.id === selected);

  const ratify = async (imageId: string, decision: "RATIFIED" | "REJECTED") => {
    try {
      const r = await fetch("/api/vlm/ratify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, decision }),
      });
      const d = await r.json();
      if (d.ok) {
        toast.success(`Image ${decision.toLowerCase()}`);
        fetch_();
      } else {
        toast.error(`Ratification failed: ${d.error}`);
      }
    } catch {
      toast.error("Ratification failed");
    }
  };

  const runVLM = async () => {
    try {
      const r = await fetch("/api/jobs.vlm", { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        toast.success(`VLM processed ${d.counts?.processed ?? 0} images (${d.counts?.mismatched ?? 0} mismatched)`);
        fetch_();
      } else {
        toast.error(`VLM job failed: ${d.error}`);
      }
    } catch {
      toast.error("VLM job failed");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">VLM image gallery</h3>
          {summary && (
            <span className="text-[10px] text-muted-foreground">
              {summary.total} images · {summary.charts} charts · {summary.tables} tables · {summary.mismatched} mismatched
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={runVLM}>
            <Play className="h-2.5 w-2.5 mr-1" /> Run VLM
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={fetch_} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-3">
        {(["all", "PENDING", "PENDING_RETRY", "RATIFIED"] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="h-6 text-[10px] px-2"
            onClick={() => setFilter(f)}
          >
            {f === "PENDING_RETRY" ? "RETRY" : f}
            {summary && f === "all" && ` (${summary.total})`}
            {summary && f === "PENDING" && ` (${summary.pending})`}
            {summary && f === "PENDING_RETRY" && ` (${summary.retry})`}
            {summary && f === "RATIFIED" && ` (${summary.ratified})`}
          </Button>
        ))}
      </div>

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic py-4 text-center">
          No images ingested yet. Drop images in the Visual Intake above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
          {images.map((img: any) => (
            <div
              key={img.id}
              className={cn(
                "rounded border p-2 text-[10px] cursor-pointer transition-colors",
                selected === img.id ? "border-primary bg-primary/5" : "hover:bg-muted/20",
                img.discrepancyFlag === "DUAL_ROUTE_MISMATCH" && "border-red-500/30 bg-red-500/5",
              )}
              onClick={() => setSelected(selected === img.id ? null : img.id)}
            >
              {/* Image thumbnail */}
              {img.imageUrl ? (
                <img
                  src={img.imageUrl.startsWith("data:") ? img.imageUrl : img.imageUrl}
                  alt="ingested"
                  className="w-full h-20 object-cover rounded mb-1.5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-20 bg-muted/30 rounded mb-1.5 flex items-center justify-center">
                  <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}

              {/* Classification + status */}
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className={cn(
                  "text-[8px] h-3",
                  img.classifierClass === "CHART" && "bg-blue-500/10 text-blue-700",
                  img.classifierClass === "TABLE" && "bg-purple-500/10 text-purple-700",
                  img.classifierClass === "OTHER" && "bg-muted/30",
                )}>
                  {img.classifierClass}
                </Badge>
                <Badge variant="outline" className={cn(
                  "text-[8px] h-3",
                  img.ratificationStatus === "RATIFIED" && "bg-emerald-500/10 text-emerald-700",
                  img.ratificationStatus === "PENDING" && "bg-amber-500/10 text-amber-700",
                  img.ratificationStatus === "PENDING_RETRY" && "bg-red-500/10 text-red-700",
                )}>
                  {img.ratificationStatus}
                </Badge>
              </div>

              {/* Virality */}
              {img.viralityCount > 1 && (
                <div className="text-[9px] text-muted-foreground">↻ {img.viralityCount}× seen</div>
              )}
              {img.discrepancyFlag === "DUAL_ROUTE_MISMATCH" && (
                <div className="text-[9px] text-red-600 dark:text-red-400 font-medium">⚠ Mismatch</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected image detail */}
      {selectedImg && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="text-[11px] font-medium">Image analysis detail</div>

          {selectedImg.imageUrl && (
            <img
              src={selectedImg.imageUrl.startsWith("data:") ? selectedImg.imageUrl : selectedImg.imageUrl}
              alt="selected"
              className="max-h-48 rounded border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded bg-muted/20 p-2">
              <div className="font-medium mb-1">Annotation route</div>
              <div>Value: {selectedImg.annotation?.valueLow ?? "—"} – {selectedImg.annotation?.valueHigh ?? "—"}</div>
              <div>Unit: {selectedImg.annotation?.unit || "—"}</div>
              <div>Horizon: {selectedImg.annotation?.horizon || "—"}</div>
              {selectedImg.annotation?.printedSource && (
                <div>Source: {selectedImg.annotation.printedSource}</div>
              )}
            </div>
            <div className="rounded bg-muted/20 p-2">
              <div className="font-medium mb-1">Axis-read route</div>
              <div>Value: {selectedImg.axisRead?.valueLow ?? "—"} – {selectedImg.axisRead?.valueHigh ?? "—"}</div>
              <div>Unit: {selectedImg.axisRead?.unit || "—"}</div>
              <div>Horizon: {selectedImg.axisRead?.horizon || "—"}</div>
              {selectedImg.axisRead?.printedSource && (
                <div>Source: {selectedImg.axisRead.printedSource}</div>
              )}
            </div>
          </div>

          {selectedImg.parentUrl && (
            <a href={selectedImg.parentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[9px]">
              Open parent content ↗
            </a>
          )}

          {/* Ratification buttons */}
          {(selectedImg.ratificationStatus === "PENDING" || selectedImg.ratificationStatus === "PENDING_RETRY") && (
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={() => ratify(selectedImg.id, "RATIFIED")}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ratify
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => ratify(selectedImg.id, "REJECTED")}>
                <AlertTriangle className="h-3 w-3 mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Extraction Log — shows what was extracted + job run history ──
function ExtractionLog() {
  const [range, setRange] = React.useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedAdapter, setExpandedAdapter] = React.useState<string | null>(null);

  const fetch_ = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/extractions?range=${range}`);
      const d = await r.json();
      if (d.ok) setData(d);
    } catch {}
    setLoading(false);
  }, [range]);

  React.useEffect(() => { fetch_(); }, [fetch_]);

  const summary = data?.summary;
  const byAdapter = data?.byAdapter || {};
  const jobRuns = data?.jobRuns || [];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Extraction log</h3>
          {summary && (
            <span className="text-[10px] text-muted-foreground">
              {summary.totalRawContents} items · {summary.totalJobRuns} jobs ({summary.successCount}✓ {summary.failedCount}✗)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(["1h", "24h", "7d", "30d"] as const).map(r => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              className="h-6 text-[10px] px-2"
              onClick={() => setRange(r)}
            >
              {r}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={fetch_} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary by adapter type */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          {Object.entries(summary.byAdapter).map(([type, count]: [string, any]) => (
            <div key={type} className="rounded bg-muted/20 p-2 text-center">
              <div className="text-[10px] text-muted-foreground truncate">{type}</div>
              <div className="font-semibold tabular-nums text-sm">{count}</div>
            </div>
          ))}
          {Object.keys(summary.byAdapter).length === 0 && (
            <div className="col-span-full text-[11px] text-muted-foreground italic text-center py-2">
              No extractions in this period.
            </div>
          )}
        </div>
      )}

      {/* Extractions by adapter (expandable) */}
      <div className="space-y-1.5 mb-3">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Extractions by adapter</div>
        {Object.entries(byAdapter).map(([type, items]: [string, any]) => (
          <div key={type} className="rounded border bg-muted/10">
            <button
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs hover:bg-muted/20"
              onClick={() => setExpandedAdapter(expandedAdapter === type ? null : type)}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px]">{type}</span>
                <Badge variant="outline" className="text-[9px] h-3.5">{items.length}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  latest: {items[0] ? new Date(items[0].fetchedAt).toLocaleString() : "—"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {expandedAdapter === type ? "▲" : "▼"}
              </span>
            </button>
            {expandedAdapter === type && (
              <div className="border-t space-y-1 p-2 max-h-[300px] overflow-y-auto">
                {items.map((item: any) => (
                  <div key={item.id} className="rounded bg-background/50 p-2 text-[10px]">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium truncate">{item.title}</span>
                      <Badge variant="outline" className={cn(
                        "text-[8px] h-3",
                        item.extractionStatus === "EXTRACTED" && "bg-emerald-500/10 text-emerald-700",
                        item.extractionStatus === "PENDING" && "bg-amber-500/10 text-amber-700",
                        item.extractionStatus === "FAILED" && "bg-red-500/10 text-red-700",
                      )}>
                        {item.extractionStatus}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(item.fetchedAt).toLocaleString()} · {item.adapterVersion}
                    </div>
                    {item.bodyPreview && (
                      <div className="text-muted-foreground mt-1 line-clamp-2">{item.bodyPreview}</div>
                    )}
                    {item.url && item.url !== "#" && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[9px]">
                        Open original ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Job run history */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Job run history</div>
        <div className="max-h-[250px] overflow-y-auto space-y-1">
          {jobRuns.map((j: any) => {
            const counts = j.counts || {};
            const countStr = Object.entries(counts).slice(0, 3).map(([k, v]: any) => `${k}:${v}`).join(" · ");
            return (
              <div key={j.id} className={cn(
                "rounded border px-2 py-1.5 text-[10px] flex items-start justify-between gap-2",
                j.status === "DONE" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20",
              )}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {j.status === "DONE" ? (
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                    )}
                    <span className="font-mono">{j.job}</span>
                    <span className="text-muted-foreground">{new Date(j.startedAt).toLocaleString()}</span>
                  </div>
                  {countStr && <div className="text-muted-foreground mt-0.5 ml-4">{countStr}</div>}
                  {j.error && <div className="text-red-600 dark:text-red-400 mt-0.5 ml-4 line-clamp-2">{j.error.slice(0, 150)}</div>}
                </div>
              </div>
            );
          })}
          {jobRuns.length === 0 && (
            <div className="text-[11px] text-muted-foreground italic text-center py-2">
              No jobs ran in this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function IngestionConsole({ adapterHealth, rawContents, watermarks, counts, onAdapterRun, onReextract, onApply }: IngestionProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Ingestion console</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visual intake · source list manager · adapters · extraction log · re-extraction console (CP10) · batch forensics.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
          <div className="space-y-4">
            <VisualIntake />
            <SourceListManager />
            <BatchForensics rawContents={rawContents} />
          </div>
          <div className="space-y-4">
            <VLMImageGallery />
            <ExtractionLog />
            <AdapterStatus adapters={adapterHealth} watermarks={watermarks ?? []} onAdapterRun={onAdapterRun} />
            <ReExtractionConsole
              rawContents={rawContents}
              degradedCount={counts?.degradedSources ?? 0}
              onReextract={onReextract}
              onApply={onApply}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
