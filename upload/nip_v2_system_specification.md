# NIP v2 — System Specification
## Narrative Intelligence Platform, second system
### A modular, high-fidelity, alpha-seeking intelligence system — specified from everything v1 taught us

**Status:** Specification for a clean v2 build. Companion document: `nip_v2_design_document.md` (architecture, schemas, interfaces).
**Data continuity:** v2 is a rebuild of the *code*, not the *corpus*. The Neon database (634 sources, 65 theses, all audited provenance) migrates forward. Nothing hand-won is re-earned.

---

## 0. The Laws (non-negotiable invariants, each purchased by a v1 failure)

Every law below was paid for. Violating any of them is a defect regardless of tests passing.

| # | Law | The v1 failure that bought it |
|---|---|---|
| L1 | **Language from the model, numbers from math, judgment from PS.** No LLM output ever sets a price, a stage, a weight, a score, or a gate decision. Enforced in parsers and typed interfaces, never only in prompts. | MU priced at $1 by regex (+17,900% upside); LLM auto-review setting stop-losses; org-check living in counters instead of the gate |
| L2 | **Store raw before extracting. Extraction is a versioned, reprocessable transform.** | Phase-5 prompt upgrade orphaned 515 insights because raw pages were discarded |
| L3 | **Errors are never verdicts.** A failed fetch/parse/classify produces a RETRY/QUARANTINE status and a queue item — never a default value, never a classification, never silence. | fetch-failed → MEME_OTHER → 25 PS images auto-rejected; parseDateIso defaulting partials to Jan 1 (145 corrupted dates) |
| L4 | **Time is bounded, conservative, and leak-proof.** Every dated row carries `dateEarliest/dateLatest`; `dateLatest ≤ fetchedAt` clamped at insert; all analytics reads go through asOf helpers (grep-enforced); each computation takes the conservative bound for its direction. | Future-dated LLM hallucinations; 186-day phantom silences; the look-ahead risk E3 exists to kill |
| L5 | **Identity and organization are different axes.** Same person → merge (one mind, one stance, one effectiveN contributor). Same org, different people → affiliate (never independent of each other). Every merge carries a stated basis; every registry change files a map. | Citrini7 merged into zephyr_z9; semi_analysis merged into Daniel Niles; 3 contradictory merge narratives; China+Korea "independent channels" that were one shop |
| L6 | **Evidence attaches to specific claims, not entity neighborhoods.** An event supports a thesis only if it argues that thesis's specific claim. Entity overlap is candidate *blocking*, never assignment. Same rule for engagements and calendar links. | 15 fake VALIDATED theses with identical evidence blocks; 396 "objections" of which 5 were real |
| L7 | **One voice is one voice.** Echo collapses to events; org-aware independence; effectiveN (inverse Herfindahl over org contributions); stance aggregates per information event, not per insight. | Three authors holding 20/23 forecasts read as broad support; Dylan Patel's intra-interview diversity read as a REVERSING alert |
| L8 | **Whoever speaks is attributed; whoever carries is recorded.** Speaker ≠ carrier on every relayed claim (screenshots, "per TrendForce", RTs). | BofA-via-Eugene; every fintwit account screenshotting one exhibit reading as independent corroboration |
| L9 | **Demonstrated, not built.** Acceptance = the behavior watched happening, preferably via deliberate sabotage. "Enforced in code" is not a test result. | Six real bugs caught only by demonstration: promotion-before-demotion, ACTIONABLE inversion, org-gate hole, dual-route never firing, dedup silently dropping, quarantine untested |
| L10 | **PS gates are staged, never auto-applied; named deliverables are delivered, not absorbed.** Anything marked "PS confirms" waits. Reports with PS review steps arrive as documents, not status-table rows. | Epistemic tags applied without confirmation; stage report v2 absorbed into a status table |
| L11 | **Secrets never travel in reports.** Out-of-band delivery only; env-var injection via dashboard. | Passwords printed twice, once inside the remediation for printing them |
| L12 | **Counts reconcile.** Any moved number ships with opening → deltas (named) → closing. | 23-vs-21 forecasts, 6-vs-7 managers, 58/57/45/44/42/41 authors, 128-forever stances |
| L13 | **No silent infrastructure dependencies.** LLM/VLM access goes through a provider abstraction with publicly-routable providers; schedulers are explicit jobs, not `setInterval` in a process someone hopes stays alive; backups are off-box with a demonstrated restore. | Internal-only z-ai hostname dead on Vercel; scheduler dead code on serverless; the filesystem reset that wiped the backups directory itself |
| L14 | **The UI is organized around what PS decides, not what the database stores.** Every synthesized number expands in place to evidence; uncertainty renders as composition, never a bare badge; failures render in cause language. | Nine tabs mirroring nine tables; the "where do I see the hypotheses" question having no answer; two tabs telling contradictory stories about memory |

