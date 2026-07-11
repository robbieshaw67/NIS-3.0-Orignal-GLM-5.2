// NIP v3.0 — monitor:verifications job endpoint (passed events → claim resolution)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runVerificationsMonitor } = await import("@/lib/adapters");
    return NextResponse.json(await runVerificationsMonitor());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "verifications-failed" }, { status: 500 });
  }
}
