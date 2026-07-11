# NIP v2.x — Consolidated Specification Addendum
## The complete experience-first system: Rooms 0–4, Briefing Composer, Video Extraction, Prompt Templates
### Master document. Supersedes: v2.1, v2.2, housekeeping, video/templates specs individually.

---

## Executive Summary

The system inverts from data-first to experience-first. The product is a **reading instrument** where intelligence annotates reality rather than replacing it. Four user-facing rooms plus a briefing-synthesis layer, all grounded in audited data layers M1–M7.

**Architecture:**
```
ROOM 0 — Setup          where you constitute the ecosystem (sources, preferences, templates)
ROOM 0.5 — Composer     where you request briefings from audited intelligence
ROOM 1 — Stream         where you read what your analysts said (natively, searchably, linked)
ROOM 2 — Debates        where you see disagreement (positions, evidence, resolution clocks)
ROOM 3 — Judgment       where you see what survived the gates (Thesis Board, unchanged)
ROOM 4 — Action         where you trade on it (Trade Layer, unchanged)
```

Every room consumes outputs from rooms below it. The Composer synthesizes data from Rooms 1–3 into prose. Video extraction feeds Room 1 with timestamp-anchored insights. Prompt templates let you choose the Composer's voice.

---

## PART A: The Four Rooms + Briefing Composer (Rooms 0–0.5)

### ROOM 0 — Setup (the front door)

**What it is:** The source registry and your preferences. The corpus is the asset; you curate it.

**The unit:** one card per **person/organization**, containing:
- All their media identities (handle @ X, Substack URL, YouTube channel, podcast appearances)
- Epistemic class (PS-confirmed, one per person)
- Organization affiliation
- Per-source health metrics (items this month, % became insights, % became claims, last fetched)
- Pause/resume controls
- Discovery-loop candidates arriving here for admission

**Saved views:** You save a briefing preference ("My morning read", "Memory deep-dives", "Indium deep-dive") and the Composer loads it in one tap. Stored client-side, so your briefing preferences are private and fast.

**Media-type tabs:** X handles / Substacks / Channels / Anchors / Image carriers — views over the same source registry, not separate interfaces.

**Acceptance (experiential):** Add one new author in Room 0 (all three media identities, class, org); it appears in the Stream (Room 1) within one adapter cycle; later you can pause that source via the card.

---

### ROOM 0.5 — Briefing Composer

**What it is:** Synthesize audited intelligence into a written narrative. Prose layer only — no new analysis, no LLM judgment, no gate-making.

#### Architecture

```
BriefingRequest (what you want)
    ↓
Query Engine (filter the corpus)
    ↓
Composition Engine (arrange data by template)
    ↓
Prose Writer (LLM, role 4 only — write coherent narrative)
    ↓
Output Layer (HTML / Markdown / PDF)
```

#### BriefingRequest

```typescript
interface BriefingRequest {
  // Template and voice
  template: "daily-standup" | "debate-briefing" | "thesis-update" | "topic-deepdive" | "custom"
  proseTemplate: "fast" | "analytical" | "structured" | "custom"
  
  // Filters (all optional; empty = all)
  authors?: [handle, ...]
  orgAffiliations?: [org, ...]
  entities?: [canonical-name, ...]
  narrativeFamilies?: [family, ...]
  search?: string  // "indium phosphate" → maps to entities + mentions
  
  // Time
  since: DateTime
  until: DateTime
  
  // Depth
  length: "short" | "medium" | "long"
  
  // What to include
  includeDebates: boolean
  includeTheses: boolean
  includeClaims: boolean
  includeStanceChanges: boolean
  
  // Output
  format: "html" | "markdown" | "pdf" | "email"
  includeLinks: boolean
}
```

#### Composition templates

**Daily Standup** (what I missed in 24–48h)
- Headline: one sentence, the single most important thing
- By source: what each tracked author said
- Debate movement: any position changes, resolutions
- Thesis updates: any stage changes and why
- Risks: falsifiers fired, new threats

**Debate Briefing** (focused disagreement)
- The question: what are they arguing?
- Stakes: what changes if each side wins
- Side A/B: positions, evidence, calibration
- The gap: where they disagree most sharply
- Timeline: when it resolves
- Your edge: what the system says to a decision-maker

**Thesis Update** (status of one or a few ideas)
- Thesis name + current stage
- What moved this week: events, evidence, stance changes
- Remaining gates: what does it need to promote?
- Falsifiers armed / fired
- Contrarian objections and their basis
- Quantitative claims and dispersion
- Verification dates: when we know

