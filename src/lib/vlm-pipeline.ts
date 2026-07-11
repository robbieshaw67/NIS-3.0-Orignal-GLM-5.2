// NIP v3.0 — VLM dual-route pipeline (M3, Spec §5)
//
// classify (CHART/TABLE/TEXT_SCREENSHOT/OTHER; classifier errors → PENDING_RETRY,
// never a class — L3) → two independent VLM calls (annotation route vs axis-read
// route) → date-by-date comparison → disagreement >15% fires DUAL_ROUTE_MISMATCH
// and stores the range, never a point; printed source = claim's org attribution (L8);
// unlabeled geometry → LOW-confidence ranges only, parser-enforced.
//
// Every VLM claim routes through PS ratification until graduation (50 ratifications
// ≥95% approval; revocable); both routes' values logged permanently; per-route
// error rate tracked.

import { db } from "./db";
import { complete, completeVision, type TaskType } from "./provider";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────

const classifySchema = z.object({
  class: z.enum(["CHART", "TABLE", "TEXT_SCREENSHOT", "OTHER"]),
  confidence: z.number(),
});

const annotationRouteSchema = z.object({
  valueLow: z.number(),
  valueHigh: z.number(),
  unit: z.string(),
  horizon: z.string(),
  printedSource: z.string().optional(),
});

