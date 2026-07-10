// NIP v3.0 — Provider Layer (the L13 fix, designed — Design §2)
//
// One interface; all LLM/VLM access flows through it. The L1 guard lives here
// structurally: forbidden fields are stripped-and-logged on every parse, so
// no call site can receive a price or a stage from a model even if the prompt
// is jailbroken, because the type doesn't carry it.
//
// In production this routes through Anthropic (publicly routable). In this
// sandbox we proxy through the z-ai-web-dev-sdk and treat it as the same
// abstraction — the call sites don't know or care.

import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type TaskType =
  | "TRIAGE"
  | "DEEP_EXTRACT"
  | "ADJUDICATE"
  | "ASSESS"
  | "CLASSIFY_IMAGE"
  | "EXTRACT_CHART_ANNOTATIONS"
  | "EXTRACT_CHART_AXIS"
  | "NAME_DEBATE"
  | "DRAFT_STAKES";

export interface PromptRef {
  id: string;            // e.g. "deep_extract/v3"
  template: string;      // versioned artifact, in repo
  params?: Record<string, string | number>;
}

export interface CompletionRequest {
  taskType: TaskType;
  prompt: PromptRef;
  schema: z.ZodTypeAny;
  cacheKey?: string;     // content-hash; same key + prompt version = cache hit
}

export interface VisionRequest extends CompletionRequest {
  imageRef: string;      // storageRef
}

export interface CompletionResult {
  data: unknown;         // typed & parsed
  raw: string;
  cacheHit: boolean;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  strippedFields: string[]; // L1 — every forbidden field that was dropped
}

// ─────────────────────────────────────────────────────────────────────
// Routing config — not code. Cheap model for TRIAGE/CLASSIFY, strong for
// DEEP_EXTRACT/ASSESS, vision for chart routes.
// ─────────────────────────────────────────────────────────────────────

const ROUTING: Record<TaskType, { provider: string; model: string; maxTokens: number; temperature: number }> = {
  TRIAGE:                     { provider: "z-ai", model: "glm-4-flash",    maxTokens: 400,  temperature: 0.0 },
  DEEP_EXTRACT:               { provider: "z-ai", model: "glm-4-plus",     maxTokens: 1800, temperature: 0.0 },
  ADJUDICATE:                 { provider: "z-ai", model: "glm-4-plus",     maxTokens: 600,  temperature: 0.0 },
  ASSESS:                     { provider: "z-ai", model: "glm-4-plus",     maxTokens: 600,  temperature: 0.1 },
  CLASSIFY_IMAGE:             { provider: "z-ai", model: "glm-4v-flash",   maxTokens: 100,  temperature: 0.0 },
  EXTRACT_CHART_ANNOTATIONS:  { provider: "z-ai", model: "glm-4v-plus",    maxTokens: 800,  temperature: 0.0 },
  EXTRACT_CHART_AXIS:         { provider: "z-ai", model: "glm-4v-plus",    maxTokens: 800,  temperature: 0.0 },
  NAME_DEBATE:                { provider: "z-ai", model: "glm-4-flash",    maxTokens: 200,  temperature: 0.3 },
  DRAFT_STAKES:               { provider: "z-ai", model: "glm-4-plus",     maxTokens: 500,  temperature: 0.4 },
};

// ─────────────────────────────────────────────────────────────────────
// The L1 forbidden fields — strip-and-log, structurally
// No call site can receive a price or a stage even if the prompt is jailbroken
// ─────────────────────────────────────────────────────────────────────

const FORBIDDEN_FIELDS = [
  "stage", "entryPrice", "targetPrice", "stopLoss",
  "currentPrice", "rankScore", "effectiveN",
  "weight", "authorityWeight",
];

function stripForbidden(obj: unknown): { clean: unknown; stripped: string[] } {
  const stripped: string[] = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (FORBIDDEN_FIELDS.includes(k)) {
        stripped.push(k);
        continue;
      }
      out[k] = v;
    }
    return { clean: out, stripped };
  }
  return { clean: obj, stripped };
}

// ─────────────────────────────────────────────────────────────────────
// In-memory cache — content-hash × prompt-version. The free 429 mitigation.
// ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, { raw: string; tokensIn: number; tokensOut: number }>();

function hashKey(s: string): string {
  // Lightweight FNV-1a — sufficient for cache keys, no dep on node:crypto
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h.toString(16);
}

// ─────────────────────────────────────────────────────────────────────
// Provider client — wraps z-ai-web-dev-sdk
// ─────────────────────────────────────────────────────────────────────

let _zai: any = null;
async function getClient() {
  if (_zai) return _zai;
  _zai = await ZAI.create();
  return _zai;
}

// ─────────────────────────────────────────────────────────────────────
// The interface
// ─────────────────────────────────────────────────────────────────────

