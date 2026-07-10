#!/usr/bin/env bun
// NIP v3.0 — asOf CI grep gate (Design §4, L4 enforcement)
//
// Scans src/ for direct Prisma reads on time-sensitive tables OUTSIDE lib/asof.ts
// and designated CRUD paths. Fails the build if any are found.
//
// The rule: a grep step fails the build on
//   db.(source|informationEvent|thesis|falsifier|thesisEngagement|authorStance|stanceChange).find
// outside lib/asof.ts.
//
// Usage: bun run scripts/check-asof-grep.ts
// Exits non-zero on violation.

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

const ROOT = "/home/z/my-project";
const SRC = join(ROOT, "src");

// Designated CRUD / write paths where direct Prisma reads ARE allowed:
//   - lib/asof.ts — the sanctioned reader module itself
//   - lib/adapters.ts — adapter writes (storeRaw, source.create)
//   - app/api/**/route.ts — API endpoints (snapshot reads, queue writes, etc.)
//   - scripts/** — seed/migration scripts
const ALLOWED_PREFIXES = [
  "src/lib/asof.ts",
  "src/lib/adapters.ts",
  "src/app/api/",
  "src/lib/promotion.ts",  // the thesis-promotion pipeline (PS-gated writes)
  "src/lib/reextraction.ts", // CP10 apply
];

// Tables that are time-sensitive — reads must go through asOf helpers
const TIME_SENSITIVE_TABLES = [
  "source",
  "informationEvent",
  "thesis",
  "falsifier",
  "thesisEngagement",
  "authorStance",
  "stanceChange",
];

// Patterns: db.<table>.findMany, db.<table>.findFirst, db.<table>.findUnique, db.<table>.aggregate, db.<table>.groupBy
const READ_PATTERN = new RegExp(
  `db\\.(${TIME_SENSITIVE_TABLES.join("|")})\\.(findMany|findFirst|findUnique|aggregate|groupBy|count)\\b`
);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function isAllowed(filePath: string): boolean {
  const rel = relative(ROOT, filePath);
  return ALLOWED_PREFIXES.some(p => rel.startsWith(p));
}

const violations: Array<{ file: string; line: number; text: string }> = [];
const files = walk(SRC);

for (const file of files) {
  if (isAllowed(file)) continue;
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    const match = READ_PATTERN.exec(line);
    if (match) {
      violations.push({ file: relative(ROOT, file), line: i + 1, text: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error("╔══════════════════════════════════════════════════════════════╗");
  console.error("║  L4 VIOLATION — asOf grep gate failed                         ║");
  console.error("║  Direct Prisma reads on time-sensitive tables detected       ║");
  console.error("║  outside lib/asof.ts and designated CRUD paths.              ║");
  console.error("╚══════════════════════════════════════════════════════════════╝");
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error("");
  }
  console.error(`Found ${violations.length} violation(s).`);
  console.error("");
  console.error("Fix: route reads through lib/asof.ts helpers:");
  console.error("  getSourcesAsOf(asOf, filter)");
  console.error("  getEventsAsOf(asOf, ...)");
  console.error("  getRecencyWindow(asOf, days, ...)");
  console.error("");
  process.exit(1);
} else {
  console.log(`✓ asOf grep gate passed — ${files.length} files scanned, 0 violations.`);
}
