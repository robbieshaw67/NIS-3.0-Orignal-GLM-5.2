import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const counts = {
    authors: await db.author.count(),
    rawContent: await db.rawContent.count(),
    sources: await db.source.count(),
    events: await db.informationEvent.count(),
    theses: await db.thesis.count(),
    claims: await db.quantClaim.count(),
    falsifiers: await db.falsifier.count(),
    verifications: await db.verificationEvent.count(),
    stances: await db.authorStance.count(),
    queue: await db.queueItem.count(),
  };
  console.log("New DB counts:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
}
main().then(() => process.exit(0));
