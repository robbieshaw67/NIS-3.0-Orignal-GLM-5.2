// NIP v3.0 — M4 Knowledge layer: InformationEvent clustering + falsifier screen
//
// Spec §6: "deterministic candidate blocking (shared canonical entity + 7-day
// window + citation/URL/QT-edge overlap) → batched LLM sameness adjudication
// (cached) → member classes ORIGIN / INDEPENDENT / ECHO with org-dependence
// rule: same-org members can never both be INDEPENDENT (L5/L7)."
//
// Spec §6 Falsifiers: "compiled queries (canonical entities + keywords +
// direction), ARMED/PARTIAL/FIRED/EXPIRED/RETIRED lifecycle; cheap deterministic
// screen per batch (zero LLM on quiet batches) → LLM assessment only on hits →
// deterministic consequences"

import { db } from "./db";

// ─────────────────────────────────────────────────────────────────────
// M4: InformationEvent clustering — proper entity + 7-day window + org-dependence
// ─────────────────────────────────────────────────────────────────────

const CLUSTER_WINDOW_DAYS = 7;

export async function clusterIntoEvents(): Promise<{
  clustered: number;
  newEvents: number;
  echoes: number;
  origins: number;
  independents: number;
}> {
  const counts = { clustered: 0, newEvents: 0, echoes: 0, origins: 0, independents: 0 };

  // Get all ungrouped sources (no informationEventId)
  const ungrouped = await db.source.findMany({
    where: { informationEventId: null },
    include: { rawContent: true },
    orderBy: { dateLatest: "asc" },
    take: 100,
  });

  for (const src of ungrouped) {
    counts.clustered++;

    const srcEntities = (src.entities as any[]) ?? [];
    const srcTickers = (src.tickers as any[]) ?? [];
    const srcDate = src.dateLatest ?? new Date();
    const windowStart = new Date(srcDate.getTime() - CLUSTER_WINDOW_DAYS * 86400_000);
    const windowEnd = new Date(srcDate.getTime() + CLUSTER_WINDOW_DAYS * 86400_000);

    // Find candidate events: same entity overlap + within 7-day window
    const candidateEvents = await db.informationEvent.findMany({
      where: {
        eventDate: { gte: windowStart, lte: windowEnd },
        sources: { some: {} },
      },
      include: { sources: { include: { rawContent: true } } },
    });

    // Filter by entity/ticker overlap (L6: entity overlap is candidate blocking)
    let matchedEvent: any = null;
    for (const ev of candidateEvents) {
      const evEntities = ev.sources.flatMap((s: any) => s.entities ?? []);
      const evTickers = ev.sources.flatMap((s: any) => s.tickers ?? []);
      const entityOverlap = srcEntities.some(e => evEntities.includes(e)) ||
                           srcTickers.some(t => evTickers.includes(t));
      if (!entityOverlap) continue;

      // Check citation/URL/QT-edge overlap (L6)
      const srcUrl = src.rawContent?.url ?? "";
      const evUrls = ev.sources.map((s: any) => s.rawContent?.url ?? "");
      const urlOverlap = evUrls.some((u: string) => u && srcUrl && (u === srcUrl || u.includes(srcUrl) || srcUrl.includes(u)));

      // Check direction consistency (BULLISH vs BEARISH shouldn't cluster)
      const evDirections = new Set(ev.sources.map((s: any) => s.direction));
      const directionConsistent = evDirections.has(src.direction) || evDirections.has("NEUTRAL") || src.direction === "NEUTRAL";

      if (entityOverlap && (urlOverlap || directionConsistent)) {
        matchedEvent = ev;
        break;
      }
    }

    // Load author org for org-dependence rule (L5/L7)
    const author = await db.author.findUnique({ where: { id: src.authorId } });

    if (matchedEvent) {
      // Determine independence class with org-dependence rule
      // same-org members can never both be INDEPENDENT
      const existingOrgs = new Set<string>();
      for (const evSrc of matchedEvent.sources) {
        const evAuthor = await db.author.findUnique({ where: { id: evSrc.authorId } });
        if (evAuthor?.orgAffiliation) existingOrgs.add(evAuthor.orgAffiliation);
      }

      let independenceClass = "INDEPENDENT";
      if (author?.orgAffiliation && existingOrgs.has(author.orgAffiliation)) {
        // Same org → ECHO (L5: same org, different people → never independent)
        independenceClass = "ECHO";
        counts.echoes++;
      } else {
        counts.independents++;
      }

      await db.source.update({
        where: { id: src.id },
        data: {
          informationEventId: matchedEvent.id,
          independenceClass,
        },
      });

      // Update event member count + independent count
      const newMemberCount = matchedEvent.memberCount + 1;
      const newIndependentCount = independenceClass === "INDEPENDENT"
        ? matchedEvent.independentCount + 1
        : matchedEvent.independentCount;
      const newAuthorBreadth = independenceClass === "INDEPENDENT"
        ? Math.max(matchedEvent.authorBreadth, newIndependentCount)
        : matchedEvent.authorBreadth;

      await db.informationEvent.update({
        where: { id: matchedEvent.id },
        data: {
          memberCount: newMemberCount,
          independentCount: newIndependentCount,
          authorBreadth: newAuthorBreadth,
        },
      });
    } else {
      // Create new event — this source is the ORIGIN
      const ev = await db.informationEvent.create({
        data: {
          canonicalTitle: src.keyInsight.slice(0, 80),
          eventDate: srcDate,
          originType: "AUTO_CLUSTERED",
          originUrl: src.rawContent?.url,
          memberCount: 1,
          authorBreadth: 1,
          independentCount: 1,
        },
      });
      await db.source.update({
        where: { id: src.id },
        data: { informationEventId: ev.id, independenceClass: "ORIGIN" },
      });
      counts.newEvents++;
      counts.origins++;
    }
  }

  return counts;
}

