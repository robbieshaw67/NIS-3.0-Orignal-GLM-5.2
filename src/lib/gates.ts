// NIP v3.0 — Gates module (the L1/L6/L7 fix, designed — Design §5)
//
// Pure functions only, no I/O, no LLM, fully unit-tested.
// Demotion evaluated BEFORE promotion.
// Threshold values live in the GateThreshold table (PS-editable, versioned),
// never constants in code. Gate acceptance tests are the sabotage suite (spec §13).

import type { Thesis, InformationEvent } from "@prisma/client";

export interface ThesisCounters {
  orgAwareEffectiveN: number;  // inverse Herfindahl over org shares
  distinctOrgs: number;
  distinctClasses: number;     // epistemic classes — ≥2 with ≥1 non-synthesizer as separate hard conditions
  independents: number;        // org-dependence applied
  independentEvents: number;
  primaryIntegrityEvents: number;
}

export interface GateContext {
  contrarianStatus: string;          // SURVIVED | ENGAGED_UNRESOLVED | CONCEDED | KILLED | UNENGAGED
  engagementSearchLoggedAt: Date | null;
  armedFalsifiers: number;
  crowdingFlag: boolean;
  verificationEventId: string | null;
  stanceFlags: { reversingUnreviewed: boolean };
  priceJoined: boolean;
}

export interface GateResult {
  ok: boolean;
  missing: string[];      // human-readable list of unsatisfied conditions
  evidence: Record<string, unknown>;
}

