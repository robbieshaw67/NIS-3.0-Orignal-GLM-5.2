// NIP v3.0 — Engagement ruling: PS rules on a staged engagement (L10)
// When all engagements for a thesis are ANSWERED, contrarian → SURVIVED.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { engagementId, psDecision, reasoning, psActor } = body ?? {};
  if (!engagementId || !psDecision) {
    return NextResponse.json({ ok: false, error: "engagementId and psDecision required" }, { status: 400 });
  }
  if (!["ANSWERED", "OPEN", "CONCEDED"].includes(psDecision)) {
    return NextResponse.json({ ok: false, error: "psDecision must be ANSWERED|OPEN|CONCEDED" }, { status: 400 });
  }
  try {
    const { ruleOnEngagement } = await import("@/lib/promotion");
    const result = await ruleOnEngagement({ engagementId, psDecision, reasoning, psActor });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "engagement-ruling-failed" }, { status: 500 });
  }
}
