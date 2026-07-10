// NIP v3.0 — ops:backup — nightly off-box dump + monthly restore drill (L13)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runBackupJob } = await import("@/lib/adapters");
    return NextResponse.json(await runBackupJob());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "backup-failed" }, { status: 500 });
  }
}