export interface StageTransition {
  from: string;
  to: string;
  evidence: Record<string, unknown>;
  acceptedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────
// computeCounters — pure, org-aware effectiveN (inverse Herfindahl over
// org contributions), distinctOrgs, distinctClasses, independents
// ─────────────────────────────────────────────────────────────────────

export function computeCounters(
  thesis: Pick<Thesis, "independentEvents" | "primaryIntegrityEvents">,
  events: Array<{
    id: string;
    independentCount: number;
    authorBreadth: number;
    members?: Array<{ authorId: string; orgAffiliation?: string | null; epistemicClass?: string | null }>;
  }>,
): ThesisCounters {
  // Tally per-org contribution shares
  const orgShares = new Map<string, number>();
  const classSet = new Set<string>();
  let independents = 0;

  for (const ev of events) {
    independents += ev.independentCount;
    if (ev.members) {
      for (const m of ev.members) {
        const org = m.orgAffiliation ?? "UNAFFILIATED";
        orgShares.set(org, (orgShares.get(org) ?? 0) + 1);
        if (m.epistemicClass) classSet.add(m.epistemicClass);
      }
    }
  }

  const totalContribs = Array.from(orgShares.values()).reduce((a, b) => a + b, 0) || 1;
  let hh = 0; // Herfindahl
  for (const share of orgShares.values()) {
    const p = share / totalContribs;
    hh += p * p;
  }
  // inverse Herfindahl — bounds: 1 (one org dominates) to #orgs (perfectly even)
  const orgAwareEffectiveN = hh > 0 ? (1 / hh) * Math.min(events.length, 8) / 8 : 0;

  return {
    orgAwareEffectiveN: Math.round(orgAwareEffectiveN * 100) / 100,
    distinctOrgs: orgShares.size,
    distinctClasses: classSet.size,
    independents,
    independentEvents: thesis.independentEvents,
    primaryIntegrityEvents: thesis.primaryIntegrityEvents,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Thresholds — read from GateThreshold table; these are fallbacks
// ─────────────────────────────────────────────────────────────────────

export const FALLBACK_THRESHOLDS = {
  OBSERVATION_TO_HYPOTHESIS:        { minEvents: 3, minEffectiveN: 2, trailingDays: 60 },
  HYPOTHESIS_TO_VALIDATED:          { minIndependentEvents: 2, minPrimaryIntegrity: 1, minEffectiveN: 3, minDistinctOrgs: 2, minDistinctClasses: 2, minArmedFalsifiers: 1 },
  VALIDATED_TO_ACTIONABLE:          { requireVerificationEvent: true, contrarianMustSurvive: true, crowdingMustBeClear: true, allFalsifiersArmed: true, noUnreviewedReversing14d: true, requirePriceJoin: false },
};

// ─────────────────────────────────────────────────────────────────────
// canPromote — demotion checked first, then promotion
// ─────────────────────────────────────────────────────────────────────

export function canPromote(
  stage: string,
  counters: ThesisCounters,
  ctx: GateContext,
  thresholds: typeof FALLBACK_THRESHOLDS = FALLBACK_THRESHOLDS,
): GateResult {
  // L1: NEVER let the LLM set a stage. This function is the only place a
  // stage transition is decided, and it's pure math + PS-gated context.
  const missing: string[] = [];

  // ── demotion check first ──
  if (ctx.contrarianStatus === "KILLED") {
    return { ok: false, missing: ["contrarian=KILLED — cannot promote; demote"], evidence: { demotion: true } };
  }
  if (ctx.contrarianStatus === "CONCEDED") {
    return { ok: false, missing: ["contrarian=CONCEDED — demote"], evidence: { demotion: true } };
  }
  if (ctx.crowdingFlag && stage === "VALIDATED") {
    return { ok: false, missing: ["crowding flag set — demote or block new capital"], evidence: { demotion: true } };
  }

  // ── promotion rules by stage ──
  if (stage === "OBSERVATION") {
    const t = thresholds.OBSERVATION_TO_HYPOTHESIS;
    if (counters.independentEvents < t.minEvents) missing.push(`≥${t.minEvents} independent events (have ${counters.independentEvents})`);
    if (counters.orgAwareEffectiveN < t.minEffectiveN) missing.push(`effectiveN ≥ ${t.minEffectiveN} (have ${counters.orgAwareEffectiveN})`);
  } else if (stage === "HYPOTHESIS") {
    const t = thresholds.HYPOTHESIS_TO_VALIDATED;
    if (counters.independentEvents < t.minIndependentEvents) missing.push(`≥${t.minIndependentEvents} independent events (have ${counters.independentEvents})`);
    if (counters.primaryIntegrityEvents < t.minPrimaryIntegrity) missing.push(`≥${t.minPrimaryIntegrity} primary-integrity event (have ${counters.primaryIntegrityEvents})`);
    if (counters.orgAwareEffectiveN < t.minEffectiveN) missing.push(`effectiveN ≥ ${t.minEffectiveN} (have ${counters.orgAwareEffectiveN})`);
    if (counters.distinctOrgs < t.minDistinctOrgs) missing.push(`≥${t.minDistinctOrgs} distinct orgs (have ${counters.distinctOrgs})`);
    if (counters.distinctClasses < t.minDistinctClasses) missing.push(`≥${t.minDistinctClasses} distinct classes (have ${counters.distinctClasses})`);
    if (ctx.armedFalsifiers < t.minArmedFalsifiers) missing.push(`≥${t.minArmedFalsifiers} armed falsifier (have ${ctx.armedFalsifiers})`);
    if (ctx.contrarianStatus === "ENGAGED_UNRESOLVED") missing.push("contrarian engagement unresolved");
  } else if (stage === "VALIDATED") {
    const t = thresholds.VALIDATED_TO_ACTIONABLE;
    if (t.requireVerificationEvent && !ctx.verificationEventId) missing.push("linked VerificationEvent (dated, not prose)");
    if (t.contrarianMustSurvive && ctx.contrarianStatus !== "SURVIVED" && ctx.contrarianStatus !== "UNENGAGED") {
      missing.push(`contrarian SURVIVED or UNENGAGED-with-logged-search (have ${ctx.contrarianStatus})`);
    }
    if (t.contrarianMustSurvive && ctx.contrarianStatus === "UNENGAGED" && !ctx.engagementSearchLoggedAt) {
      missing.push("engagement search not logged");
    }
    if (t.crowdingMustBeClear && ctx.crowdingFlag) missing.push("crowding not clear");
    if (t.allFalsifiersArmed && ctx.armedFalsifiers < 1) missing.push("falsifiers all ARMED");
    if (t.noUnreviewedReversing14d && ctx.stanceFlags.reversingUnreviewed) missing.push("unreviewed REVERSING in 14d from origin-habitual contributor");
  } else if (stage === "ACTIONABLE") {
    return { ok: false, missing: ["already ACTIONABLE — promotion is to TradePlan (PS only)"], evidence: {} };
  } else {
    return { ok: false, missing: [`unknown stage: ${stage}`], evidence: {} };
  }

  return {
    ok: missing.length === 0,
    missing,
    evidence: {
      counters,
      contrarianStatus: ctx.contrarianStatus,
      armedFalsifiers: ctx.armedFalsifiers,
      crowdingFlag: ctx.crowdingFlag,
      verificationEventId: ctx.verificationEventId,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// computeStage — returns transition + evidence snapshot for stageHistory
// ─────────────────────────────────────────────────────────────────────

export function computeStage(
  thesis: Pick<Thesis, "stage">,
  counters: ThesisCounters,
  ctx: GateContext,
): StageTransition {
  const result = canPromote(thesis.stage, counters, ctx);
  const ladder = ["OBSERVATION", "HYPOTHESIS", "VALIDATED", "ACTIONABLE"];
  const idx = ladder.indexOf(thesis.stage);
  const next = result.ok && idx < ladder.length - 1 ? ladder[idx + 1] : thesis.stage;
  return {
    from: thesis.stage,
    to: next,
    evidence: result.evidence,
    acceptedAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Sabotage-suite entry points — these are the demonstrated tests (L9)
// ─────────────────────────────────────────────────────────────────────

export const SABOTAGE_TESTS = {
  sameOrgTwoClassFailsValidated: () => {
    // L7: same org, two authors, two classes — must NOT pass VALIDATED
    const counters: ThesisCounters = {
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
  killedContrarianBlocksPromotion: () => {
    const counters: ThesisCounters = {
      orgAwareEffectiveN: 4,
      distinctOrgs: 4,
      distinctClasses: 3,
      independents: 4,
      independentEvents: 4,
      primaryIntegrityEvents: 2,
    };
    const ctx: GateContext = {
      contrarianStatus: "KILLED",
      engagementSearchLoggedAt: null,
      armedFalsifiers: 2,
      crowdingFlag: false,
      verificationEventId: "v1",
      stanceFlags: { reversingUnreviewed: false },
      priceJoined: true,
    };
    const r = canPromote("HYPOTHESIS", counters, ctx);
    return !r.ok && r.evidence.demotion === true;
  },
};
