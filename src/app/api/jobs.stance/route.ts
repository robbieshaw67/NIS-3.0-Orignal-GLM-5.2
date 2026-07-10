// NIP v3.0 — pipeline:stance job endpoint (per-event stance updates + change classification)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runStancePipeline } = await import("@/lib/adapters");
    return NextResponse.json(await runStancePipeline());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "stance-failed" }, { status: 500 });
  }
}
