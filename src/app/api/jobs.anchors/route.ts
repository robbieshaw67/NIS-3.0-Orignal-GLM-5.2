// NIP v3.0 — Anchors adapter (TrendForce/DRAMeXchange, revision chaining)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runAnchorsAdapter } = await import("@/lib/adapters");
    const result = await runAnchorsAdapter();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "anchors-failed" }, { status: 500 });
  }
}
