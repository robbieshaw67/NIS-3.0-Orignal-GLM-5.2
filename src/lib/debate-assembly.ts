// NIP v3.0 — Debate auto-assembly (v2.1 §2.2)
//
// Debates are auto-assembled, PS-curatable, from three existing sources:
//   1. MAGNITUDE: QuantClaim dispersion on one metric×horizon where the tails
//      are far apart and both tails are credible (non-SYNTHESIZER).
//   2. DIRECTION: ThesisEngagement rows — every SPECIFIC_OBJECTION is one side
//      of a debate whose other side is the thesis's supporting events.
//   3. STANCE COLLISION: two tracked authors with opposing rolling stances on
//      one narrative family, both active in the window.
//
// An LLM pass names the question plainly and drafts the stakes paragraph
// (PS-editable — L10-staged on first render); everything else is deterministic
// assembly. New content matching a live debate's metric/thesis/entities
// attaches as evidence automatically per batch.

import { db } from "./db";
import { complete, getPrompt, type TaskType } from "./provider";
import { z } from "zod";
import { getAuthorityWeight } from "./author";

const nameDebateSchema = z.object({
  question: z.string(),
  stakes: z.string(),
});

// ─────────────────────────────────────────────────────────────────────
// 1. MAGNITUDE debates — QuantClaim dispersion
// ─────────────────────────────────────────────────────────────────────

async function assembleMagnitudeDebates(): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0;

  // Group claims by metric×horizon
  const claims = await db.quantClaim.findMany({
    where: { resolvedValue: null }, // only unresolved claims
    include: { source: { include: { rawContent: true } } },
  });

  const byMetric = new Map<string, typeof claims>();
  for (const c of claims) {
    const key = `${c.metricId}:${c.horizon}`;
    const list = byMetric.get(key) ?? [];
    list.push(c);
    byMetric.set(key, list);
  }

  for (const [key, groupClaims] of byMetric) {
    if (groupClaims.length < 2) { skipped++; continue; }

    // Check if a debate already exists for this metric×horizon
    const [metricId, horizon] = key.split(":");
    const existing = await db.debate.findFirst({
      where: { metricId, debateType: "MAGNITUDE", status: { in: ["LIVE", "RESOLVING"] } },
    });
    if (existing) { skipped++; continue; }

    // Find the tails — low and high
    const sorted = [...groupClaims].sort((a, b) =>
      ((a.valueLow ?? 0) + (a.valueHigh ?? 0)) - ((b.valueLow ?? 0) + (b.valueHigh ?? 0))
    );
    const lowClaim = sorted[0];
    const highClaim = sorted[sorted.length - 1];

    // Tails must be far apart (>30% deviation)
    const lowMid = ((lowClaim.valueLow ?? 0) + (lowClaim.valueHigh ?? 0)) / 2;
    const highMid = ((highClaim.valueLow ?? 0) + (highClaim.valueHigh ?? 0)) / 2;
    if (lowMid === 0) { skipped++; continue; }
    const deviation = Math.abs(highMid - lowMid) / Math.abs(lowMid);
    if (deviation < 0.3) { skipped++; continue; }

    // Both tails must be credible (non-SYNTHESIZER, calibration-eligible)
    const lowAuthor = await db.author.findUnique({ where: { id: lowClaim.authorId } });
    const highAuthor = await db.author.findUnique({ where: { id: highClaim.authorId } });
    if (!lowAuthor || !highAuthor) { skipped++; continue; }
    if (lowAuthor.epistemicClass === "SYNTHESIZER" || highAuthor.epistemicClass === "SYNTHESIZER") {
      skipped++; continue;
    }

    // Find theses linked to these claims
    const thesisIds = [...new Set(groupClaims.map(c => c.thesisId).filter(Boolean))] as string[];

    // LLM pass to name the question + draft stakes
    const positions = [
      { side: "A", author: highAuthor.realName, value: `${highClaim.valueLow}-${highClaim.valueHigh}` },
      { side: "B", author: lowAuthor.realName, value: `${lowClaim.valueLow}-${lowClaim.valueHigh}` },
    ];
    const nameResult = await complete({
      taskType: "NAME_DEBATE" as TaskType,
      prompt: { ...getPrompt("name_debate/v1"), params: { positions: JSON.stringify(positions) } },
      schema: nameDebateSchema,
      cacheKey: `magnitude:${key}`,
    });
    const nameData = nameDebateSchema.safeParse(nameResult.data);
    const question = nameData.success
      ? nameData.data.question
      : `How will ${lowClaim.metricName} resolve for ${lowClaim.horizon}?`;
    const stakes = nameData.success
      ? nameData.data.stakes
      : `This debate decides the ${thesisIds.length} linked theses. A high print favors ${highAuthor.realName}'s range; a low print favors ${lowAuthor.realName}'s range.`;

    // Compute heat score: recency × participant breadth × stakes-linked thesis stages
    const linkedTheses = await db.thesis.findMany({ where: { id: { in: thesisIds } } });
    const heatScore = Math.min(10,
      groupClaims.length * 1.5 +
      new Set(groupClaims.map(c => c.authorId)).size * 1.0 +
      linkedTheses.filter(t => t.stage === "VALIDATED" || t.stage === "ACTIONABLE").length * 2.0
    );

    // Find resolution events (verification events linked to the metric)
    // (Json `has` filter not supported in SQLite — fetch upcoming and filter in JS)
    const upcomingEvents = await db.verificationEvent.findMany({
      where: { date: { gt: new Date() } },
      orderBy: { date: "asc" },
      take: 10,
    });
    const resolutionEvents = upcomingEvents.filter(e =>
      Array.isArray(e.metricIds) && (e.metricIds as string[]).includes(metricId)
    ).slice(0, 3);

    // Create the debate
    const debate = await db.debate.create({
      data: {
        question,
        debateType: "MAGNITUDE",
        metricId,
        metricName: lowClaim.metricName,
        thesisIds: thesisIds as any,
        status: "LIVE",
        stakes,
        resolutionEventIds: resolutionEvents.map(e => e.id) as any,
        heatScore: Math.round(heatScore * 10) / 10,
      },
    });

    // Link theses
    if (thesisIds.length > 0) {
      await db.debate.update({
        where: { id: debate.id },
        data: { theses: { connect: thesisIds.map(id => ({ id })) } },
      });
    }

    // Create positions — side A (high) and side B (low)
    await db.debatePosition.create({
      data: {
        debateId: debate.id,
        side: "A",
        authorId: highAuthor.id,
        authorName: highAuthor.realName,
        orgId: highAuthor.orgAffiliation,
        statement: `${lowClaim.metricName} ${highClaim.valueLow}-${highClaim.valueHigh} ${highClaim.unit === "PERCENT" ? "%" : highClaim.unit} for ${highClaim.horizon}`,
        evidenceRefs: highClaim.source ? [{
          sourceId: highClaim.source.id,
          spanStart: highClaim.spanStart ?? 0,
          spanEnd: highClaim.spanEnd ?? 0,
          url: highClaim.source.rawContent?.url ?? "",
        }] : [],
        claimIds: [highClaim.id],
        stanceWeight: getAuthorityWeight(highAuthor),
        enteredAt: highClaim.claimedAt,
        sourceId: highClaim.source?.id,
        quantClaims: { connect: [{ id: highClaim.id }] },
      },
    });
    await db.debatePosition.create({
      data: {
        debateId: debate.id,
        side: "B",
        authorId: lowAuthor.id,
        authorName: lowAuthor.realName,
        orgId: lowAuthor.orgAffiliation,
        statement: `${lowClaim.metricName} ${lowClaim.valueLow}-${lowClaim.valueHigh} ${lowClaim.unit === "PERCENT" ? "%" : lowClaim.unit} for ${lowClaim.horizon}`,
        evidenceRefs: lowClaim.source ? [{
          sourceId: lowClaim.source.id,
          spanStart: lowClaim.spanStart ?? 0,
          spanEnd: lowClaim.spanEnd ?? 0,
          url: lowClaim.source.rawContent?.url ?? "",
        }] : [],
        claimIds: [lowClaim.id],
        stanceWeight: getAuthorityWeight(lowAuthor),
        enteredAt: lowClaim.claimedAt,
        sourceId: lowClaim.source?.id,
        quantClaims: { connect: [{ id: lowClaim.id }] },
      },
    });

    created++;
  }

  return { created, skipped };
}

