# NIP — Consolidated Logic & Function Testing Engine
## Master Test Case Catalog
### Every Law (L1–L14), Module (M1–M9), and Room (0–4 + 0.5) from the full spec set, expressed as runnable test cases

**How to use this document:**
- Each test has an ID (`L1-01`, `M4-03`, `R2-05`, etc.) — reference these in bug reports and rectification notes.
- Each test states: **Setup** (what data/state to create), **Action** (what to run), **Expected** (what must be true), and where applicable a **Sabotage variant** (the deliberately broken input that must be caught, per L9 — "demonstrated, not built").
- Status column: mark ✅ PASS / ❌ FAIL / ⚠️ PARTIAL / ⬜ NOT RUN as you execute.
- A companion file, `nip_test_suite_scaffold.ts`, implements the highest-priority tests below as runnable Jest/Vitest code — drop it into `tests/` and adapt the import paths to your repo.
- Priority tags: **P0** = safety-critical, blocks everything; **P1** = core correctness; **P2** = quality/completeness.

---

## PART 1 — The Fourteen Laws (cross-cutting, test once, apply everywhere)

### L1 — No LLM output sets price, stage, weight, or gate decision

| ID | Priority | Test | Status |
|---|---|---|---|
| L1-01 | P0 | **Setup:** Mock an LLM response containing a `stage: "ACTIONABLE"` field. **Action:** Pass through the extraction parser. **Expected:** Field is stripped before reaching the DB write; an `L1_FORBIDDEN_STRIPPED` audit log row is written naming the field and source call. | ⬜ |
| L1-02 | P0 | **Setup:** Mock an LLM response containing `currentPrice: 47.50`. **Action:** Pass through any provider-layer parse path. **Expected:** Field stripped, audit logged, downstream `TradePlan.priceSource` remains untouched. | ⬜ |
| L1-03 | P0 | **Sabotage:** Search for any code path (grep `currentPrice`, `stage =`, `rankScore =`) that writes one of the forbidden fields directly from a parsed LLM response without going through the strip function. **Expected:** Zero matches outside `lib/provider/`. This is a CI gate, not a manual check — build must fail on a match. | ⬜ |
| L1-04 | P0 | **Setup:** A `TradePlan` or `Position` write attempt with `currentPrice` set but `priceSource` unset or not in `{market-data, manual}`. **Expected:** Write rejected at the schema/application layer (constraint or validation error), not silently accepted. | ⬜ |
| L1-05 | P1 | **Regression (the MU $1 case + the resurrection case):** Confirm `/api/trade-signals/prices` (or wherever price ingestion lives) contains no regex extraction of `$XX.XX` patterns from free text. **Expected:** grep for price-regex patterns (`\$\d+\.\d+`) in any route file returns zero matches, enforced in CI. | ⬜ |

### L2 — Store raw before extracting; extraction is versioned and reprocessable

| ID | Priority | Test | Status |
|---|---|---|---|
| L2-01 | P0 | **Setup:** Trigger any adapter fetch. **Action:** Inspect write order. **Expected:** `RawContent` row exists (with `storageRef` populated) *before* any `Source` row referencing it is created. | ⬜ |
| L2-02 | P1 | **Setup:** Two fetches of identical content (same `contentHash`). **Expected:** Second fetch short-circuits (cache hit), no duplicate `RawContent`, no duplicate LLM call (verify via `ProviderCall` count = 1). | ⬜ |
| L2-03 | P1 | **Setup:** A `RawContent` row with `extractionVersion: "v2"`. **Action:** Run checkpoint 10 (re-extraction) with `extractionVersion: "v3"` prompt. **Expected:** Dry-run produces a diff of old vs. new insights without mutating the DB; only applying the diff (explicit action) writes v3 rows, and v2 rows remain until superseded, not deleted. | ⬜ |
| L2-04 | P1 | **Sabotage:** Delete/corrupt a `RawContent.storageRef` blob while keeping the DB row. **Action:** Attempt re-extraction. **Expected:** Fails loudly with a specific "blob unreachable" error and quarantines the batch — does not silently produce empty extraction. | ⬜ |

### L3 — Errors are never verdicts

