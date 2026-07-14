import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const engs = await db.thesisEngagement.findMany();
  console.log("Total engagements:", engs.length);
  for (const e of engs) {
    console.log(`  thesisId=${e.thesisId.slice(-8)} status=${e.status} psDecision=${e.psDecision}`);
  }
  // Check if the thesis ID matches
  const hs = await db.thesis.findFirst({ where: { title: { contains: "Hyperscaler" } } });
  console.log("\nHyperscaler thesis:", hs?.id, hs?.title?.slice(0, 50));
  if (hs) {
    const linked = await db.thesisEngagement.findMany({ where: { thesisId: hs.id } });
    console.log("Linked engagements:", linked.length);
  }
}
main().then(() => process.exit(0));
