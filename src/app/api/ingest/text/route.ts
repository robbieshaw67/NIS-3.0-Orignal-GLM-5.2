// NIP v3.0 — Paste raw text ingestion (M1 Manual intake)
// Stores the pasted text, runs triage + extraction, auto-extracts images.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json().catch(() => ({}));
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }

    const { storeRaw, triageAndExtract } = await import("@/lib/adapters");
    const { db } = await import("@/lib/db");

    const { id: rawId, created } = await storeRaw({
      url: `manual:paste:${Date.now()}`,
      title: title || "Pasted content",
      bodyText: text,
      adapterType: "MANUAL",
      adapterVersion: "v1",
    });

    if (!created) {
      return NextResponse.json({ ok: true, rawContentId: rawId, dedup: true });
    }

    const author = await db.author.findFirst({ where: { handle: "ps" } });
    if (author) {
      const result = await triageAndExtract(text, author.id, rawId);
      if (!result.skipped) {
        await db.source.create({
          data: {
            rawContentId: rawId,
            extractionVersion: "deep_extract/v3",
            authorId: author.id,
            dateIso: result.extracted!.dateIso,
            dateEarliest: result.extracted!.dateEarliest,
            dateLatest: result.extracted!.dateLatest,
            direction: result.extracted!.direction,
            conviction: result.extracted!.conviction,
            confidence: result.extracted!.confidence,
            insightType: result.extracted!.insightType,
            verbatimQuote: result.extracted!.verbatimQuote,
            keyInsight: result.extracted!.keyInsight,
            tickers: result.extracted!.tickers as any,
            entities: result.extracted!.entities as any,
            independenceClass: "UNCLASSIFIED",
            spanStart: result.extracted!.spanStart,
            spanEnd: result.extracted!.spanEnd,
            spanConfidence: result.extracted!.spanConfidence,
          },
        });
        await db.rawContent.update({ where: { id: rawId }, data: { extractionStatus: "EXTRACTED" } });
      } else {
        await db.rawContent.update({ where: { id: rawId }, data: { extractionStatus: "SKIPPED_TRIAGE" } });
      }
    }

    return NextResponse.json({ ok: true, rawContentId: rawId, bodyLength: text.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "ingest-failed" }, { status: 500 });
  }
}