| ID | Priority | Test | Status |
|---|---|---|---|
| L3-01 | P0 | **Sabotage:** Force the VLM classifier call to throw a network error (mock `fetch` rejection). **Expected:** Resulting `IngestedImage.ratificationStatus = PENDING_RETRY`, NOT `REJECTED`; `classifierClass` is left unset or `ERROR`, never `MEME_OTHER` or any valid class. A `QueueItem type: QUARANTINE` is created. **This is the exact regression test for the 25-image incident — must never silently reclassify a fetch failure as a content judgment.** | ⬜ |
| L3-02 | P0 | **Sabotage:** Feed checkpoint 3 (sampled verification) a batch where one extracted quote does not appear in the stored raw text (fabricated by mutating test fixture). **Expected:** That entire batch is quarantined from gate computation — not just the one bad insight — until a human reviews it. | ⬜ |
| L3-03 | P1 | **Sabotage:** Truncate an RSS feed response mid-parse (malformed XML). **Expected:** Adapter logs a specific parse-failure cause, writes `AdapterHealth.state = RED` with `cause` populated, does NOT write partial/corrupt Source rows. | ⬜ |
| L3-04 | P1 | **Sabotage:** Adapter declares 20 items available but fetch only returns 4. **Expected:** Completeness checkpoint (checkpoint 2) fires an alert; batch is NOT silently accepted as complete. | ⬜ |
| L3-05 | P1 | **Sabotage:** Feed the date parser a partial/ambiguous date string. **Expected:** Result is a bounded range (`dateEarliest`/`dateLatest`) reflecting genuine uncertainty — NEVER defaults to a specific date like Jan 1 of the parse year. | ⬜ |

### L4 — Time is bounded, conservative, leak-proof

| ID | Priority | Test | Status |
|---|---|---|---|
| L4-01 | P0 | **Sabotage:** Insert a `Source` with `dateLatest` set to a future date beyond `fetchedAt`. **Expected:** Insert-time clamp forces `dateLatest = min(dateLatest, fetchedAt)`; a clamp event is logged. | ⬜ |
| L4-02 | P0 | **Setup:** Backtest skeleton run with `asOf` set to a historical date. **Action:** Insert a source dated AFTER that `asOf` into the corpus. **Expected:** The backtest computation run at that `asOf` does NOT see the future-dated source — `getSourcesAsOf` correctly excludes it. | ⬜ |
| L4-03 | P0 | **CI gate:** grep for direct `db.source.findMany`, `db.thesis.findMany`, `db.informationEvent.findMany`, `db.falsifier.findMany`, `db.authorStance.findMany`, `db.stanceChange.findMany` outside `lib/asof.ts` and designated CRUD-only paths. **Expected:** Zero matches; build fails otherwise. (Note: this is currently FAILING per the code audit — 8+ files bypass it. This test exists to make the violation impossible to reintroduce once fixed.) | ⬜ |
| L4-04 | P1 | **Setup:** A silence/gap computation (author went quiet). **Expected:** Uses day-precision only (not sub-day), and the silence window respects `dateEarliest`/`dateLatest` bounds rather than a single point date. | ⬜ |

### L5/L6/L7 — Identity/org axes, claim-specific evidence, echo collapse

| ID | Priority | Test | Status |
|---|---|---|---|
| L5-01 | P1 | **Setup:** Two author handles determined to be the same person. **Action:** Merge. **Expected:** `mergedInto` and `mergeBasis` are both populated (never a merge without a stated reason); the merged author's historical stance/calibration rolls up to the surviving canonical author. | ⬜ |
| L5-02 | P0 | **Sabotage:** Two authors from the same `orgId` both classified as members of one `InformationEvent`. **Expected:** They CANNOT both carry `independenceClass: INDEPENDENT` — org-dependence rule forces at most one INDEPENDENT per org per event; the other is ECHO or ORIGIN. | ⬜ |
| L6-01 | P0 | **Setup:** An `InformationEvent` about Company A's memory pricing. A separate, unrelated event about Company A's cloud revenue. **Action:** Run thesis-event mapping for a thesis specifically about memory pricing. **Expected:** Only the memory-pricing event links; the cloud-revenue event does NOT link merely because it shares the entity "Company A." (Regression test for the 1092→113 link fix.) | ⬜ |
| L6-02 | P1 | **Setup:** A `ThesisEngagement` candidate where an event mentions the thesis's entity but argues a different specific claim. **Expected:** Specificity filter rejects it as a genuine objection (it should not count toward the 5-genuine-of-396 style inflation). | ⬜ |
| L7-01 | P0 | **Sabotage:** Same author, same day, same underlying interview — one BULL insight and one BEAR insight extracted from different timestamps of the same transcript. **Expected:** Same-date aggregation rule treats this as ONE stance observation (intra-source diversity), NOT a REVERSING compound alert. (Regression test for the SemiAnalysis false-alert incident.) | ⬜ |
| L7-02 | P0 | **Setup:** effectiveN computation on an event with 5 members, 4 from Org X and 1 from Org Y. **Expected:** Inverse-Herfindahl-weighted effectiveN reflects the concentration (should be well below 5, reflecting that 4/5 members are one voice by organization). | ⬜ |

### L8 — Speaker ≠ carrier