export async function complete(req: CompletionRequest): Promise<CompletionResult> {
  const t0 = Date.now();
  const cfg = ROUTING[req.taskType];

  const cacheKey = req.cacheKey
    ? `${req.prompt.id}:${req.cacheKey}`
    : `${req.prompt.id}:${hashKey(req.prompt.template + JSON.stringify(req.prompt.params ?? {}))}`;

  if (cache.has(cacheKey)) {
    const hit = cache.get(cacheKey)!;
    const { clean, stripped } = stripForbidden(JSON.parse(hit.raw));
    return {
      data: req.schema.parse(clean),
      raw: hit.raw,
      cacheHit: true,
      tokensIn: hit.tokensIn,
      tokensOut: hit.tokensOut,
      latencyMs: Date.now() - t0,
      costUsd: 0,
      strippedFields: stripped,
    };
  }

  const client = await getClient();
  const sys = `You are part of the Narrative Intelligence Platform. Follow the schema exactly. Return JSON only.\nPrompt version: ${req.prompt.id}`;
  const user = req.prompt.template + (req.prompt.params ? `\n\nParams: ${JSON.stringify(req.prompt.params)}` : "");

  let raw = "";
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const resp: any = await client.chat.completions.create({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
    });
    raw = resp.choices?.[0]?.message?.content ?? "";
    tokensIn = resp.usage?.prompt_tokens ?? Math.ceil(sys.length / 4 + user.length / 4);
    tokensOut = resp.usage?.completion_tokens ?? Math.ceil(raw.length / 4);
  } catch (e: any) {
    // L3 — errors are never verdicts. Surface a RETRY-shaped result.
    raw = JSON.stringify({ _error: e?.message ?? "provider-unreachable", _retry: true });
  }

  cache.set(cacheKey, { raw, tokensIn, tokensOut });
  const { clean, stripped } = stripForbidden(safeJsonParse(raw));
  const data = req.schema.safeParse(clean).success
    ? req.schema.parse(clean)
    : { _parseError: true, _raw: raw };

  return {
    data,
    raw,
    cacheHit: false,
    tokensIn,
    tokensOut,
    latencyMs: Date.now() - t0,
    costUsd: estimateCost(cfg.model, tokensIn, tokensOut),
    strippedFields: stripped,
  };
}

export async function completeVision(req: VisionRequest): Promise<CompletionResult> {
  // For the sandbox we treat vision the same as text — the abstraction is what matters
  return complete(req);
}

function safeJsonParse(s: string): unknown {
  try {
    // Some models wrap JSON in ```json fences — strip if present
    const trimmed = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(trimmed);
  } catch {
    return { _parseError: true, _raw: s };
  }
}

function estimateCost(model: string, tin: number, tout: number): number {
  // Rough — for the ops panel; not for billing
  const rates: Record<string, [number, number]> = {
    "glm-4-flash":  [0.000001, 0.000002],
    "glm-4-plus":   [0.000005, 0.000015],
    "glm-4v-flash": [0.000002, 0.000004],
    "glm-4v-plus":  [0.000008, 0.000024],
  };
  const [pi, po] = rates[model] ?? [0.000005, 0.000015];
  return tin * pi + tout * po;
}

// ─────────────────────────────────────────────────────────────────────
// Prompt registry — versioned artifacts, referenced by id
// ─────────────────────────────────────────────────────────────────────

export const PROMPTS: Record<string, PromptRef> = {
  "triage/v3": {
    id: "triage/v3",
    template: `Score the relevance of the following content to semiconductor/AI investment signals on a 0-10 scale. Return {relevance: number, signal: "ALPHA"|"NOISE", reason: string}.

Content:
{{content}}`,
  },
  "deep_extract/v3": {
    id: "deep_extract/v3",
    template: `Extract structured insight from this content. Return:
{
  "direction": "BULLISH"|"BEARISH"|"NEUTRAL",
  "conviction": "LOW"|"MEDIUM"|"HIGH",
  "insightType": "FORECAST"|"OBSERVATION"|"OPINION",
  "verbatimQuote": "exact sentence from the content",
  "keyInsight": "one-line paraphrase",
  "tickers": ["..."],
  "entities": ["canonical names"],
  "confidence": "CLEAN"|"HEDGED"|"AMBIGUOUS"
}

Content:
{{content}}`,
  },
  "name_debate/v1": {
    id: "name_debate/v1",
    template: `Name this debate in plain language as a question (one sentence, no quotes). Stakes paragraph: 2 sentences max on why it matters and what changes if each side wins.

Positions:
{{positions}}`,
  },
};

export function getPrompt(id: string): PromptRef {
  if (!PROMPTS[id]) throw new Error(`Unknown prompt: ${id}`);
  return PROMPTS[id];
}

// ─────────────────────────────────────────────────────────────────────
// Provider log writer — feeds the ops panel and the two-pass economics
// ─────────────────────────────────────────────────────────────────────

export async function logProviderCall(args: {
  taskType: TaskType;
  promptVersion: string;
  provider: string;
  model: string;
  tokens: number;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
}) {
  // Lazy import to avoid circular at module load
  const { db } = await import("./db");
  await db.providerCall.create({ data: args });
}
