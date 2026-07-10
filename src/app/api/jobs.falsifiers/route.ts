// NIP v3.0 — monitor:falsifiers job endpoint (deterministic screen + consequences)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runFalsifierMonitor } = await import("@/lib/adapters");
    return NextResponse.json(await runFalsifierMonitor());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "falsifiers-failed" }, { status: 500 });
  }
}