| ID | Priority | Test | Status |
|---|---|---|---|
| L8-01 | P0 | **Setup:** A tweet from Author X that screenshots and captions a BofA chart ("per BofA, DRAM +17%"). **Expected:** `QuantClaim.authorId` = BofA (or org-attributed anchor), `carrierAuthorId` = Author X. The claim is NOT attributed as Author X's own view. | ⬜ |
| L8-02 | P1 | **Sabotage:** Ambiguous relay language ("saw this — thoughts?") with no clear original source stated. **Expected:** Routes to an attribution QueueItem for human resolution rather than guessing an attribution. | ⬜ |

### L9 — Demonstrated, not built

| ID | Priority | Test | Status |
|---|---|---|---|
| L9-01 | P0 | **Meta-test:** For every gate transition function (`canPromote`, falsifier FIRED consequences, dual-route VLM trigger), confirm there exists a corresponding sabotage test in this catalog with a passing result — not just a unit test of the happy path. **Expected:** 100% of gate-affecting logic has a named sabotage counterpart below. | ⬜ |

### L10 — PS gates staged, never auto-applied

| ID | Priority | Test | Status |
|---|---|---|---|
| L10-01 | P0 | **Setup:** An engagement assessment proposes verdict `ANSWERED`. **Action:** Check `ThesisEngagement.status` immediately after the LLM assessment runs. **Expected:** Status remains distinguishable as `proposedStatus: ANSWERED` while the operative `status` field stays as it was (e.g., `OPEN`) until `psDecision` is explicitly set. The proposal alone must never flip the operative field. | ⬜ |
| L10-02 | P0 | **Sabotage:** Attempt to read a VLM-derived `QuantClaim` as if it were ratified before `ratificationStatus = RATIFIED` is explicitly set by a human action. **Expected:** Any downstream consumer (dispersion calc, gate counter) either excludes PENDING claims or clearly flags them as unratified — never silently treats PENDING as RATIFIED. | ⬜ |
| L10-03 | P1 | **Setup:** A new handle candidate crosses the citation threshold. **Expected:** Enters `SourceCandidate` queue; does NOT get auto-admitted into the active registry without a PS action. | ⬜ |

### L11 — Secrets never travel in reports

| ID | Priority | Test | Status |
|---|---|---|---|
| L11-01 | P0 | **Manual/process check (not automatable in code):** Audit the last N developer reports/PRs for any string matching credential patterns (`password:`, `secret:`, API key formats). **Expected:** Zero matches. This is a review-process test, tracked here for completeness. | ⬜ |
| L11-02 | P0 | **Automated proxy:** grep the codebase for hardcoded secrets (not `process.env.*`). **Expected:** Zero matches; CI gate. | ⬜ |

### L12 — Counts reconcile

| ID | Priority | Test | Status |
|---|---|---|---|
| L12-01 | P1 | **Setup:** Any `IngestionBatch` completion. **Expected:** `counts` JSON contains `opening`, named `deltas`, and `closing` fields, and `closing = opening + sum(deltas)` arithmetically (write a checksum test). | ⬜ |

### L13 — No silent infrastructure dependencies

| ID | Priority | Test | Status |
|---|---|---|---|
| L13-01 | P0 | **CI gate:** grep for `getZai(` or any direct internal-SDK call outside `lib/provider/`. **Expected:** Zero matches (regression test for the 13-straggler-file finding). | ⬜ |
| L13-02 | P0 | **Setup:** Invoke a job's `run(ctx)` function directly in a plain Node context (not via the Vercel Cron route). **Expected:** Runs identically to the cron-invoked path — proves the host-agnostic contract is real, not aspirational. | ⬜ |
| L13-03 | P0 | **Setup:** Run `npm run db:backup && npm run db:restore:verify` against a scratch DB. **Expected:** Row counts match between source and restored DB across all tables; command completes without manual intervention. | ⬜ |
| L13-04 | P1 | **Sabotage:** A job that would run longer than the host's function timeout (simulate with a large batch). **Expected:** Job is chunked — processes a bounded slice, records a resumable watermark, and a subsequent invocation continues rather than timing out mid-write. | ⬜ |

### L14 — UI organized around what PS decides

| ID | Priority | Test | Status |
|---|---|---|---|
| L14-01 | P1 | **Setup:** Any synthesized number displayed in the UI (effectiveN, conviction, calibration score). **Expected:** Clicking/tapping it opens an evidence drawer showing the underlying inputs — no dead-end numbers. | ⬜ |
| L14-02 | P1 | **Setup:** An adapter failure. **Expected:** Health Strip shows cause language ("feed unreachable," "parser mismatch") not a raw stack trace or generic "error." | ⬜ |
| L14-03 | P2 | **Setup:** Empty Needs-You Queue + all-green Health Strip. **Expected:** UI explicitly renders "nothing needs you today" (a designed empty state), not a blank screen. | ⬜ |

---

## PART 2 — Modules M1–M9

### M1 — Acquisition

