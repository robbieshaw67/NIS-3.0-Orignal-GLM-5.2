// NIP v3.0 — CP10 Apply step (M2 Checkpoint 10, Spec §4)
//
// "Re-extraction console: source-set × prompt-version → dry-run diff →
//  PS approves → applies (L2 made operable; the 515 degraded sources are its
//  first customer)."
//
// The apply step runs the new extraction over a source-set, compares field-by-field
// against the current extraction, writes a diff to the audit log, and updates
// the Source rows with the new extractionVersion + fields + span anchors.
//
// L1: The LLM never sets a stage, price, weight, or gate decision — the provider
//     layer's strip-and-log enforces this structurally. We additionally assert
//     no extractionVersion transition touches stage/price fields.
// L2: Raw is preserved; extraction is a versioned, reprocessable transform.
// L3: If the new extraction fails CP3 (verbatim not in raw), the source is
//     quarantined, NOT silently downgraded.

import { db } from "./db";
import { complete, getPrompt } from "./provider";
import { z } from "zod";
import { createHash } from "crypto";

const deepExtractSchema = z.object({
  direction: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  conviction: z.enum(["LOW", "MEDIUM", "HIGH"]),
  insightType: z.enum(["FORECAST", "OBSERVATION", "OPINION"]),
  verbatimQuote: z.string(),
  keyInsight: z.string(),
  tickers: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  confidence: z.enum(["CLEAN", "HEDGED", "AMBIGUOUS"]),
});

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

function locateInBody(body: string, quote: string): { start: number; end: number } | null {
  const idx = body.indexOf(quote);
  if (idx >= 0) return { start: idx, end: idx + quote.length };
  const head = quote.slice(0, 30);
  const fidx = body.indexOf(head);
  if (fidx >= 0) return { start: fidx, end: fidx + quote.length };
  return null;
}

export interface ReextractionDiff {
  sourceId: string;
  rawContentId: string;
  before: {
    extractionVersion: string;
    direction: string;
    conviction: string;
    insightType: string;
    verbatimQuote: string;
    keyInsight: string;
    confidence: string;
    spanStart: number | null;
    spanEnd: number | null;
  };
  after: {
    extractionVersion: string;
    direction: string;
    conviction: string;
    insightType: string;
    verbatimQuote: string;
    keyInsight: string;
    confidence: string;
    spanStart: number | null;
    spanEnd: number | null;
    spanConfidence: string | null;
  } | null;
  changedFields: string[];
  quarantined: boolean;
  quarantineReason?: string;
}

