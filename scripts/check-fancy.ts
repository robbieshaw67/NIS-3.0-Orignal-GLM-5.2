import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  console.log("ep-fancy-scene DB:");
  console.log("  claims:", await db.quantClaim.count());
  console.log("  debates:", await db.debate.count());
  console.log("  engagements:", await db.thesisEngagement.count());
  console.log("  queue (open):", await db.queueItem.count({ where: { status: "OPEN" } }));
  console.log("  theses:", await db.thesis.count());
  console.log("  authors:", await db.author.count());
  console.log("  sources:", await db.source.count());
}
main().then(() => process.exit(0));
