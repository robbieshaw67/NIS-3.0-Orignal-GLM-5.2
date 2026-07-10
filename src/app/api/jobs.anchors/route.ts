// NIP v3.0 — Anchors adapter (TrendForce/DRAMeXchange, revision chaining)

import { NextResponse } from "next/server";
import { runAnchorsAdapter } from "@/lib/adapters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const result = await runAnchorsAdapter();
  return NextResponse.json(result);
}
