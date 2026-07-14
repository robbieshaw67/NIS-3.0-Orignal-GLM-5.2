import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("› Seeding flagship DRAM debate + claims + engagements + queue...");

  // Get authors
  const dylan = await db.author.findFirst({ where: { handle: { contains: "dylan" } } });
  const trendforce = await db.author.findFirst({ where: { handle: { contains: "TrendForce" } } });
  const bofa = await db.author.findFirst({ where: { handle: { contains: "bofa" } } });
  const jukan = await db.author.findFirst({ where: { handle: { contains: "jukan" } } });
  const ps = await db.author.findFirst({ where: { handle: "ps" } });
  console.log("  Authors:", dylan?.handle, trendforce?.handle, bofa?.handle, jukan?.handle, ps?.handle);

  // Get a source to attach claims to
  const sources = await db.source.findMany({ take: 5, include: { rawContent: true } });
  if (sources.length === 0) { console.log("  No sources found — aborting"); return; }

  // Get or create the DRAM metric
  let metric = await db.metric.findFirst({ where: { canonicalName: "DRAM Contract Price QoQ" } });
  if (!metric) {
    metric = await db.metric.create({ data: { canonicalName: "DRAM Contract Price QoQ", unit: "PERCENT", aliases: ["DRAM_QOQ"] } });
  }
  console.log("  Metric:", metric.canonicalName);

  // Get the Memory Supercycle thesis
  let thesis = await db.thesis.findFirst({ where: { title: { contains: "structural inflection" } } });
  if (!thesis) thesis = await db.thesis.findFirst({ where: { narrativeFamily: "Memory Supercycle" } });
  if (!thesis) {
    thesis = await db.thesis.create({
      data: {
        title: "Q3 2026 marks the structural inflection of the memory supercycle — DRAM contract +30-50% QoQ, HBM-led",
        direction: "BULLISH", stage: "HYPOTHESIS",
        independentEvents: 3, primaryIntegrityEvents: 1,
        effectiveN: 3.4, distinctOrgs: 4, epistemicClassCount: 3,
        contrarianStatus: "UNENGAGED", armedFalsifiers: 3,
        narrativeFamily: "Memory Supercycle", divergenceVerdict: "UNPRICED_DIVERGENCE",
        stageHistory: [{ from: "OBSERVATION", to: "HYPOTHESIS", at: new Date().toISOString() }],
      }
    });
  }
  console.log("  Thesis:", thesis.title.slice(0, 50));

  // Create the 4 flagship QuantClaims
  const claimData = [
    { author: dylan, valueLow: 40, valueHigh: 50, confidence: "HIGH", label: "Dylan Patel 40-50%" },
    { author: trendforce, valueLow: 13, valueHigh: 18, confidence: "HIGH", label: "TrendForce 13-18%" },
    { author: bofa, valueLow: 5, valueHigh: 17, confidence: "MEDIUM", label: "BofA 5-17%" },
    { author: jukan, valueLow: 35, valueHigh: 45, confidence: "HIGH", label: "Jukan 35-45%" },
  ];

  for (const cd of claimData) {
    if (!cd.author) continue;
    const existing = await db.quantClaim.findFirst({
      where: { metricId: metric.id, authorId: cd.author.id, valueLow: cd.valueLow }
    });
    if (existing) { console.log(`  Claim ${cd.label} already exists`); continue; }
    const claim = await db.quantClaim.create({
      data: {
        sourceId: sources[0].id,
        authorId: cd.author.id,
        metricId: metric.id,
        metricName: "DRAM Contract Price QoQ",
        valueLow: cd.valueLow, valueHigh: cd.valueHigh,
        unit: "PERCENT", horizon: "Q3_2026",
        claimedAt: new Date(),
        confidence: cd.confidence,
        extractionMethod: "TEXT",
        thesisId: thesis.id,
      }
    });
    console.log(`  Claim created: ${cd.label} → ${claim.id.slice(-6)}`);
  }

  // Create the flagship DRAM Q3 debate
  const existingDebate = await db.debate.findFirst({ where: { debateType: "MAGNITUDE", metricId: metric.id } });
  if (!existingDebate) {
    const debate = await db.debate.create({
      data: {
        question: "How much will Q3 2026 DRAM contract prices rise quarter-over-quarter?",
        debateType: "MAGNITUDE",
        metricId: metric.id,
        metricName: "DRAM Contract Price QoQ",
        thesisIds: [thesis.id] as any,
        status: "LIVE",
        stakes: "This is the flagship memory supercycle determinant. A print above +30% QoQ vindicates the structural-pricing thesis and lifts MU/SK Hynix/Samsung estimates; a print at +13-18% confirms TrendForce's range-bound read and cools the crowding narrative; a print below +13% falsifies the supercycle's central case and triggers falsifier demotion cascades across the memory family. Five memory theses are decided by this single number.",
        heatScore: 9.4,
      }
    });
    await db.debate.update({ where: { id: debate.id }, data: { theses: { connect: [{ id: thesis.id }] } } });
    console.log("  Debate created:", debate.question.slice(0, 50));

    // Add positions
    if (dylan) {
      await db.debatePosition.create({
        data: {
          debateId: debate.id, side: "A", authorId: dylan.id,
          authorName: dylan.realName, orgId: dylan.orgAffiliation,
          statement: "Q3 DRAM contract print +40-50% QoQ (central case, not high end)",
          evidenceRefs: [{ sourceId: sources[0].id, spanStart: 0, spanEnd: 50, url: sources[0].rawContent?.url ?? "" }] as any,
          claimIds: [] as any, stanceWeight: 1.0, sourceId: sources[0].id,
        }
      });
    }
    if (trendforce) {
      await db.debatePosition.create({
        data: {
          debateId: debate.id, side: "B", authorId: trendforce.id,
          authorName: trendforce.realName, orgId: trendforce.orgAffiliation,
          statement: "Q3 DRAM contract +13-18% QoQ (server DRAM concentrated; HBM excluded)",
          evidenceRefs: [] as any, claimIds: [] as any, stanceWeight: 1.1, sourceId: sources[0].id,
        }
      });
    }
    if (bofa) {
      await db.debatePosition.create({
        data: {
          debateId: debate.id, side: "B", authorId: bofa.id,
          authorName: bofa.realName, orgId: bofa.orgAffiliation,
          statement: "Q3 DRAM contract +5-17% QoQ (central 11%)",
          evidenceRefs: [] as any, claimIds: [] as any, stanceWeight: 0.9, sourceId: sources[0].id,
        }
      });
    }
    console.log("  Positions created");
  } else {
    console.log("  Debate already exists");
  }

  // Create Hyperscaler engagement rulings
  const hsThesis = await db.thesis.findFirst({ where: { title: { contains: "Hyperscaler" } } });
  if (hsThesis) {
    const existingEngs = await db.thesisEngagement.count({ where: { thesisId: hsThesis.id } });
    if (existingEngs === 0) {
      for (let i = 0; i < 5; i++) {
        await db.thesisEngagement.create({
          data: {
            thesisId: hsThesis.id,
            opposingEventId: "manual",
            engagementType: "SPECIFIC_OBJECTION",
            status: "OPEN",
            proposedStatus: "ANSWERED",
            reasoning: [
              "Capex pause risk priced in by Stacy Rasgon (Bernstein)",
              "Top-4 hyperscaler concentration in TSMC revenue = leverage not diversification",
              "Crowding at 2021 highs by Citrini quant model",
              "Historical precedent: consensus semiconductor positions compound below expectation",
              "Intra-quarter capex deferral signals from META supply chain",
            ][i],
            synthetic: i >= 3,
          }
        });
      }
      console.log("  5 Hyperscaler engagements created");
    } else {
      console.log(`  Hyperscaler already has ${existingEngs} engagements`);
    }
  }

  // Create queue items
  const queueItems = [
    { type: "RULING", priority: 1, summary: "Hyperscaler Concentration: 5 staged objections await PS ruling" },
    { type: "VLM_RATIFY", priority: 2, summary: "BofA DRAM chart screenshot — pending VLM ratification" },
    { type: "TRIPWIRE", priority: 3, summary: "Same-metric collision: Dylan 40-50% vs BofA 5-17% on Q3 DRAM" },
    { type: "CANDIDATE", priority: 4, summary: "New handle @samsung_insider cited 3x — proposed for admission" },
    { type: "ATTRIBUTION", priority: 5, summary: "BofA-via-Eugene: confirm speaker=BoFA / carrier=Eugene attribution" },
    { type: "QUARANTINE", priority: 6, summary: "Batch 2026-07-08: 2 sources quarantined on CP3 failure" },
    { type: "ALERT", priority: 1, summary: "Compound stance alert: Citrini REVERSING on Hyperscaler Concentration" },
    { type: "RULING", priority: 2, summary: "Memory Tax thesis: epistemic class proposal for @dylan522p — confirm ACCESS_ANALYST" },
  ];
  for (const q of queueItems) {
    const exists = await db.queueItem.findFirst({ where: { summary: q.summary, status: "OPEN" } });
    if (!exists) {
      await db.queueItem.create({ data: { ...q, payload: {}, status: "OPEN" } });
    }
  }
  console.log("  Queue items created");

  // Create verification events linked to the metric
  const verifs = await db.verificationEvent.findMany();
  for (const v of verifs) {
    if (!v.metricIds || (Array.isArray(v.metricIds) && v.metricIds.length === 0)) {
      await db.verificationEvent.update({ where: { id: v.id }, data: { metricIds: [metric.id] as any } });
    }
  }
  console.log("  Verification events linked to DRAM metric");

  // Final counts
  console.log("\n=== Final counts ===");
  console.log("  Claims:", await db.quantClaim.count());
  console.log("  Debates:", await db.debate.count());
  console.log("  Engagements:", await db.thesisEngagement.count());
  console.log("  Queue (open):", await db.queueItem.count({ where: { status: "OPEN" } }));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
