// NIP v3.0 — Aggregated API for the operator surface.
// Single endpoint serving the four rooms + supporting surfaces.
// Returns a snapshot of the system state for the page's initial render.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const asOf = new Date();

  // ── Stream: raw content — limit to 20 and truncate bodyText to 500 chars
  // to keep snapshot small (bodyText was 1.5MB for 60 items, causing garbled UI)
  const rawContentsRaw = await db.rawContent.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 20,
    include: {
      sources: {
        include: { informationEvent: true, quantClaims: true },
      },
      images: true,
    },
  });
  const rawContents = rawContentsRaw.map(r => ({
    ...r,
    bodyText: r.bodyText ? r.bodyText.slice(0, 500) : "",
  }));

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
  const recentJobs = await db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 24 });

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
    firedFalsifiers: await db.falsifier.count({ where: { status: "FIRED" } }),
    degradedSources: await db.source.count({ where: { degradedExtraction: true } }),
    watermarks: await db.watermark.count(),
    paperPositions: await db.position.count({ where: { ledgerType: "PAPER" } }),
    actualPositions: await db.position.count({ where: { ledgerType: "ACTUAL" } }),
    exitReviewPositions: await db.position.count({ where: { status: "EXIT_REVIEW" } }),
    ingestedImages: await db.ingestedImage.count(),
    pendingVlmImages: await db.ingestedImage.count({ where: { ratificationStatus: "PENDING" } }),
    ratifiedVlmImages: await db.ingestedImage.count({ where: { ratificationStatus: "RATIFIED" } }),
    vlmMismatches: await db.ingestedImage.count({ where: { discrepancyFlag: "DUAL_ROUTE_MISMATCH" } }),
  };

  // ── Audit log (recent) ──
  const auditLog = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  // ── Falsifiers (for the falsifier-fire UI) ──
  const falsifiers = await db.falsifier.findMany({
    where: { status: { in: ["ARMED", "PARTIAL", "FIRED"] } },
    orderBy: [{ status: "asc" }, { armedAt: "desc" }],
    take: 30,
  });

  // ── Watermarks (for the Ingestion Console — shows adapter progress) ──
  const watermarks = await db.watermark.findMany({ orderBy: { adapterType: "asc" } });

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
    falsifiers,
    watermarks,
    ingestedImages: await db.ingestedImage.findMany({
      include: { parentRaw: true },
      orderBy: { viralityCount: "desc" },
      take: 20,
    }),
  });
}
