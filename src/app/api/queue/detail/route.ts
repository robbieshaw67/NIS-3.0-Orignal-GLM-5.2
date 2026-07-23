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
//
// When payload is empty (e.g. seeded queue items), falls back to best-effort
// lookup based on the summary text — searches theses, authors, falsifiers, etc.

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
  const summary = queueItem.summary || "";

  try {
    switch (queueItem.type) {
      case "RULING": {
        // Try payload first, then fallback to summary search
        let thesis = null;
        if (payload.thesisId) {
          thesis = await db.thesis.findUnique({
            where: { id: payload.thesisId },
            include: {
              engagements: { orderBy: { createdAt: "desc" } },
              quantClaims: { include: { source: true } },
            },
          });
        }
        // Fallback: search by title keywords from the summary
        if (!thesis) {
          const keywords = summary.split(/[:.,\s]+/).filter(w => w.length > 4).slice(0, 3);
          for (const kw of keywords) {
            thesis = await db.thesis.findFirst({
              where: { title: { contains: kw, mode: "insensitive" } },
              include: {
                engagements: { orderBy: { createdAt: "desc" }, take: 10 },
                quantClaims: { include: { source: true }, take: 5 },
              },
            });
            if (thesis) break;
          }
        }
        detail.thesis = thesis;
        detail.engagements = thesis?.engagements ?? [];

        // If no engagements found via thesis, try fetching all open engagements
        if (detail.engagements.length === 0) {
          detail.engagements = await db.thesisEngagement.findMany({
            where: { status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 10,
          });
        }
        break;
      }
      case "VLM_RATIFY": {
        const imageId = payload.imageId;
        if (imageId) {
          detail.image = await db.ingestedImage.findUnique({
            where: { id: imageId },
            include: { parentRaw: true },
          });
        }
        // Fallback: get the most recent pending image
        if (!detail.image) {
          detail.image = await db.ingestedImage.findFirst({
            where: { ratificationStatus: "PENDING" },
            include: { parentRaw: true },
            orderBy: { createdAt: "desc" },
          });
        }
        break;
      }
      case "TRIPWIRE": {
        let falsifier = null;
        if (payload.falsifierId) {
          falsifier = await db.falsifier.findUnique({ where: { id: payload.falsifierId } });
        }
        // Fallback: search by statement text from summary keywords
        if (!falsifier) {
          const keywords = summary.split(/[:.,\s]+/).filter(w => w.length > 4).slice(0, 3);
          for (const kw of keywords) {
            falsifier = await db.falsifier.findFirst({
              where: {
                OR: [
                  { statement: { contains: kw, mode: "insensitive" } },
                  { compiledQuery: { contains: kw, mode: "insensitive" } },
                  { eventFamily: { contains: kw, mode: "insensitive" } },
                ],
              },
            });
            if (falsifier) break;
          }
        }
        // Fallback: get any armed/partial falsifier
        if (!falsifier) {
          falsifier = await db.falsifier.findFirst({
            where: { status: { in: ["ARMED", "PARTIAL"] } },
            orderBy: { armedAt: "desc" },
          });
        }
        detail.falsifier = falsifier;
        // Link to thesis — falsifier has thesisIds (JSON array), not thesisId
        if (falsifier?.thesisIds) {
          let thesisIds: string[] = [];
          try {
            thesisIds = typeof falsifier.thesisIds === "string" 
              ? JSON.parse(falsifier.thesisIds) 
              : falsifier.thesisIds;
          } catch {}
          if (Array.isArray(thesisIds) && thesisIds.length > 0) {
            detail.thesis = await db.thesis.findUnique({ where: { id: thesisIds[0] } });
          }
        }
        break;
      }
      case "ALERT": {
        let author = null;
        if (payload.authorId) {
          author = await db.author.findUnique({
            where: { id: payload.authorId },
            include: {
              stances: { orderBy: { lastEventDate: "desc" }, take: 5 },
              stanceChanges: { orderBy: { createdAt: "desc" }, take: 3 },
            },
          });
        }
        // Fallback: search by handle or name in summary
        if (!author) {
          // Extract name from summary (e.g. "Citrini REVERSING on Hyperscaler Concentration")
          const handleMatch = summary.match(/@?(\w+)/);
          if (handleMatch) {
            const name = handleMatch[1];
            author = await db.author.findFirst({
              where: {
                OR: [
                  { realName: { contains: name, mode: "insensitive" } },
                  { handle: { contains: name, mode: "insensitive" } },
                ],
              },
              include: {
                stances: { orderBy: { lastEventDate: "desc" }, take: 5 },
                stanceChanges: { orderBy: { createdAt: "desc" }, take: 3 },
              },
            });
          }
        }
        detail.author = author;

        // Find thesis mentioned in summary
        if (payload.thesisId) {
          detail.thesis = await db.thesis.findUnique({ where: { id: payload.thesisId } });
        } else {
          const keywords = summary.split(/[:.,\s]+/).filter(w => w.length > 5).slice(0, 3);
          for (const kw of keywords) {
            detail.thesis = await db.thesis.findFirst({
              where: { title: { contains: kw, mode: "insensitive" } },
            });
            if (detail.thesis) break;
          }
        }

        // Get recent stance changes regardless
        if (!author?.stanceChanges?.length) {
          detail.recentStanceChanges = await db.stanceChange.findMany({
            include: { author: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          });
        }
        break;
      }
      case "CANDIDATE": {
        let candidate = null;
        if (payload.candidateId) {
          candidate = await db.sourceCandidate.findUnique({ where: { id: payload.candidateId } });
        }
        // Fallback: search by handle in summary
        if (!candidate) {
          const handleMatch = summary.match(/@(\w+)/);
          if (handleMatch) {
            candidate = await db.sourceCandidate.findFirst({
              where: { handle: { contains: handleMatch[1], mode: "insensitive" } },
            });
          }
        }
        // Fallback: get most recent proposed candidate
        if (!candidate) {
          candidate = await db.sourceCandidate.findFirst({
            where: { status: "PROPOSED" },
            orderBy: { proposedAt: "desc" },
          });
        }
        detail.candidate = candidate;
        break;
      }
      case "ATTRIBUTION":
      case "QUARANTINE": {
        let source = null;
        if (payload.sourceId) {
          source = await db.source.findUnique({
            where: { id: payload.sourceId },
            include: { rawContent: true, informationEvent: true, author: true },
          });
        }
        // Fallback: search by keywords in verbatimQuote, keyInsight, or speaker
        if (!source) {
          const keywords = summary.split(/[:.,\s]+/).filter(w => w.length > 4).slice(0, 3);
          for (const kw of keywords) {
            source = await db.source.findFirst({
              where: {
                OR: [
                  { verbatimQuote: { contains: kw, mode: "insensitive" } },
                  { keyInsight: { contains: kw, mode: "insensitive" } },
                  { speaker: { contains: kw, mode: "insensitive" } },
                ],
              },
              include: { rawContent: true, informationEvent: true, author: true },
            });
            if (source) break;
          }
        }
        detail.source = source;

        if (payload.rawContentId) {
          detail.rawContent = await db.rawContent.findUnique({ where: { id: payload.rawContentId } });
        } else if (!source) {
          // Fallback: get a recent raw content matching the queue type
          const where: any = {};
          if (queueItem.type === "QUARANTINE") {
            where.extractionStatus = "SKIPPED_TRIAGE";
          }
          detail.rawContent = await db.rawContent.findFirst({
            where,
            orderBy: { fetchedAt: "desc" },
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
