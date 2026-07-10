// NIP v3.0 — Pipeline jobs (events clustering, ladder recompute, falsifier monitor)

import { NextResponse } from "next/server";
import { runEventsPipeline, runLadderRecompute, runFalsifierMonitor } from "@/lib/adapters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { job } = await req.json().catch(() => ({ job: "events" }));
  if (job === "events") return NextResponse.json(await runEventsPipeline());
  if (job === "ladder") return NextResponse.json(await runLadderRecompute());
  if (job === "falsifiers") return NextResponse.json(await runFalsifierMonitor());
  return NextResponse.json({ ok: false, error: "unknown job" }, { status: 400 });
}
