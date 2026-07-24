// NIP v3.0 — List ingested images with VLM analysis results
// Returns images with classification, annotation/axis-read values, ratification status.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get("status") || "all";

  const where: any = {};
  if (status !== "all") {
    where.ratificationStatus = status;
  }

  const images = await db.ingestedImage.findMany({
    where,
    include: { parentRaw: { select: { title: true, url: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Parse JSON fields safely
  const parsed = images.map(img => {
    let annotation: any = img.annotationRoute;
    let axisRead: any = img.axisReadRoute;
    try {
      if (typeof annotation === "string") {
        annotation = JSON.parse(annotation);
        if (typeof annotation === "string") annotation = JSON.parse(annotation);
      }
    } catch { annotation = {}; }
    try {
      if (typeof axisRead === "string") {
        axisRead = JSON.parse(axisRead);
        if (typeof axisRead === "string") axisRead = JSON.parse(axisRead);
      }
    } catch { axisRead = {}; }

    return {
      id: img.id,
      imageUrl: (img as any).imageUrl || null,
      imageHash: img.imageHash,
      storageRef: img.storageRef,
      classifierClass: img.classifierClass,
      annotation,
      axisRead,
      discrepancyFlag: img.discrepancyFlag,
      confidence: img.confidence,
      ratificationStatus: img.ratificationStatus,
      viralityCount: img.viralityCount,
      createdAt: img.createdAt,
      parentTitle: img.parentRaw?.title || null,
      parentUrl: img.parentRaw?.url || null,
    };
  });

  // Summary counts
  const summary = {
    total: parsed.length,
    pending: parsed.filter(i => i.ratificationStatus === "PENDING").length,
    ratified: parsed.filter(i => i.ratificationStatus === "RATIFIED").length,
    rejected: parsed.filter(i => i.ratificationStatus === "REJECTED").length,
    retry: parsed.filter(i => i.ratificationStatus === "PENDING_RETRY").length,
    mismatched: parsed.filter(i => i.discrepancyFlag === "DUAL_ROUTE_MISMATCH").length,
    charts: parsed.filter(i => i.classifierClass === "CHART").length,
    tables: parsed.filter(i => i.classifierClass === "TABLE").length,
    other: parsed.filter(i => i.classifierClass === "OTHER").length,
  };

  return NextResponse.json({ ok: true, images: parsed, summary });
}
