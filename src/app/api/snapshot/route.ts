// NIP v3.0 — Aggregated API for the operator surface.
// Single endpoint serving the four rooms + supporting surfaces.
// Returns a snapshot of the system state for the page's initial render.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const asOf = new Date();

  // ── Stream: raw content with extractions, in chronological order ──
  const rawContents = await db.rawContent.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 60,
    include: {
      sources: {
        include: { informationEvent: true, quantClaims: true },
      },
      images: true,
    },
  });

  // ── Debates: with positions, theses, resolution events ──
  const debates = await db.debate.findMany({
    orderBy: { heatScore: "desc" },
    include: {
      positions: { include: { source: { include: { rawContent: true } }, quantClaims: true } },
      theses: true,
      resolutionEvents: true,
    },
  });

  // ── Theses: with engagements, falsifiers (linked), tradePlans ──
  const theses = await db.thesis.findMany({
    orderBy: { stage: "asc" },
    include: {
      engagements: true,
      quantClaims: { include: { source: { include: { rawContent: true } } } },
      tradePlans: { include: { expression: true, positions: true } },
    },
  });

  // ── Verification events (the calendar) ──
  const verificationEvents = await db.verificationEvent.findMany({
    orderBy: { date: "asc" },
    include: { informationEvent: true },
  });

  // ── Authors with stances & stance changes ──
  const authors = await db.author.findMany({
    include: {
      stances: true,
      stanceChanges: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  // ── QuantClaims grouped by metric (for dispersion panels) ──
  const claims = await db.quantClaim.findMany({
    include: { source: { include: { rawContent: true } } },
    orderBy: { claimedAt: "desc" },
  });

  // ── Health strip (adapters + recent job runs) ──
  const adapterHealth = await db.adapterHealth.findMany({ orderBy: { adapter: "asc" } });
  const recentJobs = await db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 });

  // ── Queue (the Needs-You inbox) ──
  const queue = await db.queueItem.findMany({
    where: { status: "OPEN" },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  // ── Anchor revisions (for revision velocity arrows in Markets) ──
  const anchorRevisions = await db.anchorRevision.findMany();

  // ── Narrative families (for risk caps) ──
  const families = await db.narrativeFamily.findMany();

  // ── TradePlans + expressions ──
  const expressions = await db.thesisExpression.findMany({ include: { thesis: true } });
  const tradePlans = await db.tradePlan.findMany({
    include: { thesis: true, expression: true, positions: true },
  });

  // ── Counts for the Delta Briefing reconciliations (L12) ──
  const counts = {
    sources: await db.source.count(),
    events: await db.informationEvent.count(),
    theses: await db.thesis.count(),
    claims: await db.quantClaim.count(),
    authors: await db.author.count(),
    falsifiers: await db.falsifier.count(),
    queueOpen: await db.queueItem.count({ where: { status: "OPEN" } }),
    queueResolved7d: await db.queueItem.count({ where: { status: "RESOLVED", resolvedAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    rawContents: await db.rawContent.count(),
    armedFalsifiers: await db.falsifier.count({ where: { status: "ARMED" } }),
    partialFalsifiers: await db.falsifier.count({ where: { status: "PARTIAL" } }),
  };

  // ── Audit log (recent) ──
  const auditLog = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return NextResponse.json({
    asOf,
    counts,
    rawContents,
    debates,
    theses,
    verificationEvents,
    authors,
    claims,
    adapterHealth,
    recentJobs,
    queue,
    anchorRevisions,
    families,
    expressions,
    tradePlans,
    auditLog,
  });
}
