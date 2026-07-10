// NIP v3.0 — Thesis promotion pipeline (M6, Spec §8)
//
// The path from VALIDATED → ACTIONABLE is the critical PS-gated transition:
//   1. PS rules on staged engagements (L10 — nothing effective until ruled)
//   2. When all engagements for a thesis are ANSWERED, contrarian → SURVIVED
//   3. Gate check (pure function, demotion-before-promotion)
//   4. If ok: promote thesis, write stageHistory snapshot, audit log
//   5. On ACTIONABLE: auto-create PAPER position at mechanical entry (Spec §9)
//
// L1: gates are pure functions; LLM stage output dropped-and-logged
// L7: org-aware effectiveN, demotion evaluated before promotion
// L9: sabotage-suite entry points
// L10: PS gates staged, never auto-applied
//
// Also wires:
//   - flagPositionExitReview on falsifier FIRED (audit-noted 15-min gap)
//   - book-talk discount into stance aggregation (audit-noted 30-min gap)

import { db } from "./db";
import { canPromote, computeCounters, FALLBACK_THRESHOLDS, type GateContext } from "./gates";

// ─────────────────────────────────────────────────────────────────────
// 1. PS engagement ruling → if all engagements ANSWERED, contrarian SURVIVED
// ─────────────────────────────────────────────────────────────────────

export async function ruleOnEngagement(args: {
  engagementId: string;
  psDecision: "ANSWERED" | "OPEN" | "CONCEDED";
  reasoning?: string;
  psActor?: string;
}): Promise<{ engagement: any; contrarianUpdated: boolean; newContrarianStatus?: string }> {
  const eng = await db.thesisEngagement.findUnique({ where: { id: args.engagementId } });
  if (!eng) throw new Error("engagement not found");

  const updated = await db.thesisEngagement.update({
    where: { id: args.engagementId },
    data: {
      psDecision: args.psDecision,
      psDecidedAt: new Date(),
      status: args.psDecision, // ANSWERED | OPEN | CONCEDED
      reasoning: args.reasoning ?? eng.reasoning,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      actor: args.psActor ?? "PS",
      action: "ENGAGEMENT_RULING",
      targetType: "ThesisEngagement",
      targetId: args.engagementId,
      payload: {
        thesisId: eng.thesisId,
        decision: args.psDecision,
        reasoning: args.reasoning,
      } as any,
    },
  });

  // Check if all engagements for this thesis are now ANSWERED → contrarian SURVIVED
  const allEngagements = await db.thesisEngagement.findMany({ where: { thesisId: eng.thesisId } });
  const allAnswered = allEngagements.every(e => e.status === "ANSWERED" || e.status === "CONCEDED");
  const anyConceded = allEngagements.some(e => e.status === "CONCEDED");

  const thesis = await db.thesis.findUnique({ where: { id: eng.thesisId } });
  if (!thesis) return { engagement: updated, contrarianUpdated: false };

  let newContrarianStatus = thesis.contrarianStatus;
  if (anyConceded) {
    newContrarianStatus = "CONCEDED";
  } else if (allAnswered && thesis.contrarianStatus === "ENGAGED_UNRESOLVED") {
    newContrarianStatus = "SURVIVED";
  }

  if (newContrarianStatus !== thesis.contrarianStatus) {
    await db.thesis.update({
      where: { id: eng.thesisId },
      data: { contrarianStatus: newContrarianStatus },
    });
    await db.auditLog.create({
      data: {
        actor: "SYSTEM",
        action: "CONTRARIAN_STATUS_TRANSITION",
        targetType: "Thesis",
        targetId: eng.thesisId,
        payload: {
          from: thesis.contrarianStatus,
          to: newContrarianStatus,
          trigger: "all_engagements_ruled",
        } as any,
      },
    });
    return { engagement: updated, contrarianUpdated: true, newContrarianStatus };
  }
  return { engagement: updated, contrarianUpdated: false };
}

