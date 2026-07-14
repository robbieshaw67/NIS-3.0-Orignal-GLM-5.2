import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Check debates
  const debates = await db.debate.count();
  console.log("Debates:", debates);
  // Check quant claims
  const claims = await db.quantClaim.count();
  console.log("QuantClaims:", claims);
  // Check thesis engagements
  const engs = await db.thesisEngagement.count();
  console.log("ThesisEngagements:", engs);
  // Check the Hyperscaler thesis
  const hs = await db.thesis.findFirst({ where: { title: { contains: "Hyperscaler" } }, include: { engagements: true } });
  console.log("\nHyperscaler thesis:", hs?.id, hs?.stage, hs?.contrarianStatus);
  console.log("  engagements:", hs?.engagements.length);
  if (hs && hs.engagements.length > 0) {
    for (const e of hs.engagements) {
      console.log("  ", e.id.slice(-8), e.status, e.psDecision, e.proposedStatus);
    }
  }
  // Check verification events
  const verifs = await db.verificationEvent.count();
  console.log("\nVerificationEvents:", verifs);
  // Check if there are any claims with the DRAM metric
  const dramClaims = await db.quantClaim.findMany({ take: 5, include: { source: true } });
  console.log("\nSample claims:");
  for (const c of dramClaims) {
    console.log("  ", c.metricName, c.valueLow, "-", c.valueHigh, "by", c.authorId.slice(-6), "source:", c.sourceId?.slice(-6) ?? "none");
  }
  // Check queue items
  const queue = await db.queueItem.count({ where: { status: "OPEN" } });
  console.log("\nOpen queue items:", queue);
}
main().then(() => process.exit(0));