| ID | Priority | Test | Status |
|---|---|---|---|
| M1-01 | P1 | RSS adapter: run twice in succession; second run only fetches items newer than the stored per-feed watermark (GUID/pubDate), not the full feed. | ⬜ |
| M1-02 | P1 | Transcript adapter: submit a YouTube URL; confirm yt-dlp path succeeds, and confirm Whisper fallback engages when captions are unavailable (mock caption-fetch failure). | ⬜ |
| M1-03 | P1 | External anchor ingestion: submit a new TrendForce release; confirm `AnchorRevision` timeline gets a new dated entry rather than overwriting the prior value. | ⬜ |
| M1-04 | P2 | Discovery loop: a handle cited ≥K times by ingested content appears in `SourceCandidate` with sample references attached. | ⬜ |
| M1-05 | P1 | Image intake: batch upload of 5 images via drop zone; all 5 create `IngestedImage` rows with correct `parentRawId`/carrier linkage. | ⬜ |
| M1-06 | P2 | Image intake: paste (Ctrl/Cmd-V) a single image; creates one `IngestedImage` row. | ⬜ |
| M1-07 | P0 | X adapter (once built): thread of 12 tweets ingests as ONE `RawContent` (thread reconstruction), not 12 separate rows. | ⬜ |
| M1-08 | P1 | X adapter: a QT (quote-tweet) stores `referencesUrl` and `referenceType` correctly linking to the quoted content. | ⬜ |

### M2 — Verification (11 checkpoints)

| ID | Priority | Test | Status |
|---|---|---|---|
| M2-01 | P0 | Checkpoint 1 (pre-flight): three distinct probes (reachability, format, auth) each independently reportable — a format-only failure is distinguishable from an auth-only failure in the alert. | ⬜ |
| M2-02 | P0 | Checkpoint 2 (completeness): see L3-04. | ⬜ |
| M2-03 | P0 | Checkpoint 3 (sampled verification): see L3-02. | ⬜ |
| M2-04 | P1 | Checkpoint 4 (drift sentinel): feed a source with insights-per-post suddenly 5x baseline; confirm a drift flag fires before downstream gates consume the data. | ⬜ |
| M2-05 | P0 | Checkpoint 5 (insert invariants): attempt insert with unresolved entity; confirm entity resolution attempted, and unresolved case is logged with the raw string (not silently dropped). | ⬜ |
| M2-06 | P2 | Checkpoint 6 (triage discard ledger): confirm discarded (score <0.3) items remain queryable/inspectable, not deleted. | ⬜ |
| M2-07 | P1 | Checkpoint 7 (extraction confidence): a HEDGED-confidence insight is visually/programmatically distinguishable (e.g., dispersion haircut applied) from a CLEAN one downstream. | ⬜ |
| M2-08 | P0 | Checkpoint 8 (attribution): see L8-01/L8-02. | ⬜ |
| M2-09 | P1 | Checkpoint 9 (contradiction tripwire): same author, same day, two claims on the same metric differing >30%; confirm a same-day QueueItem is created. | ⬜ |
| M2-10 | P1 | Checkpoint 10 (re-extraction console): see L2-03. Apply step (currently missing per audit): confirm that once implemented, applying a diff correctly supersedes old-version rows without losing history. | ⬜ |
| M2-11 | P2 | Checkpoint 11 (weekly scorecard): running the scorecard job produces all named metrics (coverage, echo-capture, discard rate, verification pass rate, attribution flags, queue latency) with no null/undefined fields. | ⬜ |

### M3 — Extraction

| ID | Priority | Test | Status |
|---|---|---|---|
| M3-01 | P1 | Two-pass triage: content scoring below relevance threshold does NOT trigger the expensive deep-extraction call (verify via `ProviderCall` log — only one cheap call, zero deep calls). | ⬜ |
| M3-02 | P0 | Provider Layer forbidden-field strip: see L1-01/L1-02. | ⬜ |
| M3-03 | P0 | VLM dual-route: feed a chart image with deliberately ambiguous/dual-readable values (the BofA-style canonical test). Confirm TWO independent VLM calls occur (annotation route + axis-read route), and if they disagree >15%, `DUAL_ROUTE_MISMATCH` fires and a RANGE (not a point) is stored. | ⬜ |
| M3-04 | P1 | VLM: an unlabeled/ambiguous chart geometry produces `AXIS_READ_ESTIMATE` at LOW confidence — never a point value, per the hard boundary rule. | ⬜ |
| M3-05 | P1 | Entity/metric registry: an unresolved entity mention is logged with the raw string and an `unresolvedRate` metric increments — not silently discarded. | ⬜ |
| M3-06 | P1 | Content-hash cache: identical content + identical `extractionVersion` submitted twice → second call is a cache hit (zero additional `ProviderCall`). | ⬜ |

### M4 — Knowledge