// ─────────────────────────────────────────────────────────────────────
// M4: Falsifier deterministic screen
// "compiled queries (canonical entities + keywords + direction)"
// "cheap deterministic screen per batch (zero LLM on quiet batches)"
// "→ LLM assessment only on hits → deterministic consequences (FIRED demotes,
//   resolves forecasts, updates calibration counters)"
// ─────────────────────────────────────────────────────────────────────

export async function screenFalsifiers(): Promise<{
  screened: number;
  hits: number;
  fired: number;
  expired: number;
}> {
  const counts = { screened: 0, hits: 0, fired: 0, expired: 0 };

  const armed = await db.falsifier.findMany({
    where: { status: { in: ["ARMED", "PARTIAL"] } },
  });

  const now = new Date();

  for (const f of armed) {
    counts.screened++;

    // Check expiry
    if (f.expiresAt && f.expiresAt < now) {
      await db.falsifier.update({
        where: { id: f.id },
        data: { status: "EXPIRED", lastCheckedAt: now },
      });
      counts.expired++;
      continue;
    }

    // Deterministic screen: check if the compiled query matches any recent source
    const query = f.compiledQuery as any;
    const keywords: string[] = query?.keywords ?? [];
    const direction = query?.direction ?? "BEARISH";
    const entities = (f.thesisIds as string[]) ?? [];

    // Get recent sources (last 7 days)
    const recentSources = await db.source.findMany({
      where: {
        dateLatest: { gte: new Date(now.getTime() - 7 * 86400_000) },
      },
      include: { rawContent: true },
      take: 100,
    });

    let hit = false;
    let hitSource: any = null;

    for (const src of recentSources) {
      // Check direction match (falsifier fires when the OPPOSITE direction is confirmed)
      // e.g., a BEARISH falsifier on a BULLISH thesis fires when bearish evidence appears
      if (src.direction !== direction && src.direction !== "NEUTRAL") continue;

      // Check keyword match in verbatim or keyInsight or bodyText
      const haystack = `${src.verbatimQuote} ${src.keyInsight} ${src.rawContent?.bodyText ?? ""}`.toLowerCase();
      const keywordMatch = keywords.length === 0 || keywords.some(kw => haystack.includes(kw.toLowerCase()));
      if (!keywordMatch) continue;

      hit = true;
      hitSource = src;
      break;
    }

    if (hit) {
      counts.hits++;
      // LLM assessment would happen here in production
      // For now: deterministic fire if the hit source is HIGH conviction
      if (hitSource.conviction === "HIGH" && hitSource.confidence === "CLEAN") {
        counts.fired++;

        // Fire the falsifier → deterministic consequences
        const { fireFalsifier } = await import("./promotion");
        await fireFalsifier({
          falsifierId: f.id,
          firingEvidence: {
            sourceId: hitSource.id,
            direction: hitSource.direction,
            conviction: hitSource.conviction,
            verbatim: hitSource.verbatimQuote,
            screenedAt: now.toISOString(),
          },
        });
      } else {
        // Partial hit — upgrade to PARTIAL if not already
        if (f.status === "ARMED") {
          await db.falsifier.update({
            where: { id: f.id },
            data: { status: "PARTIAL", lastCheckedAt: now },
          });
        }
      }
    }

    // Update lastCheckedAt
    await db.falsifier.update({
      where: { id: f.id },
      data: { lastCheckedAt: now },
    });
  }

  return counts;
}