**Topic Deep-Dive** (indium phosphate, memory capex, etc.)
- Question framed: what's happening with [topic]?
- Stakes: which theses rest on this?
- The positions: who says what (organized by debate)
- The evidence: claims, data points, recent events
- Debate status: where it stands, what resolves it, timeline
- The outliers: who disagrees, how far apart, why?

**Custom** (user writes the brief)
- Respect the user's requested structure, tone, focus
- Base rules: cite every claim, no invented facts, distinguish authority from interpretation, show disagreement, flag uncertainty

#### Prose Writer (LLM, role 4 only)

System prompt varies by `proseTemplate`:

**FAST** (Daily Standup)
```
Voice: Fact-first, scannable, no fluff.
Structure: Headline → By source → Debate movement → Thesis updates → Risks
Tone: Bloomberg terminal, not essay. Short sentences.
Length: 300–400 words
Avoid: Long explanations, background narrative
```

**ANALYTICAL** (Debate or Deep-Dive)
```
Voice: Thorough, balanced, explanatory
Structure: Question → Stakes → Side A → Side B → Gap → Timeline → Your edge
Tone: WSJ op-ed. Space for nuance and explanation
Length: 600–900 words
Avoid: Taking sides, hiding disagreement
```

**STRUCTURED** (Thesis Update)
```
Voice: Metric-focused, stage-aware
Structure: Stage → What moved → Remaining gates → Falsifiers → Objections → Numbers → Resolution
Tone: Investment memo. Bullet points acceptable
Length: 400–600 words per thesis
Avoid: Burying the stage or gates
```

