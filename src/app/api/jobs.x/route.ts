// NIP v3.0 — X adapter job endpoint (scraper-first per logged decision)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runXAdapter } = await import("@/lib/adapters");
    const result = await runXAdapter();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "x-failed" }, { status: 500 });
  }
}
