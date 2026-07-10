# NIP v2 — Design Document
## Architecture, data model, interfaces, and migration
### Companion to `nip_v2_system_specification.md` — the spec says *what*; this says *how*

---

## 1. Architecture overview

**Topology: three planes on managed infrastructure.**

```
┌─────────────────────────────────────────────────────────────┐
│  OPERATOR PLANE (Next.js on Vercel — display + PS actions)  │
│  Delta Briefing · Thesis Board · Explorer · Authors ·        │
│  Ingestion Console · Markets — all reads via API layer       │
└──────────────────────────┬──────────────────────────────────┘
                           │ typed API (tRPC or REST)
┌──────────────────────────┴──────────────────────────────────┐
│  COMPUTE PLANE (jobs)                                        │
│  Scheduled: adapters, checkpoints, monitors, ladder recompute│
│  On-demand: deep-examine, VLM pipeline, assessments,         │
│             re-extraction                                    │
│  Host: Vercel Cron endpoints (daily tier) now;               │
│        promote hot paths to a worker dyno (Railway) when     │
│        cadence needs exceed daily                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ Prisma (Neon serverless driver)
┌──────────────────────────┴──────────────────────────────────┐
│  DATA PLANE                                                  │
│  Neon Postgres (source of truth) · Object storage for raw    │
│  payloads + images · Nightly off-box dumps (14d retention)   │
└─────────────────────────────────────────────────────────────┘
   Cross-cutting: Provider Layer (LLM/VLM) · asOf module ·
   Audit log · Auth · Secrets (env-injected only)
```

**Stack (continuity-biased — the team knows it, the data lives in it):** Next.js 16 / TypeScript / Prisma / **Neon Postgres with `@prisma/adapter-neon`** (serverless HTTP driver — kills the stale-connection crash class permanently) / Tailwind + shadcn / TanStack Query. New: provider layer (below), object storage (Vercel Blob or S3-compatible) for raw HTML/transcripts/images so the DB stores references + hashes rather than megabyte blobs.

**Design stance on the rebuild question:** this is a **strangler rebuild, not a greenfield**. v1's *data* and its audited provenance migrate as-is; v1's *code* is replaced module-by-module against the interfaces below. Rationale: the corpus and its correction history (merge maps, date bounds, PS tag decisions) are the most expensive artifacts in the project; the code is the cheap part.

---

## 2. The Provider Layer (the L13 fix, designed)

One interface; all model access flows through it. This is the single most important new component.

```typescript
interface ModelProvider {
  complete(req: CompletionRequest): Promise<CompletionResult>
  completeVision(req: VisionRequest): Promise<CompletionResult>
}
interface CompletionRequest {
  taskType: TaskType            // TRIAGE | DEEP_EXTRACT | ADJUDICATE | ASSESS | CLASSIFY_IMAGE | EXTRACT_CHART_ANNOTATIONS | EXTRACT_CHART_AXIS | ...
  prompt: PromptRef             // versioned prompt id + params — never inline strings
  schema: ZodSchema             // typed structured output, parsed not trusted
  cacheKey?: string             // content-hash; same key + prompt version = cache hit, no call
}
```

**Routing config, not code:** `taskType → { provider, model, maxTokens, temperature }`. Cheap model for TRIAGE/CLASSIFY, strong model for DEEP_EXTRACT/ASSESS, vision model for the chart routes. Providers: Anthropic API primary (text + vision in one), fallback slot optional.

**The L1 guard lives here, structurally:** the parse step validates against the Zod schema and **strips-and-logs any field on the forbidden list** (`stage`, `entryPrice`, `targetPrice`, `stopLoss`, `currentPrice`, `rankScore`, `effectiveN`, any weight). No call site can receive a price or a stage from a model even if the prompt is jailbroken, because the type doesn't carry it.

**Also here:** per-call cost/latency/token logging (feeds an ops panel and the two-pass economics), retry with backoff, rate-limit queueing, and the cache (keyed content-hash × prompt-version — the free 429 mitigation).

**Prompt registry:** prompts are versioned artifacts in the repo (`prompts/deep_extract/v3.md`), referenced by id. `extractionVersion` on outputs = prompt id. Checkpoint-10 re-extraction diffs versions mechanically.

---

## 3. Data model (consolidated — the full v1 schema, cleaned)

Grouped by module; all Postgres, all migrated from the live Neon DB (§8). Key columns only; timestamps/ids implied.

