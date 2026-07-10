# NIP v2.1 — Experience-First Redesign
## Amends `nip_v2_system_specification.md` and `nip_v2_design_document.md`
### The inversion: the product is a reading instrument. Intelligence annotates reality; it never replaces it.

---

## 0. The design failure being corrected (stated for the record)

v2 was designed bottom-up: M1→M7 data machinery, M8 display last. Result: a system that filters belief with real rigor and shows the operator almost nothing — no native content, no visible debates, ingestion that requires a human to poke it. Three failures, one root cause (display treated as terminal, not primary):

1. **Ingestion is not automatic.** X adapter unbuilt; 13 LLM call sites dead on the deployment (provider half-wired); RSS lacks watermarks; crons daily-only. "Self-updating" is currently a claim, not a property.
2. **Raw reality is invisible.** The operator sees extraction cards, never the tweets, threads, transcripts, and posts themselves. The corpus — the asset — cannot be *read*.
3. **Debate has no home.** Disagreement is the most valuable content in the corpus (four alpha gaps, all downstream of disagreement) and it exists only as machine-readable rows. jukan vs. Dylan vs. TrendForce is a query result, not a page.

**The inversion:** the system is four rooms the operator walks through in order — **Reality → Disagreement → Judgment → Action** — and the build order now follows the rooms, not the pipeline.

```
ROOM 1: THE STREAM      what your analysts actually said (native, readable, linked)
ROOM 2: THE DEBATES     where they disagree (quotes side-by-side, stakes, resolution clock)
ROOM 3: THE JUDGMENT    what survives the gates (Thesis Board — unchanged spec)
ROOM 4: THE ACTION      what to do about it (trade layer — unchanged spec)
```
Rooms 3 and 4 keep their existing specs. Rooms 1 and 2 are new, specified below, and they come FIRST. Automation (§3) is the precondition for Room 1 having anything in it.

---

## 1. ROOM 1 — The Stream (native content, annotated)

**What it is:** a chronological, filterable feed of the raw ingested corpus, rendered in each medium's native form — the reading surface for the 42-handle ecosystem. Opening the app in the morning means *reading what your analysts said*, not querying what a pipeline extracted.

### 1.1 Content-native rendering