| ID | Priority | Test | Status |
|---|---|---|---|
| M4-01 | P0 | Event clustering: candidate blocking (entity + 7-day window + URL/QT overlap) correctly proposes candidates; LLM sameness adjudication is cached (same pair submitted twice → one call). | ⬜ |
| M4-02 | P0 | Org-dependence rule: see L5-02. | ⬜ |
| M4-03 | P1 | Dispersion: `getAuthorityWeight()` floor rule (≥5 resolved forecasts) — an author with 3 resolved forecasts gets the floor weight, not their raw (undersampled) weight. | ⬜ |
| M4-04 | P1 | Verification calendar: a `VerificationEvent` with `status: UPCOMING` whose date passes auto-transitions to `PASSED_*` and triggers linked claim resolution + falsifier assessment. | ⬜ |
| M4-05 | P0 | Falsifier lifecycle: deterministic screen (keyword/entity match) runs on every batch at zero LLM cost; only a HIT triggers the LLM assessment call. Confirm zero `ProviderCall` rows for a batch with no falsifier-relevant content. | ⬜ |
| M4-06 | P0 | Falsifier FIRED: confirm deterministic consequences fire same-batch — thesis demotion, forecast resolution, calibration counter update — without waiting for a separate human trigger. | ⬜ |
| M4-07 | P0 | Falsifier FIRED → position exit: `flagPositionExitReview` is invoked in the FIRED branch; an open `Position` transitions to `EXIT_REVIEW` status and a `QueueItem type: TRIPWIRE` is created. (Currently a known gap — this is the regression test that proves the wire.) | ⬜ |
| M4-08 | P2 | Event-family grouping: two falsifiers tied to the same real-world trigger (e.g., same capex disclosure) are grouped under one `eventFamily` for stress-test purposes. | ⬜ |
| M4-09 | P1 | InformationEvent dedup fields: `sourceUrlHash`, `membersByType`, `mentionIds` are populated correctly when clustering runs (prereq for Composer dedup — see R0.5 tests). | ⬜ |

### M5 — Author intelligence

| ID | Priority | Test | Status |
|---|---|---|---|
| M5-01 | P0 | Stance aggregation: multiple insights from the same author within the same InformationEvent aggregate to ONE stance observation, not N. (Same root cause as L7-01.) | ⬜ |
| M5-02 | P1 | Stance change classification: a stance moving from strong-bull to moderate-bull classifies as MODERATING, not REVERSING; a flip in direction classifies as REVERSING. | ⬜ |
| M5-03 | P0 | Book-talk discount: a POSITIONED_MANAGER's insight CONSISTENT with their standing stance is weighted 0.5x; the SAME author's stance CHANGE is weighted 1.5x. **(Currently a spec deviation risk — verify it is NOT a flat multiplier; must be asymmetric and stance-conditional.)** | ⬜ |
| M5-04 | P1 | Compound alert: a stance change is cross-checked against its trigger source (verbatim quote exists) before surfacing as an alert — not surfaced on the LLM's say-so alone. | ⬜ |
| M5-05 | P1 | Calibration: `forecastsMade/Resolved/Correct` update correctly when a linked `VerificationEvent` resolves; Brier score computes only once there's sufficient density (defined threshold). | ⬜ |
| M5-06 | P1 | Lead-lag ranking: SYNTHESIZER-class authors are excluded from the read-first/origination ranking (explicit PS instruction). | ⬜ |
| M5-07 | P1 | Org clustering: two authors from the same firm (e.g., the Citrini trio) render/aggregate as one shop in author views, not three independent voices. | ⬜ |

### M6 — Thesis engine

| ID | Priority | Test | Status |
|---|---|---|---|
| M6-01 | P0 | Gate purity: `canPromote()` and `computeStage()` are pure functions — same inputs always produce same outputs, no I/O, no LLM calls inside them. | ⬜ |
| M6-02 | P0 | **Demotion-before-promotion ordering** (the original bug class): construct a thesis that simultaneously satisfies a demotion condition (e.g., a FIRED falsifier) and a promotion condition (e.g., new corroborating events). Confirm demotion is evaluated FIRST and wins — thesis does not promote in the same cycle it should demote. | ⬜ |
| M6-03 | P0 | OBSERVATION → HYPOTHESIS: exactly at the boundary (2 events, effectiveN 1.9) does NOT promote; at (3 events, effectiveN 2.0) DOES promote. Test the exact threshold, not just the middle of the range. | ⬜ |
| M6-04 | P0 | HYPOTHESIS → VALIDATED, the org-gate hole regression: construct a thesis with 2 independent events but BOTH from the same organization. Confirm it does NOT promote (distinctOrgs ≥ 2 is a genuinely separate hard condition, not implied by independent-event count). | ⬜ |
| M6-05 | P0 | HYPOTHESIS → VALIDATED: same construction but with 2 distinct orgs and 2 distinct epistemic classes where BOTH are SYNTHESIZER. Confirm it does NOT promote (must include ≥1 non-synthesizer class). | ⬜ |
| M6-06 | P0 | VALIDATED → ACTIONABLE, the inversion regression: a thesis with an ENGAGED_UNRESOLVED contrarian objection must NOT promote to ACTIONABLE, even if every other gate is satisfied. Confirm the specific "always blocks" behavior, distinct from UNENGAGED (which CAN pass with a logged search). | ⬜ |
| M6-07 | P1 | Contrarian engagement: a proposed `ANSWERED`/`OPEN`/`CONCEDED` verdict sits in `proposedStatus` and does not affect the gate computation until `psDecision` is set (cross-check with L10-01). | ⬜ |
| M6-08 | P2 | Adversarial self-play (if built): a SYNTHETIC-flagged engagement satisfies the "logged search" path for UNENGAGED but can NEVER by itself satisfy SURVIVED. | ⬜ |
| M6-09 | P1 | UNPRICED_DIVERGENCE: corpus weighted median vs. external anchor values computed only from anchors with `sourceClass: EXTERNAL_ANCHOR` — internal corpus "consensus" language from an analyst's own framing (e.g., Dylan characterizing "consensus is 15-20%") must NOT be treated as an external anchor value. | ⬜ |