**M1/M2 — Acquisition & Verification**
```prisma
model RawContent {        // L2. Blob body in object storage; DB row holds refs.
  contentHash String @unique
  url String; storageRef String; title String
  adapterType String; adapterVersion String
  threadId String?; referencesUrl String?; referenceType String?   // echo graph edges
  fetchedAt DateTime
  extractionStatus String  // PENDING|EXTRACTED|FAILED|SKIPPED_TRIAGE|PENDING_RETRY
  extractionError String @default("")
}
model IngestionBatch { trigger String; status String; checkpointResults Json; discardLedgerRef String?; counts Json /* opening→delta→closing, L12 */ }
model SourceCandidate { handle String; citations Int; sampleRefs Json; status String }  // discovery loop
model QueueItem { type String /* RULING|VLM_RATIFY|CANDIDATE|ATTRIBUTION|TRIPWIRE|QUARANTINE|ALERT */; payload Json; status String; resolvedBy String?; resolvedAt DateTime? }
model AdapterHealth { adapter String @unique; lastSuccessAt DateTime?; lastRunAt DateTime?; state String /* GREEN|AMBER|RED */; cause String @default("") }
```

**M3 — Extraction**
```prisma
model Source {            // an extracted insight
  rawContentId String; extractionVersion String; degradedExtraction Boolean @default(false)
  authorId String; carrierAuthorId String?          // L8: speaker vs carrier
  dateIso DateTime?; dateEarliest DateTime?; dateLatest DateTime?   // L4 bounds
  direction String; conviction String; confidence String /* CLEAN|HEDGED|AMBIGUOUS */
  insightType String; verbatimQuote String; keyInsight String
  tickers Json; entities Json /* canonical ids */; insightMetadata Json
  informationEventId String?; independenceClass String @default("UNCLASSIFIED")
}
model Entity { canonicalName String; ticker String?; aliases Json; orgId String? }
model Metric { canonicalName String; unit String; aliases Json }
model IngestedImage { imageHash @unique; parentRawId String?; storageRef String
  classifierClass String; annotationRoute Json; axisReadRoute Json   // both routes logged permanently
  discrepancyFlag String @default(""); confidence String
  ratificationStatus String /* PENDING|RATIFIED|REJECTED|PENDING_RETRY */
  viralityCount Int @default(1) }
```

**M4 — Knowledge**
```prisma
model InformationEvent { canonicalTitle String; eventDate DateTime; originType String; originUrl String
  memberCount Int; authorBreadth Int; independentCount Int; clusterVersion String }
model QuantClaim { sourceId String; eventId String?; thesisId String?
  authorId String; carrierAuthorId String?; orgAttribution String?  // printed source on images
  metricId String; valueLow Float?; valueHigh Float?  // ranges first-class
  unit String; horizon String; claimedAt DateTime
  extractionMethod String /* TEXT|VLM */; confidence String
  resolvedValue Float?; resolvedAt DateTime?; resolutionSource String @default("") }
model AnchorRevision { metricId String; org String; values Json /* dated timeline */ }
model VerificationEvent { date DateTime; eventType String; entityId String?
  thesisLinks Json /* [{thesisId, canVerify, canFalsify}] */; falsifierIds Json; metricIds Json
  status String /* UPCOMING|PASSED_VERIFIED|PASSED_FALSIFIED|PASSED_MIXED|PASSED_UNRESOLVED */; outcome String }
model Falsifier { forecastId String?; statement String; compiledQuery Json
  status String /* ARMED|PARTIAL|FIRED|EXPIRED|RETIRED */; eventFamily String?   // same-trigger grouping
  armedAt DateTime; expiresAt DateTime?; lastCheckedAt DateTime?; firingEvidence Json }
```

**M5 — Author intelligence**
```prisma
model Author { handle @unique; realName String; cluster String
  epistemicClass String /* +UNRESOLVED */; orgAffiliation String?
  mergedInto String?; mergeBasis String?                            // L5: the map is the table
  calibrationScore Float; forecastsMade Int; forecastsResolved Int; forecastsCorrect Int
  brierScore Float?; magnitudeError Float?; leadTimeDays Float?; authorityWeight Float @default(1.0) }
// authorityWeight readable ONLY via getAuthorityWeight(author) — accessor enforces the ≥5-resolved floor
model AuthorStance { authorId; narrativeFamily; rollingDirection Float; rollingConviction Float
  insightCount Int; postingBaseline Float; lastEventDate DateTime }  // per-EVENT aggregation, L7
model StanceChange { authorId; narrativeFamily; changeType String
  priorStance Float; newStance Float; magnitude Float; triggerEventId String; reviewed Boolean }
model AuthorFamilyStats { authorId; family; originationRate Float; medianEchoLagHrs Float?; upstreamScore Float }
```

