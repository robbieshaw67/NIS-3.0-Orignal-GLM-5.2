import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Find authors by partial handle match
  const allAuthors = await db.author.findMany();
  console.log("All authors:");
  for (const a of allAuthors) {
    console.log(`  ${a.handle} | ${a.realName} | ${a.orgAffiliation}`);
  }
  
  // Find dylan
  const dylan = allAuthors.find(a => a.handle.toLowerCase().includes("dylan") || a.realName.toLowerCase().includes("dylan"));
  const tf = allAuthors.find(a => a.handle.toLowerCase().includes("trend") || a.realName.toLowerCase().includes("trend"));
  const bofa = allAuthors.find(a => a.handle.toLowerCase().includes("bofa") || a.orgAffiliation?.toLowerCase().includes("bofa") || a.realName.toLowerCase().includes("bofa"));
  
  console.log("\nMatched:");
  console.log("  dylan:", dylan?.handle);
  console.log("  trendforce:", tf?.handle);
  console.log("  bofa:", bofa?.handle);
  
  const metric = await db.metric.findFirst({ where: { canonicalName: "DRAM Contract Price QoQ" } });
  const thesis = await db.thesis.findFirst({ where: { title: { contains: "structural inflection" } } });
  const sources = await db.source.findMany({ take: 1 });
  
  if (!metric || !thesis || sources.length === 0) {
    console.log("Missing metric/thesis/sources");
    return;
  }
  
  // Create missing claims
  const claimData = [
    { author: dylan, valueLow: 40, valueHigh: 50, confidence: "HIGH", label: "Dylan 40-50%" },
    { author: tf, valueLow: 13, valueHigh: 18, confidence: "HIGH", label: "TrendForce 13-18%" },
    { author: bofa, valueLow: 5, valueHigh: 17, confidence: "MEDIUM", label: "BofA 5-17%" },
  ];
  
  for (const cd of claimData) {
    if (!cd.author) { console.log(`  SKIP ${cd.label} — author not found`); continue; }
    const existing = await db.quantClaim.findFirst({
      where: { metricId: metric.id, authorId: cd.author.id, valueLow: cd.valueLow }
    });
    if (existing) { console.log(`  EXISTS ${cd.label}`); continue; }
    await db.quantClaim.create({
      data: {
        sourceId: sources[0].id, authorId: cd.author.id,
        metricId: metric.id, metricName: "DRAM Contract Price QoQ",
        valueLow: cd.valueLow, valueHigh: cd.valueHigh,
        unit: "PERCENT", horizon: "Q3_2026",
        claimedAt: new Date(), confidence: cd.confidence,
        extractionMethod: "TEXT", thesisId: thesis.id,
      }
    });
    console.log(`  CREATED ${cd.label}`);
  }
  
  // Link claims to debate positions
  const debate = await db.debate.findFirst({ where: { debateType: "MAGNITUDE" } });
  if (debate) {
    const allClaims = await db.quantClaim.findMany({ where: { metricId: metric.id } });
    console.log(`\nTotal claims: ${allClaims.length}`);
    for (const c of allClaims) {
      console.log(`  ${c.valueLow}-${c.valueHigh} by ${c.authorId.slice(-6)}`);
    }
  }
  
  console.log("\nFinal claim count:", await db.quantClaim.count());
}
main().then(() => process.exit(0));
