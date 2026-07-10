// NIP v3.0 — RSS adapter job endpoint
// Vercel Cron target: daily tier (Spec §6). Idempotent + resumable via watermarks.

import { NextResponse } from "next/server";
import { runRssAdapter } from "@/lib/adapters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const result = await runRssAdapter();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await runRssAdapter();
  return NextResponse.json(result);
}
