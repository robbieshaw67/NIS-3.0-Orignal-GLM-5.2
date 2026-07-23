import { chromium } from "playwright";

const BASE = "https://nis-3-0-orignal-glm-5-2-robbieshaw67-3774s-projects.vercel.app";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`);
  });

  console.log("=== Loading Briefing tab ===");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const briefingText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("Briefing has 'View details':", briefingText.includes("View details"));
  console.log("Briefing has 'Run all':", briefingText.includes("Run all"));
  console.log("Briefing has 'Health strip':", briefingText.includes("Health strip"));
  console.log("Briefing has 'Needs-you queue':", briefingText.includes("Needs-you queue"));
  console.log("Briefing has 'Job registry':", briefingText.includes("Job registry"));
  console.log("Briefing queue count:", (briefingText.match(/View details/g) || []).length);

  console.log("\n=== Navigating to Setup tab ===");
  await page.click('button:has-text("Setup")');
  await page.waitForTimeout(3000);

  const setupText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("Setup has 'Source List Manager':", setupText.includes("Source List Manager"));
  console.log("Setup has 'Add Source':", setupText.includes("Add Source"));
  console.log("Setup has author cards:", setupText.includes("Forecasts"));
  console.log("Setup v3.1 marker:", setupText.includes("[v3.1]"));

  console.log("\n=== Navigating to Composer tab ===");
  await page.click('button:has-text("Composer")');
  await page.waitForTimeout(3000);

  const composerText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("Composer has 'Compose Briefing':", composerText.includes("Compose Briefing"));
  console.log("Composer has 'Daily Standup':", composerText.includes("Daily Standup"));
  console.log("Composer has template list:", composerText.includes("TEMPLATE"));
  console.log("Composer v3.1 marker:", composerText.includes("[v3.1]"));

  console.log("\n=== Testing Composer: click Compose Briefing ===");
  await page.click('button:has-text("Compose Briefing")');
  await page.waitForTimeout(8000);

  const resultText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("Composer shows result:", resultText.length > 200);
  console.log("Composer result preview (first 300 chars):");
  console.log(resultText.slice(0, 300));

  console.log("\n=== Navigating to Ingestion tab ===");
  await page.click('button:has-text("Ingestion")');
  await page.waitForTimeout(3000);

  const ingestionText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("Ingestion has adapters:", ingestionText.includes("adapter") || ingestionText.includes("RSS") || ingestionText.includes("Adapter"));
  console.log("Ingestion has watermarks:", ingestionText.includes("atermark"));
  console.log("Ingestion text preview (first 500 chars):");
  console.log(ingestionText.slice(0, 500));

  console.log("\n=== Testing Briefing: click View details on first queue item ===");
  await page.click('button:has-text("Briefing")');
  await page.waitForTimeout(2000);
  await page.click('button:has-text("View details")').first().catch(() => {});
  await page.waitForTimeout(3000);

  const detailText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("Details expanded:", detailText.includes("Hide details") || detailText.length > briefingText.length);

  console.log("\n=== ERRORS ===");
  if (errors.length === 0) console.log("No errors!");
  else errors.forEach((e) => console.log(`  ${e}`));

  await browser.close();
}

main().catch(console.error);
