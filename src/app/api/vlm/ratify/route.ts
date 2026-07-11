// NIP v3.0 — VLM ratification: PS ratifies or rejects a VLM extraction (L10)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { imageId, decision, correctedValues } = body ?? {};
  if (!imageId || !decision) {
    return NextResponse.json({ ok: false, error: "imageId and decision required" }, { status: 400 });
  }
  if (!["RATIFIED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ ok: false, error: "decision must be RATIFIED|REJECTED" }, { status: 400 });
  }

  await db.ingestedImage.update({
    where: { id: imageId },
    data: { ratificationStatus: decision },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      actor: "PS",
      action: `VLM_${decision}`,
      targetType: "IngestedImage",
      targetId: imageId,
      payload: { decision, correctedValues } as any,
    },
  });

  // Check graduation
  const { checkRatificationGraduation } = await import("@/lib/vlm-pipeline");
  const grad = await checkRatificationGraduation();

  return NextResponse.json({
    ok: true,
    imageId,
    decision,
    graduation: grad,
  });
}
