// NIP v3.0 — Extractions API
// Returns raw content + job runs by time range, grouped by adapter type.
// Used by the Extraction Log panel in the Ingestion tab.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const range = new URL(req.url).searchParams.get("range") || "24h";
  const adapter = new URL(req.url).searchParams.get("adapter");

  const intervals: Record<string, string> = {
    "1h": "1 hour",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
    all: "100 years",
  };
  const interval = intervals[range] || "24 hours";

  // ── Raw content by adapter type ──
  const rawWhere: any = {
    fetchedAt: { gte: new Date(Date.now() - parseInterval(interval)) },
  };
  if (adapter && adapter !== "all") {
    rawWhere.adapterType = adapter;
  }

  const rawContents = await db.rawContent.findMany({
    where: rawWhere,
    orderBy: { fetchedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      adapterType: true,
      adapterVersion: true,
      fetchedAt: true,
      extractionStatus: true,
      url: true,
      bodyText: true,
    },
  });

  // Group by adapter type
  const byAdapter: Record<string, any[]> = {};
  for (const r of rawContents) {
    const key = r.adapterType;
    if (!byAdapter[key]) byAdapter[key] = [];
    byAdapter[key].push({
      id: r.id,
      title: r.title,
      adapterVersion: r.adapterVersion,
      fetchedAt: r.fetchedAt,
      extractionStatus: r.extractionStatus,
      url: r.url,
      bodyPreview: (r.bodyText || "").slice(0, 200),
    });
  }

  // ── Job runs in the same period ──
  const jobWhere: any = {
    startedAt: { gte: new Date(Date.now() - parseInterval(interval)) },
  };

  const jobRuns = await db.jobRun.findMany({
    where: jobWhere,
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  // Group jobs by status
  const jobsByStatus = {
    DONE: jobRuns.filter(j => j.status === "DONE"),
    FAILED: jobRuns.filter(j => j.status === "FAILED"),
  };

  // Summary counts
  const summary = {
    totalRawContents: rawContents.length,
    totalJobRuns: jobRuns.length,
    successCount: jobsByStatus.DONE.length,
    failedCount: jobsByStatus.FAILED.length,
    byAdapter: Object.fromEntries(
      Object.entries(byAdapter).map(([k, v]) => [k, v.length])
    ),
  };

  return NextResponse.json({
    ok: true,
    range,
    summary,
    byAdapter,
    jobRuns: jobRuns.map(j => ({
      id: j.id,
      job: j.job,
      status: j.status,
      startedAt: j.startedAt,
      counts: j.counts,
      error: j.error,
    })),
  });
}

function parseInterval(interval: string): number {
  // Parse "24 hours", "7 days", etc. → milliseconds
  const m = interval.match(/(\d+)\s*(hour|day|year)/);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = parseInt(m[1]);
  const unit = m[2];
  if (unit === "hour") return n * 60 * 60 * 1000;
  if (unit === "day") return n * 24 * 60 * 60 * 1000;
  if (unit === "year") return n * 365 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}
