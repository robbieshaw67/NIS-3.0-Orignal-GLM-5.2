import { PrismaClient } from "@prisma/client";
const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });
async function main() {
  const eng: any[] = await oldDb.$queryRaw`SELECT DISTINCT engagement FROM "Source" WHERE engagement IS NOT NULL LIMIT 10`;
  console.log("Engagement values:", eng.map(e => e.engagement));
  const st: any[] = await oldDb.$queryRaw`SELECT DISTINCT "sourceType" FROM "Source" LIMIT 10`;
  console.log("Source types:", st.map(s => s.sourceType));
  const ec: any[] = await oldDb.$queryRaw`SELECT DISTINCT "extractionConfidence" FROM "Source" LIMIT 10`;
  console.log("Extraction confidence:", ec.map(e => e.extractionConfidence));
  const ic: any[] = await oldDb.$queryRaw`SELECT DISTINCT "independenceClass" FROM "Source" LIMIT 10`;
  console.log("Independence class:", ic.map(i => i.independenceClass));
  const sc: any[] = await oldDb.$queryRaw`SELECT DISTINCT "sourceClass" FROM "Source" LIMIT 10`;
  console.log("Source class:", sc.map(s => s.sourceClass));
}
main().then(() => process.exit(0));
