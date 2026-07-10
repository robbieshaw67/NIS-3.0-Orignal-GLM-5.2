// NIP v3.0 — pipeline:contrarian job endpoint (engagement detection + PS queue)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runContrarianPipeline } = await import("@/lib/adapters");
    return NextResponse.json(await runContrarianPipeline());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "contrarian-failed" }, { status: 500 });
  }
}