### M7 — Trade layer

| ID | Priority | Test | Status |
|---|---|---|---|
| M7-01 | P0 | Paper ledger auto-create: a thesis transitioning to ACTIONABLE automatically creates a `Position(ledgerType: PAPER)` at the mechanical entry price — no human action required for PAPER (the sole automatic exception to L10). | ⬜ |
| M7-02 | P0 | Paper ledger auto-close: a thesis demoting from ACTIONABLE closes the linked PAPER position automatically; an ACTUAL position instead transitions to `EXIT_REVIEW`, never auto-closes. | ⬜ |
| M7-03 | P0 | Non-price stop: see M4-07 (falsifier fire → EXIT_REVIEW is the trade-layer half of this test). | ⬜ |
| M7-04 | P1 | Family risk cap: two theses sharing a `NarrativeFamily` (e.g., MU + Hynix proxies) attempt to exceed the family's `riskCapR`; the second position is rejected with the arithmetic shown (opening cap, current usage, attempted addition, rejection reason). | ⬜ |
| M7-05 | P1 | TradePlan determinism: given the same thesis/expression/price inputs, `constructionLog` reproduces an identical plan on re-run (entry/stop/target formula is a pure function). | ⬜ |
| M7-06 | P0 | priceSource enforcement: see L1-04. | ⬜ |

### M9 — Platform

| ID | Priority | Test | Status |
|---|---|---|---|
| M9-01 | P0 | Provider Layer routing: `taskType: TRIAGE` routes to the cheap model, `taskType: DEEP_EXTRACT` routes to the strong model, per the routing config — verify by inspecting `ProviderCall.model` for each task type. | ⬜ |
| M9-02 | P1 | Cost logging: every `ProviderCall` row has non-null `tokens`, `costUsd`, `latencyMs`. | ⬜ |
| M9-03 | P0 | Job idempotency: run the same job twice with no new data between runs; second run makes zero redundant writes (watermark correctly prevents reprocessing). | ⬜ |
| M9-04 | P0 | JobRun-driven health: manually mark a JobRun as failed; confirm the Health Strip reflects AMBER/RED based on the JobRun record, not on a separate reachability ping. | ⬜ |
| M9-05 | P0 | Backup/restore: see L13-03. | ⬜ |

---

## PART 3 — Rooms 0–4 (User-facing)

### Room 0 — Setup

| ID | Priority | Test | Status |
|---|---|---|---|
| R0-01 | P1 | Add a new author card with 3 media identities (X, Substack, YouTube); confirm all three are linked under one canonical author and appear correctly across adapters. | ⬜ |
| R0-02 | P1 | Set epistemic class + org on a new author via the StagedDecision pattern; confirm it is NOT active until explicitly confirmed (L10 cross-check). | ⬜ |
| R0-03 | P1 | Per-source health metrics (items this month, % → insights, % → claims, last fetched) render correctly and match underlying counts. | ⬜ |
| R0-04 | P2 | Pause a source; confirm the adapter skips it on next scheduled run. | ⬜ |
| R0-05 | P2 | A discovery-loop candidate appears in Room 0 for one-tap admission (not requiring a separate developer action). | ⬜ |

### Room 0.5 — Briefing Composer

