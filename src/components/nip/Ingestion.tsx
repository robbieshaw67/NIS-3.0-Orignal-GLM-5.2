"use client";

// NIP v3.0 — Ingestion Console (M8 surface #5, Spec §10)
// Visual Intake (drop / multi-image batch / paste / mobile), adapters,
// re-extraction console (CP10 — dry-run AND apply now wired), batch forensics,
// jobs runner (manual trigger of adapter jobs).

import * as React from "react";
import {
  Upload, ImagePlus, Clipboard, RefreshCw, AlertTriangle,
  FileSearch, Settings2, History, Play, CheckCircle2, Database,
  Layers3, Activity, Mic2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CauseChip, EvidenceLink, ReconLine } from "./grammar";
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
  { id: "rss",        label: "RSS",        endpoint: "/api/jobs.rss",        icon: RefreshCw },
  { id: "x",          label: "X scraper",  endpoint: "/api/jobs.x",          icon: Activity },
  { id: "transcripts",label: "Transcripts",endpoint: "/api/jobs.transcripts",icon: FileSearch },
  { id: "anchors",    label: "Anchors",    endpoint: "/api/jobs.anchors",    icon: Database },
  { id: "events",     label: "Events",     endpoint: "/api/jobs.events",     icon: Layers3 },
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

export function IngestionConsole({ adapterHealth, rawContents, watermarks, counts, onAdapterRun, onReextract, onApply }: IngestionProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold">Ingestion console</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visual intake · adapters · re-extraction console (CP10 — apply wired) · batch forensics.
            Everything that comes in stores raw first (L2), errors never verdict (L3), counts reconcile (L12).
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
          <div className="space-y-4">
            <VisualIntake />
            <BatchForensics rawContents={rawContents} />
          </div>
          <div className="space-y-4">
            <AdapterStatus adapters={adapterHealth} watermarks={watermarks ?? []} onAdapterRun={onAdapterRun} />
            <ReExtractionConsole
              rawContents={rawContents}
              degradedCount={counts?.degradedSources ?? 0}
              onReextract={onReextract}
              onApply={onApply}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
