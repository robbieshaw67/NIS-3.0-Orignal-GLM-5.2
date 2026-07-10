// NIP v3.0 — Pipeline jobs (events clustering, ladder recompute, falsifier monitor)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { job } = await req.json().catch(() => ({ job: "events" }));
    const mod = await import("@/lib/adapters");
    if (job === "events") return NextResponse.json(await mod.runEventsPipeline());
    if (job === "ladder") return NextResponse.json(await mod.runLadderRecompute());
    if (job === "falsifiers") return NextResponse.json(await mod.runFalsifierMonitor());
    return NextResponse.json({ ok: false, error: "unknown job" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "pipeline-failed" }, { status: 500 });
  }
}
