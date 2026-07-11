// NIP v3.0 — Source migration with correct column mapping
import { PrismaClient } from "@prisma/client";

const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });
const newDb = new PrismaClient({ datasources: { db: { url: process.env.NEW_DB_URL } } as any });

async function main() {
  console.log("=== NIP v3.0 Source Migration ===\n");

  // Build ID maps
  const newAuthors = await newDb.author.findMany({ select: { id: true, handle: true } });
  const authorMap = new Map(newAuthors.map(a => [a.handle, a.id]));

  const newRawContents = await newDb.rawContent.findMany({ select: { id: true, contentHash: true } });
  const rawByHash = new Map(newRawContents.map(r => [r.contentHash, r.id]));

  // Get old rawContents to map old.id → contentHash
  const oldRawContents: any[] = await oldDb.$queryRaw`SELECT id, "contentHash" FROM "RawContent"`;
  const oldRawIdToHash = new Map(oldRawContents.map(r => [r.id, r.contentHash]));

  console.log(`  ${authorMap.size} authors, ${rawByHash.size} raw contents mapped`);

  // Migrate Sources
  console.log("› Migrating sources...");
  const oldSources: any[] = await oldDb.$queryRaw`SELECT * FROM "Source"`;
  let sourceCount = 0;
  let skipped = 0;

  for (const s of oldSources) {
    try {
      // Map rawContentId: old.id → contentHash → new.id
      const contentHash = oldRawIdToHash.get(s.rawContentId);
      const newRawId = contentHash ? rawByHash.get(contentHash) : null;
      if (!newRawId) { skipped++; continue; }

      // Map author: handle (keep @ prefix as stored in DB) → new author.id
      const handle = s.handle || "";
      const newAuthorId = authorMap.get(handle) || authorMap.get(handle.replace("@", ""));
      if (!newAuthorId) { skipped++; continue; }

      // Parse tickers from comma-separated string
      const tickers = (s.tickers || "").split(",").map((t: string) => t.trim()).filter(Boolean);

      // Map sourceType → insightType
      const insightType = s.sourceType === "PODCAST" || s.sourceType === "VIDEO" ? "OBSERVATION" : "OBSERVATION";

      // Direction: not stored in old schema, default to NEUTRAL
      // (will be re-extracted by CP10 re-extraction)
      const direction = "NEUTRAL";

      // Conviction: derive from sourceClass
      const conviction = s.sourceClass === "EXTERNAL_ANCHOR" ? "HIGH" : "MEDIUM";

      // Confidence
      const confidence = s.extractionConfidence || "AMBIGUOUS";

      // Key insight from context or engagement
      const keyInsight = s.context || s.engagement || s.title || "";

      await newDb.source.create({
        data: {
          rawContentId: newRawId,
          extractionVersion: s.extractionVersion || "v1-migrated",
          degradedExtraction: s.degradedExtraction ?? false,
          authorId: newAuthorId,
          carrierAuthorId: s.speakerHandle ? (authorMap.get(s.speakerHandle.replace("@", "")) || null) : null,
          dateIso: s.dateIso ? new Date(s.dateIso) : null,
          dateEarliest: s.dateEarliest ? new Date(s.dateEarliest) : null,
          dateLatest: s.dateLatest ? new Date(s.dateLatest) : null,
          direction,
          conviction,
          confidence,
          insightType,
          verbatimQuote: s.verbatimQuote || "",
          keyInsight,
          tickers,
          entities: [],
          insightMetadata: s.insightMetadata ? (typeof s.insightMetadata === "string" ? JSON.parse(s.insightMetadata) : s.insightMetadata) : {},
          independenceClass: s.independenceClass || "UNCLASSIFIED",
        },
      });
      sourceCount++;
      if (sourceCount % 100 === 0) console.log(`  ...${sourceCount} sources migrated`);
    } catch (e: any) {
      skipped++;
    }
  }
  console.log(`  ✓ ${sourceCount} sources migrated (${skipped} skipped)`);

  // Final counts
  console.log("\n=== Final DB counts ===");
  const counts = {
    authors: await newDb.author.count(),
    rawContent: await newDb.rawContent.count(),
    sources: await newDb.source.count(),
    events: await newDb.informationEvent.count(),
    theses: await newDb.thesis.count(),
    falsifiers: await newDb.falsifier.count(),
    verifications: await newDb.verificationEvent.count(),
    stances: await newDb.authorStance.count(),
  };
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  });
