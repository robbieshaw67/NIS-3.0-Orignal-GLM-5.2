import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto("https://nip-v3.vercel.app/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const mainText = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main ? main.innerText : "NO MAIN ELEMENT";
  });
  console.log("=== BRIEFING MAIN CONTENT ===");
  console.log(mainText.slice(0, 2000));

  await page.click('button:has-text("Setup")');
  await page.waitForTimeout(2000);
  const setupText = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main ? main.innerText : "NO MAIN ELEMENT";
  });
  console.log("\n=== SETUP MAIN CONTENT ===");
  console.log(setupText.slice(0, 2500));

  await page.click('button:has-text("Composer")');
  await page.waitForTimeout(2000);
  const composerText = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main ? main.innerText : "NO MAIN ELEMENT";
  });
  console.log("\n=== COMPOSER MAIN CONTENT ===");
  console.log(composerText.slice(0, 2000));

  await browser.close();
}

main().catch(console.error);