**M6 — Thesis engine**
```prisma
model Thesis { title; direction; stage String
  eventIds Json; independentEvents Int; primaryIntegrityEvents Int
  effectiveN Float; distinctOrgs Int; epistemicClassCount Int       // ALL hard gate inputs, L6/L7
  contrarianStatus String; engagementSearchLoggedAt DateTime?
  armedFalsifiers Int; crowdingFlag Boolean
  verificationEventId String?; divergenceVerdict String /* UNPRICED_DIVERGENCE|PRICED|UNKNOWN */
  narrativeFamily String; stageHistory Json /* every transition + evidence snapshot */ }
model ThesisEngagement { thesisId; opposingEventId; answeringEventId String?
  engagementType String; status String /* OPEN|ANSWERED|CONCEDED */
  proposedStatus String?; reasoning String; synthetic Boolean @default(false)
  psDecision String?; psDecidedAt DateTime? }                        // staged, L10
```

**M7 — Trade layer**
```prisma
model ThesisExpression { thesisId; entityId; instrumentType String; thesisBeta Int
  betaEvidence Json; crowdingScore Float; liquidityClass String; rankScore Float; rationale String }
model TradePlan { thesisId; expressionId
  entryLow Float?; entryHigh Float?; stopPrice Float?; targetBase Float?; targetBull Float?
  priceSource String /* market-data|manual — NO third value */; priceAsOfDate DateTime?
  atrValue Float?; riskPerUnit Float?; unitsPlanned Float?
  falsifierStopIds Json; verificationEventId String
  status String /* DRAFT|ARMED|FILLED|EXITED|CANCELLED */; constructionLog Json }
model NarrativeFamily { name; thesisIds Json; riskCapR Float }
model Position { tradePlanId; ledgerType String /* PAPER|ACTUAL */
  entryPrice Float; entryDate DateTime; units Float; riskR Float
  exitPrice Float?; exitDate DateTime?; exitReason String; rMultiple Float?
  setupType String /* PRE_CONSENSUS|STANCE_CHANGE|CROWDING_FADE|SECOND_ORDER|DIVERGENCE */
  status String /* OPEN|CLOSED|EXIT_REVIEW */ }
```

**M9 — Platform**
```prisma
model AuditLog { actor String /* PS|SYSTEM|JOB:x */; action String; targetType String; targetId String; payload Json }
model ProviderCall { taskType; promptVersion; provider; model; tokens Int; costUsd Float; latencyMs Int; cacheHit Boolean }
model JobRun { job String; startedAt; finishedAt?; status String; counts Json; error String @default("") }
```

---

## 4. The time module (L4, designed)

One module, `lib/asof.ts`, exports the **only** sanctioned readers for time-sensitive tables:

```typescript
getSourcesAsOf(asOf, filter)         // visibility: dateLatest <= asOf  (certainly-past)
getEventsAsOf(asOf, ...)             // eventDate from member dateLatest maxima
getRecencyWindow(asOf, days, ...)    // window membership: dateEarliest >= asOf - days (never fresher-than-might-be)
requireDayPrecision(...)             // silence/gap computations only
```
CI rule: a grep step fails the build on `db.(source|informationEvent|thesis|falsifier|thesisEngagement|authorStance|stanceChange).find` outside `lib/asof.ts` and designated CRUD paths. Insert path clamps `dateLatest = min(dateLatest, fetchedAt)` and logs clamps.

## 5. The gate module (L1/L6/L7, designed)

`lib/gates.ts` — pure functions only, no I/O, no LLM, fully unit-tested, **demotion evaluated before promotion**:

```typescript
computeCounters(thesis, eventsAsOf): ThesisCounters   // org-aware effectiveN (inverse Herfindahl over org shares), distinctOrgs, distinctClasses, independents (org-dependence applied)
canPromote(stage, counters, context): GateResult      // context: contrarian status + search log, falsifier states, crowding, stance flags, verification link
computeStage(thesis, ...): StageTransition            // returns transition + evidence snapshot for stageHistory
```
Threshold values live in a config table, PS-editable, versioned — never constants in code. Gate acceptance tests are the sabotage suite from spec §13 and run in CI.

