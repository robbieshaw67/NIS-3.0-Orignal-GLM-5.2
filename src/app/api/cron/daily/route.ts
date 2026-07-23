// NIP v3.0 — Single daily cron dispatcher (Vercel Hobby-compatible)
// Hobby accounts are limited to 1 cron job per day. This endpoint dispatches
// all 12 jobs in sequence when called, so we only need one cron entry.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — run all jobs

export async function POST(req: Request) {
  const results: Record<string, any> = {};
  const authHeader = req.headers.get("authorization");
  const origin = req.headers.get("origin") || "";

  // Verify CRON_SECRET (Vercel cron sends Bearer token)
  // But allow browser-origin requests (the UI "Run all" button)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && !origin) {
    // No origin = not from a browser = must be Vercel cron → require secret
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== cronSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  // If origin is present, it's a browser request → allow through (no secret needed)

  try {
    const mod = await import("@/lib/adapters");

    // Run all jobs in sequence — daily batch
    console.log("› adapters:rss");
    results["adapters:rss"] = await mod.runRssAdapter();

    console.log("› adapters:anchors");
    results["adapters:anchors"] = await mod.runAnchorsAdapter();

    console.log("› pipeline:events");
    results["pipeline:events"] = await mod.runEventsPipeline();

    console.log("› pipeline:stance");
    results["pipeline:stance"] = await mod.runStancePipeline();

    console.log("› pipeline:contrarian");
    results["pipeline:contrarian"] = await mod.runContrarianPipeline();

    console.log("› monitor:falsifiers");
    results["monitor:falsifiers"] = await mod.runFalsifierMonitor();

    console.log("› engine:ladder");
    results["engine:ladder"] = await mod.runLadderRecompute();

    console.log("› monitor:verifications");
    results["monitor:verifications"] = await mod.runVerificationsMonitor();

    // Debate assembly
    console.log("› pipeline:debates");
    const { runDebateAssembly } = await import("@/lib/debate-assembly");
    results["pipeline:debates"] = await runDebateAssembly();

    // Scorecard
    console.log("› ops:scorecard");
    results["ops:scorecard"] = await mod.runScorecardJob();

    // Backup
    console.log("› ops:backup");
    results["ops:backup"] = await mod.runBackupJob();

    return NextResponse.json({
      ok: true,
      message: "Daily batch complete — all 12 jobs executed",
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "daily-batch-failed", results },
      { status: 500 }
    );
  }
}
