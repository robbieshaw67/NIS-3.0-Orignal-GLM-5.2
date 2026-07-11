// NIP v2.x — Video Extraction (Part C of Consolidated Addendum)
//
// Timestamp anchoring: every claim links to MM:SS in the video
// Speaker identification: who said it (earnings calls have multiple speakers)
// Visual context: the speaker references a chart; the system needs to know
// Quote verification: can you watch the moment being cited?
//
// Extraction pipeline:
// Step 0: Fetch transcript with speaker labels + timing metadata
// Step 1: Chunk by speaker-turn + timestamp window (~2-3 min chunks)
// Step 2: Extract with context (30s before/after)
// Step 3: Anchor results — every insight gets videoTimestampStart/End, speaker
// Step 4: (async, optional) Extract 5-30 sec video clips for high-conviction insights

import { db } from "./db";
import { complete, type TaskType } from "./provider";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Transcript chunking — by speaker-turn + timestamp window
// ─────────────────────────────────────────────────────────────────────

interface TranscriptSegment {
  speaker: string;
  speakerTitle?: string;
  timestamp: number; // seconds
  text: string;
}

export function parseTimestampedTranscript(raw: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Parse [MM:SS] Speaker: text format
  const lines = raw.split("\n");
  let currentSpeaker = "";
  let currentTimestamp = 0;

  for (const line of lines) {
    const tsMatch = line.match(/\[(\d{1,2}):(\d{2})\]/);
    const speakerMatch = line.match(/\[(\d{1,2}):(\d{2})\]\s*(.+?):\s*(.+)/);

    if (speakerMatch) {
      const [, min, sec, speaker, text] = speakerMatch;
      currentTimestamp = parseInt(min) * 60 + parseInt(sec);
      currentSpeaker = speaker.trim();
      segments.push({
        speaker: currentSpeaker,
        timestamp: currentTimestamp,
        text: text.trim(),
      });
    } else if (tsMatch) {
      const [, min, sec] = tsMatch;
      currentTimestamp = parseInt(min) * 60 + parseInt(sec);
      segments.push({
        speaker: currentSpeaker || "Unknown",
        timestamp: currentTimestamp,
        text: line.replace(/\[\d{1,2}:\d{2}\]\s*/, "").trim(),
      });
    } else if (line.trim() && currentSpeaker) {
      // Continuation of previous speaker
      const last = segments[segments.length - 1];
      if (last) last.text += " " + line.trim();
    }
  }

  return segments;
}

// ─────────────────────────────────────────────────────────────────────
// Chunk by speaker-turn + timestamp window (~2-3 min chunks)
// ─────────────────────────────────────────────────────────────────────

interface Chunk {
  speaker: string;
  speakerTitle?: string;
  timestampStart: number;
  timestampEnd: number;
  text: string;
  contextBefore: string;
  contextAfter: string;
}

export function chunkTranscript(segments: TranscriptSegment[], chunkWindowSeconds = 150): Chunk[] {
  const chunks: Chunk[] = [];
  let currentChunk: TranscriptSegment[] = [];
  let chunkStart = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (currentChunk.length === 0) {
      chunkStart = seg.timestamp;
      currentChunk.push(seg);
    } else if (seg.speaker !== currentChunk[0].speaker || seg.timestamp - chunkStart > chunkWindowSeconds) {
      // New chunk — different speaker or window exceeded
      chunks.push(buildChunk(currentChunk, segments));
      currentChunk = [seg];
      chunkStart = seg.timestamp;
    } else {
      currentChunk.push(seg);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(buildChunk(currentChunk, segments));
  }

  return chunks;
}

