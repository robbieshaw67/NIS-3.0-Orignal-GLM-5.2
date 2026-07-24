import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto("https://nis-3-0-orignal-glm-5-2-robbieshaw67-3774s-projects.vercel.app/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/tmp/nip-audit-shots/01-briefing.png" });

  await page.click('button:has-text("Setup")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/nip-audit-shots/02-setup.png" });

  await page.click('button:has-text("Composer")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/nip-audit-shots/03-composer.png" });

  await page.click('button:has-text("Ingestion")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/tmp/nip-audit-shots/04-ingestion.png" });

  await page.click('button:has-text("Briefing")');
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("View details")').first().click().catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/tmp/nip-audit-shots/05-briefing-details.png" });

  await browser.close();
  console.log("Screenshots saved");
}

main().catch(console.error);
