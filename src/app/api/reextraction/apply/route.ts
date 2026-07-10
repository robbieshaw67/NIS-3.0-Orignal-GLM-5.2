// NIP v3.0 — CP10 apply: PS-approved diff → write to Source rows (L10 staged)
// L1: LLM never sets a stage/price — provider strip-and-log enforces structurally.
// L2: raw preserved; extraction is a versioned, reprocessable transform.
// L3: CP3 violations quarantine, never silently downgrade.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { diffs, psActor } = body ?? {};
  if (!Array.isArray(diffs) || diffs.length === 0) {
    return NextResponse.json({ ok: false, error: "diffs[] required" }, { status: 400 });
  }
  try {
    const { applyReextraction } = await import("@/lib/reextraction");
    const result = await applyReextraction({ diffs, psActor });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "apply-failed", applied: 0, skipped: 0, auditIds: [] }, { status: 500 });
  }
}
