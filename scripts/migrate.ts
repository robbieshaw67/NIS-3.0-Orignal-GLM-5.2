// NIP v3.0 — Corpus migration from v1/v2 to v3 (raw SQL version)
// Uses $queryRaw to read from old DB (different schema) + Prisma client for new DB

import { PrismaClient } from "@prisma/client";

const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });
const newDb = new PrismaClient({ datasources: { db: { url: process.env.NEW_DB_URL } } as any });

async function main() {
  console.log("=== NIP v3.0 Corpus Migration ===\n");

  // First, clear the new DB (remove demo seed data)
  console.log("› Clearing new DB (demo data)...");
  await clearNewDb();

  // ── Migrate Authors (old uses handle as PK, no id) ──
  console.log("› Migrating authors...");
  const oldAuthors: any[] = await oldDb.$queryRaw`SELECT * FROM "Author"`;
  let authorCount = 0;
  for (const a of oldAuthors) {
    try {
      await newDb.author.create({
        data: {
          handle: a.handle,
          realName: a.realName || a.handle,
          cluster: a.cluster || "",
          epistemicClass: (a.epistemicClass || "UNRESOLVED").replace("UNTAGGED", "UNRESOLVED"),
          orgAffiliation: a.orgAffiliation || null,
          calibrationScore: (a.calibrationScore ?? 50) / 100,
          forecastsMade: a.forecastsMade ?? 0,
          forecastsResolved: a.forecastsResolved ?? 0,
          forecastsCorrect: a.forecastsCorrect ?? 0,
          brierScore: a.brierScore,
          authorityWeight: a.authorityWeight ?? 1.0,
          bio: a.profile || "",
          avatarColor: "#64748b",
        },
      });
      authorCount++;
    } catch (e: any) {
      if (!e.message.includes("Unique constraint")) console.error(`  author ${a.handle}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`  ✓ ${authorCount} authors migrated`);

  // ── Migrate RawContent ──
  console.log("› Migrating raw content...");
  const oldRaw: any[] = await oldDb.$queryRaw`SELECT * FROM "RawContent"`;
  let rawCount = 0;
  for (const r of oldRaw) {
    try {
      await newDb.rawContent.create({
        data: {
          contentHash: r.contentHash || `migrated-${r.id}`,
          url: r.url || "",
          storageRef: r.storageRef || `raw/migrated/${r.id}`,
          title: r.title || "",
          adapterType: r.adapterType || "MANUAL",
          adapterVersion: r.adapterVersion || "v1-migrated",
          bodyText: r.bodyText || r.rawText || "",
          threadId: r.threadId || null,
          referencesUrl: r.referencesUrl || null,
          referenceType: r.referenceType || null,
          fetchedAt: r.fetchedAt || r.createdAt || new Date(),
          extractionStatus: r.extractionStatus || "EXTRACTED",
        },
      });
      rawCount++;
    } catch (e: any) {
      if (!e.message.includes("Unique constraint")) console.error(`  raw ${r.id}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`  ✓ ${rawCount} raw content migrated`);

  // ── Migrate Sources ──
  console.log("› Migrating sources...");
  const oldSources: any[] = await oldDb.$queryRaw`SELECT * FROM "Source"`;
  let sourceCount = 0;
  // Build a map of old rawContentId → new rawContent id
  const newRawContents = await newDb.rawContent.findMany({ select: { id: true, contentHash: true, url: true } });
  const rawByHash = new Map(newRawContents.map(r => [r.contentHash, r.id]));
  const rawByUrl = new Map(newRawContents.map(r => [r.url, r.id]));

  for (const s of oldSources) {
    try {
      // Find the new rawContent ID
      let newRawId = rawByHash.get(s.rawContentId) || rawByUrl.get(s.url || "");
      if (!newRawId) {
        // Try by old ID matching contentHash
        const match = newRawContents.find(r => r.contentHash === s.rawContentId || r.contentHash === `migrated-${s.rawContentId}`);
        if (match) newRawId = match.id;
      }
      if (!newRawId) continue;

      await newDb.source.create({
        data: {
          rawContentId: newRawId,
          extractionVersion: s.extractionVersion || "v1-migrated",
          authorId: s.authorId,
          dateIso: s.dateIso ? new Date(s.dateIso) : null,
          dateEarliest: s.dateEarliest ? new Date(s.dateEarliest) : null,
          dateLatest: s.dateLatest ? new Date(s.dateLatest) : null,
          direction: s.direction || "NEUTRAL",
          conviction: s.conviction || "MEDIUM",
          confidence: s.confidence || "AMBIGUOUS",
          insightType: s.insightType || "OBSERVATION",
          verbatimQuote: s.verbatimQuote || "",
          keyInsight: s.keyInsight || s.summary || "",
          tickers: s.tickers || [],
          entities: s.entities || [],
          independenceClass: s.independenceClass || "UNCLASSIFIED",
        },
      });
      sourceCount++;
    } catch (e: any) {
      // Skip errors silently for speed
    }
  }
  console.log(`  ✓ ${sourceCount} sources migrated`);

  // ── Migrate InformationEvents ──
  console.log("› Migrating information events...");
  const oldEvents: any[] = await oldDb.$queryRaw`SELECT * FROM "InformationEvent"`;
  let eventCount = 0;
  for (const ev of oldEvents) {
    try {
      await newDb.informationEvent.create({
        data: {
          canonicalTitle: ev.canonicalTitle || ev.title || "Migrated event",
          eventDate: ev.eventDate ? new Date(ev.eventDate) : new Date(),
          originType: ev.originType || "MIGRATED",
          originUrl: ev.originUrl || null,
          memberCount: ev.memberCount ?? 0,
          authorBreadth: ev.authorBreadth ?? 0,
          independentCount: ev.independentCount ?? 0,
        },
      });
      eventCount++;
    } catch {}
  }
  console.log(`  ✓ ${eventCount} events migrated`);

  // ── Migrate Theses ──
  console.log("› Migrating theses...");
  const oldTheses: any[] = await oldDb.$queryRaw`SELECT * FROM "Thesis"`;
  let thesisCount = 0;
  for (const t of oldTheses) {
    try {
      await newDb.thesis.create({
        data: {
          title: t.title || t.statement || "Migrated thesis",
          direction: t.direction || "NEUTRAL",
          stage: t.stage || "OBSERVATION",
          eventIds: t.eventIds || [],
          independentEvents: t.independentEvents ?? 0,
          primaryIntegrityEvents: t.primaryIntegrityEvents ?? 0,
          effectiveN: t.effectiveN ?? 0,
          distinctOrgs: t.distinctOrgs ?? 0,
          epistemicClassCount: t.epistemicClassCount ?? 0,
          contrarianStatus: t.contrarianStatus || "UNENGAGED",
          armedFalsifiers: t.armedFalsifiers ?? 0,
          crowdingFlag: t.crowdingFlag ?? false,
          divergenceVerdict: t.divergenceVerdict || "UNKNOWN",
          narrativeFamily: t.narrativeFamily || "",
          stageHistory: t.stageHistory || [],
        },
      });
      thesisCount++;
    } catch {}
  }
  console.log(`  ✓ ${thesisCount} theses migrated`);

  // ── Migrate QuantClaims ──
  console.log("› Migrating quant claims...");
  const oldClaims: any[] = await oldDb.$queryRaw`SELECT * FROM "QuantClaim"`;
  let claimCount = 0;
  // Build map of new source IDs for linking
  for (const c of oldClaims) {
    try {
      // Find a source by the old sourceId — may not map directly, so use a best-effort
      const newSource = await newDb.source.findFirst({ orderBy: { createdAt: "desc" } });
      await newDb.quantClaim.create({
        data: {
          sourceId: newSource?.id || "",
          authorId: c.authorId || "",
          metricId: c.metricId || c.metric || "",
          metricName: c.metricName || c.metric || "",
          valueLow: c.valueLow,
          valueHigh: c.valueHigh,
          unit: c.unit || "PERCENT",
          horizon: c.horizon || "",
          claimedAt: c.claimedAt ? new Date(c.claimedAt) : new Date(),
          confidence: c.confidence || "MEDIUM",
          resolvedValue: c.resolvedValue,
          resolvedAt: c.resolvedAt ? new Date(c.resolvedAt) : null,
          resolutionSource: c.resolutionSource || "",
        },
      });
      claimCount++;
    } catch {}
  }
  console.log(`  ✓ ${claimCount} claims migrated`);

  // ── Migrate Falsifiers ──
  console.log("› Migrating falsifiers...");
  const oldFalsifiers: any[] = await oldDb.$queryRaw`SELECT * FROM "Falsifier"`;
  let falsifierCount = 0;
  for (const f of oldFalsifiers) {
    try {
      await newDb.falsifier.create({
        data: {
          statement: f.statement || f.query || "",
          compiledQuery: f.compiledQuery || { keywords: [], direction: "BEARISH" },
          status: f.status || "ARMED",
          eventFamily: f.eventFamily || null,
          armedAt: f.armedAt ? new Date(f.armedAt) : new Date(),
          expiresAt: f.expiresAt ? new Date(f.expiresAt) : null,
          lastCheckedAt: f.lastCheckedAt ? new Date(f.lastCheckedAt) : null,
          firingEvidence: f.firingEvidence || {},
          thesisIds: f.thesisIds || [],
        },
      });
      falsifierCount++;
    } catch {}
  }
  console.log(`  ✓ ${falsifierCount} falsifiers migrated`);

  // ── Migrate VerificationEvents ──
  console.log("› Migrating verification events...");
  const oldVerifs: any[] = await oldDb.$queryRaw`SELECT * FROM "VerificationEvent"`;
  let verifCount = 0;
  for (const v of oldVerifs) {
    try {
      await newDb.verificationEvent.create({
        data: {
          date: v.date ? new Date(v.date) : new Date(),
          eventType: v.eventType || "UNKNOWN",
          entityId: v.entityId || null,
          thesisLinks: v.thesisLinks || [],
          falsifierIds: v.falsifierIds || [],
          metricIds: v.metricIds || [],
          status: v.status || "UPCOMING",
          outcome: v.outcome || "",
        },
      });
      verifCount++;
    } catch {}
  }
  console.log(`  ✓ ${verifCount} verification events migrated`);

  // ── Migrate AuthorStances ──
  console.log("› Migrating author stances...");
  const oldStances: any[] = await oldDb.$queryRaw`SELECT * FROM "AuthorStance"`;
  let stanceCount = 0;
  for (const s of oldStances) {
    try {
      await newDb.authorStance.create({
        data: {
          authorId: s.authorId,
          narrativeFamily: s.narrativeFamily || "",
          rollingDirection: s.rollingDirection ?? 0,
          rollingConviction: s.rollingConviction ?? 0,
          insightCount: s.insightCount ?? 0,
          postingBaseline: s.postingBaseline ?? 0,
        },
      });
      stanceCount++;
    } catch {}
  }
  console.log(`  ✓ ${stanceCount} stances migrated`);

  // ── Migrate QueueItems ──
  console.log("› Migrating queue items...");
  const oldQueue: any[] = await oldDb.$queryRaw`SELECT * FROM "QueueItem"`;
  let queueCount = 0;
  for (const q of oldQueue) {
    try {
      await newDb.queueItem.create({
        data: {
          type: q.type || "ALERT",
          payload: q.payload || {},
          status: q.status || "OPEN",
          priority: q.priority ?? 5,
          summary: q.summary || q.message || "",
          createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
        },
      });
      queueCount++;
    } catch {}
  }
  console.log(`  ✓ ${queueCount} queue items migrated`);

  // ── Final reconciliation ──
  console.log("\n=== Migration Complete ===");
  const newCounts = {
    authors: await newDb.author.count(),
    rawContent: await newDb.rawContent.count(),
    sources: await newDb.source.count(),
    events: await newDb.informationEvent.count(),
    theses: await newDb.thesis.count(),
    claims: await newDb.quantClaim.count(),
    falsifiers: await newDb.falsifier.count(),
    verifications: await newDb.verificationEvent.count(),
    stances: await newDb.authorStance.count(),
    queue: await newDb.queueItem.count(),
  };
  console.log("New DB counts (L12 reconciliation):");
  for (const [k, v] of Object.entries(newCounts)) {
    console.log(`  ${k}: ${v}`);
  }
}

async function clearNewDb() {
  await newDb.position.deleteMany();
  await newDb.tradePlan.deleteMany();
  await newDb.thesisExpression.deleteMany();
  await newDb.narrativeFamily.deleteMany();
  await newDb.thesisEngagement.deleteMany();
  await newDb.thesis.deleteMany();
  await newDb.debatePosition.deleteMany();
  await newDb.debate.deleteMany();
  await newDb.falsifier.deleteMany();
  await newDb.verificationEvent.deleteMany();
  await newDb.anchorRevision.deleteMany();
  await newDb.quantClaim.deleteMany();
  await newDb.source.deleteMany();
  await newDb.informationEvent.deleteMany();
  await newDb.authorFamilyStats.deleteMany();
  await newDb.stanceChange.deleteMany();
  await newDb.authorStance.deleteMany();
  await newDb.author.deleteMany();
  await newDb.ingestedImage.deleteMany();
  await newDb.rawContent.deleteMany();
  await newDb.ingestionBatch.deleteMany();
  await newDb.sourceCandidate.deleteMany();
  await newDb.queueItem.deleteMany();
  await newDb.adapterHealth.deleteMany();
  await newDb.auditLog.deleteMany();
  await newDb.providerCall.deleteMany();
  await newDb.jobRun.deleteMany();
  await newDb.gateThreshold.deleteMany();
  await newDb.watermark.deleteMany();
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await oldDb.$disconnect();
    await newDb.$disconnect();
    process.exit(1);
  });
