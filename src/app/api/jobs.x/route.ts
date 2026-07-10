// NIP v3.0 — X adapter job endpoint (scraper-first per logged decision)

import { NextResponse } from "next/server";
import { runXAdapter } from "@/lib/adapters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const result = await runXAdapter();
  return NextResponse.json(result);
}
