// NIP v3.0 — asOf module (the L4 fix, designed — Design §4)
//
// The ONLY sanctioned readers for time-sensitive tables. CI rule:
//   a grep step fails the build on db.(source|informationEvent|thesis|...
//   ).find outside lib/asof.ts and designated CRUD paths.
//
// Insert path clamps dateLatest = min(dateLatest, fetchedAt) and logs clamps.

import { Prisma } from "@prisma/client";
import { db } from "./db";

export type AsOfFilter = {
  narrativeFamily?: string;
  authorId?: string;
  metricId?: string;
  limit?: number;
};

// ─── sources ─── visibility: dateLatest <= asOf (certainly-past)
export async function getSourcesAsOf(asOf: Date, filter: AsOfFilter = {}) {
  const where: Prisma.SourceWhereInput = {
    dateLatest: { lte: asOf },
    dateEarliest: { not: null },
  };
  if (filter.narrativeFamily) {
    // Source has no narrativeFamily directly — joined via thesis/event; skip in this stub
  }
  if (filter.authorId) where.authorId = filter.authorId;
  return db.source.findMany({
    where,
    take: filter.limit ?? 200,
    orderBy: { dateLatest: "desc" },
    include: { rawContent: true },
  });
}

// ─── events ─── eventDate from member dateLatest maxima
export async function getEventsAsOf(asOf: Date, filter: AsOfFilter = {}) {
  return db.informationEvent.findMany({
    where: { eventDate: { lte: asOf } },
    take: filter.limit ?? 100,
    orderBy: { eventDate: "desc" },
    include: { sources: true, verificationEvents: true },
  });
}

// ─── recency window ─── membership: dateEarliest >= asOf - days
//   (never fresher-than-might-be — the look-ahead guard)
export async function getRecencyWindow(asOf: Date, days: number, filter: AsOfFilter = {}) {
  const since = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000);
  return db.source.findMany({
    where: {
      dateEarliest: { gte: since, lte: asOf },
    },
    take: filter.limit ?? 200,
    orderBy: { dateLatest: "desc" },
    include: { rawContent: true },
  });
}

// ─── day-precision only ─── silence/gap computations
export function requireDayPrecision(d: Date | null | undefined): Date | null {
  if (!d) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ─── the insert clamp ─── dateLatest = min(dateLatest, fetchedAt)
export function clampDateLatest(dateLatest: Date | null, fetchedAt: Date): Date {
  if (!dateLatest) return fetchedAt;
  return dateLatest.getTime() > fetchedAt.getTime() ? fetchedAt : dateLatest;
}

// ─── audit: log any clamp that fires ───
export async function logClamp(args: {
  rawContentId: string;
  field: string;
  from: string;
  to: string;
}) {
  await db.auditLog.create({
    data: {
      actor: "SYSTEM",
      action: "DATE_CLAMP",
      targetType: "RawContent",
      targetId: args.rawContentId,
      payload: { field: args.field, from: args.from, to: args.to } as any,
    },
  });
}

// ─── the silence window check ─── day-precision only, conservative
export function isSilenceCandidate(lastEventDate: Date | null, asOf: Date, minDays = 30): boolean {
  if (!lastEventDate) return false;
  const dayLast = requireDayPrecision(lastEventDate);
  const dayAsOf = requireDayPrecision(asOf);
  if (!dayLast || !dayAsOf) return false;
  const diffDays = (dayAsOf.getTime() - dayLast.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays >= minDays;
}
