// NIP v3.0 — Queue Detail API
// Expands a queue item with full context so the operator can see what's behind it
// before ruling. Each queue type fetches the relevant data:
//   RULING      → thesis + staged engagements
//   VLM_RATIFY  → ingested image + extraction results
//   TRIPWIRE    → falsifier + linked thesis
//   ALERT       → stance change + author + sources
//   CANDIDATE   → source candidate + sample refs
//   ATTRIBUTION → flagged source + raw content
//   QUARANTINE  → quarantined raw content + reason

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const queueItem = await db.queueItem.findUnique({ where: { id } });
  if (!queueItem) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // Parse payload safely (Postgres JSON can return as string)
  let payload: any = queueItem.payload ?? {};
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }

  const detail: any = { ...queueItem, payload };

  try {
    switch (queueItem.type) {
      case "RULING": {
        // Thesis + staged engagements
        const thesisId = payload.thesisId;
        if (thesisId) {
          const thesis = await db.thesis.findUnique({
            where: { id: thesisId },
            include: {
              engagements: { orderBy: { createdAt: "desc" } },
              quantClaims: { include: { source: true } },
            },
          });
          detail.thesis = thesis;
          detail.engagements = thesis?.engagements ?? [];
        }
        break;
      }
      case "VLM_RATIFY": {
        const imageId = payload.imageId;
        if (imageId) {
          const image = await db.ingestedImage.findUnique({
            where: { id: imageId },
            include: { parentRaw: true },
          });
          detail.image = image;
        }
        break;
      }
      case "TRIPWIRE": {
        const falsifierId = payload.falsifierId;
        if (falsifierId) {
          const falsifier = await db.falsifier.findUnique({
            where: { id: falsifierId },
          });
          detail.falsifier = falsifier;
          if (falsifier?.thesisId) {
            detail.thesis = await db.thesis.findUnique({
              where: { id: falsifier.thesisId },
            });
          }
        }
        break;
      }
      case "ALERT": {
        const authorId = payload.authorId;
        if (authorId) {
          const author = await db.author.findUnique({
            where: { id: authorId },
            include: {
              stances: { orderBy: { createdAt: "desc" }, take: 5 },
              stanceChanges: { orderBy: { createdAt: "desc" }, take: 3 },
            },
          });
          detail.author = author;
        }
        const thesisId = payload.thesisId;
        if (thesisId) {
          detail.thesis = await db.thesis.findUnique({ where: { id: thesisId } });
        }
        break;
      }
      case "CANDIDATE": {
        const candidateId = payload.candidateId;
        if (candidateId) {
          detail.candidate = await db.sourceCandidate.findUnique({
            where: { id: candidateId },
          });
        }
        break;
      }
      case "ATTRIBUTION":
      case "QUARANTINE": {
        const sourceId = payload.sourceId;
        if (sourceId) {
          const source = await db.source.findUnique({
            where: { id: sourceId },
            include: { rawContent: true, informationEvent: true },
          });
          detail.source = source;
        }
        const rawContentId = payload.rawContentId;
        if (rawContentId) {
          detail.rawContent = await db.rawContent.findUnique({
            where: { id: rawContentId },
          });
        }
        break;
      }
    }
  } catch (e: any) {
    detail.fetchError = e?.message ?? "detail-fetch-failed";
  }

  return NextResponse.json({ ok: true, detail });
}