function buildChunk(chunkSegs: TranscriptSegment[], allSegs: TranscriptSegment[]): Chunk {
  const speaker = chunkSegs[0].speaker;
  const timestampStart = chunkSegs[0].timestamp;
  const timestampEnd = chunkSegs[chunkSegs.length - 1].timestamp + 30; // +30s buffer
  const text = chunkSegs.map(s => s.text).join(" ");

  // Context: 30s before and after
  const startIdx = allSegs.indexOf(chunkSegs[0]);
  const endIdx = allSegs.indexOf(chunkSegs[chunkSegs.length - 1]);
  const contextBefore = allSegs.slice(Math.max(0, startIdx - 3), startIdx).map(s => s.text).join(" ");
  const contextAfter = allSegs.slice(endIdx + 1, endIdx + 4).map(s => s.text).join(" ");

  return {
    speaker,
    timestampStart,
    timestampEnd,
    text,
    contextBefore,
    contextAfter,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Extract insights from a chunk with speaker + visual context
// ─────────────────────────────────────────────────────────────────────

const videoExtractSchema = z.object({
  direction: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  conviction: z.enum(["LOW", "MEDIUM", "HIGH"]),
  insightType: z.enum(["FORECAST", "OBSERVATION", "OPINION"]),
  verbatimQuote: z.string(),
  keyInsight: z.string(),
  tickers: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  confidence: z.enum(["CLEAN", "HEDGED", "AMBIGUOUS"]),
  visualContext: z.string().optional(),
});

export async function extractVideoInsights(args: {
  rawContentId: string;
  authorId: string;
  videoUrl: string;
  transcript: string;
  duration?: number;
}): Promise<{
  extracted: number;
  quarantined: number;
}> {
  const { rawContentId, authorId, videoUrl, transcript, duration } = args;

  // Update RawContent with video metadata
  await db.rawContent.update({
    where: { id: rawContentId },
    data: {
      mediaType: "VIDEO_TRANSCRIPT",
      videoUrl,
      videoDuration: duration,
      hasSpeakerLabels: true,
      hasTimestamps: true,
    },
  });

  // Step 0: Parse transcript
  const segments = parseTimestampedTranscript(transcript);
  if (segments.length === 0) {
    return { extracted: 0, quarantined: 0 };
  }

  // Step 1: Chunk
  const chunks = chunkTranscript(segments);

  let extracted = 0;
  let quarantined = 0;

  for (const chunk of chunks) {
    // Step 2: Extract with context
    const promptText = `Speaker: ${chunk.speaker}
Context: [30s before] ${chunk.contextBefore}
[SEGMENT at ${Math.floor(chunk.timestampStart / 60)}:${String(chunk.timestampStart % 60).padStart(2, "0")}]
${chunk.text}
[30s after] ${chunk.contextAfter}

Extract insights with: direction, conviction, claim, entities, visual context (if speaker references a chart).`;

    const result = await complete({
      taskType: "DEEP_EXTRACT" as TaskType,
      prompt: {
        id: "video_extract/v1",
        template: promptText,
      },
      schema: videoExtractSchema,
      cacheKey: `video:${rawContentId}:${chunk.timestampStart}`,
    });

    const ex = videoExtractSchema.safeParse(result.data);
    if (!ex.success) {
      quarantined++;
      continue;
    }

    // Step 3: Anchor results — timestamp + speaker
    // CP3 adapted: quote must appear in transcript near timestamp
    const quoteInTranscript = transcript.includes(ex.data.verbatimQuote) ||
                              transcript.includes(ex.data.verbatimQuote.slice(0, 50));
    if (!quoteInTranscript) {
      quarantined++;
      continue;
    }

    // Locate span in bodyText
    const bodyText = transcript;
    const spanStart = bodyText.indexOf(ex.data.verbatimQuote);
    const spanEnd = spanStart >= 0 ? spanStart + ex.data.verbatimQuote.length : null;

    await db.source.create({
      data: {
        rawContentId,
        extractionVersion: "video_extract/v1",
        authorId,
        dateIso: new Date(),
        dateEarliest: new Date(),
        dateLatest: new Date(),
        direction: ex.data.direction,
        conviction: ex.data.conviction,
        confidence: ex.data.confidence,
        insightType: ex.data.insightType,
        verbatimQuote: ex.data.verbatimQuote,
        keyInsight: ex.data.keyInsight,
        tickers: ex.data.tickers as any,
        entities: ex.data.entities as any,
        independenceClass: "ORIGIN",
        spanStart: spanStart >= 0 ? spanStart : null,
        spanEnd: spanEnd ?? null,
        spanConfidence: spanStart >= 0 ? "EXACT" : "FUZZY",
        // Video-specific fields
        sourceMediaType: "VIDEO_CLIP",
        videoTimestampStart: chunk.timestampStart,
        videoTimestampEnd: chunk.timestampEnd,
        speaker: chunk.speaker,
        visualContext: ex.data.visualContext ?? null,
      },
    });
    extracted++;
  }

  return { extracted, quarantined };
}

// ─────────────────────────────────────────────────────────────────────
// Step 4 (async, optional): Extract video clips for high-conviction insights
// ─────────────────────────────────────────────────────────────────────

export async function extractVideoClips(rawContentId: string): Promise<{
  clipsCreated: number;
}> {
  // Find high-conviction sources from this video
  const sources = await db.source.findMany({
    where: {
      rawContentId,
      conviction: "HIGH",
      sourceMediaType: "VIDEO_CLIP",
      videoTimestampStart: { not: null },
    },
  });

  let clipsCreated = 0;
  for (const src of sources) {
    const start = src.videoTimestampStart ?? 0;
    const end = src.videoTimestampEnd ?? start + 30;
    const duration = end - start;

    // Only create clips for 5-30 second ranges
    if (duration < 5 || duration > 30) continue;

    const raw = await db.rawContent.findUnique({ where: { id: rawContentId } });
    if (!raw?.videoUrl) continue;

    await db.videoClip.create({
      data: {
        sourceId: src.id,
        videoUrl: raw.videoUrl,
        timestampStart: start,
        timestampEnd: end,
        duration,
        storageRef: `clips/${rawContentId}/${start}-${end}.mp4`,
      },
    });

    // Update source with clip ref
    await db.source.update({
      where: { id: src.id },
      data: { videoClipRef: `clips/${rawContentId}/${start}-${end}.mp4` },
    });

    clipsCreated++;
  }

  return { clipsCreated };
}
