import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Move engagements from OBSERVATION thesis to VALIDATED thesis
  const result = await db.thesisEngagement.updateMany({
    where: { thesisId: "cmrfttz91001hto5xpaw7lemk" }, // OBSERVATION thesis
    data: { thesisId: "cmrftu145001sto5x0reqagjh" }   // VALIDATED thesis
  });
  console.log(`Moved ${result.count} engagements to VALIDATED thesis`);

  // Verify
  const vs = await db.thesis.findUnique({
    where: { id: "cmrftu145001sto5x0reqagjh" },
    include: { engagements: true }
  });
  console.log(`VALIDATED thesis now has ${vs?.engagements.length ?? 0} engagements`);
}
main().then(() => process.exit(0));