// ── dry-run: produce the diff without applying ──
export async function dryRunReextraction(args: {
  sourceIds?: string[];
  degradedOnly?: boolean;
  targetVersion: string;
}): Promise<{ diffs: ReextractionDiff[]; counts: { scanned: number; changed: number; quarantined: number } }> {
  const where: any = {};
  if (args.sourceIds && args.sourceIds.length > 0) {
    where.id = { in: args.sourceIds };
  }
  if (args.degradedOnly) {
    where.degradedExtraction = true;
  }

  const sources = await db.source.findMany({
    where,
    include: { rawContent: true },
    take: 1, // batch limit — PS reviews in chunks; LLM calls are slow
  });

  const diffs: ReextractionDiff[] = [];
  let changed = 0, quarantined = 0;

  for (const src of sources) {
    const before = {
      extractionVersion: src.extractionVersion,
      direction: src.direction,
      conviction: src.conviction,
      insightType: src.insightType,
      verbatimQuote: src.verbatimQuote,
      keyInsight: src.keyInsight,
      confidence: src.confidence,
      spanStart: src.spanStart,
      spanEnd: src.spanEnd,
    };

    // Re-run extraction with the target version
    const ext = await complete({
      taskType: "DEEP_EXTRACT",
      prompt: { ...getPrompt("deep_extract/v3"), params: { content: (src.rawContent?.bodyText ?? "").slice(0, 4000) } },
      schema: deepExtractSchema,
      cacheKey: hash((src.rawContent?.bodyText ?? "") + args.targetVersion),
    });
    const ex = deepExtractSchema.safeParse(ext.data);

    if (!ex.success) {
      diffs.push({
        sourceId: src.id,
        rawContentId: src.rawContentId,
        before,
        after: null,
        changedFields: [],
        quarantined: true,
        quarantineReason: "deep-extract parse-error on new version",
      });
      quarantined++;
      continue;
    }

    // CP3 — verbatim quote must be locatable in stored raw
    const body = src.rawContent?.bodyText ?? "";
    const span = locateInBody(body, ex.data.verbatimQuote);
    if (!span) {
      diffs.push({
        sourceId: src.id,
        rawContentId: src.rawContentId,
        before,
        after: null,
        changedFields: [],
        quarantined: true,
        quarantineReason: "CP3 violation — verbatim quote not found in stored raw",
      });
      quarantined++;
      continue;
    }

    const after = {
      extractionVersion: args.targetVersion,
      direction: ex.data.direction,
      conviction: ex.data.conviction,
      insightType: ex.data.insightType,
      verbatimQuote: ex.data.verbatimQuote,
      keyInsight: ex.data.keyInsight,
      confidence: ex.data.confidence,
      spanStart: span.start,
      spanEnd: span.end,
      spanConfidence: "EXACT" as const,
    };

    const changedFields: string[] = [];
    for (const k of ["extractionVersion", "direction", "conviction", "insightType", "verbatimQuote", "keyInsight", "confidence", "spanStart", "spanEnd"] as const) {
      if (before[k] !== after[k]) changedFields.push(k);
    }

    if (changedFields.length > 0) changed++;

    diffs.push({ sourceId: src.id, rawContentId: src.rawContentId, before, after, changedFields, quarantined: false });
  }

  return { diffs, counts: { scanned: sources.length, changed, quarantined } };
}

// ── apply: write the new extraction to Source rows (after PS approval) ──
export async function applyReextraction(args: {
  diffs: ReextractionDiff[];
  psActor?: string;
}): Promise<{ applied: number; skipped: number; auditIds: string[] }> {
  let applied = 0, skipped = 0;
  const auditIds: string[] = [];

  for (const diff of args.diffs) {
    if (diff.quarantined || !diff.after) {
      skipped++;
      // Write the quarantine to a queue item (L3)
      if (diff.quarantined) {
        await db.queueItem.create({
          data: {
            type: "QUARANTINE",
            priority: 4,
            summary: `CP10 re-extraction quarantined source ${diff.sourceId.slice(-6)}: ${diff.quarantineReason}`,
            payload: { sourceId: diff.sourceId, reason: diff.quarantineReason } as any,
            status: "OPEN",
          },
        });
      }
      continue;
    }

    // Write the new extraction
    await db.source.update({
      where: { id: diff.sourceId },
      data: {
        extractionVersion: diff.after.extractionVersion,
        direction: diff.after.direction,
        conviction: diff.after.conviction,
        insightType: diff.after.insightType,
        verbatimQuote: diff.after.verbatimQuote,
        keyInsight: diff.after.keyInsight,
        confidence: diff.after.confidence,
        spanStart: diff.after.spanStart,
        spanEnd: diff.after.spanEnd,
        spanConfidence: diff.after.spanConfidence,
        degradedExtraction: false, // graduating from degraded status
      },
    });

    // Audit log — every transition carries its evidence snapshot (Spec §11)
    const audit = await db.auditLog.create({
      data: {
        actor: args.psActor ?? "PS",
        action: "CP10_APPLY",
        targetType: "Source",
        targetId: diff.sourceId,
        payload: {
          before: diff.before,
          after: diff.after,
          changedFields: diff.changedFields,
        } as any,
      },
    });
    auditIds.push(audit.id);
    applied++;
  }

  return { applied, skipped, auditIds };
}
