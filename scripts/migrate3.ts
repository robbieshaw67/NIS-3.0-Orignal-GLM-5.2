// NIP v3.0 — Fast corpus migration with in-memory ID mapping
import { PrismaClient } from "@prisma/client";

const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });
const newDb = new PrismaClient({ datasources: { db: { url: process.env.NEW_DB_URL } } as any });

async function main() {
  console.log("=== NIP v3.0 Fast Corpus Migration ===\n");

  // Build ID maps in memory (single queries)
  console.log("› Building ID maps...");
  const newAuthors = await newDb.author.findMany({ select: { id: true, handle: true } });
  const authorMap = new Map(newAuthors.map(a => [a.handle, a.id]));

  const newRawContents = await newDb.rawContent.findMany({ select: { id: true, contentHash: true } });
  const rawByHash = new Map(newRawContents.map(r => [r.contentHash, r.id]));

  // Get old rawContents to map old.id → contentHash
  const oldRawContents: any[] = await oldDb.$queryRaw`SELECT id, "contentHash" FROM "RawContent"`;
  const oldRawIdToHash = new Map(oldRawContents.map(r => [r.id, r.contentHash || `migrated-${r.id}`]));

  console.log(`  ${authorMap.size} authors, ${rawByHash.size} raw contents, ${oldRawIdToHash.size} old raw IDs mapped`);

  // ── Migrate Sources (with in-memory ID mapping) ──
  console.log("› Migrating sources...");
  const oldSources: any[] = await oldDb.$queryRaw`SELECT * FROM "Source" LIMIT 700`;
  let sourceCount = 0;
  let sourceSkipped = 0;
  for (const s of oldSources) {
    try {
      // Map: old.rawContentId → old.contentHash → new.rawContent.id
      const contentHash = oldRawIdToHash.get(s.rawContentId) || s.rawContentId;
      const newRawId = rawByHash.get(contentHash);
      if (!newRawId) { sourceSkipped++; continue; }
      // Map: old.authorId (handle) → new.author.id
      const newAuthorId = authorMap.get(s.authorId);
      if (!newAuthorId) { sourceSkipped++; continue; }

      await newDb.source.create({
        data: {
          rawContentId: newRawId,
          extractionVersion: s.extractionVersion || "v1-migrated",
          authorId: newAuthorId,
          dateIso: s.dateIso ? new Date(s.dateIso) : null,
          dateEarliest: s.dateEarliest ? new Date(s.dateEarliest) : null,
          dateLatest: s.dateLatest ? new Date(s.dateLatest) : null,
          direction: s.direction || "NEUTRAL",
          conviction: s.conviction || "MEDIUM",
          confidence: s.confidence || "AMBIGUOUS",
          insightType: s.insightType || "OBSERVATION",
          verbatimQuote: s.verbatimQuote || "",
          keyInsight: s.keyInsight || "",
          tickers: s.tickers || [],
          entities: s.entities || [],
          independenceClass: s.independenceClass || "UNCLASSIFIED",
        },
      });
      sourceCount++;
      if (sourceCount % 100 === 0) console.log(`  ...${sourceCount} sources migrated`);
    } catch { sourceSkipped++; }
  }
  console.log(`  ✓ ${sourceCount} sources migrated (${sourceSkipped} skipped)`);

  // ── Migrate Theses ──
  console.log("› Migrating theses...");
  const oldTheses: any[] = await oldDb.$queryRaw`SELECT * FROM "Thesis" LIMIT 100`;
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

  // ── Migrate Falsifiers ──
  console.log("› Migrating falsifiers...");
  const oldFalsifiers: any[] = await oldDb.$queryRaw`SELECT * FROM "Falsifier" LIMIT 50`;
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
  const oldVerifs: any[] = await oldDb.$queryRaw`SELECT * FROM "VerificationEvent" LIMIT 50`;
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
  const oldStances: any[] = await oldDb.$queryRaw`SELECT * FROM "AuthorStance" LIMIT 200`;
  let stanceCount = 0;
  for (const s of oldStances) {
    try {
      const newAuthorId = authorMap.get(s.authorId);
      if (!newAuthorId) continue;
      await newDb.authorStance.create({
        data: {
          authorId: newAuthorId,
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

  // ── Final reconciliation ──
  console.log("\n=== Migration Complete ===");
  const newCounts = {
    authors: await newDb.author.count(),
    rawContent: await newDb.rawContent.count(),
    sources: await newDb.source.count(),
    events: await newDb.informationEvent.count(),
    theses: await newDb.thesis.count(),
    falsifiers: await newDb.falsifier.count(),
    verifications: await newDb.verificationEvent.count(),
    stances: await newDb.authorStance.count(),
  };
  console.log("New DB counts (L12 reconciliation):");
  for (const [k, v] of Object.entries(newCounts)) console.log(`  ${k}: ${v}`);
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await oldDb.$disconnect();
    await newDb.$disconnect();
    process.exit(1);
  });
