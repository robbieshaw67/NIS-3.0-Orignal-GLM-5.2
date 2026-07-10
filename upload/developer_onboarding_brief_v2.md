# Developer Onboarding Brief — v2 (CURRENT)
## Narrative Intelligence Platform (NIP)
### Supersedes the prior brief. Give this document, plus the four attachments, to the new developer as the opening prompt.

**Attachments that travel with this brief:**
1. `nip_v2_system_specification.md` — the target system (the WHAT, including the Fourteen Laws)
2. `nip_v2_design_document.md` — architecture, schema, interfaces, migration plan (the HOW)
3. `nip_v2_1_experience_first_redesign.md` — **the governing amendment**: the four-room inversion (Stream, Debates, Judgment, Action) and the build order in its §5, which supersedes everything else's sequencing
4. `code_verification_audit.md` — the outgoing developer's file:line self-audit; the most honest map of the code that exists. Treat its findings as your checklist, and independently verify them in your step 2–3 baseline.
5. Repo + live Vercel deployment + Neon database access (credentials arrive separately, out-of-band — never in chat or reports; L11)

---

## 1. What you are inheriting (60 seconds)

A working narrative-intelligence system for semiconductor/AI investment signals. It ingests analyst content (X, Substack, transcripts, chart screenshots), extracts structured insights, collapses echo into information events, and runs theses up a deterministic promotion ladder (OBSERVATION → HYPOTHESIS → VALIDATED → ACTIONABLE) gated by concentration-adjusted breadth, cross-organization triangulation, armed falsifiers, and a contrarian-survival test. A trade layer (specced, partly built) converts ACTIONABLE theses into deterministic trade plans with a paper ledger.

**The corpus is the asset.** ~634 sources, 65 theses, 568 information events, 51 quantitative claims, fully audited provenance (date bounds, canonical identities with filed merge maps, PS-confirmed epistemic classes and org affiliations). Live on Neon Postgres, deployed on Vercel behind basic auth. The code is replaceable; the data and its correction history are not. Every schema migration: backup → checksum → migrate → row-count verify. No exceptions.

**The strategic reframe you are building toward (v2.1):** the product is a **reading instrument first**. Intelligence annotates reality; it never replaces it. The operator must be able to *read* what their 42 analysts said (natively, linked to originals) and *see* their disagreements as rendered debates — before and beneath all analytical chrome. The prior build inverted this and the correction is now the priority.

**Live business context you must not break:** one VALIDATED thesis (Hyperscaler Concentration) awaits PS's engagement rulings to become the first ACTIONABLE; one live UNPRICED_DIVERGENCE (corpus 45% Q3 DRAM QoQ vs. external consensus 5–18%) resolves against real events in July (SK Hynix ADR Jul 10, Intel Jul 15, Samsung Jul 25). These paths stay working at all times.

## 2. Read the Fourteen Laws first (Spec §0)

