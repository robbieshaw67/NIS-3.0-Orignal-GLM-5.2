// NIP v2.x — Briefing Composer API (Room 0.5)
// POST a BriefingRequest, get back a composed briefing

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      template = "daily-standup",
      proseTemplate = "fast",
      authors = [],
      orgAffiliations = [],
      entities = [],
      narrativeFamilies = [],
      search = "",
      since,
      until,
      length = "medium",
      includeDebates = true,
      includeTheses = true,
      includeClaims = true,
      includeStanceChanges = true,
      format = "html",
      includeLinks = true,
    } = body ?? {};

    // Create the request record
    const briefingReq = await db.briefingRequest.create({
      data: {
        template,
        proseTemplate,
        authors: authors as any,
        orgAffiliations: orgAffiliations as any,
        entities: entities as any,
        narrativeFamilies: narrativeFamilies as any,
        search,
        since: since ? new Date(since) : null,
        until: until ? new Date(until) : null,
        length,
        includeDebates,
        includeTheses,
        includeClaims,
        includeStanceChanges,
        format,
        includeLinks,
        status: "COMPOSING",
      },
    });

    // Compose the briefing
    const { composeBriefing } = await import("@/lib/briefing-composer");
    const result = await composeBriefing({
      template,
      proseTemplate,
      authors,
      orgAffiliations,
      entities,
      narrativeFamilies,
      search,
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      length,
      includeDebates,
      includeTheses,
      includeClaims,
      includeStanceChanges,
      format,
      includeLinks,
    });

    // Save the output
    const output = await db.briefingOutput.create({
      data: {
        requestId: briefingReq.id,
        content: result.content,
        wordCount: result.wordCount,
        claimsCited: result.claimsCited,
        sourcesCited: result.sourcesCited,
        dedupedCount: result.dedupedCount,
      },
    });

    await db.briefingRequest.update({
      where: { id: briefingReq.id },
      data: { status: "DONE" },
    });

    return NextResponse.json({
      ok: true,
      requestId: briefingReq.id,
      content: result.content,
      wordCount: result.wordCount,
      claimsCited: result.claimsCited,
      sourcesCited: result.sourcesCited,
      dedupedCount: result.dedupedCount,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "briefing-failed" },
      { status: 500 }
    );
  }
}

// GET — list past briefings
export async function GET() {
  try {
    const requests = await db.briefingRequest.findMany({
      include: { output: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ ok: true, requests });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
