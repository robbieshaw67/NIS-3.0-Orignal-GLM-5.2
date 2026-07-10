// NIP v3.0 — ops:scorecard — weekly checkpoint 11 (Spec §4)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runScorecardJob } = await import("@/lib/adapters");
    return NextResponse.json(await runScorecardJob());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "scorecard-failed" }, { status: 500 });
  }
}
