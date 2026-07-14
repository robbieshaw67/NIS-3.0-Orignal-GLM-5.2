import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const theses = await db.thesis.findMany({ select: { id: true, title: true, eventIds: true }, take: 10 });
  for (const t of theses) {
    const eids = t.eventIds;
    console.log(`  ${t.id.slice(-8)} | type=${typeof eids} | isArray=${Array.isArray(eids)} | value=${JSON.stringify(eids)?.slice(0, 60)}`);
  }
}
main().then(() => process.exit(0));