Each was purchased by a specific production failure, cited beside the law. The three most frequently tested:
- **L1:** No LLM output ever sets a price, stage, weight, or gate decision — enforced in parsers/types, not prompts. (An LLM once priced Micron at $1 via regex, producing +17,900% "upside." The audit found that regex path *resurrected* after a filesystem restore — see §4. It dies again with a CI test this time.)
- **L3:** Errors are never verdicts. A failed fetch produces RETRY/QUARANTINE + a queue item — never a default classification. (A network error once auto-rejected 25 of PS's uploaded images as "memes.")
- **L9:** Demonstrated, not built. "Enforced in code" is not a test result. Acceptance = the behavior watched happening, preferably via deliberate sabotage. This standard caught six real bugs code review missed.

## 3. How we work (the process contract)

1. **Work orders in, reports back.** Named report-back checkpoints are documents delivered to PS — never absorbed into status tables. (Rule exists because it was violated.)
2. **PS gates are staged, never auto-applied (L10):** tag assignments, engagement verdicts, VLM ratifications, calendar entries, handle admissions — built, staged, shown; effective only after PS rules. (Also violated once. Not twice.)
3. **Deviations arrive as flagged decisions with tradeoffs, before shipping** — not discovered in acceptance sections.
4. **Counts reconcile (L12):** any moved number ships with opening → named deltas → closing.
5. **Secrets never travel in reports (L11):** out-of-band delivery, env-dashboard injection. You get this once.
6. **Acceptance tests are sabotage tests:** truncated feed → must alert; fabricated quote → must quarantine its batch; future date → must clamp; same-org two-class thesis → must fail VALIDATED; LLM returning a `stage` or price field → must drop-and-log. Run them, show output.
7. **PS's judgment points are enumerated in Spec §12.** Do not move items across that human/machine line without an explicit work order.

## 4. Build-state matrix (audit-corrected — the exact, honest gap)

| Spec section | State | Notes |
|---|---|---|
| M1 RSS adapter (12 feeds) | **BUILT — NO WATERMARKS** | Re-fetches everything each run; hash-dedup contains damage but burns quota. Fix in sequence step 3. |
| M1 Transcript adapter | **BUILT (on-demand only)** | Publish auto-detection unbuilt |
| M1 External anchors + revision tracking | **BUILT** | Auto-resolution of QuantClaims wired |
| M1 X adapter + discovery loop | **UNBUILT** | Decision logged: scraper-first. Fills the Stream; sequence step 7. `SourceCandidate` model also missing from schema |
| M1 Image intake (multi-upload, paste, mobile) | **BUILT** | Panel live in Ingestion Console |
| M2 Checkpoints 1–11 | **BUILT** | Demonstrated; quarantine + clamp tests on record. CP10 re-extraction: dry-run only, **apply step missing** |
| M3 Two-pass triage + versioned extraction | **BUILT** | 515 legacy sources flagged degraded, awaiting CP10 apply |
| M3 VLM dual-route pipeline | **BUILT — NEEDS HARDENING** | Mechanism verified (flag fires, ranges stored); extraction fidelity poor (a [7,60] range on ~5–17 truth). Both routes logged; per-route error tracking specced, unbuilt. PS ratifies every VLM claim until graduation (50 @ ≥95%) |
| M3/M9 **Provider abstraction** | **HALF-WIRED — CRITICAL** | Only VLM + RSS page-reader go through `getProvider()`. **13 files still call the internal-only SDK directly** (audit lists them: falsifier-monitor, ingestion, information-events, engagement-filter/assessment, thesis-event-mapping, thesis-ladder, quant-claims, transcript ASR, 4 routes). These are silently dead on the deployment. Sequence step 3, item 1 |
| **Regex-price path** | **RESURRECTED — MUST DIE** | `/api/trade-signals/prices` extracts `$XX.XX` from search snippets into `currentPrice` with no `priceSource` — the exact MU-$1 bug, deleted in Batch 1, back after the filesystem-restore. Delete again + CI sabotage test so it cannot return a third time. Also: verify whether any signal's price data was re-polluted since the restore |
| **P1 asOf discipline** | **FAIL — STRUCTURAL** | 8+ analytics files do direct Prisma reads bypassing the asOf helpers. Look-ahead leakage is possible in live gate computations, not just future backtests. Fix = refactor through helpers **+ the CI grep gate** (Design §4) so the rule is enforced, not documented. Ideal first deep work — it walks you through every analytics file with the system's central law as your lens |
| M4 Information events / org-aware independence | **BUILT** | Echo capture 6.3% on legacy corpus (structural: hand-curated single insights); rises when X streams flow |
| M4 QuantClaims / dispersion / calendar / falsifiers | **BUILT** | 23 falsifiers armed (2 PARTIAL, China InP); capex event-family grouped. Dispersion UI unbuilt. Missing schema fields from 4A §E: `extractionMethod`, `carrierAuthorId`, `threadId`, `referencesUrl` |
| M4 Falsifier → position EXIT_REVIEW | **GAP (15 min)** | `flagPositionExitReview` exists but is NOT wired into the falsifier FIRED branch — the non-price stop is half-connected |
| M5 Identity/org/epistemic/stance/calibration | **BUILT** | Per-event stance aggregation fixed; calibration counters all zero until July resolutions. **Book-talk discount exists but is not wired into aggregation** (30 min) |
| M5 Lead-lag / read-first | **BUILT — KNOWN LIMITATION** | Single-member-event volume dominance; SYNTHESIZER exclusion instructed |
| M6 Thesis ladder + gates | **BUILT — AUDITED** | Six bugs found and fixed via demonstrated tests; pure functions; do not touch without re-running the sabotage suite |
| M6 Engagement pipeline + PS override queue | **BUILT** | 5 real objections staged; PS rulings pending — keep this path alive |
| M7 Paper ledger core | **BUILT (idle)** | Auto-create/close on stage transitions verified; awaits first ACTIONABLE |
| M7 Trade layer Part B (expressions, TradePlan, families, risk) | **STUBS** | Position model exists; TradePlan/NarrativeFamily not in schema; full spec in Batch-3 rev.2 |
| **M8 ROOM 1 — The Stream** | **UNBUILT — see v2.1 §1** | Native content rendering + annotation layer. Requires span anchoring (v2.1 §4) |
| **M8 ROOM 2 — Debate Theater** | **UNBUILT — see v2.1 §2** | Debate/DebatePosition schema + assembly from existing machinery. Flagship (DRAM Q3) builds from data that exists today |
| M8 Thesis Board / rendered queue / Delta Briefing / dispersion panel | **UNBUILT** | Specs in the UI addendum + Design §7; sequenced AFTER Rooms 1–2 per v2.1 |
| M8 Ingestion Ledger skeleton (strip/digest/queue) | **BUILT** | Strip keys off JobRun records |
| M9 Jobs on Vercel Cron (rss/anchors/scorecard) | **BUILT (daily)** | No watermark idempotency yet; Railway-worker promotion trigger pre-written: any job needing sub-daily cadence or >60s moves, no re-litigating |
| M9 Neon + off-box backups + restore drill | **BUILT** | Drill on record with row-count verification |
| Cross-cutting hygiene | **PASS** | No hardcoded secrets; no TODO/FIXME in src/ |
| Dynamics engine / embeddings / broker integration | **FUTURE / NEVER** | Seams reserved (Design §9) |

## 5. Your first work order (v2.1 §5 sequence — this is the current order)

1. **Read** all four attached documents fully, then the repo's `docs/` (worklog, deferral notes, merge maps, `STEP9_REPORT_v2_1.md`).
2. **Admission ticket:** take a backup, run the restore drill, post the row-count table. Nothing else proceeds first.
3. **Regression baseline:** run the gate sabotage suite + checkpoint tests against live data; post results green before changing anything — so your first change has a baseline.
4. **Automation criticals (audit items, in this order):**
   a. **Kill the regex-price path** + add the CI sabotage test (any code writing a price without `priceSource ∈ {market-data, manual}` fails the build) + verify no price data was re-polluted since the restore. (~30 min; money-safety first.)
   b. **Rewire the 13 straggler LLM call sites** through `getProvider()` with a publicly-routable provider (PS provisions the API key, out-of-band). Acceptance: deep-examine, engagement assessment, falsifier monitoring, and thesis proposal all run end-to-end **on the deployed Vercel app**. (~2–3 hrs, mechanical — the audit lists every file.)
   c. **RSS per-feed watermarks.** (~1 hr.)
   d. Riders while you're in there: wire `flagPositionExitReview` into the falsifier FIRED branch (15 min); add the missing 4A schema fields; wire the book-talk discount into aggregation (30 min).
5. **Reprocess PS's 25 rejected images** through the fixed pipeline (auto-rejected by a network error masquerading as classification — the L3 case study). Stage in the ratification queue.
6. **Span anchoring + backfill** (v2.1 §4): `spanStart/spanEnd` on Source and QuantClaim, transcript timestamp offsets, backfill by locating existing verbatims in stored raw. The key to Rooms 1–2.
7. **ROOM 1 — The Stream** (v2.1 §1). Acceptance is experiential: PS reads 24h of the ecosystem natively on a phone, expands a thread, taps a highlight to its extraction, follows a link to an original, uses one saved view.
8. **ROOM 2 — The Debate Theater** (v2.1 §2). Acceptance: the DRAM Q3 debate renders as the flagship from existing data — Dylan's 40–50% verbatim deep-linked to the transcript timestamp, TrendForce/BofA as anchor-class positions with the revision arrow, the stakes naming the memory theses, the Jul 10/15/25 resolution clock. Two taps from the Stream.
9. **Automation completion** (v2.1 §3 items 4–7): X scraper adapter with thread/QT capture and discovery loop; transcript publish-watch; hot-adapter promotion to the worker host when cadence demands; then the formal acceptance — **the seven-day unattended run**, reported with JobRun evidence. Only after this may the system be described as "automatic."
10. **Then:** Thesis Board + rendered Needs-You Queue + Delta Briefing per the UI addendum; P1 asOf refactor with the CI grep gate (your first deep structural work); CP10 apply step; trade layer Part B as the first ACTIONABLE arrives.

**Report back after steps 2–3 together, after step 4, after step 8, and after the seven-day run** — standing format: what was done, demonstrated acceptance with outputs shown, reconciliation lines on moved counts, deviations flagged before shipping.

## 6. What good looks like here

Your predecessor's best rounds shared one pattern: when a review flagged something, they ran the verification query *before* defending the code — and twice the query proved the flag right in ways that mattered. The standard is not "no bugs"; it is **bugs get caught by demonstrations, failures announce themselves in cause language, PS's judgment enters at the named points, and nothing — ever — silently becomes a verdict.** And one sentence to keep above your desk, because the entire v2.1 correction exists because it was learned late: **the operator must be able to read the reality the system reasons about — intelligence that cannot be seen next to its source is not trusted, and intelligence that is not trusted is not used.**