| ID | Priority | Test | Status |
|---|---|---|---|
| R05-01 | P0 | Data fidelity: generate a briefing on a known debate; every factual claim in the output text appears verbatim (or as a faithful paraphrase of) content actually in the corpus. Zero invented facts. | ⬜ |
| R05-02 | P0 | Dedup: construct an event where 3 tracked authors retweeted the same source. Generated briefing mentions it ONCE ("X said [claim]; retweeted by A, B, C"), not three times. | ⬜ |
| R05-03 | P1 | Citation integrity: 5 random claims in a generated briefing each link to their original content; for video sources, the link resolves to the correct timestamp. | ⬜ |
| R05-04 | P1 | Multi-media hierarchy: an event containing an anchor + analyst tweet + chart on the same fact — briefing cites the anchor first, notes analyst agreement/disagreement, does not repeat the fact 3x. | ⬜ |
| R05-05 | P1 | Uncertainty flagging: briefing text includes calibration/positioning context inline (e.g., "(80% calibration, 0.5x weight)"), not bare assertions. | ⬜ |
| R05-06 | P2 | Template switching: same BriefingRequest data with `proseTemplate: fast` vs `analytical` produces meaningfully different length/structure (fast ≈ 300–400 words bullet-forward; analytical ≈ 600–900 words with explanatory structure). | ⬜ |
| R05-07 | P1 | Time-bounding (L4 cross-check): a briefing requested for period [day1, day40] does not include a claim that only resolved on day50, even if the briefing is generated on day60. | ⬜ |
| R05-08 | P0 | Reproduction: same BriefingRequest run 3 times produces IDENTICAL underlying data selection (same events/claims/debates included) — prose wording may vary, facts must not. | ⬜ |
| R05-09 | P1 | Missing-data honesty: a request for a topic with zero corpus coverage produces a briefing that explicitly states "no data found" rather than inventing plausible-sounding content. | ⬜ |

### Room 1 — The Stream