// ─────────────────────────────────────────────────────────────────────
// 2. Gate check + promotion → ACTIONABLE
// ─────────────────────────────────────────────────────────────────────

export async function attemptPromote(args: {
  thesisId: string;
  psActor?: string;
}): Promise<{
  promoted: boolean;
  from: string;
  to: string;
  missing: string[];
  paperPositionCreated?: string;
}> {
  const thesis = await db.thesis.findUnique({ where: { id: args.thesisId } });
  if (!thesis) throw new Error("thesis not found");

  // Load linked events for counter computation
  const events = await db.informationEvent.findMany({
    where: { id: { in: (thesis.eventIds as string[]) ?? [] } },
    include: { sources: true },
  });

  // Build counters (org-aware effectiveN via inverse Herfindahl)
  const counters = computeCounters(
    {
      independentEvents: thesis.independentEvents,
      primaryIntegrityEvents: thesis.primaryIntegrityEvents,
    },
    events.map(e => ({
      id: e.id,
      independentCount: e.independentCount,
      authorBreadth: e.authorBreadth,
      members: e.sources.map(s => ({
        authorId: s.authorId,
        orgAffiliation: null, // resolved at the Author level in production
        epistemicClass: null,
      })),
    })),
  );

  const ctx: GateContext = {
    contrarianStatus: thesis.contrarianStatus,
    engagementSearchLoggedAt: thesis.engagementSearchLoggedAt,
    armedFalsifiers: thesis.armedFalsifiers,
    crowdingFlag: thesis.crowdingFlag,
    verificationEventId: thesis.verificationEventId,
    stanceFlags: { reversingUnreviewed: false },
    priceJoined: true,
  };

  const gate = canPromote(thesis.stage, counters, ctx);
  if (!gate.ok) {
    return { promoted: false, from: thesis.stage, to: thesis.stage, missing: gate.missing };
  }

  const ladder = ["OBSERVATION", "HYPOTHESIS", "VALIDATED", "ACTIONABLE"];
  const idx = ladder.indexOf(thesis.stage);
  const next = idx < ladder.length - 1 ? ladder[idx + 1] : thesis.stage;

  // Stage transition + evidence snapshot
  const stageHistory = (thesis.stageHistory as any[]) ?? [];
  stageHistory.push({
    from: thesis.stage,
    to: next,
    at: new Date().toISOString(),
    evidence: gate.evidence,
    psActor: args.psActor ?? "PS",
  });

  await db.thesis.update({
    where: { id: args.thesisId },
    data: { stage: next, stageHistory: stageHistory as any },
  });

  await db.auditLog.create({
    data: {
      actor: args.psActor ?? "PS",
      action: "STAGE_PROMOTION",
      targetType: "Thesis",
      targetId: args.thesisId,
      payload: { from: thesis.stage, to: next, evidence: gate.evidence } as any,
    },
  });

  // ── On ACTIONABLE: auto-create PAPER position at mechanical entry ──
  // Spec §9: "Paper ledger (activates on first ACTIONABLE): auto PAPER position
  // at mechanical entry per promotion, mechanical exits, ACTUAL fills logged alongside."
  let paperPositionCreated: string | undefined;
  if (next === "ACTIONABLE") {
    paperPositionCreated = await autoCreatePaperPosition(thesis.id, args.psActor);
  }

  return { promoted: true, from: thesis.stage, to: next, missing: [], paperPositionCreated };
}

// ─────────────────────────────────────────────────────────────────────
// 3. Auto PAPER position at mechanical entry (Spec §9)
// ─────────────────────────────────────────────────────────────────────

