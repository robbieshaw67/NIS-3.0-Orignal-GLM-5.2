// NIP v3.0 — M2 Verification Checkpoints (Spec §4)
//
// The eleven checkpoints, all deterministic. This module implements the ones
// that were missing: CP2 (completeness), CP4 (drift sentinels), CP6 (discard
// ledger), CP8 (attribution), CP9 (contradiction tripwire).
//
// CP1 (pre-flight), CP3 (sampled extraction), CP5 (insert invariants),
// CP10 (re-extraction), CP11 (weekly scorecard) are already implemented
// elsewhere — see adapters.ts, reextraction.ts, and runScorecardJob.

import { db } from "./db";

// ─────────────────────────────────────────────────────────────────────
// CP2 — Completeness: fetched vs source-declared counts
// "gaps alert (the checkpoint that kills the '2-4 tweets where dozens existed')"
// ─────────────────────────────────────────────────────────────────────

export async function checkCompleteness(rawContentId: string): Promise<{
  ok: boolean;
  declaredCount: number | null;
  fetchedCount: number;
  cause: string;
}> {
  const raw = await db.rawContent.findUnique({ where: { id: rawContentId } });
  if (!raw) return { ok: false, declaredCount: null, fetchedCount: 0, cause: "raw not found" };

  // Count actual sources extracted from this raw
  const fetchedCount = await db.source.count({ where: { rawContentId } });

  // Source-declared count: for threads, the tweet count; for RSS, the item count
  // In production: parsed from the source's own metadata (tweet count, RSS item count)
  // Here: infer from bodyText structure
  let declaredCount: number | null = null;
  if (raw.adapterType === "X" && raw.threadId) {
    // Thread — count self-reply markers in bodyText
    const replyMarkers = (raw.bodyText.match(/\n@/g) || []).length;
    declaredCount = replyMarkers + 1;
  } else if (raw.adapterType === "RSS") {
    // RSS — count <item> or article markers
    const itemMarkers = (raw.bodyText.match(/<item>/gi) || []).length;
    declaredCount = itemMarkers > 0 ? itemMarkers : null;
  }

  if (declaredCount === null) {
    return { ok: true, declaredCount: null, fetchedCount, cause: "no declared count available" };
  }

  // Gap: declared but not fetched
  const gap = declaredCount - fetchedCount;
  if (gap > 2) {
    // L3: gap → alert, not silence
    await db.queueItem.create({
      data: {
        type: "ALERT",
        priority: 2,
        summary: `CP2 completeness gap: ${raw.title.slice(0, 50)} — declared ${declaredCount}, fetched ${fetchedCount} (${gap} missing)`,
        payload: { rawContentId, declaredCount, fetchedCount, gap } as any,
        status: "OPEN",
      },
    });
    return { ok: false, declaredCount, fetchedCount, cause: `${gap} items missing` };
  }

  return { ok: true, declaredCount, fetchedCount, cause: "" };
}

// ─────────────────────────────────────────────────────────────────────
// CP4 — Drift sentinels: rolling per-source baselines
// "hard deviation flags parser-break-or-source-change before a thesis starves"
// ─────────────────────────────────────────────────────────────────────

const DRIFT_DEVIATION_THRESHOLD = 0.5; // 50% deviation from baseline → flag