---

## 1. Purpose and thesis of the system

Extract true, early, tradeable beliefs from a curated ecosystem of analysts — instrumented rather than impressionistic. The edge lives in exactly four gaps, and every module must serve one:

1. **Timing gaps** — the lag between when the instrumented corpus knows (channel checks, upstream stance changes) and when it's priced.
2. **Magnitude gaps** — calibration-weighted corpus median vs. verified external consensus on a resolvable metric with a dated verification (the UNPRICED_DIVERGENCE class; live example: corpus 45% vs TrendForce 13–18% on Q3 DRAM QoQ).
3. **Crowd-state gaps** — measured crowding (echo share, synthesizer arrival, dispersion collapse) vs. felt crowding.
4. **Structure gaps** — expressing a consensus thesis one causal link down the chain where attention hasn't propagated.

Anything that doesn't sharpen one of these four is engineering, not alpha, and is deprioritized by rule.

## 2. Module map

Nine modules, strict dependency direction (each consumes only the ones above it):

```
M1 Acquisition → M2 Verification → M3 Extraction → M4 Knowledge
                                                      ↓
                              M5 Author Intelligence ←┘
                                                      ↓
                                        M6 Thesis Engine
                                                      ↓
                                        M7 Trade Layer
                                                      ↓
M9 Platform (cross-cutting)             M8 Operator Surface
```

---

## 3. M1 — Acquisition

**Adapters (all watermark-incremental, all store-raw-first per L2):**
- **X/Twitter** (scraper-first per the logged decision): per-handle fetch, watermark = last tweet ID; **thread reconstruction** (self-reply chain = one document); **QT/reply/RT edges captured** (`referencesUrl`, `referenceType`) — the pre-labeled echo graph.
- **RSS/Substack:** every feed-publishing handle in the registry; watermark = GUID/pubDate.
- **Transcripts:** yt-dlp captions, Whisper fallback; on publish detection.
- **External anchors** (`sourceClass: EXTERNAL_ANCHOR`, mandatory org + as-of date): TrendForce/DRAMeXchange releases, earnings transcripts, hyperscaler capex disclosures, PS-amended source list. Anchors on one metric from one org chain into **revision timelines** (revision velocity is itself a signal).
- **Images:** the Visual Intake surface (M8) feeding the VLM pipeline (M3); images attached to ingested posts flow in automatically; **image-hash dedup doubles as a chart-virality counter** (crowding datum).
- **Manual:** deep-examine URL and manual-add, preserved from v1.

**Discovery loop:** handles cited ≥K times by ingested content enter a candidate queue with samples; **nothing auto-admits** (L10). Approved handles get an epistemic-class proposal for PS confirmation.

**Scheduling:** explicit jobs (M9), never in-process timers (L13). Cadence config per adapter.

## 4. M2 — Verification (the eleven checkpoints, all deterministic)