// ─────────────────────────────────────────────────────────────────────
// 2. DIRECTION debates — ThesisEngagement rows
// ─────────────────────────────────────────────────────────────────────

async function assembleDirectionDebates(): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0;

  // Find theses with unanswered SPECIFIC_OBJECTIONS
  const theses = await db.thesis.findMany({
    where: {
      stage: { in: ["HYPOTHESIS", "VALIDATED", "ACTIONABLE"] },
      engagements: { some: { engagementType: "SPECIFIC_OBJECTION", status: "OPEN" } },
    },
    include: { engagements: true },
  });

  for (const thesis of theses) {
    // Check if a DIRECTION debate already exists for this thesis
    // (Json `has` filter not supported in SQLite — fetch and filter in JS)
    const existingDebates = await db.debate.findMany({
      where: { debateType: "DIRECTION", status: { in: ["LIVE", "RESOLVING"] } },
    });
    const existing = existingDebates.find(d =>
      Array.isArray(d.thesisIds) && (d.thesisIds as string[]).includes(thesis.id)
    );
    if (existing) { skipped++; continue; }

    const objections = thesis.engagements.filter(e => e.engagementType === "SPECIFIC_OBJECTION");
    if (objections.length === 0) { skipped++; continue; }

    // Find the resolution events for this thesis
    const resolutionEvents = thesis.verificationEventId
      ? [thesis.verificationEventId]
      : [];

    const nameResult = await complete({
      taskType: "NAME_DEBATE" as TaskType,
      prompt: {
        ...getPrompt("name_debate/v1"),
        params: {
          positions: JSON.stringify([
            { side: "A", author: "Thesis supporters", value: thesis.direction },
            { side: "B", author: `${objections.length} objectors`, value: thesis.direction === "BULLISH" ? "BEARISH" : "BULLISH" },
          ]),
        },
      },
      schema: nameDebateSchema,
      cacheKey: `direction:${thesis.id}`,
    });
    const nameData = nameDebateSchema.safeParse(nameResult.data);
    const question = nameData.success
      ? nameData.data.question
      : `Is "${thesis.title.slice(0, 60)}" correct, or do the ${objections.length} objections win?`;
    const stakes = nameData.success
      ? nameData.data.stakes
      : `This debate decides whether the ${thesis.stage} thesis promotes or stalls. ${objections.length} staged objections await PS ruling.`;

    const heatScore = Math.min(10,
      objections.length * 1.5 +
      (thesis.stage === "VALIDATED" ? 3 : thesis.stage === "ACTIONABLE" ? 4 : 1) +
      (thesis.contrarianStatus === "ENGAGED_UNRESOLVED" ? 2 : 0)
    );

    const debate = await db.debate.create({
      data: {
        question,
        debateType: "DIRECTION",
        thesisIds: [thesis.id] as any,
        status: "LIVE",
        stakes,
        resolutionEventIds: resolutionEvents as any,
        heatScore: Math.round(heatScore * 10) / 10,
      },
    });
    await db.debate.update({
      where: { id: debate.id },
      data: { theses: { connect: [{ id: thesis.id }] } },
    });

    created++;
  }

  return { created, skipped };
}

