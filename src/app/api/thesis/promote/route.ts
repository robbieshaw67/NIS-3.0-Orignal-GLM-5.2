// NIP v3.0 — Thesis promotion: gate check + ACTIONABLE → auto PAPER position
// L10: PS-gated — only PS can call this. In production, requires auth check.

import { NextRequest, NextResponse } from "next/server";
import { attemptPromote } from "@/lib/promotion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { thesisId, psActor } = body ?? {};
  if (!thesisId) {
    return NextResponse.json({ ok: false, error: "thesisId required" }, { status: 400 });
  }
  try {
    const result = await attemptPromote({ thesisId, psActor });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
