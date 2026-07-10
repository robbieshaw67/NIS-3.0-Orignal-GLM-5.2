// NIP v3.0 — engine:ladder job endpoint (gate computation + stage transitions)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runLadderRecompute } = await import("@/lib/adapters");
    return NextResponse.json(await runLadderRecompute());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "ladder-failed" }, { status: 500 });
  }
}