1. **Pre-flight** per source: reachable / format unchanged / auth alive — three distinct probes, cause-labeled.
2. **Completeness:** fetched vs. source-declared counts; gaps alert (the checkpoint that kills the original "2–4 tweets where dozens existed" failure class).
3. **Sampled extraction verification:** N random insights per batch — verbatim quote string-matched in stored raw, entities present, dates consistent. Failure quarantines the batch from all gate computation (L3, demonstrated).
4. **Drift sentinels:** rolling per-source baselines (insights/post, claim density, tag mix); hard deviation flags parser-break-or-source-change before a thesis starves.
5. **Insert invariants:** raw-chain present; dates bounded and clamped (L4); author canonical; entities resolved-or-logged.
6. **Triage discard ledger:** two-pass economics with the discard side inspectable; weekly 10-sample PS review; discard-rate sentinel.
7. **Extraction confidence** (text): CLEAN / HEDGED / AMBIGUOUS per insight; LOW gets visual distinction + dispersion haircut downstream.
8. **Attribution:** speaker ≠ carrier on relayed content (L8); ambiguity → one-question queue item.
9. **Contradiction tripwire:** same-author whiplash or same-metric collision (>30% deviation vs HIGH-confidence claim) flags same-day — catches extraction errors and genuine reversals alike.
10. **Re-extraction console:** source-set × prompt-version → dry-run diff → PS approves → applies (L2 made operable; the 515 degraded sources are its first customer).
11. **Weekly scorecard:** coverage vs registry (active/silent/anomalously-silent), echo-capture trend, discard rate, verification pass rate, attribution flags, PS queue latency.

## 5. M3 — Extraction

- **Two-pass:** cheap triage (relevance 0–10) → strong-model 20-field deep extraction only above threshold. Content-hash cache: same hash + same `extractionVersion` never hits the LLM twice.
- **Versioned prompts** (L2): every insight stamped `extractionVersion`; upgrades re-run via checkpoint 10 with diffable output.
- **Registries:** canonical **entity** registry (alias tables, org links, unresolved-rate emitted per batch with names persisted) and canonical **metric** registry (for QuantClaims).
- **Structured outputs:** insights (direction, conviction, entities, insightType, confidence); **QuantClaims** (metric, valueLow/High — ranges are first-class, unit, horizon, speaker vs carrier); date bounds from `parseDateBounds` (no point-defaults, ever — L3/L4).
- **VLM pipeline (Visual Intelligence):** classify (CHART/TABLE/TEXT_SCREENSHOT/OTHER; classifier errors → PENDING_RETRY, never a class — L3) → **two independent VLM calls** (annotation route vs axis-read route) → date-by-date comparison → disagreement >15% fires DUAL_ROUTE_MISMATCH and stores the **range, never a point**; printed source = claim's org attribution (L8); unlabeled geometry → LOW-confidence ranges only, parser-enforced. **Every VLM claim routes through PS ratification** until graduation (50 ratifications ≥95% approval; revocable); both routes' values logged permanently; per-route error rate tracked.

## 6. M4 — Knowledge layer

- **InformationEvents:** deterministic candidate blocking (shared canonical entity + 7-day window + citation/URL/QT-edge overlap) → batched LLM sameness adjudication (cached) → member classes ORIGIN / INDEPENDENT / ECHO with **org-dependence rule**: same-org members can never both be INDEPENDENT (L5/L7). `independentCount` is what downstream consumes; failure default ECHO.
- **QuantClaims + dispersion:** per metric×horizon — IQR, calibration-weighted median (via the `getAuthorityWeight()` accessor, floor rule ≥5 resolved), tail authors (min/max with identity), dispersion trajectory snapshots (narrowing = consensus forming), realized-vs-claimed resolution on print.
- **Verification calendar:** dated events (earnings, pricing releases, capex disclosures) with thesis links stating what each can verify/falsify; falsifiers get appointment dates; passed events auto-resolve linked claims and trigger falsifier assessment; anchor ingestion proposes new entries (PS confirms).
- **Falsifiers:** compiled queries (canonical entities + keywords + direction), ARMED/PARTIAL/FIRED/EXPIRED lifecycle; cheap deterministic screen per batch (zero LLM on quiet batches) → LLM assessment only on hits → **deterministic consequences** (FIRED demotes, resolves forecasts, updates calibration counters). Same-real-world-trigger falsifiers grouped as **event families** for stress purposes.

## 7. M5 — Author intelligence