export async function checkDriftSentinel(authorId: string): Promise<{
  ok: boolean;
  baseline: { insightsPerPost: number; claimDensity: number };
  current: { insightsPerPost: number; claimDensity: number };
  cause: string;
}> {
  // Get the last 30 days of sources for this author (current window)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
  const recentSources = await db.source.findMany({
    where: { authorId, dateLatest: { gte: thirtyDaysAgo } },
    include: { quantClaims: true, rawContent: true },
  });

  // Get the previous 60 days (baseline window)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000);
  const baselineSources = await db.source.findMany({
    where: { authorId, dateLatest: { gte: ninetyDaysAgo, lt: thirtyDaysAgo } },
    include: { quantClaims: true, rawContent: true },
  });

  if (baselineSources.length === 0) {
    return {
      ok: true,
      baseline: { insightsPerPost: 0, claimDensity: 0 },
      current: { insightsPerPost: 0, claimDensity: 0 },
      cause: "no baseline yet",
    };
  }

  // Compute baselines
  const baselineRawContentIds = new Set(baselineSources.map(s => s.rawContentId));
  const baselinePostsCount = baselineRawContentIds.size;
  const baselineInsightsPerPost = baselineSources.length / Math.max(1, baselinePostsCount);
  const baselineClaimsCount = baselineSources.reduce((s, src) => s + src.quantClaims.length, 0);
  const baselineClaimDensity = baselineClaimsCount / Math.max(1, baselineSources.length);

  // Compute current window
  const currentRawContentIds = new Set(recentSources.map(s => s.rawContentId));
  const currentPostsCount = currentRawContentIds.size;
  const currentInsightsPerPost = recentSources.length / Math.max(1, currentPostsCount);
  const currentClaimsCount = recentSources.reduce((s, src) => s + src.quantClaims.length, 0);
  const currentClaimDensity = currentClaimsCount / Math.max(1, recentSources.length);

  // Check for hard deviation
  const insightsDeviation = baselineInsightsPerPost > 0
    ? Math.abs(currentInsightsPerPost - baselineInsightsPerPost) / baselineInsightsPerPost
    : 0;
  const claimDeviation = baselineClaimDensity > 0
    ? Math.abs(currentClaimDensity - baselineClaimDensity) / baselineClaimDensity
    : 0;

  if (insightsDeviation > DRIFT_DEVIATION_THRESHOLD || claimDeviation > DRIFT_DEVIATION_THRESHOLD) {
    const author = await db.author.findUnique({ where: { id: authorId } });
    // L3: drift → alert, not silence
    await db.queueItem.create({
      data: {
        type: "ALERT",
        priority: 3,
        summary: `CP4 drift sentinel: ${author?.handle ?? authorId} — insights/post ${baselineInsightsPerPost.toFixed(1)}→${currentInsightsPerPost.toFixed(1)}, claim density ${baselineClaimDensity.toFixed(2)}→${currentClaimDensity.toFixed(2)}`,
        payload: {
          authorId,
          baseline: { insightsPerPost: baselineInsightsPerPost, claimDensity: baselineClaimDensity },
          current: { insightsPerPost: currentInsightsPerPost, claimDensity: currentClaimDensity },
        } as any,
        status: "OPEN",
      },
    });
    return {
      ok: false,
      baseline: { insightsPerPost: baselineInsightsPerPost, claimDensity: baselineClaimDensity },
      current: { insightsPerPost: currentInsightsPerPost, claimDensity: currentClaimDensity },
      cause: `deviation > ${DRIFT_DEVIATION_THRESHOLD * 100}%`,
    };
  }

  return {
    ok: true,
    baseline: { insightsPerPost: baselineInsightsPerPost, claimDensity: baselineClaimDensity },
    current: { insightsPerPost: currentInsightsPerPost, claimDensity: currentClaimDensity },
    cause: "",
  };
}

// ─────────────────────────────────────────────────────────────────────
// CP6 — Triage discard ledger: two-pass economics with the discard side
// inspectable; weekly 10-sample PS review; discard-rate sentinel
// ─────────────────────────────────────────────────────────────────────

export async function updateDiscardLedger(batchId: string, discardedCount: number, totalCount: number): Promise<void> {
  const discardRate = totalCount > 0 ? discardedCount / totalCount : 0;
  await db.ingestionBatch.update({
    where: { id: batchId },
    data: {
      counts: {
        discarded: discardedCount,
        total: totalCount,
        discardRate: Math.round(discardRate * 100) / 100,
      } as any,
    },
  });

  // Discard-rate sentinel — if >30% discarded, alert
  if (discardRate > 0.3) {
    await db.queueItem.create({
      data: {
        type: "ALERT",
        priority: 4,
        summary: `CP6 discard-rate sentinel: batch ${batchId.slice(-6)} — ${Math.round(discardRate * 100)}% discarded (${discardedCount}/${totalCount})`,
        payload: { batchId, discardedCount, totalCount, discardRate } as any,
        status: "OPEN",
      },
    });
  }
}

