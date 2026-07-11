// NIP v2.x — Briefing Composer (Room 0.5, Part A of Consolidated Addendum)
//
// Architecture:
//   BriefingRequest → Query Engine (filter corpus) → Composition Engine
//   (arrange by template) → Prose Writer (LLM role 4 only) → Output Layer
//
// Prose layer only — no new analysis, no LLM judgment, no gate-making.
// Every claim in the briefing appears verbatim in the corpus. No invented facts.

import { db } from "./db";
import { complete, type TaskType } from "./provider";
import { getAuthorityWeight } from "./author";
import { PROSE_TEMPLATES, BRIEFING_TEMPLATES, type BriefingTemplate, type ProseTemplate } from "./prompt-templates";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Query Engine — filter the corpus per the BriefingRequest
// ─────────────────────────────────────────────────────────────────────

export async function queryCorpus(req: {
  authors?: string[];
  orgAffiliations?: string[];
  entities?: string[];
  narrativeFamilies?: string[];
  search?: string;
  since?: Date;
  until?: Date;
  includeDebates?: boolean;
  includeTheses?: boolean;
  includeClaims?: boolean;
  includeStanceChanges?: boolean;
}) {
  // Build source filter
  const sourceWhere: any = {};
  if (req.since || req.until) {
    sourceWhere.dateLatest = {};
    if (req.since) sourceWhere.dateLatest.gte = req.since;
    if (req.until) sourceWhere.dateLatest.lte = req.until;
  }

  // Author filter
  if (req.authors && req.authors.length > 0) {
    const authors = await db.author.findMany({
      where: { handle: { in: req.authors } },
      select: { id: true },
    });
    sourceWhere.authorId = { in: authors.map(a => a.id) };
  }

  // Search filter
  if (req.search) {
    sourceWhere.OR = [
      { verbatimQuote: { contains: req.search, mode: "insensitive" } },
      { keyInsight: { contains: req.search, mode: "insensitive" } },
    ];
  }

  const sources = await db.source.findMany({
    where: sourceWhere,
    include: {
      rawContent: true,
      author: true,
      quantClaims: true,
      informationEvent: true,
    },
    orderBy: { dateLatest: "desc" },
    take: 200,
  });

  // Theses
  let theses: any[] = [];
  if (req.includeTheses) {
    const thesisWhere: any = {};
    if (req.narrativeFamilies && req.narrativeFamilies.length > 0) {
      thesisWhere.narrativeFamily = { in: req.narrativeFamilies };
    }
    theses = await db.thesis.findMany({
      where: thesisWhere,
      include: { engagements: true, quantClaims: true },
      orderBy: { stage: "asc" },
      take: 20,
    });
  }

  // Debates
  let debates: any[] = [];
  if (req.includeDebates) {
    debates = await db.debate.findMany({
      where: { status: { in: ["LIVE", "RESOLVING"] } },
      include: {
        positions: { include: { source: { include: { rawContent: true } }, quantClaims: true } },
        theses: true,
        resolutionEvents: true,
      },
      orderBy: { heatScore: "desc" },
      take: 10,
    });
  }

  // Claims
  let claims: any[] = [];
  if (req.includeClaims) {
    claims = await db.quantClaim.findMany({
      where: { resolvedValue: null },
      include: { source: { include: { rawContent: true } } },
      orderBy: { claimedAt: "desc" },
      take: 30,
    });
  }

  // Stance changes
  let stanceChanges: any[] = [];
  if (req.includeStanceChanges) {
    stanceChanges = await db.stanceChange.findMany({
      where: { createdAt: { gte: req.since ?? new Date(Date.now() - 7 * 86400_000) } },
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  return { sources, theses, debates, claims, stanceChanges };
}

// ─────────────────────────────────────────────────────────────────────
// Dedup Engine — collapse echoes, show originator + count
// v2x Part D: "When event contains mostly ECHO (>2 simple retweets of one
// source), render as 'originator + count' not separate entries"
// ─────────────────────────────────────────────────────────────────────

export function dedupSources(sources: any[]): {
  deduped: any[];
  dedupedCount: number;
} {
  const byEvent = new Map<string, any[]>();
  const standalone: any[] = [];

  for (const src of sources) {
    if (!src.informationEventId) {
      standalone.push(src);
      continue;
    }
    const list = byEvent.get(src.informationEventId) ?? [];
    list.push(src);
    byEvent.set(src.informationEventId, list);
  }

  const deduped: any[] = [...standalone];
  let dedupedCount = 0;

  for (const [eventId, group] of byEvent) {
    const echoes = group.filter(s => s.independenceClass === "ECHO");
    const origins = group.filter(s => s.independenceClass === "ORIGIN" || s.independenceClass === "INDEPENDENT");

    if (echoes.length > 2 && origins.length >= 1) {
      // Collapse: show originator + echo count
      deduped.push({
        ...origins[0],
        _deduped: true,
        _echoCount: echoes.length,
        _echoAuthors: echoes.map(e => e.author?.handle).filter(Boolean),
      });
      dedupedCount += echoes.length;
    } else {
      deduped.push(...group);
    }
  }

  return { deduped, dedupedCount };
}

// ─────────────────────────────────────────────────────────────────────
// Multi-media hierarchy — anchor > verification > analyst > synthesizer
// v2x Part D: "Show highest-authority source for each claim"
// ─────────────────────────────────────────────────────────────────────

const HIERARCHY = {
  EXTERNAL_ANCHOR: 0,
  VERIFICATION: 1,
  HIGH_CALIBRATION_PRIMARY: 2,
  POSITIONED_ANALYST: 3,
  SYNTHESIZER: 4,
};

export function rankByAuthority(source: any): number {
  if (source.sourceClass === "EXTERNAL_ANCHOR" || source.author?.handle === "TrendForce") return HIERARCHY.EXTERNAL_ANCHOR;
  if (source.author?.forecastsResolved >= 5 && source.author?.epistemicClass !== "POSITIONED_MANAGER") {
    const correctRate = source.author.forecastsResolved > 0
      ? source.author.forecastsCorrect / source.author.forecastsResolved
      : 0;
    if (correctRate > 0.75) return HIERARCHY.HIGH_CALIBRATION_PRIMARY;
  }
  if (source.author?.epistemicClass === "POSITIONED_MANAGER") return HIERARCHY.POSITIONED_ANALYST;
  if (source.author?.epistemicClass === "SYNTHESIZER") return HIERARCHY.SYNTHESIZER;
  return HIERARCHY.HIGH_CALIBRATION_PRIMARY;
}

// ─────────────────────────────────────────────────────────────────────
// Composition Engine — arrange data by template
// ─────────────────────────────────────────────────────────────────────

export function composeBriefingData(
  template: BriefingTemplate,
  data: { sources: any[]; theses: any[]; debates: any[]; claims: any[]; stanceChanges: any[] },
  dedupedCount: number
): string {
  const tmpl = BRIEFING_TEMPLATES[template];
  const sections: string[] = [];

  // Apply dedup
  const { deduped, dedupedCount: dc } = dedupSources(data.sources);

  // Sort sources by authority hierarchy
  const sortedSources = [...deduped].sort((a, b) => rankByAuthority(a) - rankByAuthority(b));

  switch (template) {
    case "daily-standup":
      // Headline
      const topSource = sortedSources[0];
      if (topSource) {
        sections.push(`## Headline\n\n${topSource.keyInsight}`);
      }

      // By source
      sections.push("## By Source\n");
      for (const src of sortedSources.slice(0, 15)) {
        const author = src.author;
        const weight = author ? getAuthorityWeight(author).toFixed(2) : "1.00";
        const dedupNote = src._deduped ? ` (retweeted by ${src._echoCount} tracked authors)` : "";
        sections.push(`- **${author?.realName ?? "Unknown"}** (@${author?.handle}, ${author?.epistemicClass}, ${weight} weight): ${src.keyInsight}${dedupNote} [source](${src.rawContent?.url})`);
      }

      // Debate movement
      if (data.debates.length > 0) {
        sections.push("\n## Debate Movement\n");
        for (const d of data.debates.slice(0, 5)) {
          sections.push(`- **${d.question}** (${d.status}, heat ${d.heatScore})`);
        }
      }

      // Thesis updates
      if (data.theses.length > 0) {
        sections.push("\n## Thesis Updates\n");
        for (const t of data.theses.slice(0, 10)) {
          sections.push(`- **[${t.stage}] ${t.title}** — effN ${t.effectiveN}, ${t.armedFalsifiers} falsifiers armed`);
        }
      }

      // Risks
      if (data.stanceChanges.length > 0) {
        sections.push("\n## Risks\n");
        const reversals = data.stanceChanges.filter(s => s.changeType === "REVERSING");
        for (const sc of reversals.slice(0, 5)) {
          sections.push(`- **${sc.author?.realName}** REVERSING on ${sc.narrativeFamily} (magnitude ${sc.magnitude.toFixed(2)})`);
        }
      }
      break;

    case "debate-briefing":
      if (data.debates.length === 0) {
        sections.push("No live debates in the requested period.");
        break;
      }
      for (const d of data.debates.slice(0, 3)) {
        sections.push(`## ${d.question}\n`);
        sections.push(`**Stakes:** ${d.stakes}\n`);

        const sideA = d.positions?.filter((p: any) => p.side === "A") ?? [];
        const sideB = d.positions?.filter((p: any) => p.side === "B") ?? [];

        sections.push("### Side A");
        for (const p of sideA) {
          sections.push(`- **${p.authorName}** (${p.orgId}): ${p.statement} [source](${p.source?.rawContent?.url})`);
        }

        sections.push("\n### Side B");
        for (const p of sideB) {
          sections.push(`- **${p.authorName}** (${p.orgId}): ${p.statement} [source](${p.source?.rawContent?.url})`);
        }

        if (d.resolutionEvents?.length > 0) {
          sections.push("\n### Timeline");
          for (const ev of d.resolutionEvents) {
            sections.push(`- ${new Date(ev.date).toLocaleDateString()}: ${ev.eventType}`);
          }
        }
        sections.push("");
      }
      break;

    case "thesis-update":
      for (const t of data.theses.slice(0, 5)) {
        sections.push(`## ${t.title}\n`);
        sections.push(`**Stage:** ${t.stage}`);
        sections.push(`**Counters:** ${t.independentEvents} independent events, effN ${t.effectiveN}, ${t.distinctOrgs} orgs, ${t.epistemicClassCount} classes`);
        sections.push(`**Falsifiers:** ${t.armedFalsifiers} armed`);
        sections.push(`**Contrarian:** ${t.contrarianStatus}`);
        if (t.divergenceVerdict !== "UNKNOWN") {
          sections.push(`**Divergence:** ${t.divergenceVerdict}`);
        }
        sections.push("");
      }
      break;

    case "topic-deepdive":
      sections.push("## Topic Deep-Dive\n");
      sections.push(`**Sources found:** ${sortedSources.length} (${dedupedCount + dc} echoes deduped)`);
      sections.push(`**Debates:** ${data.debates.length}`);
      sections.push(`**Claims:** ${data.claims.length}`);
      sections.push(`**Theses:** ${data.theses.length}\n`);

      if (data.claims.length > 0) {
        sections.push("### Quantitative Claims\n");
        for (const c of data.claims.slice(0, 10)) {
          sections.push(`- ${c.metricName}: ${c.valueLow}–${c.valueHigh}${c.unit === "PERCENT" ? "%" : ""} (${c.confidence})`);
        }
      }
      break;

    case "custom":
      sections.push("## Custom Briefing\n");
      sections.push(`Data: ${sortedSources.length} sources, ${data.theses.length} theses, ${data.debates.length} debates`);
      break;
  }

  return sections.join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// Prose Writer — LLM role 4 only (write coherent narrative)
// ─────────────────────────────────────────────────────────────────────

const proseSchema = z.object({
  briefing: z.string(),
  wordCount: z.number(),
});

export async function composeBriefing(req: {
  template: BriefingTemplate;
  proseTemplate: ProseTemplate;
  authors?: string[];
  orgAffiliations?: string[];
  entities?: string[];
  narrativeFamilies?: string[];
  search?: string;
  since?: Date;
  until?: Date;
  length: "short" | "medium" | "long";
  includeDebates: boolean;
  includeTheses: boolean;
  includeClaims: boolean;
  includeStanceChanges: boolean;
  format: "html" | "markdown" | "pdf" | "email";
  includeLinks: boolean;
}): Promise<{
  content: string;
  wordCount: number;
  claimsCited: number;
  sourcesCited: number;
  dedupedCount: number;
}> {
  // Step 1: Query Engine
  const data = await queryCorpus(req);

  // Step 2: Composition Engine
  const composed = composeBriefingData(req.template, data, 0);
  const { dedupedCount } = dedupSources(data.sources);

  // Step 3: Prose Writer — LLM role 4 only
  const prosePrompt = PROSE_TEMPLATES[req.proseTemplate] ?? PROSE_TEMPLATES.fast;
  const tmplInfo = BRIEFING_TEMPLATES[req.template];

  const systemPrompt = `${prosePrompt}

Template: ${tmplInfo.name}
Structure:
${tmplInfo.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Compose a briefing from the audited data below. Do NOT invent facts. Every claim must come from the data. Return {briefing: string, wordCount: number}.

Data:
${composed}`;

  const result = await complete({
    taskType: "NAME_DEBATE" as TaskType, // reuse for prose generation
    prompt: {
      id: `briefing/${req.template}/v1`,
      template: systemPrompt,
    },
    schema: proseSchema,
    cacheKey: `briefing:${req.template}:${req.search ?? "all"}:${req.since?.getTime() ?? 0}`,
  });

  const parsed = proseSchema.safeParse(result.data);
  const briefing = parsed.success ? parsed.data.briefing : composed;
  const wordCount = parsed.success ? parsed.data.wordCount : briefing.split(/\s+/).length;

  return {
    content: briefing,
    wordCount,
    claimsCited: data.claims.length,
    sourcesCited: data.sources.length,
    dedupedCount,
  };
}