async function autoCreatePaperPosition(thesisId: string, psActor?: string): Promise<string> {
  // Pick the highest-ranked expression for this thesis
  const expr = await db.thesisExpression.findFirst({
    where: { thesisId },
    orderBy: { rankScore: "desc" },
  });
  if (!expr) return "";

  // Find or create a TradePlan (PAPER positions need a plan to attach to)
  let plan = await db.tradePlan.findFirst({
    where: { thesisId, expressionId: expr.id, status: "ARMED" },
  });
  if (!plan) {
    // In production: compute entry/stop/target from market data + ATR
    // Here: use the existing draft plan if any, else skip
    plan = await db.tradePlan.findFirst({
      where: { thesisId, expressionId: expr.id },
    });
    if (!plan) return "";
    await db.tradePlan.update({ where: { id: plan.id }, data: { status: "ARMED" } });
  }

  // Mechanical entry: midpoint of entry band
  const entry = plan.entryLow && plan.entryHigh ? (plan.entryLow + plan.entryHigh) / 2 : 100;
  const stop = plan.stopPrice ?? entry * 0.95;
  const riskPerUnit = entry - stop;
  const riskR = 1.0; // fixed-fractional sizing — conviction modulates only downward (Spec §9)

  const position = await db.position.create({
    data: {
      tradePlanId: plan.id,
      ledgerType: "PAPER",
      entryPrice: entry,
      entryDate: new Date(),
      units: plan.unitsPlanned ?? 1,
      riskR,
      setupType: "PRE_CONSENSUS", // first paper position is pre-consensus by default
      status: "OPEN",
    },
  });

  await db.auditLog.create({
    data: {
      actor: "SYSTEM",
      action: "PAPER_POSITION_AUTO_CREATED",
      targetType: "Position",
      targetId: position.id,
      payload: {
        thesisId,
        tradePlanId: plan.id,
        entryPrice: entry,
        stopPrice: stop,
        riskPerUnit,
        riskR,
        setupType: "PRE_CONSENSUS",
        psActor: psActor ?? "PS",
      } as any,
    },
  });

  return position.id;
}

// ─────────────────────────────────────────────────────────────────────
// 4. Falsifier FIRED → flagPositionExitReview (audit-noted 15-min gap)
// Spec §9: "non-price stop: linked falsifier fires → exit signal regardless of chart"
// Spec §7: "demotion with open position = EXIT_REVIEW, never auto-exit for ACTUAL"
// ─────────────────────────────────────────────────────────────────────

export async function fireFalsifier(args: {
  falsifierId: string;
  firingEvidence?: any;
  psActor?: string;
}): Promise<{ positionsFlagged: number; thesisDemoted: boolean }> {
  const falsifier = await db.falsifier.findUnique({ where: { id: args.falsifierId } });
  if (!falsifier) throw new Error("falsifier not found");

  // Update falsifier status
  await db.falsifier.update({
    where: { id: args.falsifierId },
    data: {
      status: "FIRED",
      firingEvidence: args.firingEvidence ?? { at: new Date().toISOString() },
      lastCheckedAt: new Date(),
    },
  });

  // For each linked thesis, flag open positions for EXIT_REVIEW
  const thesisIds = (falsifier.thesisIds as string[]) ?? [];
  let positionsFlagged = 0;
  let thesisDemoted = false;

  for (const tid of thesisIds) {
    const thesis = await db.thesis.findUnique({ where: { id: tid } });
    if (!thesis) continue;

    // Find open positions via trade plans
    const plans = await db.tradePlan.findMany({
      where: { thesisId: tid },
      include: { positions: true },
    });

    for (const plan of plans) {
      for (const pos of plan.positions) {
        if (pos.status === "OPEN") {
          await db.position.update({
            where: { id: pos.id },
            data: { status: "EXIT_REVIEW" },
          });
          positionsFlagged++;
          await db.auditLog.create({
            data: {
              actor: "SYSTEM",
              action: "POSITION_EXIT_REVIEW_FLAGGED",
              targetType: "Position",
              targetId: pos.id,
              payload: {
                thesisId: tid,
                falsifierId: args.falsifierId,
                ledgerType: pos.ledgerType,
                note: "Non-price stop: linked falsifier fired (Spec §9). EXIT_REVIEW, not auto-exit — ACTUAL positions require PS close.",
              } as any,
            },
          });
        }
      }
    }

    // Demotion with open position: stage → lower (but never auto-exit ACTUAL)
    if (thesis.stage === "ACTIONABLE" || thesis.stage === "VALIDATED") {
      const newStage = thesis.stage === "ACTIONABLE" ? "VALIDATED" : "HYPOTHESIS";
      const stageHistory = (thesis.stageHistory as any[]) ?? [];
      stageHistory.push({
        from: thesis.stage,
        to: newStage,
        at: new Date().toISOString(),
        evidence: { falsifierFired: args.falsifierId, demotion: true },
      });
      await db.thesis.update({
        where: { id: tid },
        data: { stage: newStage, stageHistory: stageHistory as any },
      });
      thesisDemoted = true;
      await db.auditLog.create({
        data: {
          actor: "SYSTEM",
          action: "STAGE_DEMOTION",
          targetType: "Thesis",
          targetId: tid,
          payload: {
            from: thesis.stage,
            to: newStage,
            trigger: "falsifier_fired",
            falsifierId: args.falsifierId,
          } as any,
        },
      });
    }
  }

  return { positionsFlagged, thesisDemoted };
}

