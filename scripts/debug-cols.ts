import { PrismaClient } from "@prisma/client";
const oldDb = new PrismaClient({ datasources: { db: { url: process.env.OLD_DB_URL } } as any });
async function main() {
  const cols: any[] = await oldDb.$queryRaw`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'Source' ORDER BY ordinal_position
  `;
  console.log("Source columns:");
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);
  
  const sample: any[] = await oldDb.$queryRaw`SELECT * FROM "Source" LIMIT 1`;
  console.log("\nFull source row keys:", Object.keys(sample[0] || {}));
  console.log("Full source row:", JSON.stringify(sample[0], null, 2).slice(0, 500));
}
main().then(() => process.exit(0));
