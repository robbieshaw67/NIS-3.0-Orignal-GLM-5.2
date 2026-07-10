// NIP v3.0 — VLM dual-route job endpoint (processes pending PENDING images)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const { runVLMDualRoute } = await import("@/lib/vlm-pipeline");
    const pending = await db.ingestedImage.findMany({
      where: { ratificationStatus: "PENDING_RETRY" },
      take: 5,
    });
    const counts = { processed: 0, mismatched: 0, pending: pending.length };
    for (const img of pending) {
      counts.processed++;
      const result = await runVLMDualRoute({ imageId: img.id, imageRef: img.storageRef });
      if (result.discrepancyFlag) counts.mismatched++;
    }
    return NextResponse.json({ ok: true, counts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "vlm-failed" }, { status: 500 });
  }
}