export async function weeklyDiscardSample(): Promise<{
  sampleSize: number;
  sampled: any[];
}> {
  // Get the last 10 SKIPPED_TRIAGE raw contents for PS review
  const skipped = await db.rawContent.findMany({
    where: { extractionStatus: "SKIPPED_TRIAGE" },
    orderBy: { fetchedAt: "desc" },
    take: 10,
    include: { sources: false },
  });

  // Create a queue item for PS review
  if (skipped.length > 0) {
    await db.queueItem.create({
      data: {
        type: "RULING",
        priority: 5,
        summary: `CP6 weekly discard sample: ${skipped.length} items for PS review`,
        payload: { sampleIds: skipped.map(s => s.id), sampleSize: skipped.length } as any,
        status: "OPEN",
      },
    });
  }

  return { sampleSize: skipped.length, sampled: skipped };
}

// ─────────────────────────────────────────────────────────────────────
// CP8 — Attribution: speaker ≠ carrier on relayed content
// "ambiguity → one-question queue item"
// ─────────────────────────────────────────────────────────────────────

export async function checkAttribution(sourceId: string): Promise<{
  resolved: boolean;
  speakerId: string;
  carrierId: string | null;
  cause: string;
}> {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { rawContent: true },
  });
  if (!source) return { resolved: false, speakerId: "", carrierId: null, cause: "source not found" };

  // If no carrier, attribution is unambiguous
  if (!source.carrierAuthorId) {
    return { resolved: true, speakerId: source.authorId, carrierId: null, cause: "" };
  }

  // Carrier is set — check if the content indicates a relay (RT, repost, "per X")
  const body = source.rawContent?.bodyText ?? "";
  const relayIndicators = [
    /repost/i, /RT @/, /via @/, /per /i, /h\/t /i, /screenshot/i,
    /according to/i, /as reported by/i,
  ];
  const isRelay = relayIndicators.some(pattern => pattern.test(body));

  if (isRelay) {
    return {
      resolved: true,
      speakerId: source.authorId,
      carrierId: source.carrierAuthorId,
      cause: "",
    };
  }

  // Ambiguity — create a one-question queue item (L3: never silent)
  await db.queueItem.create({
    data: {
      type: "ATTRIBUTION",
      priority: 5,
      summary: `CP8 attribution ambiguity: source ${sourceId.slice(-6)} — is @${source.authorId} the speaker or carrier?`,
      payload: { sourceId, speakerId: source.authorId, carrierId: source.carrierAuthorId } as any,
      status: "OPEN",
    },
  });

  return {
    resolved: false,
    speakerId: source.authorId,
    carrierId: source.carrierAuthorId,
    cause: "ambiguity — queue item created",
  };
}

// ─────────────────────────────────────────────────────────────────────
// CP9 — Contradiction tripwire: same-author whiplash or same-metric collision
// ">30% deviation vs HIGH-confidence claim flags same-day — catches extraction
// errors and genuine reversals alike"
// ─────────────────────────────────────────────────────────────────────

const WHIPLASH_THRESHOLD = 0.3; // 30% deviation