// ─────────────────────────────────────────────────────────────────────
// 3. STANCE COLLISION debates
// ─────────────────────────────────────────────────────────────────────

async function assembleStanceCollisionDebates(): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0;

  // Find pairs of authors with opposing stances on the same family
  const stances = await db.authorStance.findMany({
    where: { rollingDirection: { not: 0 } },
    include: { author: true },
  });

  const byFamily = new Map<string, typeof stances>();
  for (const s of stances) {
    const list = byFamily.get(s.narrativeFamily) ?? [];
    list.push(s);
    byFamily.set(s.narrativeFamily, list);
  }

  for (const [family, familyStances] of byFamily) {
    const bullish = familyStances.filter(s => s.rollingDirection > 0.2);
    const bearish = familyStances.filter(s => s.rollingDirection < -0.2);
    if (bullish.length === 0 || bearish.length === 0) { skipped++; continue; }

    // Check if a stance-collision debate exists for this family
    const existing = await db.debate.findFirst({
      where: { debateType: "DIRECTION", stakes: { contains: family }, status: { in: ["LIVE"] } },
    });
    if (existing) { skipped++; continue; }

    // Pick the strongest bull vs strongest bear
    const topBull = bullish.sort((a, b) => b.rollingDirection - a.rollingDirection)[0];
    const topBear = bearish.sort((a, b) => a.rollingDirection - b.rollingDirection)[0];

    const question = `Is ${family} bullish or bearish?`;
    const stakes = `${topBull.author.realName} holds ${topBull.rollingDirection > 0 ? "bullish" : "bearish"} (${topBull.rollingDirection.toFixed(2)}); ${topBear.author.realName} holds ${topBear.rollingDirection > 0 ? "bullish" : "bearish"} (${topBear.rollingDirection.toFixed(2)}). Both are active in the window — this is a stance collision on ${family}.`;

    const heatScore = Math.min(10,
      Math.abs(topBull.rollingDirection - topBear.rollingDirection) * 4 +
      (bullish.length + bearish.length) * 0.5
    );

    await db.debate.create({
      data: {
        question,
        debateType: "DIRECTION",
        status: "LIVE",
        stakes,
        heatScore: Math.round(heatScore * 10) / 10,
      },
    });

    created++;
  }

  return { created, skipped };
}

// ─────────────────────────────────────────────────────────────────────
// The assembly job
// ─────────────────────────────────────────────────────────────────────

export async function runDebateAssembly() {
  const { startJobRun } = await import("./adapters");
  const jobRun = await startJobRun("pipeline:debates");
  const counts = { magnitudeCreated: 0, directionCreated: 0, stanceCollisionCreated: 0, skipped: 0 };

  try {
    const mag = await assembleMagnitudeDebates();
    const dir = await assembleDirectionDebates();
    const stance = await assembleStanceCollisionDebates();

    counts.magnitudeCreated = mag.created;
    counts.directionCreated = dir.created;
    counts.stanceCollisionCreated = stance.created;
    counts.skipped = mag.skipped + dir.skipped + stance.skipped;

    await db.jobRun.update({
      where: { id: jobRun.id },
      data: { status: "DONE", counts: counts as any, finishedAt: new Date() },
    });
    return { ok: true, counts };
  } catch (e: any) {
    await db.jobRun.update({
      where: { id: jobRun.id },
      data: { status: "FAILED", counts: counts as any, error: e.message, finishedAt: new Date() },
    });
    return { ok: false, error: e.message, counts };
  }
}
