import { PrismaClient } from "@prisma/client";
const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });

async function main() {
  // Check what the old Source table looks like
  const oldSources: any[] = await oldDb.$queryRaw`SELECT * FROM "Source" LIMIT 3`;
  console.log("Old Source sample:");
  for (const s of oldSources) {
    console.log("  rawContentId:", s.rawContentId, "| authorId:", s.authorId, "| direction:", s.direction);
  }

  // Check what the old RawContent looks like
  const oldRaw: any[] = await oldDb.$queryRaw`SELECT id, "contentHash", url FROM "RawContent" LIMIT 3`;
  console.log("\nOld RawContent sample:");
  for (const r of oldRaw) {
    console.log("  id:", r.id, "| contentHash:", r.contentHash, "| url:", r.url?.slice(0, 50));
  }

  // Check if old Source.rawContentId matches old RawContent.id
  const sampleSource = oldSources[0];
  if (sampleSource) {
    const matchingRaw: any[] = await oldDb.$queryRaw`SELECT id, "contentHash" FROM "RawContent" WHERE id = ${sampleSource.rawContentId}`;
    console.log("\nMatching raw for first source:", matchingRaw[0]?.id, matchingRaw[0]?.contentHash);
  }
}
main().then(() => process.exit(0));
