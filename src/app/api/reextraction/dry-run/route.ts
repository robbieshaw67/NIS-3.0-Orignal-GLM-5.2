// NIP v3.0 — CP10 dry-run: source-set × prompt-version → diff

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sourceIds, degradedOnly, targetVersion } = body ?? {};
  if (!targetVersion) {
    return NextResponse.json({ ok: false, error: "targetVersion required" }, { status: 400 });
  }
  try {
    // Lazy import — avoids loading the provider/reextraction chain at module load
    const { dryRunReextraction } = await import("@/lib/reextraction");
    const result = await dryRunReextraction({
      sourceIds,
      degradedOnly: degradedOnly ?? false,
      targetVersion,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    // L3 — errors are never verdicts. Return the cause, never crash the process.
    return NextResponse.json(
      { ok: false, error: e?.message ?? "dry-run-failed", diffs: [], counts: { scanned: 0, changed: 0, quarantined: 0 } },
      { status: 500 }
    );
  }
}