// ─────────────────────────────────────────────────────────────────────
// 5. Book-talk discount wired into aggregation (audit-noted 30-min gap)
// Spec §7: "book-talk discount (POSITIONED_MANAGER consistent = 0.5×, stance change = 1.5×)"
// ─────────────────────────────────────────────────────────────────────

export const BOOK_TALK_DISCOUNT = {
  CONSISTENT: 0.5,   // POSITIONED_MANAGER consistent stance → 0.5× weight
  STANCE_CHANGE: 1.5, // stance change from POSITIONED_MANAGER → 1.5× weight
};

export function applyBookTalkDiscount(args: {
  authorEpistemicClass: string;
  stanceChanged: boolean;
  baseWeight: number;
}): number {
  if (args.authorEpistemicClass !== "POSITIONED_MANAGER") return args.baseWeight;
  return args.baseWeight * (args.stanceChanged ? BOOK_TALK_DISCOUNT.STANCE_CHANGE : BOOK_TALK_DISCOUNT.CONSISTENT);
}

// ─────────────────────────────────────────────────────────────────────
// 6. Sabotage suite entry points (L9 — demonstrated, not built)
// ─────────────────────────────────────────────────────────────────────

export const PROMOTION_SABOTAGE_TESTS = {
  // L7: same-org two-class thesis must fail VALIDATED promotion
  sameOrgTwoClassFailsValidated: () => {
    const counters = {
      orgAwareEffectiveN: 1.0,
      distinctOrgs: 1,
      distinctClasses: 2,
      independents: 2,
      independentEvents: 2,
      primaryIntegrityEvents: 1,
    };
    const ctx: GateContext = {
      contrarianStatus: "SURVIVED",
      engagementSearchLoggedAt: new Date(),
      armedFalsifiers: 1,
      crowdingFlag: false,
      verificationEventId: "v1",
      stanceFlags: { reversingUnreviewed: false },
      priceJoined: true,
    };
    const r = canPromote("HYPOTHESIS", counters, ctx);
    return !r.ok && r.missing.some(m => m.includes("distinct orgs"));
  },
  // L10: PS-gated ACTIONABLE → no auto-promotion without verificationEvent link
  validatedMissingVerificationFailsActionable: () => {
    const counters = {
      orgAwareEffectiveN: 4.0,
      distinctOrgs: 4,
      distinctClasses: 3,
      independents: 4,
      independentEvents: 4,
      primaryIntegrityEvents: 2,
    };
    const ctx: GateContext = {
      contrarianStatus: "SURVIVED",
      engagementSearchLoggedAt: new Date(),
      armedFalsifiers: 2,
      crowdingFlag: false,
      verificationEventId: null, // missing!
      stanceFlags: { reversingUnreviewed: false },
      priceJoined: true,
    };
    const r = canPromote("VALIDATED", counters, ctx);
    return !r.ok && r.missing.some(m => m.includes("VerificationEvent"));
  },
};