- **Identity & org:** canonical authors, merge maps with stated basis (L5), `orgAffiliation` seeded by PS knowledge.
- **Epistemic class** (PS-confirmed, single class, dominant mode of knowing): CHANNEL_PRIMARY / ACCESS_ANALYST / MODEL_BUILDER / POSITIONED_MANAGER / SYNTHESIZER (+ UNRESOLVED quarantine). Consumption: cross-class×cross-org triangulation gate; **book-talk discount** (POSITIONED_MANAGER consistent = 0.5×, stance change = 1.5×); SYNTHESIZER share feeds crowding and is excluded from read-first.
- **Stance system:** per author×family rolling stance (decay half-life ~45d), **aggregated per information event** (one interview = one observation — L7), day-precision-only silence detection, change classes CONSISTENT / MODERATING / REVERSING / NEW_ENGAGEMENT / SILENCE. Compound alert = stance change × upstream score × affected thesis stage — the system's single most actionable event class, verified against the trigger source before surfacing (the artifact lesson).
- **Calibration:** forecastsMade/Resolved/Correct, Brier when dense enough, **magnitude calibration** from realized-vs-claimed, lead-time-in-days once the price join exists; `authorityWeight` readable only through the floor-enforcing accessor.
- **Lead-lag / read-first:** origination rate weighted by corroborated-event independence; per family; SYNTHESIZER excluded.

## 8. M6 — Thesis engine

- **Theses** are specific falsifiable claims (not themes), mapped to events under the specificity rule (L6).
- **The ladder** (pure functions, demotion checked before promotion, LLM stage output dropped-and-logged — L1):
  - OBSERVATION → HYPOTHESIS: ≥3 events, effectiveN ≥ 2, trailing 60d.
  - HYPOTHESIS → VALIDATED: ≥2 independent events (org-aware), ≥1 primary-integrity, effectiveN ≥ 3, **≥2 distinct orgs AND ≥2 distinct classes (≥1 non-synthesizer) as separate hard conditions**, ≥1 armed falsifier, contrarian ≠ KILLED.
  - VALIDATED → ACTIONABLE: linked VerificationEvent (dated, not prose); contrarian = SURVIVED **or** UNENGAGED-with-logged-search (ENGAGED_UNRESOLVED always blocks); crowding clear; falsifiers all ARMED; no unreviewed REVERSING/MODERATING from an origin-habitual contributor in 14d; leading/lagging banner until the price join exists; not-priced verdict displayed.
  - ACTIONABLE → TradePlan: PS only. (PAPER positions are the sole automatic exception, explicitly labeled.)
- **Contrarian machinery:** structural engagement detection (direction × entity overlap × Cluster-C weighting, insightType as bonus only) → specificity filter → LLM ANSWERED/OPEN/CONCEDED assessment (the one LLM judgment in the module) → **PS override queue; nothing takes effect until PS rules** (L10). UNENGAGED renders as an amber risk flag, never a comfort. Optional adversarial self-play (synthetic red-team from corpus evidence, flagged SYNTHETIC, satisfies the search-log path, never the SURVIVED gate).
- **Crowding (interim proxy, replace-not-patch when dynamics land):** echo share + no-new-independent + synthesizer arrival + chart-virality input.
- **UNPRICED_DIVERGENCE:** corpus weighted median vs external anchors; informational until a quarter of paper-ledger evidence, then eligible as a gate.

## 9. M7 — Trade layer

- **Expressions:** candidates only from corpus causal-chain evidence; thesisBeta (LLM-proposed with quoted evidence, PS-reviewable), crowding, PS-maintained liquidity config; rank = pure function; **PS picks** from the ranked table.
- **Stage gates:** HYPOTHESIS = watchlist only; VALIDATED = starter ≤0.5R defined-risk; ACTIONABLE = core ≤1.0R; crowded = no new capital + INVERSE legitimized; demotion with open position = EXIT_REVIEW, never auto-exit for ACTUAL.
- **TradePlan (fully deterministic):** entry = price ± 0.5×ATR band; stop = max(2×ATR technical, corpus-stated invalidation); **non-price stop**: linked falsifier fires → exit signal regardless of chart; targets from QuantClaim magnitudes (flagged) else mechanical R-multiples; `priceSource ∈ {market-data, manual}` — no third state, ever (L1); constructionLog makes every plan reproducible.
- **Risk:** fixed-fractional sizing (riskPerTradePct × book, conviction modulates only downward), **narrative-family caps** (MU + Hynix proxies + equipment share one budget; breach rejected with the arithmetic shown), stress table = deterministic traversal of falsifier→thesis→plan→position with event-family grouping.
- **Paper ledger (activates on first ACTIONABLE):** auto PAPER position at mechanical entry per promotion, mechanical exits, ACTUAL fills logged alongside; results cut by stage-at-entry, family, and **setup type** (pre-consensus / stance-change / crowding-fade / second-order-lag / divergence) — the forward evidence engine and the honesty check on every gate above it.

