// NIP v2.x — Video extraction API (Part C)
// POST a video URL + transcript, get timestamped, speaker-anchored insights

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { videoUrl, transcript, channel, title, extractClips = false } = body ?? {};

    if (!videoUrl || !transcript) {
      return NextResponse.json(
        { ok: false, error: "videoUrl and transcript required" },
        { status: 400 }
      );
    }

    // Store the raw content as a video transcript
    const { storeRaw } = await import("@/lib/adapters");
    const { id: rawId, created } = await storeRaw({
      url: videoUrl,
      title: title || `Video transcript — ${videoUrl}`,
      bodyText: transcript,
      adapterType: "TRANSCRIPT",
      adapterVersion: "yt-dlp+v3",
    });

    // Find or create the author
    let author = null;
    if (channel) {
      author = await db.author.findFirst({ where: { handle: channel } });
    }
    if (!author) {
      author = await db.author.findFirst({ where: { handle: "ps" } });
    }

    if (!author) {
      return NextResponse.json({ ok: false, error: "no author found" }, { status: 400 });
    }

    // Extract video insights with timestamp anchoring + speaker ID
    const { extractVideoInsights, extractVideoClips } = await import("@/lib/video-extraction");
    const result = await extractVideoInsights({
      rawContentId: rawId,
      authorId: author.id,
      videoUrl,
      transcript,
    });

    // Optionally extract clips for high-conviction insights
    let clipsResult = { clipsCreated: 0 };
    if (extractClips) {
      clipsResult = await extractVideoClips(rawId);
    }

    // Audit log
    await db.auditLog.create({
      data: {
        actor: "PS",
        action: "VIDEO_EXTRACTED",
        targetType: "RawContent",
        targetId: rawId,
        payload: {
          videoUrl,
          title,
          channel,
          extracted: result.extracted,
          quarantined: result.quarantined,
          clipsCreated: clipsResult.clipsCreated,
        } as any,
      },
    });

    return NextResponse.json({
      ok: true,
      rawContentId: rawId,
      extracted: result.extracted,
      quarantined: result.quarantined,
      clipsCreated: clipsResult.clipsCreated,
      dedup: !created,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "video-extract-failed" },
      { status: 500 }
    );
  }
}
