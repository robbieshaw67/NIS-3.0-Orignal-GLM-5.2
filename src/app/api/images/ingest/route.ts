// NIP v3.0 — Image ingestion endpoint (M3 Visual Intelligence)
// Accepts an image URL or base64, creates an IngestedImage row with PENDING status,
// and optionally triggers the VLM dual-route pipeline immediately.
//
// Spec §5: "images attached to ingested posts flow in automatically; image-hash
// dedup doubles as a chart-virality counter (crowding datum)."

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { imageUrl, imageBase64, parentRawId, processImmediately } = body ?? {};

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { ok: false, error: "imageUrl or imageBase64 required" },
        { status: 400 }
      );
    }

    // Hash the image for dedup (virality counter — same image seen multiple times)
    const imageHash = createHash("sha256")
      .update(imageUrl ?? imageBase64.slice(0, 1000))
      .digest("hex")
      .slice(0, 32);

    // Check for existing image (dedup)
    const existing = await db.ingestedImage.findUnique({ where: { imageHash } });
    if (existing) {
      // Virality counter — same image seen again
      const updated = await db.ingestedImage.update({
        where: { id: existing.id },
        data: { viralityCount: { increment: 1 } },
      });
      return NextResponse.json({
        ok: true,
        imageId: existing.id,
        dedup: true,
        viralityCount: updated.viralityCount,
      });
    }

    // Create the IngestedImage
    const storageRef = imageUrl
      ? `images/url/${imageHash}`
      : `images/base64/${imageHash}`;

    const image = await db.ingestedImage.create({
      data: {
        imageHash,
        parentRawId: parentRawId ?? null,
        storageRef,
        classifierClass: "OTHER", // will be set by VLM pipeline
        confidence: "LOW",
        ratificationStatus: "PENDING",
        viralityCount: 1,
      },
    });

    // Optionally trigger VLM pipeline immediately
    if (processImmediately) {
      try {
        const { runVLMDualRoute } = await import("@/lib/vlm-pipeline");
        await runVLMDualRoute({ imageId: image.id, imageRef: storageRef });
      } catch {
        // Pipeline failure doesn't fail the ingestion — the cron will retry
      }
    }

    return NextResponse.json({ ok: true, imageId: image.id, dedup: false });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "image-ingest-failed" },
      { status: 500 }
    );
  }
}