## 10. M8 — Operator surface (six surfaces, not nine tabs — L14)

1. **Delta Briefing (landing):** Health Strip (per-adapter, keyed off job execution records, amber-on-silence) · Intake Digest (corpus-language deltas, every line evidence-linked, fidelity sparklines, weekly scorecard) · **Needs-You Queue** (one inbox: rulings, VLM ratifications, candidates, attribution questions, tripwires, quarantines, alerts — each resolvable in-line; empty queue + green strip = "nothing needs you today," rendered literally).
2. **Thesis Board:** five ladder columns, gate criteria on headers, cards showing counter strip / contrarian chip / falsifier lights / verification countdown / divergence badge, evidence drawer in place (events, engagements two-column, stage history with snapshots), distance-to-promotion sorting.
3. **Explorer (one, consolidated):** event chips, independence badges, confidence rendering, bounds-honest dates, speaker/carrier, extraction version; entity views as filter presets.
4. **Authors:** class + org clustering (the Citrini trio renders as one shop), calibration counters, stance sparklines, read-first rank, book-talk indicator.
5. **Ingestion Console:** Visual Intake (drop / multi-image batch / paste / mobile), adapters, re-extraction console, batch forensics.
6. **Markets (grows with M7):** dispersion panels (claims as markers, ranges as bars, anchors distinct, median line, revision arrows — DRAM_QOQ is the flagship), verification-calendar strip, Signal Desk / Risk / Ledger views as the trade layer activates.

Legacy narrative views are demoted with an explicit pre-audit banner or removed.

## 11. M9 — Platform (cross-cutting)

- **Provider abstraction:** all LLM/VLM calls behind one interface; **publicly-routable provider(s)** (Anthropic-class API) configured per environment; per-call cost/latency logging; hash-keyed caching; typed structured-output parsing that drops forbidden fields (stages, prices) by construction (L1, L13).
- **Jobs:** explicit scheduled endpoints/workers (host-appropriate: Vercel Cron or a worker dyno), execution records feeding the Health Strip, idempotent, resumable, rate-limit-aware with backoff.
- **Time discipline:** asOf helper module as the only sanctioned read path for time-sensitive tables; grep audit in CI (L4).
- **Provenance & audit:** every derived row chains to its inputs; every PS decision logged; every gate transition carries its evidence snapshot.
- **Security:** auth in front of everything except a data-free `/health`; secrets out-of-band and env-injected (L11); role-scoped DB credentials.
- **Durability:** hosted Postgres; nightly off-box backups, 14-day retention, restore drill demonstrated per environment (L13).

## 12. PS's standing judgment points (the complete list)

Epistemic class tags and org affiliations · engagement rulings (override queue) · VLM ratifications until graduation · handle admissions · anchor source list · falsifier compilation review · thesis-family assignments · liquidity/venue config · all trade parameters (risk %, family caps, ATR multiples, weights) · expression selection per trade · every ACTUAL position · weekly discard sample · stage-report reviews. Everything else is deterministic or bounded-LLM.

## 13. Acceptance philosophy (L9, codified)

Every module ships with sabotage-style demonstrated tests: the truncated feed that must alert, the fabricated quote that must quarantine, the future date that must clamp, the same-org two-class thesis that must fail VALIDATED, the fired falsifier that must demote same-batch, the LLM stage/price field that must drop-and-log, the BofA image that must produce a flagged range cold, the broken adapter that must show red without log-reading, the overnight run that must green the strip because jobs executed. Reports state opening→delta→closing on every moved count (L12). PS-gated items arrive staged (L10).