| ID | Priority | Test | Status |
|---|---|---|---|
| R1-01 | P1 | Tweet renders as tweet-form card (author, avatar, class chip, org chip, full text, timestamp, link to original). | ⬜ |
| R1-02 | P0 | Thread reconstruction: a 12-tweet thread renders as ONE continuous readable unit (not 12 disconnected cards). | ⬜ |
| R1-03 | P1 | Transcript renders as expandable card; expanding reveals timestamped segments; clicking an extracted insight deep-links to its timestamp offset in the transcript. | ⬜ |
| R1-04 | P1 | Chart image renders with its VLM extraction shown beside it (both routes' values visible if DUAL_ROUTE_MISMATCH fired). | ⬜ |
| R1-05 | P0 | Span highlight: hovering/tapping a highlighted span in native content opens the extraction card in place (EvidenceLink component) without navigating away. | ⬜ |
| R1-06 | P1 | Content with zero extractions still appears in the Stream (not hidden). | ⬜ |
| R1-07 | P2 | Triage-discarded content is reachable via a "show filtered" toggle. | ⬜ |
| R1-08 | P1 | Filters (handle/org/class/medium/family/has-claim/has-debate) are composable (AND logic) and correctly narrow the feed. | ⬜ |
| R1-09 | P1 | Saved view ("Morning read") persists and reloads the same filter combination. | ⬜ |
| R1-10 | P0 | Mobile rendering: Stream is fully usable (readable, scrollable, tappable) at a ~380px viewport. | ⬜ |

### Room 2 — The Debate Theater

| ID | Priority | Test | Status |
|---|---|---|---|
| R2-01 | P0 | MAGNITUDE debate auto-assembly: given QuantClaim dispersion where tails are far apart (e.g., the DRAM Q3 case), a `Debate` object is created/updated automatically without manual seeding. | ⬜ |
| R2-02 | P1 | DIRECTION debate auto-assembly: a `ThesisEngagement` with a genuine SPECIFIC_OBJECTION becomes one side of a debate. | ⬜ |
| R2-03 | P2 | STANCE_COLLISION debate: two tracked authors with opposing rolling stances on one narrative family within the active window produce a debate entry. | ⬜ |
| R2-04 | P0 | Debate page renders both sides with each holder's actual quote, highlighted span, linked to the original tweet/transcript timestamp. | ⬜ |
| R2-05 | P1 | RangeBar correctly displays quantitative positions from both sides on a shared scale, with anchor-class positions visually distinct from analyst positions. | ⬜ |
| R2-06 | P1 | Resolution clock (CountdownChip) correctly reflects the linked VerificationEvent's date and updates/resolves when that event passes. | ⬜ |
| R2-07 | P1 | On resolution: the page displays the actual print, the verdict (which side was vindicated), and updates each holder's calibration record visibly. | ⬜ |
| R2-08 | P2 | Silence flag: a debate holder who stops affirming their position (no new content in N days) is visually flagged. | ⬜ |
| R2-09 | P1 | Cross-links: from a Debate page, each position links back to its Stream content; from a Thesis Board card, a "live debates" chip links to relevant debates. | ⬜ |

### Room 3 — Judgment (Thesis Board)

| ID | Priority | Test | Status |
|---|---|---|---|
| R3-01 | P1 | Five columns (OBSERVATION/HYPOTHESIS/VALIDATED/ACTIONABLE/POSITIONED) each display their gate criteria in the column header. | ⬜ |
| R3-02 | P1 | Thesis card shows counter strip (events/effectiveN/orgs/classes), contrarian chip, falsifier count, verification countdown, divergence badge — all matching the underlying data (cross-check against direct DB query). | ⬜ |
| R3-03 | P1 | Clicking a card opens an evidence drawer in place (events, debate view, stage history, QuantClaims) without full navigation. | ⬜ |
| R3-04 | P2 | Within-column sort by distance-to-promotion correctly orders cards (closest to next gate threshold first). | ⬜ |
| R3-05 | P0 | Direct acceptance case: the Hyperscaler Concentration card correctly shows its 2 OPEN objections as clickable items leading to Room 2. | ⬜ |

### Room 4 — Action (Trade Layer)

| ID | Priority | Test | Status |
|---|---|---|---|
| R4-01 | P1 | Expression ranking table displays candidates with thesisBeta, crowding, liquidity class, and rank score matching the pure-function computation. | ⬜ |
| R4-02 | P0 | TradePlan display shows priceSource explicitly (market-data/manual) — never blank or a third value. | ⬜ |
| R4-03 | P1 | Paper ledger view correctly cuts results by stage-at-entry, family, and setup type. | ⬜ |
| R4-04 | P0 | Family risk cap breach in the UI shows the arithmetic (not just a rejection message) — cross-check with M7-04. | ⬜ |

---

## PART 4 — Video Extraction (M3 enhancement)

| ID | Priority | Test | Status |
|---|---|---|---|
| V-01 | P1 | A 10-minute call segment's extracted insights have `videoTimestampStart/End` within ±5 seconds of the actual moment the claim was spoken (manual spot-check by jumping to the timestamp). | ⬜ |
| V-02 | P1 | Multi-speaker call (3 speakers): every extracted insight correctly attributes `speaker`/`speakerTitle` matching who is actually speaking at that timestamp. | ⬜ |
| V-03 | P2 | An earnings call referencing a slide produces `visualContext` text describing the slide/chart referenced. | ⬜ |
| V-04 | P1 | Sample 5 video-sourced insights; each `verbatimQuote` is found in the stored transcript at/near the given timestamp (exact or close fuzzy match). | ⬜ |
| V-05 | P0 | Intra-source stance isolation for video: a 60-minute call chunked by speaker-turn does NOT produce spurious REVERSING alerts from natural phrasing variation across chunks (cross-check with L7-01/M5-01, video-specific case). | ⬜ |
| V-06 | P2 | High-conviction video insight triggers async clip extraction; resulting `VideoClip.storageRef` is a valid, playable 5–30 second clip covering the claimed timestamp range. | ⬜ |

---

## PART 5 — Synthesis Rules (Composer housekeeping)

| ID | Priority | Test | Status |
|---|---|---|---|
| S-01 | P0 | Same as R05-02 — restated here as the canonical dedup unit test at the Composition Engine level (independent of the full briefing pipeline): given a mocked event with `membersByType: {ORIGIN:1, ECHO:3}`, the render function outputs origin-plus-count form. | ⬜ |
| S-02 | P1 | Media hierarchy ordering: given a mocked fact-cluster with one ANCHOR, one high-calibration analyst, and one positioned analyst all claiming the same value, the composition output cites the anchor first. | ⬜ |
| S-03 | P1 | No-repeat: given the same mocked fact-cluster, the composed output does not restate the same numeric claim more than once in different phrasing (string-similarity check across output sentences). | ⬜ |
| S-04 | P2 | Pure-echo edge case: an event with 20 ECHO members and 1 low-calibration SYNTHESIZER origin still credits the origin first, and any ECHO member with added commentary (a QT, not a plain RT) is treated as independent, not folded into the count. | ⬜ |

---

## Execution Notes

**Run order recommendation:** P0 tests first, grouped by Law (Part 1) since these are cross-cutting regressions with known historical incidents behind them — a P0 failure here invalidates trust in everything downstream. Then M1–M9 in dependency order. Then Rooms in build order (per the Consolidated Addendum §E: Rooms 1–2 before 0–0.5).

**Regression priority:** Tests marked with "(the X incident)" or "(regression test)" in their description map to a documented historical failure. These should be the first tests written as actual code (see the companion scaffold file) because they protect against known, expensive-to-repeat mistakes.

**What "PASS" means here:** A test passes only when demonstrated against real data/a real sabotage input, per L9 — not when the code merely compiles or a happy-path input is accepted. If you can only construct the sabotage condition manually (e.g., editing a test fixture to fabricate a bad quote), that's expected and correct; document the manual construction step in the test comment.

**Total count:** 100 test cases across 14 Laws, 9 Modules (M1-M9, minus M8 which is the Rooms), 6 Rooms, video extraction, and synthesis rules.
