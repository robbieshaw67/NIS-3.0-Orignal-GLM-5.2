// NIP v3.0 — Source List Manager API
// PS manages the registry of feeds/handles/channels from the Ingestion Console.
// Adapters read from this table instead of hardcoded arrays.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET — list all sources, optionally filtered by type
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get("type");

  const where: any = {};
  if (sourceType) where.sourceType = sourceType;

  const sources = await db.sourceList.findMany({
    where,
    orderBy: [{ sourceType: "asc" }, { handle: "asc" }],
  });
  return NextResponse.json({ ok: true, sources });
}

// POST — add a new source
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sourceType, handle, realName, feedUrl, channelUrl } = body ?? {};

    if (!sourceType || !handle) {
      return NextResponse.json({ ok: false, error: "sourceType and handle required" }, { status: 400 });
    }

    if (!["X", "RSS", "TRANSCRIPT", "ANCHOR"].includes(sourceType)) {
      return NextResponse.json({ ok: false, error: "sourceType must be X | RSS | TRANSCRIPT | ANCHOR" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await db.sourceList.findUnique({
      where: { sourceType_handle: { sourceType, handle } },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Source already exists", source: existing }, { status: 409 });
    }

    const source = await db.sourceList.create({
      data: {
        sourceType,
        handle,
        realName: realName || "",
        feedUrl: feedUrl || null,
        channelUrl: channelUrl || null,
        active: true,
        addedBy: "PS",
      },
    });

    return NextResponse.json({ ok: true, source });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "add-failed" }, { status: 500 });
  }
}

// PATCH — toggle active/inactive or update fields
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, active, realName, feedUrl, channelUrl } = body ?? {};

    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    const data: any = {};
    if (active !== undefined) data.active = active;
    if (realName !== undefined) data.realName = realName;
    if (feedUrl !== undefined) data.feedUrl = feedUrl;
    if (channelUrl !== undefined) data.channelUrl = channelUrl;

    const source = await db.sourceList.update({ where: { id }, data });
    return NextResponse.json({ ok: true, source });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "update-failed" }, { status: 500 });
  }
}

// DELETE — remove a source
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    await db.sourceList.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "delete-failed" }, { status: 500 });
  }
}
