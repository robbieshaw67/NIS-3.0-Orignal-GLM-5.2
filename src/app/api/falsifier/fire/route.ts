// NIP v3.0 — Falsifier fire: deterministic consequence → EXIT_REVIEW + demotion
// Spec §9: "non-price stop: linked falsifier fires → exit signal regardless of chart"

import { NextRequest, NextResponse } from "next/server";
import { fireFalsifier } from "@/lib/promotion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { falsifierId, firingEvidence, psActor } = body ?? {};
  if (!falsifierId) {
    return NextResponse.json({ ok: false, error: "falsifierId required" }, { status: 400 });
  }
  try {
    const result = await fireFalsifier({ falsifierId, firingEvidence, psActor });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
