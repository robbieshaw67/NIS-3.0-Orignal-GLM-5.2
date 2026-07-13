"use client";

// NIP v3.0 — Source List Manager
// PS manages the registry of feeds/handles/channels from the Ingestion Console.
// Add/remove/toggle X handles, RSS feeds, YouTube channels, anchors.

import * as React from "react";
import {
  Plus, Trash2, Power, RefreshCw, Twitter, Rss, Mic2, Anchor,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SOURCE_TYPES = [
  { id: "X", label: "X / Twitter", icon: Twitter, placeholder: "@handle (e.g. @dpatel)" },
  { id: "RSS", label: "RSS / Substack", icon: Rss, placeholder: "Feed URL (e.g. https://site.com/feed)" },
  { id: "TRANSCRIPT", label: "YouTube", icon: Mic2, placeholder: "Channel URL or @handle" },
  { id: "ANCHOR", label: "Anchor", icon: Anchor, placeholder: "Org name (e.g. TrendForce)" },
] as const;

export function SourceListManager() {
  const [sources, setSources] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newType, setNewType] = React.useState("X");
  const [newHandle, setNewHandle] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newFeedUrl, setNewFeedUrl] = React.useState("");
  const [newChannelUrl, setNewChannelUrl] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const fetchSources = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/sources/list");
      const data = await r.json();
      if (data.ok) setSources(data.sources);
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = async () => {
    if (!newHandle.trim()) { toast.error("Handle/URL required"); return; }
    setAdding(true);
    try {
      const r = await fetch("/api/sources/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: newType,
          handle: newHandle.trim(),
          realName: newName.trim() || undefined,
          feedUrl: newFeedUrl.trim() || undefined,
          channelUrl: newChannelUrl.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        toast.success(`Added ${newType} source: ${newHandle}`);
        setNewHandle(""); setNewName(""); setNewFeedUrl(""); setNewChannelUrl("");
        setShowAdd(false);
        fetchSources();
      } else {
        toast.error(data.error || "Failed to add");
      }
    } catch { toast.error("Failed to add source"); }
    finally { setAdding(false); }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await fetch("/api/sources/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !currentActive }),
      });
      setSources(prev => prev.map(s => s.id === id ? { ...s, active: !currentActive } : s));
      toast.success(currentActive ? "Source paused" : "Source resumed");
    } catch { toast.error("Failed to toggle"); }
  };

  const handleDelete = async (id: string, handle: string) => {
    if (!confirm(`Remove ${handle}? This stops all future fetching.`)) return;
    try {
      await fetch(`/api/sources/list?id=${id}`, { method: "DELETE" });
      setSources(prev => prev.filter(s => s.id !== id));
      toast.success(`Removed ${handle}`);
    } catch { toast.error("Failed to remove"); }
  };

  const grouped = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of sources) {
      const list = m.get(s.sourceType) ?? [];
      list.push(s);
      m.set(s.sourceType, list);
    }
    return m;
  }, [sources]);

  const activeCount = sources.filter(s => s.active).length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Source List Manager</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {sources.length} sources ({activeCount} active) · adapters fetch from this list
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetchSources} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3 w-3 mr-1" /> Add Source
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 mb-3 space-y-2">
          <div className="text-[11px] font-medium">Add New Source</div>

          {/* Type selector */}
          <div className="flex gap-1.5">
            {SOURCE_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setNewType(t.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors",
                    newType === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" /> {t.label}
                </button>
              );
            })}
          </div>

          <Input
            placeholder={SOURCE_TYPES.find(t => t.id === newType)?.placeholder ?? ""}
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Real name (optional)" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-xs" />
            {newType === "RSS" && <Input placeholder="Feed URL (if different)" value={newFeedUrl} onChange={e => setNewFeedUrl(e.target.value)} className="h-8 text-xs" />}
            {newType === "TRANSCRIPT" && <Input placeholder="Channel URL" value={newChannelUrl} onChange={e => setNewChannelUrl(e.target.value)} className="h-8 text-xs" />}
          </div>

          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={adding}>
              {adding ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Source list grouped by type */}
      {loading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Loading sources…</div>
      ) : sources.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No sources yet. Click "Add Source" to add X handles, RSS feeds, YouTube channels, or anchors.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {SOURCE_TYPES.map(typeDef => {
            const group = grouped.get(typeDef.id) ?? [];
            if (group.length === 0) return null;
            const Icon = typeDef.icon;
            return (
              <div key={typeDef.id}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium">{typeDef.label}</span>
                  <Badge variant="outline" className="text-[9px] h-3.5">{group.length}</Badge>
                  <Badge variant="outline" className="text-[9px] h-3.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    {group.filter(g => g.active).length} active
                  </Badge>
                </div>
                <div className="space-y-1">
                  {group.map(s => (
                    <div key={s.id} className={cn(
                      "flex items-center justify-between rounded border px-2 py-1.5 text-[11px]",
                      s.active ? "bg-muted/20" : "bg-muted/10 opacity-60"
                    )}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-mono truncate">{s.handle}</span>
                          {s.realName && <span className="text-muted-foreground truncate">— {s.realName}</span>}
                        </div>
                        {s.feedUrl && <div className="text-[9px] text-muted-foreground truncate">{s.feedUrl}</div>}
                        {s.channelUrl && <div className="text-[9px] text-muted-foreground truncate">{s.channelUrl}</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={() => handleToggle(s.id, s.active)}
                          className={cn(
                            "p-1 rounded hover:bg-muted/50 transition-colors",
                            s.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          )}
                          title={s.active ? "Pause" : "Resume"}
                        >
                          {s.active ? <CheckCircle2 className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.handle)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
