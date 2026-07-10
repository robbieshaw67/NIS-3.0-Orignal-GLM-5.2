// NIP v3.0 — Pipeline jobs: events, stance, contrarian, ladder, falsifiers, verifications

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { job } = await req.json().catch(() => ({ job: "events" }));
    const mod = await import("@/lib/adapters");
    const dispatch: Record<string, () => Promise<any>> = {
      events:        mod.runEventsPipeline,
      stance:        mod.runStancePipeline,
      contrarian:    mod.runContrarianPipeline,
      ladder:        mod.runLadderRecompute,
      falsifiers:    mod.runFalsifierMonitor,
      verifications: mod.runVerificationsMonitor,
    };
    const runner = dispatch[job];
    if (!runner) return NextResponse.json({ ok: false, error: `unknown job: ${job}` }, { status: 400 });
    return NextResponse.json(await runner());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "pipeline-failed" }, { status: 500 });
  }
}
