// NIP v3.0 — Deep-examine URL ingestion (M1 Manual intake)
// Fetches the URL, stores raw, runs triage + extraction, auto-extracts images.
// L2: store raw before extracting. L3: errors never verdicts.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url) {
      return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
    }

    // Fetch the URL
    let bodyText = "";
    let title = url;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "NIP-v3/1.0 (narrative-intelligence-platform)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) {
        return NextResponse.json({ ok: false, error: `fetch failed: ${resp.status}` }, { status: 502 });
      }
      const html = await resp.text();
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();
      // Strip HTML tags for body text (simplified — production would use a proper parser)
      bodyText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);
    } catch (e: any) {
      // L3: fetch failure → RETRY, not a verdict
      return NextResponse.json({ ok: false, error: `fetch error: ${e.message}` }, { status: 502 });
    }

    // Store raw + extract (lazy import to avoid Turbopack issues)
    const { storeRaw, triageAndExtract } = await import("@/lib/adapters");
    const { id: rawId, created } = await storeRaw({
      url,
      title,
      bodyText,
      adapterType: "MANUAL",
      adapterVersion: "v1",
    });

    if (!created) {
      return NextResponse.json({ ok: true, rawContentId: rawId, dedup: true, message: "Already ingested" });
    }

    // Run triage + extraction
    const author = await (await import("@/lib/db")).db.author.findFirst({
      where: { handle: "ps" }, // attribute manual intake to PS
    });
    if (author) {
      const result = await triageAndExtract(bodyText, author.id, rawId);
      const { db } = await import("@/lib/db");
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

    return NextResponse.json({ ok: true, rawContentId: rawId, title, bodyLength: bodyText.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "ingest-failed" }, { status: 500 });
  }
}