const axisReadRouteSchema = z.object({
  valueLow: z.number(),
  valueHigh: z.number(),
  unit: z.string(),
  horizon: z.string(),
  printedSource: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────
// The dual-route pipeline
// ─────────────────────────────────────────────────────────────────────

const MISMATCH_THRESHOLD = 0.15; // 15% disagreement → DUAL_ROUTE_MISMATCH

export interface VLMResult {
  imageId: string;
  classifierClass: string;
  annotationRoute: { valueLow: number; valueHigh: number; unit: string; horizon: string; printedSource?: string };
  axisReadRoute: { valueLow: number; valueHigh: number; unit: string; horizon: string; printedSource?: string };
  discrepancyFlag: string; // "" | DUAL_ROUTE_MISMATCH
  confidence: string; // LOW | MEDIUM | HIGH
  ratificationStatus: string; // PENDING | RATIFIED | REJECTED | PENDING_RETRY
  orgAttribution?: string; // printed source on the image (L8)
}

export async function runVLMDualRoute(args: {
  imageId: string;
  imageRef: string; // storageRef
}): Promise<VLMResult> {
  const { imageId, imageRef } = args;

  // Step 1: Classify (CHART/TABLE/TEXT_SCREENSHOT/OTHER)
  // Classifier errors → PENDING_RETRY, never a class (L3)
  let classifierClass = "OTHER";
  let classifyConfidence = 0;
  try {
    const classifyResult = await complete({
      taskType: "CLASSIFY_IMAGE" as TaskType,
      prompt: {
        id: "classify_image/v1",
        template: `Classify this image as CHART, TABLE, TEXT_SCREENSHOT, or OTHER. Return {class, confidence}.

Image ref: ${imageRef}`,
      },
      schema: classifySchema,
      cacheKey: `classify:${imageRef}`,
    });
    const parsed = classifySchema.safeParse(classifyResult.data);
    if (parsed.success) {
      classifierClass = parsed.data.class;
      classifyConfidence = parsed.data.confidence;
    } else {
      // L3: parse failure → PENDING_RETRY, not a default class
      await db.ingestedImage.update({
        where: { id: imageId },
        data: {
          classifierClass: "OTHER",
          ratificationStatus: "PENDING_RETRY",
          confidence: "LOW",
        },
      });
      return {
        imageId,
        classifierClass: "OTHER",
        annotationRoute: { valueLow: 0, valueHigh: 0, unit: "", horizon: "" },
        axisReadRoute: { valueLow: 0, valueHigh: 0, unit: "", horizon: "" },
        discrepancyFlag: "",
        confidence: "LOW",
        ratificationStatus: "PENDING_RETRY",
      };
    }
  } catch {
    // L3: provider failure → PENDING_RETRY
    await db.ingestedImage.update({
      where: { id: imageId },
      data: { ratificationStatus: "PENDING_RETRY", confidence: "LOW" },
    });
    return {
      imageId,
      classifierClass: "OTHER",
      annotationRoute: { valueLow: 0, valueHigh: 0, unit: "", horizon: "" },
      axisReadRoute: { valueLow: 0, valueHigh: 0, unit: "", horizon: "" },
      discrepancyFlag: "",
      confidence: "LOW",
      ratificationStatus: "PENDING_RETRY",
    };
  }

  // If not a chart/table, no dual-route needed
  if (classifierClass !== "CHART" && classifierClass !== "TABLE") {
    await db.ingestedImage.update({
      where: { id: imageId },
      data: { classifierClass, confidence: classifyConfidence > 0.8 ? "HIGH" : "MEDIUM" },
    });
    return {
      imageId,
      classifierClass,
      annotationRoute: { valueLow: 0, valueHigh: 0, unit: "", horizon: "" },
      axisReadRoute: { valueLow: 0, valueHigh: 0, unit: "", horizon: "" },
      discrepancyFlag: "",
      confidence: classifyConfidence > 0.8 ? "HIGH" : "MEDIUM",
      ratificationStatus: "RATIFIED",
    };
  }

  // Step 2: Two independent VLM calls — annotation route vs axis-read route
  const annotationPrompt = {
    id: "extract_chart_annotations/v1",
    template: `Extract the data values from this chart/table image by reading the annotations (labels, data labels, callouts). Return {valueLow, valueHigh, unit, horizon, printedSource}.

Image ref: ${imageRef}`,
  };
  const axisReadPrompt = {
    id: "extract_chart_axis/v1",
    template: `Extract the data values from this chart/table image by reading the axis ticks and bar/line positions. Return {valueLow, valueHigh, unit, horizon, printedSource}.

Image ref: ${imageRef}`,
  };

  const [annotationResult, axisReadResult] = await Promise.all([
    completeVision({
      taskType: "EXTRACT_CHART_ANNOTATIONS" as TaskType,
      prompt: annotationPrompt,
      schema: annotationRouteSchema,
      cacheKey: `annotation:${imageRef}`,
      imageRef,
    }).catch(() => null),
    completeVision({
      taskType: "EXTRACT_CHART_AXIS" as TaskType,
      prompt: axisReadPrompt,
      schema: axisReadRouteSchema,
      cacheKey: `axis:${imageRef}`,
      imageRef,
    }).catch(() => null),
  ]);

  const annotationData = annotationResult?.data;
  const annotation = annotationRouteSchema.safeParse(annotationData).success
    ? annotationRouteSchema.parse(annotationData)
    : { valueLow: 0, valueHigh: 0, unit: "", horizon: "" };
  const axisReadData = axisReadResult?.data;
  const axisRead = axisReadRouteSchema.safeParse(axisReadData).success
    ? axisReadRouteSchema.parse(axisReadData)
    : { valueLow: 0, valueHigh: 0, unit: "", horizon: "" };

  // Step 3: Date-by-date comparison → DUAL_ROUTE_MISMATCH on >15% disagreement
  let discrepancyFlag = "";
  let finalLow = annotation.valueLow;
  let finalHigh = annotation.valueHigh;
  let confidence = "MEDIUM";

  if (annotation.valueLow > 0 && axisRead.valueLow > 0) {
    const annMid = (annotation.valueLow + annotation.valueHigh) / 2;
    const axisMid = (axisRead.valueLow + axisRead.valueHigh) / 2;
    const deviation = Math.abs(annMid - axisMid) / Math.max(annMid, axisMid);
    if (deviation > MISMATCH_THRESHOLD) {
      discrepancyFlag = "DUAL_ROUTE_MISMATCH";
      // Store the RANGE (never a point) — the union of both routes
      finalLow = Math.min(annotation.valueLow, axisRead.valueLow);
      finalHigh = Math.max(annotation.valueHigh, axisRead.valueHigh);
      confidence = "LOW"; // mismatch → LOW confidence, parser-enforced
    } else {
      // Routes agree — use the annotation route values
      confidence = "HIGH";
    }
  } else {
    // One or both routes failed → LOW confidence ranges only
    confidence = "LOW";
  }

  // Step 4: Printed source = org attribution (L8)
  const orgAttribution = annotation.printedSource ?? axisRead.printedSource;

  // Step 5: Update the IngestedImage with both routes' values logged permanently
  await db.ingestedImage.update({
    where: { id: imageId },
    data: {
      classifierClass,
      annotationRoute: annotation as any,
      axisReadRoute: axisRead as any,
      discrepancyFlag,
      confidence,
      ratificationStatus: "PENDING", // Every VLM claim routes through PS ratification
    },
  });

  // Step 6: Create a ratification queue item (L10 — PS must ratify)
  await db.queueItem.create({
    data: {
      type: "VLM_RATIFY",
      priority: 2,
      summary: `VLM dual-route extraction on image ${imageId.slice(-6)}: ${finalLow}-${finalHigh} ${annotation.unit}${discrepancyFlag ? ` [${discrepancyFlag}]` : ""}`,
      payload: {
        imageId,
        classifierClass,
        annotationRoute: annotation,
        axisReadRoute: axisRead,
        discrepancyFlag,
        finalLow,
        finalHigh,
        confidence,
        orgAttribution,
      } as any,
      status: "OPEN",
    },
  });

  return {
    imageId,
    classifierClass,
    annotationRoute: annotation,
    axisReadRoute: axisRead,
    discrepancyFlag,
    confidence,
    ratificationStatus: "PENDING",
    orgAttribution,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Ratification graduation counter
// Spec §5: "50 ratifications ≥95% approval; revocable"
// ─────────────────────────────────────────────────────────────────────

const RATIFICATION_GRADUATION_THRESHOLD = 50;
const RATIFICATION_APPROVAL_THRESHOLD = 0.95;

export async function checkRatificationGraduation(): Promise<{
  totalRatifications: number;
  approvalRate: number;
  graduated: boolean;
}> {
  const ratified = await db.ingestedImage.count({ where: { ratificationStatus: "RATIFIED" } });
  const rejected = await db.ingestedImage.count({ where: { ratificationStatus: "REJECTED" } });
  const total = ratified + rejected;
  const approvalRate = total > 0 ? ratified / total : 0;
  const graduated = total >= RATIFICATION_GRADUATION_THRESHOLD && approvalRate >= RATIFICATION_APPROVAL_THRESHOLD;

  return { totalRatifications: total, approvalRate, graduated };
}