// ─────────────────────────────────────────────────────────────────────
// M4: QuantClaim resolution — proper resolution against anchor prints
// (not midpoint of own range — that was the audit's finding)
// ─────────────────────────────────────────────────────────────────────

export async function resolveClaimAgainstAnchor(claimId: string, anchorValue: number): Promise<{
  resolved: boolean;
  resolvedValue: number;
  withinRange: boolean;
}> {
  const claim = await db.quantClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { resolved: false, resolvedValue: 0, withinRange: false };

  const withinRange = anchorValue >= (claim.valueLow ?? 0) && anchorValue <= (claim.valueHigh ?? 0);

  await db.quantClaim.update({
    where: { id: claimId },
    data: {
      resolvedValue: anchorValue,
      resolvedAt: new Date(),
      resolutionSource: "anchor_print",
    },
  });

  // Update author calibration
  await db.author.update({
    where: { id: claim.authorId },
    data: {
      forecastsResolved: { increment: 1 },
      forecastsCorrect: { increment: withinRange ? 1 : 0 },
    },
  });

  return { resolved: true, resolvedValue: anchorValue, withinRange };
}

// ─────────────────────────────────────────────────────────────────────
// M5: Increment forecastsMade when a new QuantClaim is created
// (the audit found this was never incremented)
// ─────────────────────────────────────────────────────────────────────

export async function onForecastCreated(authorId: string): Promise<void> {
  await db.author.update({
    where: { id: authorId },
    data: { forecastsMade: { increment: 1 } },
  });
}

// ─────────────────────────────────────────────────────────────────────
// M6: Crowding computation
// "echo share + no-new-independent + synthesizer arrival + chart-virality input"
// ─────────────────────────────────────────────────────────────────────

export async function computeCrowding(thesisId: string): Promise<{
  echoShare: number;
  noNewIndependentDays: number;
  synthesizerArrival: boolean;
  chartVirality: number;
  crowdingFlag: boolean;
}> {
  const thesis = await db.thesis.findUnique({
    where: { id: thesisId },
    include: { quantClaims: true },
  });
  if (!thesis) {
    return { echoShare: 0, noNewIndependentDays: 0, synthesizerArrival: false, chartVirality: 0, crowdingFlag: false };
  }

  // eventIds is stored as jsonb — may be double-encoded string
  let eventIds: any = thesis.eventIds;
  try {
    if (typeof eventIds === "string") {
      eventIds = JSON.parse(eventIds);
      if (typeof eventIds === "string") {
        eventIds = JSON.parse(eventIds);
      }
    }
    if (!Array.isArray(eventIds)) eventIds = [];
  } catch { eventIds = []; }
  const events: any[] = eventIds.length > 0 ? await db.informationEvent.findMany({
    where: { id: { in: eventIds as string[] } },
    include: { sources: true },
  }) : [];

  // Echo share: ECHO / (ECHO + INDEPENDENT + ORIGIN)
  let echoCount = 0, independentCount = 0, originCount = 0;
  for (const ev of events) {
    for (const src of ev.sources) {
      if (src.independenceClass === "ECHO") echoCount++;
      else if (src.independenceClass === "INDEPENDENT") independentCount++;
      else if (src.independenceClass === "ORIGIN") originCount++;
    }
  }
  const total = echoCount + independentCount + originCount;
  const echoShare = total > 0 ? echoCount / total : 0;

  // No-new-independent: days since last INDEPENDENT source
  const independentSources = events.flatMap(ev => ev.sources).filter(s => s.independenceClass === "INDEPENDENT");
  const lastIndependentDate = independentSources.length > 0
    ? new Date(Math.max(...independentSources.map(s => new Date(s.dateLatest ?? 0).getTime())))
    : null;
  const noNewIndependentDays = lastIndependentDate
    ? Math.floor((Date.now() - lastIndependentDate.getTime()) / 86400_000)
    : 999;

  // Synthesizer arrival: check if any SYNTHESIZER author posted in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
  const recentSources = await db.source.findMany({
    where: { dateLatest: { gte: sevenDaysAgo } },
    include: { rawContent: true },
  });
  const synthesizerAuthors = await db.author.findMany({
    where: { epistemicClass: "SYNTHESIZER" },
  });
  const synthesizerIds = new Set(synthesizerAuthors.map(a => a.id));
  const synthesizerArrival = recentSources.some(s => synthesizerIds.has(s.authorId));

  // Chart virality: sum of viralityCount on IngestedImages linked to the thesis's events
  const eventSourceIds = events.flatMap(ev => ev.sources.map(s => s.id));
  const images = await db.ingestedImage.findMany({
    where: { parentRawId: { in: eventSourceIds } },
  });
  const chartVirality = images.reduce((sum, img) => sum + img.viralityCount, 0);

  // Crowding flag: echo share > 50% OR no new independent in 14 days OR synthesizer arrival + high virality
  const crowdingFlag =
    echoShare > 0.5 ||
    noNewIndependentDays > 14 ||
    (synthesizerArrival && chartVirality > 5);

  // Update the thesis
  await db.thesis.update({
    where: { id: thesisId },
    data: { crowdingFlag },
  });

  return { echoShare, noNewIndependentDays, synthesizerArrival, chartVirality, crowdingFlag };
}