- **Tweets/threads:** tweet-form cards — author (avatar, handle, real name, epistemic-class chip, org chip), full verbatim text, thread rendered as one continuous readable unit (the A1 thread reconstruction finally visible), QT/reply rendered with the referenced content inline, timestamp, **link to the original**. Always the link to the original.
- **Substack/articles:** title, author, hero excerpt, expandable full stored text, link out.
- **Transcripts:** episode card; expandable transcript with **timestamped segments**; each extracted insight deep-links to its timestamp offset.
- **Images/charts:** the image itself, rendered, with its VLM extraction shown beside it (both routes' values, any DUAL_ROUTE_MISMATCH range visible), ratification state, virality count, link to the carrying post.
- **External anchors:** distinct visual treatment (bordered, org-badged) — TrendForce releases and earnings excerpts read as *ground truth arriving*, visually unlike opinion.

### 1.2 The annotation layer (the fusion of raw and extracted)

Intelligence renders **on top of** the content, never instead of it:

- **Span highlights:** the exact sentences that became insights or QuantClaims are highlighted in the native text. Hover/tap a highlight → the extraction card (type, direction, conviction, confidence, entities, claim values) appears in place. Requires §4's span-anchoring.
- **Margin chips:** event membership ("1 of 8 — SemiAnalysis memory report" → the event's other members), stance flag if this content moved the author's baseline (MODERATING/REVERSING badge), debate flag if this content is a position in a live debate (→ Room 2), claim chip if it carries a quantitative claim.
- **Nothing hidden:** content that produced zero extractions still appears in the Stream (untriaged reality is still reality); triage-discarded content is reachable via a "show filtered" toggle — the discard ledger made readable.

### 1.3 Stream controls

Filters as chips, composable: handle · org · epistemic class · medium · narrative family · has-claim · has-debate · stance-events-only · anchors-only. Saved views ("Morning read": CHANNEL_PRIMARY + anchors + stance events, last 24h). Search across verbatim text. Infinite scroll with day separators; unread marker per session. **Mobile-first** — this is the surface that must be excellent on a phone.

### 1.4 Acceptance (experiential, per L9)

PS opens the Stream on a phone, reads the last 24 hours of the ecosystem natively, expands one thread, taps one highlight to see its extraction, follows one link to the original tweet, and toggles one saved view — all without touching any other tab. A transcript insight deep-links to its timestamp. An anchor visually reads as ground truth.

---

## 2. ROOM 2 — The Debate Theater (disagreement as a first-class object)

**What it is:** the page where jukan-vs-Dylan-vs-TrendForce exists as a *rendered argument*, not a query result. Every debate answers five questions on one screen: what is the question, who says what (in their own words, linked), what's at stake, what resolves it, and where does it stand.

### 2.1 The Debate object (new schema)

```prisma
model Debate {
  id             String @id
  question       String            // plain language: "How much will DRAM contract prices rise in Q3 2026?"
  debateType     String            // MAGNITUDE (claim dispersion) | DIRECTION (thesis engagement) | TIMING | MECHANISM
  metricId       String?           // for MAGNITUDE debates
  thesisIds      Json              // theses whose fate this debate decides
  status         String            // LIVE | RESOLVING | RESOLVED_A | RESOLVED_B | RESOLVED_MIXED | DORMANT
  stakes         String            // LLM-written, PS-editable: why this matters, what changes if each side wins
  resolutionEventIds Json          // the verification events that settle it
  heatScore      Float             // recency × participant breadth × stakes-linked thesis stages — drives ranking
  positions      DebatePosition[]
}
model DebatePosition {
  id             String @id
  debateId       String
  side           String            // A | B | NUANCED
  authorId       String            // the SPEAKER (L8)
  orgId          String?
  statement      String            // the position in one line
  evidenceRefs   Json              // [{sourceId, spanStart, spanEnd, url}] — the actual quotes, anchored & linked
  claimIds       Json              // linked QuantClaims where quantitative
  stanceWeight   Float             // book-talk discount applied; calibration-weighted when available
  enteredAt      DateTime
  lastAffirmedAt DateTime          // silence on a debate is itself informative
}
```

### 2.2 Detection (assembled from machinery that already exists — this is composition, not new analytics)

Debates are auto-assembled, PS-curatable, from three existing sources:
1. **MAGNITUDE:** QuantClaim dispersion on one metric×horizon where the tails are far apart and both tails are credible (non-SYNTHESIZER, calibration-eligible). *The DRAM Q3 debate assembles itself from existing rows: Dylan 40–50% vs. TrendForce 13–18% vs. BofA 5–17%.*
2. **DIRECTION:** ThesisEngagement rows — every SPECIFIC_OBJECTION is one side of a debate whose other side is the thesis's supporting events. The five Hyperscaler Concentration objections are already positions.
3. **STANCE COLLISION:** two tracked authors with opposing rolling stances on one narrative family, both active in the window.

An LLM pass names the question plainly and drafts the stakes paragraph (PS-editable — L10-staged on first render); everything else is deterministic assembly. New content matching a live debate's metric/thesis/entities attaches as evidence automatically per batch.

### 2.3 The rendering (the page PS asked for)

**Debate index:** ranked by heatScore; each card = the question, side counts with faces, the resolution countdown, linked-thesis stage chips. *"How much will DRAM prices rise in Q3?" — 1 vs 2 orgs — resolves Jul 25 (Samsung) — decides: Memory Supercycle (HYPOTHESIS), Memory Tax (OBSERVATION).*

**Debate page — two columns and a spine:**
- **Each side:** its holders (avatar, class chip, org chip, calibration when available, book-talk indicator), and each holder's **actual quote** — the highlighted span from the original content, rendered in native form, **linked to the original tweet/post/timestamp**. Quantitative positions show their claim values on a shared RangeBar.
- **The spine (between the columns):** the stakes paragraph; the resolution clock (linked VerificationEvents with countdowns); the current-state strip — dispersion trajectory (narrowing = converging), latest position entries, any stance changes *within* the debate (a holder moderating is rendered as movement across the page), silence flags (a side that stopped affirming).
- **On resolution:** the passed event's actual print, the verdict (which side the number vindicated), and the calibration consequence per holder — the debate page becomes the permanent record of who was right, feeding M5 visibly.
- **Cross-links everywhere:** every position → its Stream content; every debate → its theses on the Board; every thesis card (Room 3) gains a "live debates" chip → back here.

### 2.4 Acceptance (experiential)

The DRAM Q3 pricing debate — which exists in the data today — renders as the flagship: question stated plainly; Dylan's 40–50% with his verbatim transcript quote deep-linked to the timestamp; TrendForce and BofA on the other side as anchor-class positions with their revision arrow; the stakes paragraph naming the five memory theses it decides; the Jul 10/15/25 resolution clock; and after Jul 25, the resolved verdict with calibration consequences shown. PS reaches this page in two taps from the Stream.

---

## 3. Automation — "automatic" defined, then achieved

**Definition (the acceptance bar):** for seven consecutive days, no human touches the system and every day: all registered sources fetched to watermark, extraction run, events/stance/ladder recomputed, the Stream shows the day's content by morning, the Health Strip is green *because JobRuns say so*, and anything needing PS sits in the queue. Anything short of this is not "automatic" and may not be described as such.

**The specific gaps, closed in this order:**
1. **Provider rewiring — the 13 straggler call sites** through `getProvider()` (the audit's list). Without this, extraction is dead on the deployment and nothing else matters. (~2–3 hrs, mechanical.)
2. **Regex-price path killed again + CI sabotage test** so it cannot resurrect a third time (30 min — rides along, money-safety).
3. **RSS watermarks** (per-feed GUID/pubDate) — stop re-fetching the world daily.
4. **X scraper adapter** per the logged decision — thread + QT/reply capture; per-handle watermarks. This is what fills the Stream and feeds the echo machinery its first real mention streams.
5. **Transcript auto-detection** (publish-watch on registered channels) rather than on-demand only.
6. **Cadence:** X and stance-sensitive sources need better than daily → this is the pre-written Railway-worker trigger firing; move the hot adapters to the worker, keep dailies on cron.
7. **The seven-day unattended run** as the formal acceptance, reported with the JobRun evidence.

---

## 4. Span anchoring (the small technical key that makes Rooms 1–2 possible)

Extraction must record **where in the raw text each insight/claim came from**: `spanStart/spanEnd` character offsets into RawContent's stored text (for transcripts, additionally the timestamp offset). One field pair on Source and QuantClaim; the extraction prompt already returns verbatim quotes, so anchoring = locating the quote in the stored raw (exact match, fuzzy fallback, `spanConfidence` when fuzzy). Backfill over the existing corpus is a batch job (the verbatims exist; find them). **Without spans, highlights and debate-quote linking are screenshots of extractions; with spans, raw and derived are one fused surface.** This lands before Room 1 renders.

---

## 5. Revised build order (supersedes the onboarding brief §5 sequence)

| # | Item | Why this order |
|---|---|---|
| 1 | Corpus-safety admission ticket (backup + restore + row counts) | Unchanged — nothing before this |
| 2 | Regression baseline (sabotage suite green) | Unchanged |
| 3 | **Automation §3 items 1–3** (provider rewiring, regex kill + CI test, RSS watermarks) | The deployment's extraction comes alive; money-safety restored |
| 4 | **Span anchoring + backfill** (§4) | The key to both rooms |
| 5 | **ROOM 1 — The Stream** | The operator can finally read the corpus |
| 6 | **ROOM 2 — The Debate Theater** (flagship: the DRAM Q3 debate) | Disagreement gets its home; the July window renders live |
| 7 | **Automation §3 items 4–7** (X adapter, transcript watch, worker cadence, seven-day run) | The Stream fills itself |
| 8 | Room 3 board + queue + briefing (existing addendum specs) | Now annotating a readable reality |
| 9 | Trade layer Part B on first ACTIONABLE | Unchanged |

Items 3–6 are roughly one focused week. The July verification window (Jul 10–25) should render inside Rooms 1–2 if the sequence holds — the system's first resolved debate arriving on the page built to show it.

## 6. What does not change

Every law (L1–L14), every gate, the entire M1–M7 data machinery, the provenance discipline, PS's judgment points. This addendum reorders what gets *built and shown* first; it does not weaken a single filter. The intelligence was never the problem — its invisibility was.
