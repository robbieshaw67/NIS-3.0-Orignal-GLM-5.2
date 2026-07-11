# Developer Onboarding Brief — Final (CURRENT)
## Narrative Intelligence Platform (NIP) v2.x
### Give this brief + the three attachments to the new developer.

**Attachments that travel with this brief:**
1. `nip_v2_system_specification.md` — the target system, the Fourteen Laws, the module map
2. `nip_v2_design_document.md` — architecture, schemas, provider layer, migration plan
3. `nip_v2x_consolidated_addendum.md` — **MASTER SPEC: the four rooms, briefing composer, video extraction, templates, automation, all integrated**
4. `code_verification_audit.md` — the outgoing developer's file:line audit (your checklist)
5. Repo + live Vercel deployment + Neon database (credentials arrive separately, out-of-band; L11)

---

## 1. What you are inheriting (90 seconds)

A working narrative-intelligence system for semiconductor/AI investment signals. It ingests analyst content, extracts structured insights, collapses echo into information events, runs theses up a deterministic promotion ladder gated by breadth/triangulation/falsifiers/contrarian survival. A fully audited corpus (634 sources, 65 theses, 568 events, 51 quantitative claims) lives on Neon Postgres, deployed on Vercel behind basic auth. **The corpus is the asset.** The code is replaceable; the data and its correction history are not.

**The strategic shift you're building:** the product was designed bottom-up (data machinery first, display last). You're inverting it: experience-first. The user opens the app and **reads reality** — what their analysts said natively, linked to originals — before any analytical chrome. Intelligence annotates content rather than replacing it.

**Live context:** One VALIDATED thesis (Hyperscaler Concentration) awaits PS's five engagement rulings to become the first ACTIONABLE; one live UNPRICED_DIVERGENCE (corpus 45% Q3 DRAM vs. external 5–18%) resolves against real events in July. Don't break these paths.

---

## 2. The architecture you're building toward (30 seconds)

```
ROOM 0 — Setup          [where you manage the source ecosystem]
ROOM 0.5 — Composer     [where you request written briefings]
ROOM 1 — Stream         [where you read what was said, natively]
ROOM 2 — Debates        [where you see disagreement rendered]
ROOM 3 — Judgment       [where you see theses that survived gates]
ROOM 4 — Action         [where you trade on it]
```