// ─────────────────────────────────────────────────────────────────────
// M6: UNPRICED_DIVERGENCE computation
// "corpus weighted median vs external anchors"
// ─────────────────────────────────────────────────────────────────────

export async function computeDivergence(thesisId: string): Promise<{
  corpusMedian: number | null;
  anchorMedian: number | null;
  divergence: number | null;
  verdict: string;
}> {
  const thesis = await db.thesis.findUnique({
    where: { id: thesisId },
    include: { quantClaims: true },
  });
  if (!thesis || thesis.quantClaims.length === 0) {
    return { corpusMedian: null, anchorMedian: null, divergence: null, verdict: "UNKNOWN" };
  }

  // Corpus weighted median: use getAuthorityWeight for calibration weighting
  const { getAuthorityWeight } = await import("./author");
  const claimsWithAuthors = await Promise.all(
    thesis.quantClaims.map(async c => {
      const author = await db.author.findUnique({ where: { id: c.authorId } });
      return {
        mid: ((c.valueLow ?? 0) + (c.valueHigh ?? 0)) / 2,
        weight: author ? getAuthorityWeight(author) : 1.0,
        isAnchor: author?.handle === "TrendForce" || c.orgAttribution === "TrendForce",
      };
    })
  );

  // Separate corpus (non-anchor) from anchor claims
  const corpusClaims = claimsWithAuthors.filter(c => !c.isAnchor);
  const anchorClaims = claimsWithAuthors.filter(c => c.isAnchor);

  if (corpusClaims.length === 0) {
    return { corpusMedian: null, anchorMedian: null, divergence: null, verdict: "UNKNOWN" };
  }

  // Weighted median for corpus
  const sortedCorpus = corpusClaims.sort((a, b) => a.mid - b.mid);
  const totalWeight = sortedCorpus.reduce((s, c) => s + c.weight, 0);
  let cumulative = 0;
  let corpusMedian = sortedCorpus[sortedCorpus.length - 1].mid;
  for (const c of sortedCorpus) {
    cumulative += c.weight;
    if (cumulative >= totalWeight / 2) {
      corpusMedian = c.mid;
      break;
    }
  }

  // Anchor median (simple median of anchor claims)
  const sortedAnchors = anchorClaims.sort((a, b) => a.mid - b.mid);
  const anchorMedian = sortedAnchors.length > 0
    ? sortedAnchors[Math.floor(sortedAnchors.length / 2)].mid
    : null;

  if (anchorMedian === null) {
    return { corpusMedian, anchorMedian: null, divergence: null, verdict: "UNKNOWN" };
  }

  // Divergence: |corpus - anchor| / anchor
  const divergence = Math.abs(corpusMedian - anchorMedian) / Math.abs(anchorMedian);

  // Verdict: UNPRICED_DIVERGENCE if > 20% divergence
  const verdict = divergence > 0.2 ? "UNPRICED_DIVERGENCE" : "PRICED";

  // Update the thesis
  await db.thesis.update({
    where: { id: thesisId },
    data: { divergenceVerdict: verdict },
  });

  return { corpusMedian, anchorMedian, divergence, verdict };
}