export async function checkContradictionTripwire(sourceId: string): Promise<{
  ok: boolean;
  contradictions: Array<{ type: string; details: string }>;
}> {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { quantClaims: true },
  });
  if (!source) return { ok: true, contradictions: [] };

  const contradictions: Array<{ type: string; details: string }> = [];

  // Check 1: same-author whiplash — same author, opposite direction, same day
  const oneDayAgo = new Date((source.dateLatest ?? new Date()).getTime() - 86400_000);
  const oneDayAfter = new Date((source.dateLatest ?? new Date()).getTime() + 86400_000);
  const sameDaySources = await db.source.findMany({
    where: {
      authorId: source.authorId,
      id: { not: sourceId },
      dateLatest: { gte: oneDayAgo, lte: oneDayAfter },
    },
  });

  for (const other of sameDaySources) {
    if (
      (source.direction === "BULLISH" && other.direction === "BEARISH") ||
      (source.direction === "BEARISH" && other.direction === "BULLISH")
    ) {
      contradictions.push({
        type: "SAME_AUTHOR_WHIPLASH",
        details: `${source.direction} vs ${other.direction} within 24h`,
      });
    }
  }

  // Check 2: same-metric collision — >30% deviation vs HIGH-confidence claim
  for (const claim of source.quantClaims) {
    const existingClaims = await db.quantClaim.findMany({
      where: {
        metricId: claim.metricId,
        horizon: claim.horizon,
        id: { not: claim.id },
        confidence: "HIGH",
      },
      include: { source: true },
    });

    for (const existing of existingClaims) {
      const claimMid = ((claim.valueLow ?? 0) + (claim.valueHigh ?? 0)) / 2;
      const existingMid = ((existing.valueLow ?? 0) + (existing.valueHigh ?? 0)) / 2;
      if (claimMid === 0 || existingMid === 0) continue;
      const deviation = Math.abs(claimMid - existingMid) / Math.max(claimMid, existingMid);
      if (deviation > WHIPLASH_THRESHOLD) {
        contradictions.push({
          type: "SAME_METRIC_COLLISION",
          details: `${claim.metricName} ${claim.valueLow}-${claim.valueHigh} vs existing ${existing.valueLow}-${existing.valueHigh} (${Math.round(deviation * 100)}% deviation)`,
        });
      }
    }
  }

  if (contradictions.length > 0) {
    await db.queueItem.create({
      data: {
        type: "TRIPWIRE",
        priority: 3,
        summary: `CP9 contradiction tripwire: source ${sourceId.slice(-6)} — ${contradictions.map(c => c.type).join(", ")}`,
        payload: { sourceId, contradictions } as any,
        status: "OPEN",
      },
    });
  }

  return { ok: contradictions.length === 0, contradictions };
}

// ─────────────────────────────────────────────────────────────────────
// Run all checkpoints for a batch (called after extraction)
// ─────────────────────────────────────────────────────────────────────

export async function runAllCheckpoints(rawContentId: string, sourceIds: string[]): Promise<{
  cp2: any;
  cp4: any;
  cp6: any;
  cp8Results: any[];
  cp9Results: any[];
}> {
  const cp2 = await checkCompleteness(rawContentId);

  // CP4: drift sentinel per author
  const raw = await db.rawContent.findUnique({ where: { id: rawContentId }, include: { sources: true } });
  let cp4: any = { ok: true, cause: "no sources" };
  if (raw && raw.sources.length > 0) {
    cp4 = await checkDriftSentinel(raw.sources[0].authorId);
  }

  // CP6: update discard ledger
  const discarded = await db.rawContent.count({
    where: { extractionStatus: "SKIPPED_TRIAGE", fetchedAt: { gte: new Date(Date.now() - 86400_000) } },
  });
  const total = await db.rawContent.count({
    where: { fetchedAt: { gte: new Date(Date.now() - 86400_000) } },
  });
  const cp6 = { discarded, total, discardRate: total > 0 ? discarded / total : 0 };

  // CP8: attribution check per source
  const cp8Results: any[] = [];
  for (const sid of sourceIds) {
    cp8Results.push(await checkAttribution(sid));
  }

  // CP9: contradiction tripwire per source
  const cp9Results: any[] = [];
  for (const sid of sourceIds) {
    cp9Results.push(await checkContradictionTripwire(sid));
  }

  return { cp2, cp4, cp6, cp8Results, cp9Results };
}
