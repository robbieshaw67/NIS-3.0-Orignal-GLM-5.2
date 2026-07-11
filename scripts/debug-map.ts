import { PrismaClient } from "@prisma/client";
const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });
const newDb = new PrismaClient({ datasources: { db: { url: process.env.NEW_DB_URL } } as any });

async function main() {
  // Get one old source
  const oldSources: any[] = await oldDb.$queryRaw`SELECT * FROM "Source" LIMIT 1`;
  const s = oldSources[0];
  console.log("Old source rawContentId:", s.rawContentId);

  // Get old rawContent
  const oldRaw: any[] = await oldDb.$queryRaw`SELECT id, "contentHash" FROM "RawContent" WHERE id = ${s.rawContentId}`;
  console.log("Old rawContent:", oldRaw[0]?.id, oldRaw[0]?.contentHash?.slice(0, 20));

  // Check if new DB has this contentHash
  if (oldRaw[0]?.contentHash) {
    const newRaw = await newDb.rawContent.findFirst({ where: { contentHash: oldRaw[0].contentHash } });
    console.log("New rawContent match:", newRaw?.id ?? "NOT FOUND");
    if (!newRaw) {
      // Check what contentHashes exist in new DB
      const sample: any[] = await newDb.$queryRaw`SELECT id, "contentHash" FROM "RawContent" LIMIT 3`;
      console.log("New DB sample contentHashes:");
      for (const r of sample) console.log("  ", r.id, r.contentHash?.slice(0, 20));
    }
  }

  // Check handle mapping
  const handle = (s.handle || "").replace("@", "");
  console.log("\nHandle:", handle);
  const author = await newDb.author.findUnique({ where: { handle } });
  console.log("Author match:", author?.id ?? "NOT FOUND");
  if (!author) {
    const allHandles = await newDb.author.findMany({ select: { handle: true } });
    console.log("Available handles:", allHandles.slice(0, 5).map(a => a.handle));
  }
}
main().then(() => process.exit(0));
