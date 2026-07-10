// NIP v3.0 — Seed script
// Builds the flagship state described across the spec + design doc + v2.1 + onboarding brief:
//   • DRAM Q3 pricing debate — Dylan Patel 40-50% vs TrendForce 13-18% vs BofA 5-17%
//   • Hyperscaler Concentration thesis (VALIDATED → awaits PS engagement rulings → ACTIONABLE)
//   • Live verification clock: SK Hynix ADR Jul 10, Intel Jul 15, Samsung Jul 25
//   • 42-handle ecosystem, ~634 sources, ~65 theses shape, ~51 quantitative claims
//   • 23 falsifiers armed (2 PARTIAL, China InP event-family)
//   • 5 staged objections to Hyperscaler Concentration
//   • 515 degraded legacy sources awaiting CP10 apply
//
// Run: bun run /home/z/my-project/scripts/seed.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}
function date(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  console.log("› Resetting database...");
  // delete in dependency order
  await db.position.deleteMany();
  await db.tradePlan.deleteMany();
  await db.thesisExpression.deleteMany();
  await db.narrativeFamily.deleteMany();
  await db.thesisEngagement.deleteMany();
  await db.thesis.deleteMany();
  await db.debatePosition.deleteMany();
  await db.debate.deleteMany();
  await db.falsifier.deleteMany();
  await db.verificationEvent.deleteMany();
  await db.anchorRevision.deleteMany();
  await db.quantClaim.deleteMany();
  await db.source.deleteMany();
  await db.informationEvent.deleteMany();
  await db.authorFamilyStats.deleteMany();
  await db.stanceChange.deleteMany();
  await db.authorStance.deleteMany();
  await db.author.deleteMany();
  await db.metric.deleteMany();
  await db.entity.deleteMany();
  await db.ingestedImage.deleteMany();
  await db.rawContent.deleteMany();
  await db.ingestionBatch.deleteMany();
  await db.sourceCandidate.deleteMany();
  await db.queueItem.deleteMany();
  await db.adapterHealth.deleteMany();
  await db.auditLog.deleteMany();
  await db.providerCall.deleteMany();
  await db.jobRun.deleteMany();
  await db.gateThreshold.deleteMany();
  await db.watermark.deleteMany();

  // ─────────────────────────────────────────────────────────────────
  // Gate thresholds (config table — never constants in code)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding gate thresholds...");
  const thresholds = [
    { key: "OBSERVATION_TO_HYPOTHESIS.minEvents",            value: 3 },
    { key: "OBSERVATION_TO_HYPOTHESIS.minEffectiveN",        value: 2 },
    { key: "OBSERVATION_TO_HYPOTHESIS.trailingDays",         value: 60 },
    { key: "HYPOTHESIS_TO_VALIDATED.minIndependentEvents",   value: 2 },
    { key: "HYPOTHESIS_TO_VALIDATED.minPrimaryIntegrity",    value: 1 },
    { key: "HYPOTHESIS_TO_VALIDATED.minEffectiveN",          value: 3 },
    { key: "HYPOTHESIS_TO_VALIDATED.minDistinctOrgs",        value: 2 },
    { key: "HYPOTHESIS_TO_VALIDATED.minDistinctClasses",     value: 2 },
    { key: "HYPOTHESIS_TO_VALIDATED.minArmedFalsifiers",     value: 1 },
    { key: "VALIDATED_TO_ACTIONABLE.requireVerificationEvent", value: 1 },
    { key: "VALIDATED_TO_ACTIONABLE.contrarianMustSurvive",  value: 1 },
    { key: "VALIDATED_TO_ACTIONABLE.crowdingMustBeClear",    value: 1 },
    { key: "VALIDATED_TO_ACTIONABLE.allFalsifiersArmed",     value: 1 },
    { key: "VALIDATED_TO_ACTIONABLE.noUnreviewedReversing14d", value: 1 },
  ];
  for (const t of thresholds) {
    await db.gateThreshold.create({ data: t });
  }

  // ─────────────────────────────────────────────────────────────────
  // Adapter health — keyed off JobRun records (L13), not reachability
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding adapter health...");
  await db.adapterHealth.create({ data: { adapter: "rss",       lastSuccessAt: daysAgo(0),  lastRunAt: daysAgo(0),  state: "GREEN", cause: "" }});
  await db.adapterHealth.create({ data: { adapter: "transcript",lastSuccessAt: daysAgo(1),  lastRunAt: daysAgo(0),  state: "AMBER", cause: "yt-dlp fallback to Whisper on 2 channels; publish-watch not yet wired" }});
  await db.adapterHealth.create({ data: { adapter: "x",         lastSuccessAt: null,        lastRunAt: null,        state: "RED",   cause: "scraper adapter unbuilt — sequence step 7" }});
  await db.adapterHealth.create({ data: { adapter: "anchors",   lastSuccessAt: daysAgo(0),  lastRunAt: daysAgo(0),  state: "GREEN", cause: "" }});
  await db.adapterHealth.create({ data: { adapter: "images",    lastSuccessAt: daysAgo(0),  lastRunAt: daysAgo(0),  state: "GREEN", cause: "" }});

  // ─────────────────────────────────────────────────────────────────
  // Authors — the 42-handle ecosystem (subset)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding authors...");
  const authors = [
    { handle: "dylan522p",     realName: "Dylan Patel",         epistemicClass: "ACCESS_ANALYST",   orgAffiliation: "SemiAnalysis",   avatarColor: "#10b981", bio: "Chief analyst at SemiAnalysis. Co-host of the Latent Space podcast. Access to supply-chain checks across memory and logic." },
    { handle: "semi_analysis", realName: "Daniel Niles",        epistemicClass: "SYNTHESIZER",      orgAffiliation: "SemiAnalysis",   avatarColor: "#10b981", bio: "Merged into SemiAnalysis (L5 map filed: same shop, different byline)." },
    { handle: "citrini7",      realName: "Citrini Research",    epistemicClass: "MODEL_BUILDER",    orgAffiliation: "Citrini Capital",avatarColor: "#6366f1", bio: "Merged into zephyr_z9 (L5 map filed). Quant model builder." },
    { handle: "zephyr_z9",     realName: "Zephyr Research",     epistemicClass: "MODEL_BUILDER",    orgAffiliation: "Citrini Capital",avatarColor: "#6366f1", bio: "Citrini trio — same shop as Citrini7 (L5 org-aware independence rule)." },
    { handle: "danielniles",   realName: "Daniel Niles",        epistemicClass: "SYNTHESIZER",      orgAffiliation: "NilesRTC",       avatarColor: "#0ea5e9", bio: "Synthesizer — read-second by rule." },
    { handle: "eugene_loh",    realName: "Eugene Loh",          epistemicClass: "SYNTHESIZER",      orgAffiliation: "BofA Securities",avatarColor: "#ef4444", bio: "Carrier of BofA's printed research (L8: speaker ≠ carrier)." },
    { handle: "jukan_137",     realName: "Jukan Kazuya",        epistemicClass: "CHANNEL_PRIMARY",  orgAffiliation: "Independent",    avatarColor: "#f59e0b", bio: "Tokyo-based channel checks across memory pricing and equipment orders." },
    { handle: "TrendForce",    realName: "TrendForce Corp",     epistemicClass: "ACCESS_ANALYST",   orgAffiliation: "TrendForce",     avatarColor: "#dc2626", bio: "External anchor — pricing releases treated as ground-truth arriving." },
    { handle: "DRAMeXchange",  realName: "DRAMeXchange",        epistemicClass: "ACCESS_ANALYST",   orgAffiliation: "TrendForce",     avatarColor: "#dc2626", bio: "External anchor, same org as TrendForce (L5 org-aware rule)." },
    { handle: "bofa_research", realName: "BofA Securities",     epistemicClass: "ACCESS_ANALYST",   orgAffiliation: "BofA Securities",avatarColor: "#ef4444", bio: "Sell-side. Printed research, attribution on the carrying screenshot." },
    { handle: "stacyrasgon",   realName: "Stacy Rasgon",        epistemicClass: "ACCESS_ANALYST",   orgAffiliation: "Bernstein",      avatarColor: "#8b5cf6", bio: "Bernstein semiconductor lead. Methodical, slow to call tops." },
    { handle: "harlan_consult",realName: "Harlan Consulting",   epistemicClass: "CHANNEL_PRIMARY",  orgAffiliation: "Independent",    avatarColor: "#14b8a6", bio: "Taiwan channel checks across TSMC, Foxconn, ASE." },
    { handle: "mlassalle",     realName: "Michele Lassalle",    epistemicClass: "POSITIONED_MANAGER",orgAffiliation: "Hudson Bay",     avatarColor: "#f97316", bio: "Positioned manager — book-talk discount applies (0.5× consistent, 1.5× on stance change)." },
    { handle: "ps",            realName: "Portfolio Strategist",epistemicClass: "UNRESOLVED",       orgAffiliation: "Operator",       avatarColor: "#0f172a", bio: "The operator. PS gates all judgments enumerated in Spec §12." },
  ];
  const authorIds: Record<string, string> = {};
  for (const a of authors) {
    const row = await db.author.create({ data: { ...a } });
    authorIds[a.handle] = row.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // Entities & metrics — canonical registries (M3)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding entities & metrics...");
  const entities = [
    { canonicalName: "Micron Technology",    ticker: "MU",     orgId: "Micron" },
    { canonicalName: "Samsung Electronics",  ticker: "005930.KS", orgId: "Samsung" },
    { canonicalName: "SK Hynix",             ticker: "000660.KS", orgId: "SK Hynix" },
    { canonicalName: "Intel",                ticker: "INTC",   orgId: "Intel" },
    { canonicalName: "Taiwan Semiconductor", ticker: "TSM",    orgId: "TSMC" },
    { canonicalName: "NVIDIA",               ticker: "NVDA",   orgId: "NVIDIA" },
    { canonicalName: "Advanced Micro Devices",ticker: "AMD",   orgId: "AMD" },
    { canonicalName: "Hyperscaler Capex Aggregate", ticker: null, orgId: "Hyperscalers" },
  ];
  const entityIds: Record<string, string> = {};
  for (const e of entities) {
    const row = await db.entity.create({ data: { ...e, aliases: [] as any } });
    entityIds[e.canonicalName] = row.id;
  }

  const metrics = [
    { canonicalName: "DRAM Contract Price QoQ", unit: "PERCENT", aliases: ["DRAM_QOQ", "DRAM contract price change QoQ"] },
    { canonicalName: "NAND Contract Price QoQ", unit: "PERCENT", aliases: ["NAND_QOQ"] },
    { canonicalName: "HBM Capacity Share",       unit: "PERCENT", aliases: ["HBM_SHARE"] },
    { canonicalName: "Hyperscaler Capex YoY",    unit: "PERCENT", aliases: ["CAPEX_YOY"] },
    { canonicalName: "TSMC Revenue Share of Logic", unit: "PERCENT", aliases: ["TSMC_LOGIC_SHARE"] },
    { canonicalName: "DRAM Inventory Days",      unit: "DAYS",    aliases: ["DRAM_INV"] },
  ];
  const metricIds: Record<string, string> = {};
  for (const m of metrics) {
    const row = await db.metric.create({ data: { ...m, aliases: m.aliases as any } });
    metricIds[m.canonicalName] = row.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // Raw content — flagship posts/transcripts/anchors
  // Each has bodyText with the verbatim quote locatable by span offsets
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding raw content + extractions...");

  // Dylan Patel podcast transcript — the 40-50% claim
  const dylanBody = `SemiAnalysis Podcast #94 — Memory Supercycle Check-In\n\nDylan Patel: When we look at the Q3 DRAM contract price trajectory, the datapoints are stacking up fast. SK Hynix is sold out through end of year on HBM3E, Samsung is finally qualification-complete on HBM3E 12Hi, and Micron's HBM share is now structurally capped by their 1a node yields. So when we model the blended DRAM contract print for Q3, we see 40 to 50 percent QoQ. That's not a forecast of the high end — that's the central case. The pricing power is structural; it is not transitory.`;
  const dylanRaw = await db.rawContent.create({
    data: {
      contentHash: "dylan_pod94_" + Date.now(),
      url: "https://semianalysis.com/podcast/94-memory-supercycle",
      storageRef: "raw/transcripts/dylan_pod94.txt",
      title: "SemiAnalysis Podcast #94 — Memory Supercycle Check-In",
      adapterType: "TRANSCRIPT",
      adapterVersion: "yt-dlp+v3",
      bodyText: dylanBody,
      fetchedAt: daysAgo(9),
      extractionStatus: "EXTRACTED",
    },
  });
  // locate the verbatim quote
  const dylanSpanStart = dylanBody.indexOf("we see 40 to 50 percent QoQ");
  const dylanSpanEnd = dylanSpanStart + "we see 40 to 50 percent QoQ".length;
  const dylanSource = await db.source.create({
    data: {
      rawContentId: dylanRaw.id,
      extractionVersion: "deep_extract/v3",
      authorId: authorIds.dylan522p,
      dateIso: date(2026, 7, 1),
      dateEarliest: date(2026, 7, 1),
      dateLatest: date(2026, 7, 1),
      direction: "BULLISH",
      conviction: "HIGH",
      confidence: "CLEAN",
      insightType: "FORECAST",
      verbatimQuote: "we see 40 to 50 percent QoQ",
      keyInsight: "Dylan Patel forecasts Q3 DRAM contract price +40-50% QoQ (central case, not high end).",
      tickers: ["MU", "000660.KS", "005930.KS"] as any,
      entities: [entityIds["Micron Technology"], entityIds["SK Hynix"], entityIds["Samsung Electronics"]] as any,
      independenceClass: "ORIGIN",
      spanStart: dylanSpanStart,
      spanEnd: dylanSpanEnd,
      spanConfidence: "EXACT",
    },
  });

  // TrendForce anchor — the 13-18% pricing release
  const tfBody = `TrendForce Press Release — Q3 2026 DRAM Contract Price Forecast\n\nTrendForce: Based on completed negotiations with major DRAM suppliers, TrendForce forecasts Q3 2026 DRAM contract prices will rise 13 to 18 percent quarter-over-quarter. The increase is concentrated in server DRAM modules; PC DRAM pricing remains range-bound as demand has not yet inflected. HBM contracts are negotiated separately and are excluded from this aggregate figure.`;
  const tfRaw = await db.rawContent.create({
    data: {
      contentHash: "tf_q3_release_" + Date.now(),
      url: "https://www.trendforce.com/press/q3-2026-dram-contract",
      storageRef: "raw/anchors/tf_q3.txt",
      title: "TrendForce Press Release — Q3 2026 DRAM Contract Price Forecast",
      adapterType: "ANCHOR",
      adapterVersion: "v1",
      bodyText: tfBody,
      fetchedAt: daysAgo(5),
      extractionStatus: "EXTRACTED",
    },
  });
  const tfSpanStart = tfBody.indexOf("13 to 18 percent quarter-over-quarter");
  const tfSpanEnd = tfSpanStart + "13 to 18 percent quarter-over-quarter".length;
  const tfSource = await db.source.create({
    data: {
      rawContentId: tfRaw.id,
      extractionVersion: "deep_extract/v3",
      authorId: authorIds.TrendForce,
      dateIso: date(2026, 7, 5),
      dateEarliest: date(2026, 7, 5),
      dateLatest: date(2026, 7, 5),
      direction: "BULLISH",
      conviction: "HIGH",
      confidence: "CLEAN",
      insightType: "FORECAST",
      verbatimQuote: "13 to 18 percent quarter-over-quarter",
      keyInsight: "TrendForce Q3 2026 DRAM contract price +13-18% QoQ (server DRAM concentrated; HBM excluded).",
      tickers: ["MU", "000660.KS", "005930.KS"] as any,
      entities: [entityIds["Micron Technology"], entityIds["SK Hynix"], entityIds["Samsung Electronics"]] as any,
      independenceClass: "ORIGIN",
      spanStart: tfSpanStart,
      spanEnd: tfSpanEnd,
      spanConfidence: "EXACT",
    },
  });

  // BofA-via-Eugene — the 5-17% relayed claim (L8 speaker ≠ carrier)
  // Includes a chart screenshot URL — auto-extracted by storeRaw into IngestedImage
  const bofaBody = `@eugene_loh reposting BofA Securities memory team note:\n\n"BofA forecasts Q3 DRAM contract prices to rise 5 to 17 percent QoQ. The low end assumes Samsung HBM3E qualification slips into late Q3; the high end assumes clean qualification by mid-July. Our central case is 11 percent. We note that TrendForce's published range is wider than our model implies at the low end."\n\nChart: ![BofA DRAM Q3 Forecast](https://bofa.com/research/dram-q3-forecast-chart.png)\n\n— Reposted for visibility. Attribution: BofA Securities Memory Team.`;
  const bofaRaw = await db.rawContent.create({
    data: {
      contentHash: "bofa_via_eugene_" + Date.now(),
      url: "https://x.com/eugene_loh/status/1284651122",
      storageRef: "raw/x/bofa_via_eugene.txt",
      title: "BofA Q3 DRAM note reposted by Eugene Loh",
      adapterType: "MANUAL",
      adapterVersion: "v1",
      bodyText: bofaBody,
      fetchedAt: daysAgo(4),
      extractionStatus: "EXTRACTED",
    },
  });
  const bofaSpanStart = bofaBody.indexOf("5 to 17 percent QoQ");
  const bofaSpanEnd = bofaSpanStart + "5 to 17 percent QoQ".length;
  const bofaSource = await db.source.create({
    data: {
      rawContentId: bofaRaw.id,
      extractionVersion: "deep_extract/v3",
      authorId: authorIds.bofa_research,           // speaker
      carrierAuthorId: authorIds.eugene_loh,        // carrier (L8)
      dateIso: date(2026, 7, 6),
      dateEarliest: date(2026, 7, 6),
      dateLatest: date(2026, 7, 6),
      direction: "BULLISH",
      conviction: "MEDIUM",
      confidence: "CLEAN",
      insightType: "FORECAST",
      verbatimQuote: "5 to 17 percent QoQ",
      keyInsight: "BofA forecasts Q3 DRAM +5-17% QoQ (central 11%). Carrier: Eugene Loh.",
      tickers: ["MU", "000660.KS"] as any,
      entities: [entityIds["Micron Technology"], entityIds["SK Hynix"]] as any,
      independenceClass: "INDEPENDENT",
      spanStart: bofaSpanStart,
      spanEnd: bofaSpanEnd,
      spanConfidence: "EXACT",
    },
  });

  // Jukan — channel check, supports the high end
  const jukanBody = `jukan (@jukan_137):\n\nSamsung HBM3E 12Hi qualification complete as of July 2. SK Hynix HBM3E sold out through Q4. Micron commanding 30%+ price premium on HBM3E vs standard DDR5 due to allocation tightness. Channel checks indicate DRAM contract Q3 print tracking toward the upper end of consensus — we read 35 to 45 percent QoQ as the live channel read. This is not the central case; this is the floor the channel is currently pricing.`;
  const jukanRaw = await db.rawContent.create({
    data: {
      contentHash: "jukan_q3_" + Date.now(),
      url: "https://x.com/jukan_137/status/1284710023",
      storageRef: "raw/x/jukan_q3.txt",
      title: "jukan — DRAM Q3 channel check",
      adapterType: "RSS",
      adapterVersion: "v1",
      bodyText: jukanBody,
      fetchedAt: daysAgo(3),
      extractionStatus: "EXTRACTED",
    },
  });
  const jukanSpanStart = jukanBody.indexOf("35 to 45 percent QoQ");
  const jukanSpanEnd = jukanSpanStart + "35 to 45 percent QoQ".length;
  const jukanSource = await db.source.create({
    data: {
      rawContentId: jukanRaw.id,
      extractionVersion: "deep_extract/v3",
      authorId: authorIds.jukan_137,
      dateIso: date(2026, 7, 7),
      dateEarliest: date(2026, 7, 7),
      dateLatest: date(2026, 7, 7),
      direction: "BULLISH",
      conviction: "HIGH",
      confidence: "CLEAN",
      insightType: "FORECAST",
      verbatimQuote: "35 to 45 percent QoQ",
      keyInsight: "jukan: DRAM Q3 channel read 35-45% QoQ (the floor the channel is pricing).",
      tickers: ["005930.KS", "000660.KS", "MU"] as any,
      entities: [entityIds["Samsung Electronics"], entityIds["SK Hynix"], entityIds["Micron Technology"]] as any,
      independenceClass: "INDEPENDENT",
      spanStart: jukanSpanStart,
      spanEnd: jukanSpanEnd,
      spanConfidence: "EXACT",
    },
  });

  // Stacy Rasgon — the cautious skeptic (Hyperscaler Concentration debate side B)
  const stacyBody = `Stacy Rasgon (Bernstein) on the SemiAnalysis podcast #95:\n\n"The concentration narrative is real but it's priced. NVIDIA is now 35% of TSMC's revenue. If hyperscaler capex pauses — not crashes, just pauses — the semiconductor index de-rates 20% before the fundamentals even bend. I'm not calling the top. I'm saying that what was a contrarian call in 2024 is now consensus, and consensus semiconductor positions historically don't compound at the rate the consensus expects them to. The five objections to the Hyperscaler Concentration thesis are not coming from people who don't understand it. They're coming from people who priced it before you did."`;
  const stacyRaw = await db.rawContent.create({
    data: {
      contentHash: "stacy_pod95_" + Date.now(),
      url: "https://semianalysis.com/podcast/95-concentration-debate",
      storageRef: "raw/transcripts/stacy_pod95.txt",
      title: "SemiAnalysis Podcast #95 — The Concentration Debate",
      adapterType: "TRANSCRIPT",
      adapterVersion: "yt-dlp+v3",
      bodyText: stacyBody,
      fetchedAt: daysAgo(6),
      extractionStatus: "EXTRACTED",
    },
  });
  const stacySpanStart = stacyBody.indexOf("what was a contrarian call in 2024 is now consensus");
  const stacySpanEnd = stacySpanStart + "what was a contrarian call in 2024 is now consensus".length;
  const stacySource = await db.source.create({
    data: {
      rawContentId: stacyRaw.id,
      extractionVersion: "deep_extract/v3",
      authorId: authorIds.stacyrasgon,
      dateIso: date(2026, 7, 4),
      dateEarliest: date(2026, 7, 4),
      dateLatest: date(2026, 7, 4),
      direction: "BEARISH",
      conviction: "MEDIUM",
      confidence: "HEDGED",
      insightType: "OPINION",
      verbatimQuote: "what was a contrarian call in 2024 is now consensus",
      keyInsight: "Stacy Rasgon: Hyperscaler Concentration is priced; a capex pause de-rates semis 20% before fundamentals bend.",
      tickers: ["NVDA", "TSM"] as any,
      entities: [entityIds["NVIDIA"], entityIds["Taiwan Semiconductor"], entityIds["Hyperscaler Capex Aggregate"]] as any,
      independenceClass: "INDEPENDENT",
      spanStart: stacySpanStart,
      spanEnd: stacySpanEnd,
      spanConfidence: "EXACT",
    },
  });

  // Citrini7 — opposing view on concentration (will be rendered as same-shop as zephyr_z9 per L5)
  const citriniBody = `Citrini Research (@citrini7):\n\nThread on Hyperscaler Concentration risk:\n\n1/ The math is straightforward: top-4 hyperscalers now ~62% of TSMC's revenue. A single quarter of capex deferral at any one of them moves the entire semiconductor index. This is not diversification. This is leverage.\n\n2/ We are positioning for a fade. Not the trade — the fade of the trade. Crowding on the long side is at 2021 highs by our read. zephyr_z9's read on the same data is here 👇`;
  const citriniRaw = await db.rawContent.create({
    data: {
      contentHash: "citrini_conc_" + Date.now(),
      url: "https://x.com/citrini7/status/1284822334",
      storageRef: "raw/x/citrini_conc.txt",
      title: "Citrini — Hyperscaler Concentration fade thread",
      adapterType: "RSS",
      adapterVersion: "v1",
      bodyText: citriniBody,
      threadId: "citrini_conc_thread",
      fetchedAt: daysAgo(8),
      extractionStatus: "EXTRACTED",
    },
  });
  const citriniSpanStart = citriniBody.indexOf("top-4 hyperscalers now ~62% of TSMC's revenue");
  const citriniSpanEnd = citriniSpanStart + "top-4 hyperscalers now ~62% of TSMC's revenue".length;
  const citriniSource = await db.source.create({
    data: {
      rawContentId: citriniRaw.id,
      extractionVersion: "deep_extract/v3",
      authorId: authorIds.citrini7,
      dateIso: date(2026, 7, 2),
      dateEarliest: date(2026, 7, 2),
      dateLatest: date(2026, 7, 2),
      direction: "BEARISH",
      conviction: "HIGH",
      confidence: "CLEAN",
      insightType: "OBSERVATION",
      verbatimQuote: "top-4 hyperscalers now ~62% of TSMC's revenue",
      keyInsight: "Citrini: top-4 hyperscalers ~62% of TSMC revenue; positioning for crowding fade.",
      tickers: ["TSM", "NVDA", "AMD"] as any,
      entities: [entityIds["Taiwan Semiconductor"], entityIds["Hyperscaler Capex Aggregate"]] as any,
      independenceClass: "INDEPENDENT",
      spanStart: citriniSpanStart,
      spanEnd: citriniSpanEnd,
      spanConfidence: "EXACT",
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // InformationEvents — collapse echo
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding information events...");
  const dramQ3Event = await db.informationEvent.create({
    data: {
      canonicalTitle: "Q3 2026 DRAM Contract Price Forecast Collection",
      eventDate: date(2026, 7, 5),
      originType: "FORECAST_COLLECTION",
      originUrl: "https://www.trendforce.com/press/q3-2026-dram-contract",
      memberCount: 4,
      authorBreadth: 4,
      independentCount: 3,
      clusterVersion: "v1",
    },
  });

  const hyperscalerDebateEvent = await db.informationEvent.create({
    data: {
      canonicalTitle: "Hyperscaler Concentration — Capex Pause Risk Debate",
      eventDate: date(2026, 7, 3),
      originType: "DEBATE",
      memberCount: 3,
      authorBreadth: 3,
      independentCount: 2,
      clusterVersion: "v1",
    },
  });

  // link sources to events
  await db.source.update({ where: { id: dylanSource.id },     data: { informationEventId: dramQ3Event.id,        independenceClass: "ORIGIN" }});
  await db.source.update({ where: { id: tfSource.id },        data: { informationEventId: dramQ3Event.id,        independenceClass: "INDEPENDENT" }});
  await db.source.update({ where: { id: bofaSource.id },      data: { informationEventId: dramQ3Event.id,        independenceClass: "INDEPENDENT" }});
  await db.source.update({ where: { id: jukanSource.id },     data: { informationEventId: dramQ3Event.id,        independenceClass: "INDEPENDENT" }});
  await db.source.update({ where: { id: stacySource.id },     data: { informationEventId: hyperscalerDebateEvent.id, independenceClass: "INDEPENDENT" }});
  await db.source.update({ where: { id: citriniSource.id },   data: { informationEventId: hyperscalerDebateEvent.id, independenceClass: "INDEPENDENT" }});

  // ─────────────────────────────────────────────────────────────────
  // QuantClaims — the actual flagship numbers (the DRAM Q3 dispersion)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding quantitative claims...");
  const dramMetricId = metricIds["DRAM Contract Price QoQ"];
  const claims = [
    { sourceId: dylanSource.id, authorId: authorIds.dylan522p,    valueLow: 40,   valueHigh: 50,   confidence: "HIGH",   extractionMethod: "TEXT", spanStart: dylanSpanStart, spanEnd: dylanSpanEnd, thesisId: null, eventId: dramQ3Event.id },
    { sourceId: tfSource.id,    authorId: authorIds.TrendForce,   valueLow: 13,   valueHigh: 18,   confidence: "HIGH",   extractionMethod: "TEXT", spanStart: tfSpanStart,    spanEnd: tfSpanEnd,    thesisId: null, eventId: dramQ3Event.id, orgAttribution: "TrendForce" },
    { sourceId: bofaSource.id,  authorId: authorIds.bofa_research,valueLow: 5,    valueHigh: 17,   confidence: "MEDIUM", extractionMethod: "TEXT", spanStart: bofaSpanStart,  spanEnd: bofaSpanEnd,  thesisId: null, eventId: dramQ3Event.id, carrierAuthorId: authorIds.eugene_loh, orgAttribution: "BofA Securities" },
    { sourceId: jukanSource.id, authorId: authorIds.jukan_137,    valueLow: 35,   valueHigh: 45,   confidence: "HIGH",   extractionMethod: "TEXT", spanStart: jukanSpanStart, spanEnd: jukanSpanEnd, thesisId: null, eventId: dramQ3Event.id },
  ];
  const claimIds: string[] = [];
  for (const c of claims) {
    const claim = await db.quantClaim.create({
      data: {
        ...c,
        metricId: dramMetricId,
        metricName: "DRAM Contract Price QoQ",
        unit: "PERCENT",
        horizon: "Q3_2026",
        claimedAt: daysAgo(7),
      },
    });
    claimIds.push(claim.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // VerificationEvents — the Jul 10/15/25 clock from the onboarding brief
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding verification events...");
  const skHynixADR = await db.verificationEvent.create({
    data: {
      date: date(2026, 7, 10),
      eventType: "EARNINGS",
      entityId: entityIds["SK Hynix"],
      thesisLinks: [{ thesisId: "pending", canVerify: true, canFalsify: true }] as any,
      metricIds: [dramMetricId] as any,
      status: "UPCOMING",
      outcome: "",
      informationEventId: dramQ3Event.id,
    },
  });
  const intelEarnings = await db.verificationEvent.create({
    data: {
      date: date(2026, 7, 15),
      eventType: "EARNINGS",
      entityId: entityIds["Intel"],
      thesisLinks: [] as any,
      metricIds: [dramMetricId, metricIds["Hyperscaler Capex YoY"]] as any,
      status: "UPCOMING",
      outcome: "",
      informationEventId: hyperscalerDebateEvent.id,
    },
  });
  const samsungEarnings = await db.verificationEvent.create({
    data: {
      date: date(2026, 7, 25),
      eventType: "EARNINGS",
      entityId: entityIds["Samsung Electronics"],
      thesisLinks: [] as any,
      metricIds: [dramMetricId, metricIds["HBM Capacity Share"]] as any,
      status: "UPCOMING",
      outcome: "",
      informationEventId: dramQ3Event.id,
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Anchor revisions — TrendForce's history of Q3 prints (revision velocity)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding anchor revisions...");
  await db.anchorRevision.create({
    data: {
      metricId: dramMetricId,
      org: "TrendForce",
      values: [
        { date: "2026-04-15", value: 5,   note: "initial Q3 forecast" },
        { date: "2026-05-20", value: 8,   note: "raised on HBM3E tightness" },
        { date: "2026-06-12", value: 11,  note: "raised again on Samsung HBM3E qualification news" },
        { date: "2026-07-05", value: 15.5, note: "current published central: 13-18% range" },
      ] as any,
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Theses — the live ones (Hyperscaler Concentration = VALIDATED)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding theses...");
  const memorySupercycle = await db.thesis.create({
    data: {
      title: "Q3 2026 marks the structural inflection of the memory supercycle — DRAM contract +30-50% QoQ, HBM-led",
      direction: "BULLISH",
      stage: "HYPOTHESIS",
      eventIds: [dramQ3Event.id] as any,
      independentEvents: 3,
      primaryIntegrityEvents: 1,
      effectiveN: 3.4,
      distinctOrgs: 4,
      epistemicClassCount: 3,
      contrarianStatus: "UNENGAGED",
      engagementSearchLoggedAt: null,
      armedFalsifiers: 3,
      crowdingFlag: false,
      verificationEventId: skHynixADR.id,
      divergenceVerdict: "UNPRICED_DIVERGENCE",
      narrativeFamily: "Memory Supercycle",
      stageHistory: [
        { from: "OBSERVATION", to: "HYPOTHESIS", at: date(2026,6,20).toISOString(), evidence: { effectiveN: 2.1, independentEvents: 3 } }
      ] as any,
    },
  });

  const hyperscalerConcentration = await db.thesis.create({
    data: {
      title: "Hyperscaler capex concentration in AI compute creates structural pricing power for TSMC + NVDA through 2026",
      direction: "BULLISH",
      stage: "VALIDATED",
      eventIds: [hyperscalerDebateEvent.id] as any,
      independentEvents: 4,
      primaryIntegrityEvents: 2,
      effectiveN: 4.2,
      distinctOrgs: 4,
      epistemicClassCount: 3,
      contrarianStatus: "ENGAGED_UNRESOLVED",
      engagementSearchLoggedAt: daysAgo(8),
      armedFalsifiers: 5,
      crowdingFlag: false,
      verificationEventId: intelEarnings.id,
      divergenceVerdict: "PRICED",
      narrativeFamily: "Hyperscaler AI Concentration",
      stageHistory: [
        { from: "OBSERVATION", to: "HYPOTHESIS", at: date(2026,5,1).toISOString(), evidence: {} },
        { from: "HYPOTHESIS", to: "VALIDATED",   at: date(2026,6,15).toISOString(), evidence: { effectiveN: 4.2, distinctOrgs: 4, distinctClasses: 3, armedFalsifiers: 5 } },
      ] as any,
    },
  });

  const memoryTax = await db.thesis.create({
    data: {
      title: "Memory pricing is the silent tax on AI inference economics — DRAM cost per token rising through 2026",
      direction: "BEARISH",
      stage: "OBSERVATION",
      eventIds: [dramQ3Event.id] as any,
      independentEvents: 2,
      primaryIntegrityEvents: 0,
      effectiveN: 1.8,
      distinctOrgs: 2,
      epistemicClassCount: 2,
      contrarianStatus: "UNENGAGED",
      engagementSearchLoggedAt: null,
      armedFalsifiers: 1,
      crowdingFlag: false,
      divergenceVerdict: "UNKNOWN",
      narrativeFamily: "Memory Supercycle",
      stageHistory: [] as any,
    },
  });

  const equipmentSecondOrder = await db.thesis.create({
    data: {
      title: "Semiconductor equipment names (ASML, AMAT, LRCX) lag memory pricing by 2 quarters — second-order long",
      direction: "BULLISH",
      stage: "HYPOTHESIS",
      eventIds: [dramQ3Event.id] as any,
      independentEvents: 3,
      primaryIntegrityEvents: 1,
      effectiveN: 2.6,
      distinctOrgs: 3,
      epistemicClassCount: 2,
      contrarianStatus: "UNENGAGED",
      engagementSearchLoggedAt: null,
      armedFalsifiers: 2,
      crowdingFlag: false,
      divergenceVerdict: "UNKNOWN",
      narrativeFamily: "Equipment Second-Order",
      stageHistory: [] as any,
    },
  });

  const crowdingFade = await db.thesis.create({
    data: {
      title: "Semiconductor crowding has reached 2021 highs — fade the long side on capex pause signals",
      direction: "BEARISH",
      stage: "OBSERVATION",
      eventIds: [hyperscalerDebateEvent.id] as any,
      independentEvents: 2,
      primaryIntegrityEvents: 0,
      effectiveN: 2.0,
      distinctOrgs: 2,
      epistemicClassCount: 2,
      contrarianStatus: "UNENGAGED",
      armedFalsifiers: 0,
      crowdingFlag: true,
      divergenceVerdict: "UNKNOWN",
      narrativeFamily: "Crowding Fade",
      stageHistory: [] as any,
    },
  });

  // Link claims to theses
  for (const cid of claimIds) {
    await db.quantClaim.update({ where: { id: cid }, data: { thesisId: memorySupercycle.id }});
  }

  // ─────────────────────────────────────────────────────────────────
  // Falsifiers — 23 armed, 2 PARTIAL (China InP event-family)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding falsifiers...");
  const falsifiers = [
    { thesisId: hyperscalerConcentration.id, statement: "Q3 hyperscaler capex prints below +15% YoY (any of MSFT/META/GOOG/AMZN)", eventFamily: "capex_q3", armedAt: daysAgo(45) },
    { thesisId: hyperscalerConcentration.id, statement: "NVIDIA data center revenue QoQ growth falls below 10% in FQ2 2027", eventFamily: "capex_q3", armedAt: daysAgo(45) },
    { thesisId: hyperscalerConcentration.id, statement: "TSMC July revenue report shows QoQ decline", eventFamily: "capex_q3", armedAt: daysAgo(45) },
    { thesisId: memorySupercycle.id,         statement: "Q3 DRAM contract prints below +13% QoQ (TrendForce low end)", eventFamily: "dram_q3", armedAt: daysAgo(30) },
    { thesisId: memorySupercycle.id,         statement: "Samsung HBM3E 12Hi qualification slips past Aug 1", eventFamily: "dram_q3", armedAt: daysAgo(30) },
    { thesisId: memorySupercycle.id,         statement: "SK Hynix HBM3E allocation tightness resolves before Q4", eventFamily: "dram_q3", armedAt: daysAgo(30) },
    { thesisId: equipmentSecondOrder.id,     statement: "ASML/AMAT/LRCX orders decline QoQ in Q3", eventFamily: "equipment_orders", armedAt: daysAgo(40) },
    { thesisId: equipmentSecondOrder.id,     statement: "TSMC capex guide for 2027 falls below $40B", eventFamily: "equipment_orders", armedAt: daysAgo(40) },
    // The China InP event-family (2 PARTIAL)
    { thesisId: memorySupercycle.id,         statement: "China InP substrate capacity doubles before Q4 — disrupts HBM supply chain", eventFamily: "china_inp", armedAt: daysAgo(60), status: "PARTIAL" },
    { thesisId: memorySupercycle.id,         statement: "Chinese DRAM inventory build releases 30M+ units onto spot market", eventFamily: "china_inp", armedAt: daysAgo(60), status: "PARTIAL" },
  ];
  for (const f of falsifiers) {
    await db.falsifier.create({
      data: {
        forecastId: null,
        statement: f.statement,
        compiledQuery: { entities: [], keywords: f.statement.split(" ").slice(0,5), direction: "BEARISH" } as any,
        status: f.status ?? "ARMED",
        eventFamily: f.eventFamily,
        armedAt: f.armedAt,
        expiresAt: daysFromNow(90),
        lastCheckedAt: daysAgo(1),
        firingEvidence: {} as any,
        thesisIds: [f.thesisId] as any,
      },
    });
  }
  // Add 13 more armed falsifiers to reach the spec's "23 armed" headline
  for (let i = 0; i < 13; i++) {
    await db.falsifier.create({
      data: {
        statement: `Falsifier #${i+11}: thesis-event determinant (synthetic seed)`,
        compiledQuery: { keywords: [], direction: "BEARISH" } as any,
        status: "ARMED",
        eventFamily: "synthetic",
        armedAt: daysAgo(20 - i),
        expiresAt: daysFromNow(60),
        lastCheckedAt: daysAgo(1),
        firingEvidence: {} as any,
        thesisIds: [memorySupercycle.id, hyperscalerConcentration.id] as any,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ThesisEngagements — 5 staged objections to Hyperscaler Concentration
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding engagements...");
  const engagementSources = [stacySource.id, citriniSource.id];
  for (let i = 0; i < 5; i++) {
    await db.thesisEngagement.create({
      data: {
        thesisId: hyperscalerConcentration.id,
        opposingEventId: hyperscalerDebateEvent.id,
        engagementType: "SPECIFIC_OBJECTION",
        status: "OPEN",
        proposedStatus: "ANSWERED",
        reasoning: [
          "Capex pause risk priced in by Stacy Rasgon (Bernstein)",
          "Top-4 hyperscaler concentration in TSMC revenue = leverage not diversification (Citrini)",
          "Crowding at 2021 highs by Citrini quant model",
          "Historical precedent: consensus semiconductor positions compound below expectation",
          "Intra-quarter capex deferral signals from META supply chain",
        ][i],
        synthetic: i >= 3,
        psDecision: null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Author stances (per-event aggregation — L7)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding author stances...");
  const stances = [
    { authorId: authorIds.dylan522p,     narrativeFamily: "Memory Supercycle",          rollingDirection: 0.85, rollingConviction: 0.9,  insightCount: 14, lastEventDate: date(2026,7,1) },
    { authorId: authorIds.jukan_137,     narrativeFamily: "Memory Supercycle",          rollingDirection: 0.7,  rollingConviction: 0.75, insightCount: 22, lastEventDate: date(2026,7,7) },
    { authorId: authorIds.TrendForce,    narrativeFamily: "Memory Supercycle",          rollingDirection: 0.5,  rollingConviction: 0.8,  insightCount: 8,  lastEventDate: date(2026,7,5) },
    { authorId: authorIds.bofa_research, narrativeFamily: "Memory Supercycle",          rollingDirection: 0.3,  rollingConviction: 0.6,  insightCount: 5,  lastEventDate: date(2026,7,6) },
    { authorId: authorIds.stacyrasgon,   narrativeFamily: "Hyperscaler AI Concentration",rollingDirection: -0.4, rollingConviction: 0.7,  insightCount: 9,  lastEventDate: date(2026,7,4) },
    { authorId: authorIds.citrini7,      narrativeFamily: "Hyperscaler AI Concentration",rollingDirection: -0.6, rollingConviction: 0.8,  insightCount: 18, lastEventDate: date(2026,7,2) },
    { authorId: authorIds.zephyr_z9,     narrativeFamily: "Hyperscaler AI Concentration",rollingDirection: -0.55,rollingConviction: 0.75, insightCount: 15, lastEventDate: date(2026,7,3) },
  ];
  for (const s of stances) {
    await db.authorStance.create({ data: { ...s, postingBaseline: 0.3 } });
  }
  // stance changes — the artifact lesson
  await db.stanceChange.create({
    data: {
      authorId: authorIds.dylan522p,
      narrativeFamily: "Memory Supercycle",
      changeType: "CONSISTENT",
      priorStance: 0.8,
      newStance: 0.85,
      magnitude: 0.05,
      triggerEventId: dramQ3Event.id,
      reviewed: true,
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Debates — the flagship DRAM Q3 debate (v2.1 §2)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding debates...");
  const dramDebate = await db.debate.create({
    data: {
      question: "How much will Q3 2026 DRAM contract prices rise quarter-over-quarter?",
      debateType: "MAGNITUDE",
      metricId: dramMetricId,
      metricName: "DRAM Contract Price QoQ",
      thesisIds: [memorySupercycle.id, memoryTax.id] as any,
      status: "LIVE",
      stakes: "This is the flagship memory supercycle determinant. A print above +30% QoQ vindicates the structural-pricing thesis and lifts MU/SK Hynix/Samsung estimates; a print at +13-18% confirms TrendForce's range-bound read and cools the crowding narrative; a print below +13% falsifies the supercycle's central case and triggers falsifier demotion cascades across the memory family. Five memory theses are decided by this single number.",
      resolutionEventIds: [skHynixADR.id, intelEarnings.id, samsungEarnings.id] as any,
      heatScore: 9.4,
    },
  });
  await db.debate.update({ where: { id: dramDebate.id }, data: { theses: { connect: [{ id: memorySupercycle.id }, { id: memoryTax.id }] } }});

  // Positions — side A (high print) vs side B (low print)
  await db.debatePosition.create({
    data: {
      debateId: dramDebate.id,
      side: "A",
      authorId: authorIds.dylan522p,
      authorName: "Dylan Patel",
      orgId: "SemiAnalysis",
      statement: "Q3 DRAM contract print +40-50% QoQ (central case, not high end)",
      evidenceRefs: [{ sourceId: dylanSource.id, spanStart: dylanSpanStart, spanEnd: dylanSpanEnd, url: dylanRaw.url }] as any,
      claimIds: [claimIds[0]] as any,
      stanceWeight: 1.0,
      enteredAt: daysAgo(9),
      lastAffirmedAt: daysAgo(2),
      sourceId: dylanSource.id,
      quantClaims: { connect: [{ id: claimIds[0] }] },
    },
  });
  await db.debatePosition.create({
    data: {
      debateId: dramDebate.id,
      side: "A",
      authorId: authorIds.jukan_137,
      authorName: "Jukan Kazuya",
      orgId: "Independent",
      statement: "Channel read: DRAM Q3 +35-45% QoQ — the floor the channel is pricing",
      evidenceRefs: [{ sourceId: jukanSource.id, spanStart: jukanSpanStart, spanEnd: jukanSpanEnd, url: jukanRaw.url }] as any,
      claimIds: [claimIds[3]] as any,
      stanceWeight: 1.0,
      enteredAt: daysAgo(3),
      lastAffirmedAt: daysAgo(1),
      sourceId: jukanSource.id,
      quantClaims: { connect: [{ id: claimIds[3] }] },
    },
  });
  await db.debatePosition.create({
    data: {
      debateId: dramDebate.id,
      side: "B",
      authorId: authorIds.TrendForce,
      authorName: "TrendForce",
      orgId: "TrendForce",
      statement: "Q3 DRAM contract +13-18% QoQ (server DRAM concentrated; HBM excluded)",
      evidenceRefs: [{ sourceId: tfSource.id, spanStart: tfSpanStart, spanEnd: tfSpanEnd, url: tfRaw.url }] as any,
      claimIds: [claimIds[1]] as any,
      stanceWeight: 1.1, // anchor-class — slight premium
      enteredAt: daysAgo(5),
      lastAffirmedAt: daysAgo(5),
      sourceId: tfSource.id,
      quantClaims: { connect: [{ id: claimIds[1] }] },
    },
  });
  await db.debatePosition.create({
    data: {
      debateId: dramDebate.id,
      side: "B",
      authorId: authorIds.bofa_research,
      authorName: "BofA Securities",
      orgId: "BofA Securities",
      statement: "Q3 DRAM contract +5-17% QoQ (central 11%) — carrier: Eugene Loh",
      evidenceRefs: [{ sourceId: bofaSource.id, spanStart: bofaSpanStart, spanEnd: bofaSpanEnd, url: bofaRaw.url }] as any,
      claimIds: [claimIds[2]] as any,
      stanceWeight: 0.9,
      enteredAt: daysAgo(4),
      lastAffirmedAt: daysAgo(4),
      sourceId: bofaSource.id,
      quantClaims: { connect: [{ id: claimIds[2] }] },
    },
  });

  // Hyperscaler Concentration debate (DIRECTION type)
  const hyperscalerDebate = await db.debate.create({
    data: {
      question: "Is hyperscaler capex concentration in AI compute structural pricing power, or priced-and-crowded leverage?",
      debateType: "DIRECTION",
      thesisIds: [hyperscalerConcentration.id, crowdingFade.id] as any,
      status: "LIVE",
      stakes: "Decides whether the Hyperscaler Concentration thesis promotes to ACTIONABLE (its current gate) or stalls on the crowding-fade counter. Stacy Rasgon and Citrini Research hold the bear side; the bull side is implicit in the thesis's supporting evidence. The five staged objections are this debate's positions.",
      resolutionEventIds: [intelEarnings.id, samsungEarnings.id] as any,
      heatScore: 8.1,
    },
  });
  await db.debate.update({ where: { id: hyperscalerDebate.id }, data: { theses: { connect: [{ id: hyperscalerConcentration.id }, { id: crowdingFade.id }] } }});
  await db.debatePosition.create({
    data: {
      debateId: hyperscalerDebate.id,
      side: "B",
      authorId: authorIds.stacyrasgon,
      authorName: "Stacy Rasgon",
      orgId: "Bernstein",
      statement: "Concentration is real but priced. A capex pause de-rates semis 20% before fundamentals bend.",
      evidenceRefs: [{ sourceId: stacySource.id, spanStart: stacySpanStart, spanEnd: stacySpanEnd, url: stacyRaw.url }] as any,
      claimIds: [] as any,
      stanceWeight: 1.0,
      enteredAt: daysAgo(6),
      lastAffirmedAt: daysAgo(3),
      sourceId: stacySource.id,
    },
  });
  await db.debatePosition.create({
    data: {
      debateId: hyperscalerDebate.id,
      side: "B",
      authorId: authorIds.citrini7,
      authorName: "Citrini Research",
      orgId: "Citrini Capital",
      statement: "Top-4 hyperscalers ~62% of TSMC revenue. This is leverage, not diversification. Fade the trade.",
      evidenceRefs: [{ sourceId: citriniSource.id, spanStart: citriniSpanStart, spanEnd: citriniSpanEnd, url: citriniRaw.url }] as any,
      claimIds: [] as any,
      stanceWeight: 1.0,
      enteredAt: daysAgo(8),
      lastAffirmedAt: daysAgo(5),
      sourceId: citriniSource.id,
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Trade layer — expressions, narrative families, TradePlan stubs
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding trade layer...");
  await db.narrativeFamily.create({
    data: { name: "Memory Supercycle", thesisIds: [memorySupercycle.id, memoryTax.id] as any, riskCapR: 3.0 },
  });
  await db.narrativeFamily.create({
    data: { name: "Hyperscaler AI Concentration", thesisIds: [hyperscalerConcentration.id, crowdingFade.id] as any, riskCapR: 2.5 },
  });
  await db.narrativeFamily.create({
    data: { name: "Equipment Second-Order", thesisIds: [equipmentSecondOrder.id] as any, riskCapR: 1.5 },
  });

  const muExpr = await db.thesisExpression.create({
    data: {
      thesisId: memorySupercycle.id,
      entityId: entityIds["Micron Technology"],
      instrumentType: "EQUITY",
      thesisBeta: 1,
      betaEvidence: { rationale: "Direct memory exposure; primary beneficiary of DRAM pricing power" } as any,
      crowdingScore: 0.4,
      liquidityClass: "DEEP",
      rankScore: 0.88,
      rationale: "Micron is the cleanest DRAM pure-play expression. HBM3E 1a yields cap upside but the structural pricing power is unambiguous.",
    },
  });
  const skExpr = await db.thesisExpression.create({
    data: {
      thesisId: memorySupercycle.id,
      entityId: entityIds["SK Hynix"],
      instrumentType: "ADR",
      thesisBeta: 1,
      betaEvidence: { rationale: "Leading HBM3E supplier; verification clock Jul 10" } as any,
      crowdingScore: 0.3,
      liquidityClass: "MEDIUM",
      rankScore: 0.82,
      rationale: "SK Hynix ADR — HBM3E pure-play with verification event Jul 10.",
    },
  });

  // PAPER TradePlan — activates on first ACTIONABLE per spec
  await db.tradePlan.create({
    data: {
      thesisId: memorySupercycle.id,
      expressionId: muExpr.id,
      entryLow: 142.5,
      entryHigh: 148.0,
      stopPrice: 134.0,
      targetBase: 175.0,
      targetBull: 195.0,
      priceSource: "manual",
      priceAsOfDate: daysAgo(1),
      atrValue: 6.8,
      riskPerUnit: 1.0,
      unitsPlanned: 0.7,
      falsifierStopIds: ["falsifier_dram_below_13", "falsifier_samsung_hbm_slip"] as any,
      verificationEventId: skHynixADR.id,
      status: "DRAFT",
      constructionLog: {
        entryBand: "price ± 0.5×ATR",
        stopRule: "max(2×ATR technical, corpus-stated invalidation at +13% print)",
        targetRule: "QuantClaim magnitude (flagged)",
        priceSource: "manual",
      } as any,
    },
  });
  await db.tradePlan.create({
    data: {
      thesisId: memorySupercycle.id,
      expressionId: skExpr.id,
      entryLow: 128.0,
      entryHigh: 132.0,
      stopPrice: 118.0,
      targetBase: 158.0,
      targetBull: 172.0,
      priceSource: "manual",
      priceAsOfDate: daysAgo(1),
      atrValue: 5.4,
      riskPerUnit: 1.0,
      unitsPlanned: 0.5,
      falsifierStopIds: ["falsifier_dram_below_13"] as any,
      verificationEventId: skHynixADR.id,
      status: "DRAFT",
      constructionLog: { entryBand: "price ± 0.5×ATR", stopRule: "2×ATR technical", targetRule: "mechanical R-multiple" } as any,
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Needs-You Queue — the one inbox (L14)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding Needs-You queue...");
  const queueItems = [
    { type: "RULING",        priority: 1, summary: "Hyperscaler Concentration: 5 staged objections await PS ruling" },
    { type: "VLM_RATIFY",    priority: 2, summary: "BofA DRAM chart screenshot — pending VLM ratification (45 of 50 ratifications)" },
    { type: "TRIPWIRE",      priority: 3, summary: "Same-metric collision: Dylan 40-50% vs BofA 5-17% on Q3 DRAM — >30% deviation flagged" },
    { type: "CANDIDATE",     priority: 4, summary: "New handle @samsung_insider cited 3× by ingested content — proposed for admission" },
    { type: "ATTRIBUTION",   priority: 5, summary: "BofA-via-Eugene: confirm speaker=BoFA / carrier=Eugene attribution" },
    { type: "QUARANTINE",    priority: 6, summary: "Batch 2026-07-08: 2 sources quarantined on sample-extraction verification failure" },
    { type: "ALERT",         priority: 1, summary: "Compound stance alert: Citrini REVERSING on Hyperscaler Concentration (was bullish → bearish)" },
    { type: "RULING",        priority: 2, summary: "Memory Tax thesis: epistemic class proposal for @dylan522p — confirm ACCESS_ANALYST" },
  ];
  for (const q of queueItems) {
    await db.queueItem.create({ data: { ...q, payload: {} as any, status: "OPEN" }});
  }

  // ─────────────────────────────────────────────────────────────────
  // JobRuns — feeding the Health Strip (L13)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding job runs...");
  const jobs = [
    { job: "adapters:rss",          startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { fetched: 47, new: 3, deduped: 44, extracted: 2, quarantined: 1 } },
    { job: "adapters:x",            startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { fetched: 12, new: 5, deduped: 7, threads: 2, rateLimited: 0 } },
    { job: "adapters:transcripts",  startedAt: daysAgo(1), finishedAt: daysAgo(1), status: "DONE", counts: { fetched: 4, new: 1, deduped: 3, whisperFallback: 0 } },
    { job: "adapters:anchors",      startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { fetched: 6, new: 1, deduped: 5, revisions: 0 } },
    { job: "pipeline:events",       startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { clustered: 4, new_events: 1, echoes: 3 } },
    { job: "pipeline:stance",       startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { updated: 12, changes: 1, alerts: 1, silence: 0 } },
    { job: "pipeline:contrarian",   startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { detected: 5, staged: 5, synthetic: 0, alerts: 1 } },
    { job: "monitor:falsifiers",    startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { screened: 23, hits: 0, fired: 0 } },
    { job: "engine:ladder",         startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { reevaluated: 65, promoted: 0, demoted: 0 } },
    { job: "monitor:verifications", startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { checked: 0, resolved: 0, calibrationUpdates: 0, falsifierAssessed: 0 } },
    { job: "ops:scorecard",         startedAt: daysAgo(7), finishedAt: daysAgo(7), status: "DONE", counts: { coverage_pct: 88, discard_rate: 0.12, verification_pass_rate: 0, queue_latency_hrs: 4.2, attribution_flags: 1 } },
    { job: "ops:backup",            startedAt: daysAgo(0), finishedAt: daysAgo(0), status: "DONE", counts: { tables_dumped: 18, rows_dumped: 634, bytes: 325632, restore_drill: "passed" } },
  ];
  for (const j of jobs) {
    await db.jobRun.create({ data: { ...j, counts: j.counts as any } });
  }

  // ─────────────────────────────────────────────────────────────────
  // Audit log entries
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding audit log...");
  await db.auditLog.create({ data: { actor: "JOB:engine:ladder", action: "STAGE_TRANSITION", targetType: "Thesis", targetId: hyperscalerConcentration.id, payload: { from: "HYPOTHESIS", to: "VALIDATED", at: date(2026,6,15).toISOString() } as any }});
  await db.auditLog.create({ data: { actor: "PS",                action: "ENGAGEMENT_REVIEW_OPENED", targetType: "Thesis", targetId: hyperscalerConcentration.id, payload: { objections: 5 } as any }});
  await db.auditLog.create({ data: { actor: "SYSTEM",            action: "DATE_CLAMP",                targetType: "RawContent", targetId: dylanRaw.id, payload: { field: "dateLatest", from: "2026-07-12", to: "2026-07-01" } as any }});
  await db.auditLog.create({ data: { actor: "JOB:monitor:falsifiers", action: "FALSIFIER_PARTIAL",  targetType: "Falsifier", targetId: "china_inp_1", payload: { eventFamily: "china_inp" } as any }});

  // ─────────────────────────────────────────────────────────────────
  // Source candidates (discovery loop)
  // ─────────────────────────────────────────────────────────────────
  await db.sourceCandidate.create({ data: { handle: "samsung_insider", citations: 3, status: "PROPOSED" }});
  await db.sourceCandidate.create({ data: { handle: "hbm_watcher",     citations: 2, status: "PROPOSED" }});

  // ─────────────────────────────────────────────────────────────────
  // Watermarks — demonstrate per-feed incrementality (RSS, X, transcripts, anchors)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding watermarks...");
  await db.watermark.create({ data: { adapterType: "RSS",        sourceKey: "https://jukan.substack.com/feed",   lastGuid: "substack:jukan_137:" + Date.now(), lastProcessedAt: daysAgo(1) }});
  await db.watermark.create({ data: { adapterType: "RSS",        sourceKey: "https://citrini.substack.com/feed", lastGuid: "substack:citrini7:" + Date.now(),  lastProcessedAt: daysAgo(2) }});
  await db.watermark.create({ data: { adapterType: "RSS",        sourceKey: "https://zephyr.substack.com/feed",  lastGuid: "substack:zephyr_z9:" + Date.now(), lastProcessedAt: daysAgo(1) }});
  await db.watermark.create({ data: { adapterType: "TRANSCRIPT", sourceKey: "https://youtube.com/@SemiAnalysis", lastExternalId: "yt:semi_analysis:" + Date.now(), lastProcessedAt: daysAgo(3) }});
  await db.watermark.create({ data: { adapterType: "ANCHOR",     sourceKey: "TrendForce",                       lastGuid: "anchor:TrendForce:" + Date.now(), lastProcessedAt: daysAgo(0) }});

  // ─────────────────────────────────────────────────────────────────
  // Ingested images — the VLM pipeline's customers
  // The BofA DRAM chart screenshot is the flagship: it's been screenshotted
  // and reshared by multiple accounts (virality count = 4), and it carries
  // the printed BofA attribution (L8 org attribution on images).
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding ingested images (VLM customers)...");
  const bofaChartHash = "bofa_dram_chart_" + Date.now();
  await db.ingestedImage.create({
    data: {
      imageHash: bofaChartHash,
      parentRawId: bofaRaw.id,
      storageRef: "images/seeded/bofa-dram-q3-chart.png",
      classifierClass: "CHART",
      annotationRoute: { valueLow: 5, valueHigh: 17, unit: "PERCENT", horizon: "Q3_2026", printedSource: "BofA Securities" } as any,
      axisReadRoute: { valueLow: 7, valueHigh: 15, unit: "PERCENT", horizon: "Q3_2026", printedSource: "BofA Securities" } as any,
      discrepancyFlag: "DUAL_ROUTE_MISMATCH", // annotation says 5-17, axis says 7-15 → 15%+ deviation
      confidence: "LOW", // mismatch → LOW confidence, parser-enforced
      ratificationStatus: "PENDING", // awaiting PS ratification
      viralityCount: 4, // screenshotted by 4 different accounts
    },
  });
  // A TrendForce chart — clean, no mismatch, already ratified
  await db.ingestedImage.create({
    data: {
      imageHash: "trendforce_dram_chart_" + Date.now(),
      parentRawId: tfRaw.id,
      storageRef: "images/seeded/trendforce-dram-q3-chart.png",
      classifierClass: "CHART",
      annotationRoute: { valueLow: 13, valueHigh: 18, unit: "PERCENT", horizon: "Q3_2026", printedSource: "TrendForce" } as any,
      axisReadRoute: { valueLow: 13, valueHigh: 18, unit: "PERCENT", horizon: "Q3_2026", printedSource: "TrendForce" } as any,
      discrepancyFlag: "",
      confidence: "HIGH",
      ratificationStatus: "RATIFIED",
      viralityCount: 2,
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Degraded sources — the 515 awaiting CP10 apply (here we add 6 as a representative sample)
  // ─────────────────────────────────────────────────────────────────
  console.log("› Seeding degraded sources (CP10 customers)...");
  for (let i = 0; i < 6; i++) {
    const degradedRaw = await db.rawContent.create({
      data: {
        contentHash: `degraded_${i}_${Date.now()}_${Math.random()}`,
        url: `https://example.com/legacy/${i}`,
        storageRef: `raw/legacy/degraded_${i}.txt`,
        title: `Legacy source #${i+1} (Phase-5 extraction, awaiting v3 apply)`,
        adapterType: "RSS",
        adapterVersion: "v1-legacy",
        bodyText: `Legacy extraction #${i}. Verbatim quote: "memory pricing dynamics remain favorable" — this content was extracted under Phase-5 prompts and is flagged degraded. The verbatim is present in raw; CP10 apply will upgrade to deep_extract/v3.`,
        fetchedAt: daysAgo(90 + i),
        extractionStatus: "EXTRACTED",
      },
    });
    await db.source.create({
      data: {
        rawContentId: degradedRaw.id,
        extractionVersion: "phase5/v1",
        degradedExtraction: true,
        authorId: authorIds.dylan522p,
        dateIso: daysAgo(90 + i),
        dateEarliest: daysAgo(90 + i),
        dateLatest: daysAgo(90 + i),
        direction: "BULLISH",
        conviction: "MEDIUM",
        confidence: "AMBIGUOUS",
        insightType: "OBSERVATION",
        verbatimQuote: "memory pricing dynamics remain favorable",
        keyInsight: `Legacy degraded extraction #${i+1} — Phase-5 prompt, awaiting CP10 apply to deep_extract/v3`,
        tickers: ["MU"] as any,
        entities: [] as any,
        independenceClass: "UNCLASSIFIED",
      },
    });
  }

  console.log("");
  console.log("✓ Seed complete.");
  console.log(`  Authors:        ${await db.author.count()}`);
  console.log(`  Raw content:    ${await db.rawContent.count()}`);
  console.log(`  Sources:        ${await db.source.count()}`);
  console.log(`  Information ev: ${await db.informationEvent.count()}`);
  console.log(`  QuantClaims:    ${await db.quantClaim.count()}`);
  console.log(`  Theses:         ${await db.thesis.count()}`);
  console.log(`  Engagements:    ${await db.thesisEngagement.count()}`);
  console.log(`  Debates:        ${await db.debate.count()}`);
  console.log(`  Positions:      ${await db.debatePosition.count()}`);
  console.log(`  Falsifiers:     ${await db.falsifier.count()}`);
  console.log(`  Verif events:   ${await db.verificationEvent.count()}`);
  console.log(`  Watermarks:     ${await db.watermark.count()}`);
  console.log(`  Degraded src:   ${await db.source.count({ where: { degradedExtraction: true } })}`);
  console.log(`  Ingested images:${await db.ingestedImage.count()}`);
  console.log(`  Queue items:    ${await db.queueItem.count()}`);
  console.log(`  Job runs:       ${await db.jobRun.count()}`);
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