## 6. Jobs (L13, designed)

| Job | Cadence (initial) | Does |
|---|---|---|
| `adapters:rss` / `adapters:x` / `adapters:transcripts` | daily (X → hourly when worker lands) | fetch → raw store → checkpoints 1–5 → triage → extract |
| `adapters:anchors` | daily + release-calendar aware | anchor fetch, revision chaining, calendar proposals |
| `pipeline:events` | per batch | clustering, independence, org rule |
| `pipeline:stance` | per batch | per-event stance updates, change classification, compound alerts |
| `monitor:falsifiers` | per batch | screen → assess-on-hit → deterministic consequences |
| `engine:ladder` | per batch | counters + stage recompute, snapshots |
| `monitor:verifications` | daily | passed events → claim resolution → calibration updates |
| `ops:scorecard` | weekly | checkpoint 11 |
| `ops:backup` | nightly | dump → off-box; monthly restore drill |

Every run writes a `JobRun` row; **AdapterHealth/strip state derives from JobRun records, not reachability**. All jobs idempotent and resumable (watermarks, `proposedStatus`-style progress fields). Hosting: Vercel Cron for daily-tier now; the promotion trigger to a Railway worker is written down in advance — *when any job needs sub-daily cadence or >60s runtime*, it moves, no re-litigating.

## 7. UI design system (L14, designed)

**Information architecture:** six surfaces per spec §10. Navigation is flat; the Needs-You badge is global.

**Component grammar (reused everywhere):**
- **EvidenceLink** — every synthesized number is a click-to-expand-in-place drawer to its inputs. No dead-end numbers anywhere in the app.
- **CompositionBadge** — conviction/confidence always rendered as parts (n events · effN · orgs · classes · contrarian state), never a lone word.
- **CauseChip** — failures in cause language ("feed moved", "provider unreachable from host"), color-coded; RED = action needed, AMBER = silence or degradation.
- **CountdownChip** — verification dates as clocks.
- **RangeBar** — QuantClaims render ranges as bars, points as markers; VLM-derived visually distinct; a [7,60]-style absurdity should *look* absurd.
- **StagedDecision** — the PS-gate pattern: proposal + reasoning + APPROVE/OVERRIDE, nothing effective until ruled (L10). Used by rulings, ratifications, candidates, calendar confirmations.
- **ReconLine** — any surfaced count that moved shows opening → delta → closing on hover (L12).

**States designed first-class:** empty ("nothing needs you today" is a deliberate screen, not a blank), loading, degraded (LLM provider down → the affected features labeled, not broken), and stale (data older than its cadence shows its age).

**Mobile:** Delta Briefing and Needs-You Queue are the two surfaces that must be fully phone-usable (the morning read and the ruling pass); Visual Intake supports tap-to-upload; everything else is desktop-first.

## 8. Migration plan (v1 → v2, strangler order)

1. **Freeze + backup:** v1 Neon dump, checksummed, restore-verified (L13). The corpus never regresses.
2. **Platform first:** provider layer + prompt registry + asOf module + gates module extracted and unit-tested against current data. v1 behavior reproduced = the regression baseline.
3. **Schema migration:** additive Prisma migration to the consolidated model (mostly renames/promotions of existing fields; `mergeBasis`, `setupType`, storageRef columns new). Raw blobs move to object storage with hash verification.
4. **Compute plane:** jobs replace scripts/endpoints one at a time; each cutover = old path off, JobRun records on, strip keyed to them, overnight demonstrated.
5. **Operator plane:** surfaces land in the addendum's priority order (Board + Queue + Intake → Briefing + Calendar → Markets), each consuming the typed API; legacy tabs demoted as replaced.
6. **Acceptance:** the full sabotage suite (spec §13) green in CI; the overnight unattended run green; PS completes one ruling, one image batch, one anchor edit end-to-end on the new surfaces.

Estimated shape: platform 2–3 days · schema+storage 1–2 · jobs 2–3 · surfaces 4–6 · hardening 2. **~2 weeks of focused build**, corpus live throughout, no evidence re-earned.

## 9. What v2 explicitly does not do (yet)

Embeddings/HDBSCAN dynamic narrative clustering (the dynamics engine — designed-for, slot reserved in M4, built when echo-rich data justifies it); broker integration (never, by design — PS executes); options analytics beyond structure labels; multi-user. Each has a reserved seam, none blocks the build.
