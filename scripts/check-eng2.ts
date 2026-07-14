import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Check all theses with "Hyperscaler" in title
  const theses = await db.thesis.findMany({
    where: { title: { contains: "Hyperscaler" } },
    include: { engagements: true }
  });
  console.log(`Found ${theses.length} theses with "Hyperscaler":`);
  for (const t of theses) {
    console.log(`  id=${t.id} stage=${t.stage} engagements=${t.engagements.length}`);
    console.log(`  title=${t.title.slice(0, 60)}`);
  }
}
main().then(() => process.exit(0));
