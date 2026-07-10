// NIP v3.0 — Transcript adapter (publish-watch on registered channels)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runTranscriptAdapter } = await import("@/lib/adapters");
    const result = await runTranscriptAdapter();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "transcripts-failed" }, { status: 500 });
  }
}