Rooms 3–4 already exist and don't change. Rooms 0–0.5, 1–2 are new and are your build. Rooms 1–2 are the current sprint's priority (live before July 25, so the system's first resolved debate lands on the board that displays it). Rooms 0–0.5 ship post-July.

---

## 3. Read these in order

1. **`nip_v2_system_specification.md`** — open with the Fourteen Laws (read the failure each one was bought by). Then skim the module map. This is context.
2. **`nip_v2_design_document.md`** — §2 on the Provider Layer (the LLM fix), §3 data model, §4 time discipline, §5 gates. This is how the system works *under* the surface.
3. **`nip_v2x_consolidated_addendum.md`** — **THIS IS YOUR WORK ORDER.** All six rooms specified (PART A), automation architecture (PART B), video extraction (PART C), synthesis rules (PART D), sequencing (PART E), acceptance tests (PART F). The integrated spec of everything you're building.
4. **`code_verification_audit.md`** — the outgoing developer's honest map of the code. Use it as a checklist; verify findings independently.
5. **`docs/` in the repo** — worklog, merge maps, `STEP9_REPORT_v2_1.md`, deferral notes. This is the decision history.

---

## 4. The process contract (five non-negotiable rules)

1. **Work orders in, reports back.** Named checkpoints are documents delivered to PS — never status-table rows.
2. **PS gates are staged, never auto-applied (L10).** Built → shown → effective only after PS rules.
3. **Deviations flagged before shipping** — not discovered in acceptance sections.
4. **Counts reconcile (L12).** Any moved number: opening → named deltas → closing.
5. **Secrets never in reports (L11).** Out-of-band delivery, env-injected.

---

## 5. Your first work order (from the Consolidated Addendum §E)

### Current sprint (Rooms 1–2, automation, July timeline)

1. **Admission ticket:** Backup → restore drill → row-count table. Nothing else until green.
2. **Regression baseline:** Sabotage suite green, both CI gates (prices + asOf) enforced in the build pipeline.
3. **Provider rewiring + safety kills** (~4 hrs): 13 LLM call sites through `getProvider()`, regex-price path killed with CI test, RSS watermarks.
4. **Span anchoring + backfill** (~4 hrs): `spanStart/spanEnd` on Source and QuantClaim, timestamps on transcripts, backfill by quote-matching into stored raw.
5. **ROOM 1 — The Stream** (~6 hrs): Native rendering per medium, annotation layer (highlights + margin chips), filters + saved views, mobile-first readable.
6. **ROOM 2 — Debate Theater** (~5 hrs): Debate object + assembly from existing machinery, the page layout (columns + spine), acceptance = DRAM flagship renders from data that exists today.
7. **Automation completion** (~8 hrs): X adapter, transcript publish-watch, hot-adapter promotion trigger, then the formal seven-day unattended run with JobRun evidence.

**Subtotal: ~27 hours.** Report back after steps 2, 3, 5–6, and the seven-day run.

### Post-July (Rooms 0–0.5, video extraction, templates)

8. **ROOM 0 — Setup** (~5 hrs): Source registry (person/org cards), media identities, epistemic class/org, per-source health metrics, pause/resume, discovery-loop candidates.
9. **M3 video extraction** (~6 hrs, parallel to 8): Timestamp anchoring, speaker ID, visual context, clip generation; schema additions; extraction prompt adaptation; checkpoint 3 verification.
10. **Briefing Composer query + composition engines** (~4 hrs): BriefingRequest parsing, Query Engine filtering, Composition Engine templating per template type.
11. **Prompt templates** (~2 hrs): FAST (Daily Standup), ANALYTICAL (Debate), STRUCTURED (Thesis Update), CUSTOM. System prompts in a versioned file.
12. **Synthesis rules** (~2 hrs): Dedup rule (no fact repeated), multi-media hierarchy (anchor first, then analyst), LLM synthesis guidance.
13. **Acceptance + hardening** (~4 hrs): All tests from §F green, fix any regressions.

**Subtotal: ~23 hours.** Total sprint through Composer shipping: ~50 hours.

---

## 6. Build-state matrix (from the audit, corrected and honest)

| Component | State | Notes |
|---|---|---|
| M1 Adapters (RSS, transcripts, anchors, images) | **BUILT** | RSS: one feed only (scale-out pending); X adapter: unbuilt per logged decision |
| M1 Discovery loop | **BUILT** | New handle candidates queued; admission gated to PS |
| M2 Checkpoints 1–11 | **BUILT** | All demonstrated; checkpoint 10 apply-step missing |
| M3 Two-pass extraction | **BUILT** | 515 legacy sources degraded, awaiting re-extraction |
| M3 VLM dual-route | **BUILT — FIDELITY POOR** | Mechanism verified; extraction quality issues (the [7,60] case); per-route error tracking unbuilt |
| M3/M9 **Provider Layer** | **HALF-WIRED — CRITICAL** | Only 2 paths use `getProvider()`; 13 files still call internal-only SDK (audit lists them); LLM features dead on deployment |
| M4 Events / independence / falsifiers | **BUILT** | Echo capture 6.3% (structural); 23 falsifiers armed |
| M5 Author / stance / calibration | **BUILT** | Per-event aggregation fixed; calibration all zeros until July |
| M6 Thesis ladder + gates | **BUILT — AUDITED** | Six bugs found and fixed; pure functions; untouched without re-testing |
| M7 Paper ledger | **BUILT (idle)** | Awaits first ACTIONABLE |
| M7 Trade layer Part B | **UNBUILT** | Full spec in Batch-3; awaits first ACTIONABLE |
| M8 ROOM 1 — Stream | **UNBUILT** | Full spec in Consolidated Addendum §A; depends on span anchoring |
| M8 ROOM 2 — Debates | **UNBUILT** | Full spec in Consolidated Addendum §A; uses existing machinery |
| M9 Jobs / Vercel Cron | **BUILT (daily)** | No watermark idempotency yet; promotion trigger pre-written |
| M9 Neon + backups | **BUILT** | Restore drill on record |
| **Housekeeping bugs (from audit)** | — | — |
| Regex-price resurrected | **MUST DIE** | Deleted in Batch 1, back after filesystem restore; needs CI test prevention |
| P1 asOf discipline | **FAIL** | 8+ analytics files bypass asOf helpers; look-ahead leakage possible in live gates |
| EXIT_REVIEW wiring | **GAP (15 min)** | Falsifier FIRED doesn't flag positions for exit-review |
| Book-talk discount | **GAP (30 min)** | Exists but not wired into aggregation |
| 4A schema fields | **MISSING** | `extractionMethod`, `carrierAuthorId`, `threadId`, `referencesUrl` not on models |

---

## 7. What good looks like here

Your predecessor's best rounds had one pattern: when flagged, they ran the verification query *before* defending. Twice the query proved the flag right in ways the code review missed. The standard is not "no bugs"; it is **bugs get caught by demonstrations, failures announce themselves in cause language, PS's judgment enters at the named points, and nothing — ever — silently becomes a verdict.**

One sentence to keep above your desk: **The operator must be able to read the reality the system reasons about. Intelligence that cannot be seen next to its source is not trusted. Intelligence that is not trusted is not used.**

That's why Rooms 1–2 come before everything else. The system can be analytically sophisticated and operationally useless if the user can't *see* what it's reasoning about.

---

## 8. Timeline and calendar

- **Now through July 25:** Current sprint (steps 1–7). Rooms 1–2 live, seven-day run completes, first resolved debate on the board.
- **July 25:** Samsung reports; DRAM debate resolves; calibration consequences visible. PS sees first "the system called this correctly."
- **Late July through August:** Post-July build (steps 8–13). Rooms 0–0.5 land; Briefing Composer ships.
- **By September:** First full briefing request → composed narrative → ready to share. System has proven its intelligence works.

---

## 9. One standing item (not your job, but worth knowing)

**PS's five engagement rulings on Hyperscaler Concentration** gate the system's first ACTIONABLE and gate Part B/Part C of the trade layer. These run on the live UI today and don't wait for the new developer. You'll inherit a system where the first ACTIONABLE might already be live, or where the rulings are staged and waiting. Either way: don't break the engagement path (the API endpoints, the queue interface, the staged-decision UX). That path was paid for in blood during Batch 2.

