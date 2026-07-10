// NIP v3.0 — CP10 apply: PS-approved diff → write to Source rows (L10 staged)
// L1: LLM never sets a stage/price — provider strip-and-log enforces structurally.
// L2: raw preserved; extraction is a versioned, reprocessable transform.
// L3: CP3 violations quarantine, never silently downgrade.

import { NextRequest, NextResponse } from "next/server";
import { applyReextraction, type ReextractionDiff } from "@/lib/reextraction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { diffs, psActor } = body ?? {};
  if (!Array.isArray(diffs) || diffs.length === 0) {
    return NextResponse.json({ ok: false, error: "diffs[] required" }, { status: 400 });
  }
  const result = await applyReextraction({ diffs: diffs as ReextractionDiff[], psActor });
  return NextResponse.json({ ok: true, ...result });
}
