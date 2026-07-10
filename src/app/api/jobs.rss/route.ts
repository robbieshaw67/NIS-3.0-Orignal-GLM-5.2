// NIP v3.0 — RSS adapter job endpoint
// Vercel Cron target: daily tier (Spec §6). Idempotent + resumable via watermarks.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runRssAdapter } = await import("@/lib/adapters");
    const result = await runRssAdapter();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "rss-failed" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
