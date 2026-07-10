// NIP v3.0 — /api/health — data-free health endpoint (Spec §11, L13)
// "auth in front of everything except a data-free /health"

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nip",
    version: "3.0.0",
    timestamp: new Date().toISOString(),
  });
}
