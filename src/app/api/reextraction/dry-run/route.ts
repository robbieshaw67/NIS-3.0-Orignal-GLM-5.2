// NIP v3.0 — CP10 dry-run: source-set × prompt-version → diff

import { NextRequest, NextResponse } from "next/server";
import { dryRunReextraction } from "@/lib/reextraction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sourceIds, degradedOnly, targetVersion } = body ?? {};
  if (!targetVersion) {
    return NextResponse.json({ ok: false, error: "targetVersion required" }, { status: 400 });
  }
  const result = await dryRunReextraction({
    sourceIds,
    degradedOnly: degradedOnly ?? false,
    targetVersion,
  });
  return NextResponse.json({ ok: true, ...result });
}
