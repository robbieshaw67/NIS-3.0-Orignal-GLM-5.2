import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const metric = await db.metric.findFirst({ where: { canonicalName: "DRAM Contract Price QoQ" } });
  const thesis = await db.thesis.findFirst({ where: { title: { contains: "structural inflection" } } });
  const sources = await db.source.findMany({ take: 1 });
  if (!metric || !thesis || sources.length === 0) return;

  // Create TrendForce and BofA as authors if they don't exist
  let tf = await db.author.findFirst({ where: { handle: "@TrendForce" } });
  if (!tf) {
    tf = await db.author.create({ data: { handle: "@TrendForce", realName: "TrendForce Corp", epistemicClass: "ACCESS_ANALYST", orgAffiliation: "TrendForce", avatarColor: "#dc2626", bio: "External anchor — pricing releases treated as ground-truth arriving." } });
  }
  let bofa = await db.author.findFirst({ where: { handle: "@bofa_research" } });
  if (!bofa) {
    bofa = await db.author.create({ data: { handle: "@bofa_research", realName: "BofA Securities", epistemicClass: "ACCESS_ANALYST", orgAffiliation: "BofA Securities", avatarColor: "#ef4444", bio: "Sell-side research. Printed attribution on carrying screenshots." } });
  }

  // Create TrendForce claim
  const tfExisting = await db.quantClaim.findFirst({ where: { metricId: metric.id, authorId: tf.id } });
  if (!tfExisting) {
    await db.quantClaim.create({ data: { sourceId: sources[0].id, authorId: tf.id, metricId: metric.id, metricName: "DRAM Contract Price QoQ", valueLow: 13, valueHigh: 18, unit: "PERCENT", horizon: "Q3_2026", claimedAt: new Date(), confidence: "HIGH", extractionMethod: "TEXT", thesisId: thesis.id, orgAttribution: "TrendForce" } });
    console.log("Created TrendForce 13-18% claim");
  }
  // Create BofA claim
  const bofaExisting = await db.quantClaim.findFirst({ where: { metricId: metric.id, authorId: bofa.id } });
  if (!bofaExisting) {
    await db.quantClaim.create({ data: { sourceId: sources[0].id, authorId: bofa.id, metricId: metric.id, metricName: "DRAM Contract Price QoQ", valueLow: 5, valueHigh: 17, unit: "PERCENT", horizon: "Q3_2026", claimedAt: new Date(), confidence: "MEDIUM", extractionMethod: "TEXT", thesisId: thesis.id, orgAttribution: "BofA Securities" } });
    console.log("Created BofA 5-17% claim");
  }

  console.log("Total claims:", await db.quantClaim.count());
  console.log("Total authors:", await db.author.count());
  console.log("Total debates:", await db.debate.count());
  console.log("Total engagements:", await db.thesisEngagement.count());
  console.log("Total queue (open):", await db.queueItem.count({ where: { status: "OPEN" } }));
}
main().then(() => process.exit(0));
