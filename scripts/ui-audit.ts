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

  console.log("=== Loading page ===");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // ── BRIEFING TAB ──
  console.log("\n=== BRIEFING TAB ===");
  const briefingText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Health strip:", briefingText.includes("Health strip"));
  console.log("✓ Intake digest:", briefingText.includes("Intake digest"));
  console.log("✓ Needs-you queue:", briefingText.includes("Needs-you queue"));
  console.log("✓ Job registry:", briefingText.includes("Job registry"));
  console.log("✓ View details links:", (briefingText.match(/View details/g) || []).length);
  console.log("✓ Run all button:", briefingText.includes("Run all"));
  // Check for hardcoded text (should NOT be present anymore)
  console.log("✗ No 'DRAM Q3 collection' hardcoded:", !briefingText.includes("DRAM Q3 collection"));
  console.log("✗ No 'BofA Q3 DRAM' hardcoded:", !briefingText.includes("BofA Q3 DRAM"));
  console.log("✗ No 'China InP' hardcoded:", !briefingText.includes("China InP"));

  // Click View details on first queue item
  console.log("\n  Clicking View details...");
  await page.locator('button:has-text("View details")').first().click().catch(() => {});
  await page.waitForTimeout(3000);
  const detailText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("  ✓ Details expanded:", detailText.includes("Hide details"));

  // ── SETUP TAB ──
  console.log("\n=== SETUP TAB ===");
  await page.click('button:has-text("Setup")');
  await page.waitForTimeout(3000);
  const setupText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Source List Manager:", setupText.includes("Source List Manager"));
  console.log("✓ Add Source button:", setupText.includes("Add Source"));
  console.log("✓ Author cards present:", setupText.includes("Forecasts"));
  console.log("✓ v3.1 marker:", setupText.includes("[v3.1]"));
  // Check pause state — should NOT show "Paused — not fetching" for all
  const pausedCount = (setupText.match(/Paused — not fetching/g) || []).length;
  console.log(`✓ Paused cards: ${pausedCount} (should be 0 or very few, not all 59)`);

  // ── COMPOSER TAB ──
  console.log("\n=== COMPOSER TAB ===");
  await page.click('button:has-text("Composer")');
  await page.waitForTimeout(3000);
  const composerText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Compose Briefing button:", composerText.includes("Compose Briefing"));
  console.log("✓ Daily Standup template:", composerText.includes("Daily Standup"));
  console.log("✓ v3.1 marker:", composerText.includes("[v3.1]"));
  console.log("✓ Prose styles:", composerText.includes("Fast") && composerText.includes("Analytical"));

  // ── STREAM TAB ──
  console.log("\n=== STREAM TAB ===");
  await page.click('button:has-text("Stream")');
  await page.waitForTimeout(3000);
  const streamText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Stream has content:", streamText.length > 100);
  console.log("✓ Has raw content:", streamText.includes("@") || streamText.includes("tweet"));

  // ── DEBATES TAB ──
  console.log("\n=== DEBATES TAB ===");
  await page.click('button:has-text("Debates")');
  await page.waitForTimeout(3000);
  const debatesText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Debates has content:", debatesText.length > 100);

  // ── THESIS BOARD TAB ──
  console.log("\n=== THESIS BOARD TAB ===");
  await page.click('button:has-text("Thesis Board")');
  await page.waitForTimeout(3000);
  const boardText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Board has content:", boardText.length > 100);
  console.log("✓ Has thesis stages:", boardText.includes("OBSERVATION") || boardText.includes("HYPOTHESIS"));

  // ── ACTION TAB ──
  console.log("\n=== ACTION TAB ===");
  await page.click('button:has-text("Action")');
  await page.waitForTimeout(3000);
  const actionText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Action has content:", actionText.length > 100);

  // ── AUTHORS TAB ──
  console.log("\n=== AUTHORS TAB ===");
  await page.click('button:has-text("Authors")');
  await page.waitForTimeout(3000);
  const authorsText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Authors has content:", authorsText.length > 100);
  console.log("✓ Has author names:", authorsText.includes("Ed Zitron") || authorsText.includes("Dylan"));

  // ── MARKETS TAB ──
  console.log("\n=== MARKETS TAB ===");
  await page.click('button:has-text("Markets")');
  await page.waitForTimeout(3000);
  const marketsText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Markets has content:", marketsText.length > 100);

  // ── INGESTION TAB ──
  console.log("\n=== INGESTION TAB ===");
  await page.click('button:has-text("Ingestion")');
  await page.waitForTimeout(3000);
  const ingestionText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  console.log("✓ Visual intake:", ingestionText.includes("Visual intake"));
  console.log("✓ Source List Manager:", ingestionText.includes("Source List Manager"));
  console.log("✓ VLM image gallery:", ingestionText.includes("VLM image gallery"));
  console.log("✓ Extraction log:", ingestionText.includes("Extraction log"));
  console.log("✓ Adapters:", ingestionText.includes("Adapters"));
  console.log("✓ Pipeline jobs:", ingestionText.includes("Pipeline jobs"));
  console.log("✓ Run all jobs:", ingestionText.includes("Run all jobs"));

  // Check VLM gallery shows images
  const vlmSection = ingestionText.indexOf("VLM image gallery");
  if (vlmSection > -1) {
    const vlmText = ingestionText.slice(vlmSection, vlmSection + 500);
    console.log("✓ VLM gallery shows image count:", /images/.test(vlmText));
  }

  console.log("\n=== ERRORS ===");
  if (errors.length === 0) console.log("✓ No errors!");
  else errors.forEach((e) => console.log(`  ✗ ${e.slice(0, 200)}`));

  await browser.close();
  console.log("\n=== AUDIT COMPLETE ===");
}

main().catch(console.error);
