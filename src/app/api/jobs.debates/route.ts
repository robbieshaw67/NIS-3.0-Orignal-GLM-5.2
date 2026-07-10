// NIP v3.0 — Debate auto-assembly job (v2.1 §2.2)
// Assembles debates from QuantClaim dispersion, ThesisEngagement rows, and stance collisions.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runDebateAssembly } = await import("@/lib/debate-assembly");
    return NextResponse.json(await runDebateAssembly());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "debate-assembly-failed" }, { status: 500 });
  }
}