**All templates:**
- Cite every claim with [link](original)
- Do not invent facts
- Distinguish authority from interpretation (TrendForce data vs. Dylan's take)
- Show disagreement explicitly
- Flag uncertainty in conviction and confidence

#### Acceptance (L9)

1. **Data fidelity:** Request a briefing on the DRAM Q3 debate. Every claim in the briefing appears verbatim in the corpus. No invented facts. (Run it; cross-check against Room 1.)

2. **Deduplication:** A 10-author briefing where three authors retweeted the same chart should show "TrendForce said X; retweeted by A, B, C" — once, not three times. (Verify the dedup rule fires and output is not duplicated.)

3. **Citation integrity:** Click five random claims in the briefing. Each links to the original content, span-highlighted or timestamp-anchored. (Demo the path; for video sources, verify the timestamp resolves to the right moment.)

4. **Multi-media synthesis:** A briefing covering the same fact across text, chart, and transcript should show the authoritative source first (anchor > verification > analyst), then note agreement/disagreement from other media, never repeat the same fact four times. (Verify hierarchy and no-repeat.)

5. **Uncertainty flagging:** The briefing says "Dylan (80% calibration, POSITIONED_MANAGER 0.5x weight)" not "Dylan says." Dispersion shows as ranges, not false consensus. (Visual check: is uncertainty visible or smoothed away?)

---

### ROOM 1 — The Stream (native content, annotated)

**What it is:** Chronological feed of raw ingested corpus, readable natively in each medium, annotated with intelligence.

#### Content-native rendering

- **Tweets/threads:** tweet-form cards — author (avatar, handle, class chip, org chip), full text, thread rendered as one unit, timestamps, **link to original**
- **Substack/articles:** title, author, excerpt, expandable full text, link out
- **Transcripts:** episode card, expandable transcript with **timestamped segments**, each extracted insight deep-links to its timestamp
- **Images/charts:** image rendered with VLM extraction (both routes' values, DUAL_ROUTE_MISMATCH range visible), ratification state, virality count, link to carrying post
- **External anchors:** bordered, org-badged — TrendForce releases, earnings excerpts read as *ground truth arriving*
- **Video clips:** 5–30 sec extracts with speaker + context (from YouTube extraction), playable inline, timestamped

#### Annotation layer

Intelligence renders *on top of* content, never instead:
- **Span highlights:** exact sentences that became insights are highlighted; hover/tap → extraction card appears in place
- **Margin chips:** event membership ("1 of 8 — SemiAnalysis memory report"), stance flag if content moved the author's baseline (MODERATING/REVERSING), debate flag if it's a position in a live debate, claim chip if it carries quantitative data
- Nothing hidden: content with zero extractions still appears; triage-discarded content is reachable via "show filtered" toggle

#### Stream controls

Filters: handle · org · epistemic class · medium · narrative family · has-claim · has-debate · stance-events-only · anchors-only. Saved views. Search (semantic + full-text over verbatim content). Infinite scroll, unread marker per session. **Mobile-first**.

#### Acceptance (experiential)

PS opens the Stream on a phone, reads 24 hours natively (tweets as tweets, transcripts expandable, charts visible), taps a span-highlight to see its extraction, follows a link to the original, toggles a saved view.

---

### ROOM 2 — The Debate Theater (disagreement as a first-class object)

**What it is:** Every debate as a rendered argument. What is the question, who says what (in their own words, linked), what's at stake, what resolves it, where does it stand?

#### Debate assembly (from existing machinery)

Auto-assembled from:
1. **MAGNITUDE:** QuantClaim dispersion on one metric where tails are far apart and credible
2. **DIRECTION:** ThesisEngagement rows — every SPECIFIC_OBJECTION is one side of a debate
3. **STANCE_COLLISION:** two tracked authors with opposing stances on one family

An LLM pass names the question plainly and drafts stakes (PS-editable, staged); everything else deterministic.

#### The Debate page (two columns + spine)

**Each side:**
- Its holders (avatar, class chip, org chip, calibration, book-talk indicator)
- Each holder's **actual quote** — the highlighted span from original, **linked to original tweet/timestamp**
- Quantitative positions shown on a shared RangeBar (both routes for VLM-derived claims)

**The spine:**
- Stakes paragraph (what changes if each side wins)
- Resolution clock (verification events with countdowns)
- Current state: dispersion trajectory (narrowing = converging), latest entries, stance changes *within* the debate (movement across the page), silence flags

**On resolution:**
- Passed event's actual print
- Verdict (which side was vindicated)
- Calibration consequence per holder

**Cross-links:** every position → its Stream content; every debate → theses it gates; every thesis card (Room 3) gains "live debates" chip.

#### Acceptance (experiential)

The DRAM Q3 debate (exists in data today) renders as the flagship: question stated plainly; Dylan's 40–50% with verbatim transcript quote deep-linked to timestamp; TrendForce/BofA on the other side as anchor-class; stakes naming the five memory theses; Jul 10/15/25 resolution clock; after Jul 25, resolved verdict with calibration consequences shown. Two taps from Stream reaches this page.

---

### ROOM 3 — Thesis Board (unchanged from original spec)

Five ladder columns: OBSERVATION | HYPOTHESIS | VALIDATED | ACTIONABLE | POSITIONED. Column headers display gate criteria. Each card shows counter strip (events / effectiveN / orgs / classes), contrarian chip, falsifier lights, verification countdown, divergence badge. Click → evidence drawer in place. Within-column sort by distance-to-promotion. Unchanged in substance; gains the integration with Rooms 1–2.

---

### ROOM 4 — Trade Layer (unchanged from Batch 3 rev.2)

Expressions, TradePlans, families, risk, paper ledger. Unchanged in substance; unchanged in gates. Unchanged.

---

## PART B: Automation Architecture (M1–M2 Enhanced)

### Definition of "automatic"

Seven consecutive untouched days: every registered source fetched to watermark, extraction run, events/stance/ladder recomputed, Stream shows day's content by morning, Health Strip green *because JobRuns say so*, anything needing PS sits in the queue. Anything short of this is not "automatic."

### The gaps being closed (in order)

1. **Provider rewiring** (13 straggler LLM call sites through `getProvider()`) — the deployed app's extraction comes alive. ~2–3 hrs, mechanical.
2. **Regex-price path kill** (+ CI sabotage test so it can't return a third time) — money-safety. ~30 min.
3. **RSS per-feed watermarks** — stop re-fetching everything daily. ~1 hr.
4. **X scraper adapter** (thread + QT/reply capture, per-handle watermarks) — fills Room 1, feeds echo machinery. ~6–8 hrs.
5. **Transcript auto-detection** (publish-watch on registered channels, not on-demand only). ~2 hrs.
6. **Hot-adapter promotion to a worker host** (when cadence demands exceed daily). Pre-written; fires when it fires.
7. **Seven-day unattended run** — formal acceptance, JobRun evidence.

### Jobs (explicit, not `setInterval`)

| Job | Cadence (current) | Does |
|---|---|---|
| adapters:rss | daily | fetch → raw store → checkpoints → triage → extract |
| adapters:x | daily (→ hourly when worker lands) | same |
| adapters:transcripts | daily + publish-watch | same |
| adapters:anchors | daily + release-calendar | anchor fetch, revisions, calendar proposals |
| pipeline:events | per batch | clustering, independence, org rule |
| pipeline:stance | per batch | per-event stance updates, change classification |
| monitor:falsifiers | per batch | screen → assess-on-hit → consequences |
| engine:ladder | per batch | counters + stage recompute, snapshots |
| monitor:verifications | daily | passed events → claim resolution → calibration |
| ops:scorecard | weekly | checkpoint 11 |
| ops:backup | nightly | dump → off-box, 14-day retention |

Every run writes a `JobRun` row. AdapterHealth/strip state derives from JobRun records, not reachability.

---

## PART C: Video Extraction (M3 Enhancement)

### The problem

YouTube transcripts are text, but currently treated as generic text. Missing:
- **Timestamp anchoring:** every claim links to MM:SS in the video
- **Speaker identification:** who said it (earnings calls have multiple speakers)
- **Visual context:** the speaker references a chart; the system needs to know
- **Quote verification:** can you watch the moment being cited?

### Schema additions

```prisma
model RawContent {
  // existing
  // + new for video
  mediaType String /* TEXT | VIDEO_TRANSCRIPT | CHART_IMAGE | AUDIO_TRANSCRIPT */
  videoUrl String?; videoDuration Int?
  transcriptStorage String?
  hasSpeakerLabels Boolean @default(false)
  hasTimestamps Boolean @default(false)
}

model Source {
  // existing
  // + new for video
  sourceMediaType String /* TEXT_QUOTE | VIDEO_CLIP | EARNINGS_CALL | PODCAST_SEGMENT | CHART_REFERENCE */
  videoTimestampStart Int?; videoTimestampEnd Int?  // seconds
  videoClipRef String?  // storage ref to 5–30 sec extracted clip
  speaker String?; speakerTitle String?
  visualContext String?  // "slide 5 showed capex waterfall"
  visualRef String?
}

model VideoClip {
  id String @unique
  sourceId String
  videoUrl String; timestampStart Int; timestampEnd Int
  duration Int  // seconds
  storageRef String
  extractedAt DateTime
}
```

### Extraction pipeline

**Step 0:** Fetch transcript with speaker labels + timing metadata

**Step 1:** Chunk by speaker-turn + timestamp window (~2–3 min chunks); extract with context

```
Speaker: [NAME] ([TITLE])
Context: [30s before]
[SEGMENT]
[30s after]

Extract insights with: direction, conviction, claim, entities, visual context (if speaker references a chart).
```

**Step 2:** Anchor results — every insight gets videoTimestampStart/End, speaker, visualContext

**Step 3 (async, optional):** Extract 5–30 sec video clips for high-conviction insights from earnings calls; store and link

**Step 4 (checkpoint 3 adapted):** Timestamp exists and in-bounds, speaker identified, quote appears in transcript near timestamp, visual context references are real

### Acceptance (L9)

1. **Timestamp anchor accuracy:** Extract from 10-min call. Jump to timestamp in video; speaker is saying the quoted text. No >5-second drift.

2. **Speaker identification:** Multi-speaker call (3 speakers). Every insight tagged with right speaker.

3. **Visual context:** Earnings call with slides. Insight references "capex waterfall slide." Extraction noted the visual.

4. **Quote verification:** Sample 5 insights. Each quote exists in transcript at given timestamp.

5. **Intra-source stance isolation:** 60-min analyst call. Extracted insights maintain speaker identity. No spurious REVERSING alerts from phrasing variation.

---

## PART D: Multi-Media Synthesis Rules + Deduplication

### 1. Tweet deduplication

**Rule (deterministic, in Composition Engine):**

When an event contains mostly ECHO (>2 simple retweets of one source), render as "originator + count" not separate entries:

```
if (event.membersByType.ECHO > 2 && event.membersByType.ORIGIN === 1) {
  renderAsOriginPlusEcho(event)  // "TrendForce said X; retweeted by 5 tracked authors"
} else {
  renderAsMultipleSources(event)
}
```

**Schema addition (M4):**
- `sourceUrlHash` on InformationEvent (for exact-duplicate collapse)
- `membersByType Json` (counts per class)
- `mentionIds Json` (all sources that reference this event)

### 2. Multi-media synthesis

**Hierarchy (deterministic):**
1. External anchor (TrendForce, SEC, company statement)
2. Verification event outcome (actual print, real data)
3. High-calibration primary analyst (>75%, non-positioned)
4. Positioned analyst (discounted by book-talk weight)
5. Synthesizer or low-calibration (lowest weight)

**Rule (Composition Engine):**
- Show highest-authority source for each claim
- Reference lower-authority sources only if they add new angle/disagreement/time-shifted update
- Don't repeat the same fact multiple times in different words

**LLM guidance (Prose Writer system prompt addition):**
```
When multiple media cover the same thing:
1. Show authoritative source first (see the hierarchy in the data)
2. Note agreement ("confirmed by [other]") or disagreement ("but Dylan contests")
3. Distinguish: authoritative data vs. analyst interpretation
4. Do not repeat the same fact multiple times
```

### Acceptance (L9)

1. **Dedup:** Briefing covering a period when three authors retweeted the same chart shows "one thing with amplification," not three separate things.

2. **Multi-media:** Event with TrendForce text + chart + Dylan's tweet + earnings call print reads as "TrendForce says X (confirmed by earnings), Dylan interprets it as Y (disagreement)" — one narrative, not four repetitions.

---

## PART E: Sequencing and Effort

### Current sprint (Rooms 0–2, automation criticals, v2.1)

| Step | Item | Est. | Blocker |
|---|---|---|---|
| 1 | Admission ticket + regression baseline | — | Nothing before this |
| 2 | Provider rewiring + regex kill + RSS watermarks | 4 hrs | Safety + deployment alive |
| 3 | Span anchoring + backfill | 4 hrs | Rooms 1–2 can't exist without it |
| 4 | ROOM 1 — The Stream | 6 hrs | Experiential acceptance |
| 5 | ROOM 2 — Debate Theater | 5 hrs | DRAM flagship renders from existing data |
| 6 | X adapter + transcript watch + seven-day run | 8 hrs | Formal "automatic" acceptance |

**Subtotal:** ~27 hours focused build. Rooms 1–2 live before July 25, system's first resolved debate on the board.

### Post-July (Room 0, Briefing Composer, video extraction, templates)

| Step | Item | Est. | Depends on |
|---|---|---|---|
| 7 | ROOM 0 — Setup (source registry + preferences) | 5 hrs | Base platform stable |
| 8 | M3 video extraction (timestamps, speakers, clips) | 6 hrs | Parallel to 7 |
| 9 | Briefing Composer (query + composition engines) | 4 hrs | After 7, 8 |
| 10 | Prompt templates (4 system prompts) | 2 hrs | With 9 |
| 11 | Dedup + multi-media synthesis rules | 2 hrs | Before Composer ships |
| 12 | Acceptance + hardening | 4 hrs | After 9–11 |

**Subtotal:** ~23 hours. Composer live ~2 weeks post-July.

**Total from now through Composer shipping: ~50 hours focused build.**

---

## PART F: Acceptance Criteria (consolidated L9 tests)

### Safety

1. **Regex-price CI gate:** Code that writes a price field without `priceSource ∈ {market-data, manual}` fails the build. (Run the build; introduce the violation; show it fails.)
2. **Dedup fidelity:** Briefing with repeated facts shows each fact once. (Run it; count occurrences.)
3. **Citation integrity:** Five random briefing claims link to originals, span-highlighted. (Follow each link.)

### Fidelity

4. **No invented facts:** Compare briefing to the Stream; every claim appears in the corpus. (Cross-check.)
5. **Authority visible:** Brief says "Dylan (80% calibration, 0.5x weight)" not "Dylan says." Dispersion shows ranges. (Visual inspection.)
6. **Debate rendering:** DRAM briefing structures as Q → stakes → sides → gap → timeline. All parts visible on first read. (Skim it.)

### Media richness

7. **Video timestamp:** Extract from 10-min call. Jump to timestamp; speaker is saying the quote. (Watch it.)
8. **Room 1 native:** Tweet is tweet-form, thread is continuous, transcript is expandable, chart is visible, clip is playable. (Open each.)

### Automation

9. **Seven-day unattended:** No human touches the system for 7 days; on day 8, Health Strip is green, Stream shows content, JobRuns prove it executed. (Show the JobRun records.)

---

## PART G: Design Principles (Unchanged Laws L1–L14)

Every law from the v2 Spec holds. This addendum adds no new data machinery — it's pure synthesis, composition, and presentation of already-audited layers. The intelligence is never new; the legibility is.

**The governing principle:** The operator must be able to read the reality the system reasons about. Intelligence that cannot be seen next to its source is not trusted. Intelligence that is not trusted is not used.

