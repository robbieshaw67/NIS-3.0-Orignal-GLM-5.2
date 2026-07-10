// NIP v3.0 — Author accessor module (Spec §7, M5)
//
// The `authorityWeight` field on Author is readable ONLY via getAuthorityWeight().
// The accessor enforces the ≥5-resolved floor: if an author has fewer than 5
// resolved forecasts, their weight is clamped to the default (1.0) regardless
// of what's stored in the DB. This prevents a single lucky call from
// dominating the calibration-weighted median.
//
// Spec: "authorityWeight readable ONLY via getAuthorityWeight(author) —
// accessor enforces the ≥5-resolved floor"

import type { Author } from "@prisma/client";

const AUTHORITY_WEIGHT_FLOOR = 5; // ≥5 resolved forecasts required
const DEFAULT_WEIGHT = 1.0;

/**
 * The ONLY sanctioned way to read an author's authority weight.
 * Enforces the ≥5-resolved floor: authors with fewer than 5 resolved
 * forecasts get the default weight (1.0), regardless of stored value.
 */
export function getAuthorityWeight(author: Pick<Author, "authorityWeight" | "forecastsResolved">): number {
  if (author.forecastsResolved < AUTHORITY_WEIGHT_FLOOR) {
    return DEFAULT_WEIGHT;
  }
  return author.authorityWeight;
}

/**
 * Check if an author has graduated past the floor (for UI display).
 */
export function hasAuthorityFloor(author: Pick<Author, "forecastsResolved">): boolean {
  return author.forecastsResolved >= AUTHORITY_WEIGHT_FLOOR;
}

export { AUTHORITY_WEIGHT_FLOOR, DEFAULT_WEIGHT };
