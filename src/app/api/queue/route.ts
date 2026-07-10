// NIP v3.0 — Resolve a queue item (PS ruling). L10: staged, never auto-applied.
// POST { id, decision, reasoning }
// Records the PS decision in the audit log and marks the item resolved.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const { id, decision, reasoning } = body ?? {};
  if (!id || !decision) {
    return NextResponse.json({ ok: false, error: "id and decision required" }, { status: 400 });
  }

  const item = await db.queueItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const updated = await db.queueItem.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedBy: "PS",
      resolvedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      actor: "PS",
      action: `QUEUE_${item.type}_RESOLVED`,
      targetType: "QueueItem",
      targetId: id,
      payload: { decision, reasoning, type: item.type, summary: item.summary } as any,
    },
  });

  return NextResponse.json({ ok: true, item: updated });
}
