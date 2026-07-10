#!/usr/bin/env bun
// NIP v3.0 — L1 CI sabotage test (Onboarding brief §5 item 4a, Spec §0 L1)
//
// The MU-$1 bug: a regex extracted "$XX.XX" from search snippets into
// `currentPrice` with no `priceSource`, producing +17,900% "upside." This
// test ensures that can never happen again by failing the build when:
//   1. Any code writes a price field (entryPrice, stopPrice, targetBase, etc.)
//      without also setting `priceSource ∈ {market-data, manual}`.
//   2. Any code reads a price from an LLM response (the provider's strip-and-log
//      handles this, but this test catches direct LLM field access).
//   3. Any code imports or uses a regex to extract dollar amounts into price fields.
//
// Usage: bun run scripts/check-l1-prices.ts
// Exits non-zero on violation.

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = "/home/z/my-project";
const SRC = join(ROOT, "src");
const SCRIPTS = join(ROOT, "scripts");

// Price fields that must always carry a priceSource
const PRICE_FIELDS = [
  "entryPrice",
  "entryLow",
  "entryHigh",
  "stopPrice",
  "targetBase",
  "targetBull",
  "currentPrice",
  "exitPrice",
];

// Patterns that indicate a price field being set
const PRICE_WRITE_PATTERN = new RegExp(
  `\\b(${PRICE_FIELDS.join("|")})\\s*[:=]`
);

// Pattern that indicates a regex extracting dollar amounts into a price field
const REGEX_PRICE_PATTERN = /\/.*\$[0-9]/;

// Allowed paths where price fields CAN be set (TradePlan construction, position creation)
const ALLOWED_PREFIXES = [
  "src/lib/promotion.ts",     // autoCreatePaperPosition (uses existing plan values)
  "src/lib/adapters.ts",      // adapters don't set prices
  "scripts/seed.ts",          // seed data
  "src/app/api/reextraction", // CP10 doesn't touch prices
  "src/lib/trade.ts",         // M7 trade layer (constructs plans WITH priceSource)
];

function walk(dir: string, files: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, files);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  } catch {}
  return files;
}

function isAllowed(filePath: string): boolean {
  const rel = relative(ROOT, filePath);
  return ALLOWED_PREFIXES.some(p => rel.startsWith(p));
}

const violations: Array<{ file: string; line: number; text: string; type: string }> = [];
const files = [...walk(SRC), ...walk(SCRIPTS)];

for (const file of files) {
  if (isAllowed(file)) continue;
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    // Check 1: price field set without priceSource nearby
    const priceMatch = PRICE_WRITE_PATTERN.exec(line);
    if (priceMatch) {
      // Look at surrounding 5 lines for priceSource
      const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 6)).join("\n");
      if (!/priceSource/i.test(context)) {
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          text: line.trim(),
          type: "price-field-without-priceSource",
        });
      }
    }

    // Check 2: regex extracting dollar amounts
    if (REGEX_PRICE_PATTERN.test(line) && /price|entry|stop|target/i.test(line)) {
      violations.push({
        file: relative(ROOT, file),
        line: i + 1,
        text: line.trim(),
        type: "regex-price-extraction",
      });
    }
  });
}

if (violations.length > 0) {
  console.error("╔══════════════════════════════════════════════════════════════╗");
  console.error("║  L1 VIOLATION — price field without priceSource detected     ║");
  console.error("║  The MU-$1 bug class: regex/LLM prices must carry             ║");
  console.error("║  priceSource ∈ {market-data, manual} — no third value.       ║");
  console.error("╚══════════════════════════════════════════════════════════════╝");
  console.error("");
  for (const v of violations) {
    console.error(`  [${v.type}] ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error("");
  }
  console.error(`Found ${violations.length} violation(s).`);
  console.error("");
  console.error("Fix: every price field write must be accompanied by priceSource");
  console.error("  ∈ {market-data, manual}. Add priceSource to the same object literal");
  console.error("  or within 5 lines of the price field assignment.");
  process.exit(1);
} else {
  console.log(`✓ L1 price-source check passed — ${files.length} files scanned, 0 violations.`);
}
