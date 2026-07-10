// NIP v3.0 — Transcript adapter (publish-watch on registered channels)

import { NextResponse } from "next/server";
import { runTranscriptAdapter } from "@/lib/adapters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const result = await runTranscriptAdapter();
  return NextResponse.json(result);
}
