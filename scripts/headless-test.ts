// Headless browser test — loads the deployed NIP v3 page, navigates to each tab,
// captures console errors, and takes screenshots.

import { chromium } from "playwright";

const URL = "https://nip-v3.vercel.app/";
const SCREENSHOT_DIR = "/tmp/nip-screenshots";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    bypassCSP: true,
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  console.log("=== Loading page ===");
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-briefing.png`, fullPage: false });
  console.log("Screenshot 1 (Briefing) saved");

  // Check what's on the briefing page
  const briefingText = await page.textContent("body");
  console.log("\n=== BRIEFING PAGE TEXT (first 500 chars) ===");
  console.log(briefingText?.slice(0, 500));

  // Check for View details link
  const viewDetailsExists = await page.locator("text=View details").count();
  console.log(`\n'View details' links found: ${viewDetailsExists}`);

  // Check for Run all button
  const runAllExists = await page.locator("text=Run all").count();
  console.log(`'Run all' buttons found: ${runAllExists}`);

  // Navigate to Setup tab
  console.log("\n=== Navigating to Setup ===");
  await page.click('button:has-text("Setup")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-setup.png`, fullPage: false });
  console.log("Screenshot 2 (Setup) saved");

  const setupText = await page.textContent("body");
  console.log("Setup page text (first 500 chars):");
  console.log(setupText?.slice(0, 500));

  const addSourceExists = await page.locator("text=Add Source").count();
  console.log(`\n'Add Source' buttons found: ${addSourceExists}`);

  const sourceListManagerExists = await page.locator("text=Source List Manager").count();
  console.log(`'Source List Manager' text found: ${sourceListManagerExists}`);

  // Navigate to Composer tab
  console.log("\n=== Navigating to Composer ===");
  await page.click('button:has-text("Composer")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-composer.png`, fullPage: false });
  console.log("Screenshot 3 (Composer) saved");

  const composerText = await page.textContent("body");
  console.log("Composer page text (first 500 chars):");
  console.log(composerText?.slice(0, 500));

  const composeBtnExists = await page.locator("text=Compose Briefing").count();
  console.log(`\n'Compose Briefing' buttons found: ${composeBtnExists}`);

  // Navigate to Stream tab
  console.log("\n=== Navigating to Stream ===");
  await page.click('button:has-text("Stream")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-stream.png`, fullPage: false });

  // Navigate to Thesis Board
  console.log("\n=== Navigating to Thesis Board ===");
  await page.click('button:has-text("Thesis Board")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-board.png`, fullPage: false });

  // Navigate to Action
  console.log("\n=== Navigating to Action ===");
  await page.click('button:has-text("Action")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-action.png`, fullPage: false });

  // Navigate to Authors
  console.log("\n=== Navigating to Authors ===");
  await page.click('button:has-text("Authors")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-authors.png`, fullPage: false });

  // Navigate to Markets
  console.log("\n=== Navigating to Markets ===");
  await page.click('button:has-text("Markets")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-markets.png`, fullPage: false });

  // Navigate to Ingestion
  console.log("\n=== Navigating to Ingestion ===");
  await page.click('button:has-text("Ingestion")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/09-ingestion.png`, fullPage: false });

  console.log("\n=== CONSOLE ERRORS ===");
  if (consoleErrors.length === 0) console.log("  (none)");
  else consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 300)}`));

  console.log("\n=== PAGE ERRORS ===");
  if (pageErrors.length === 0) console.log("  (none)");
  else pageErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 300)}`));

  await browser.close();
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
