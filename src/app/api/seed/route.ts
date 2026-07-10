// NIP v3.0 — Trigger seed re-run (development convenience)

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync("cd /home/z/my-project && bun run scripts/seed.ts", {
      timeout: 60_000,
    });
    return NextResponse.json({ ok: true, stdout: stdout.slice(-1500), stderr: stderr.slice(-500) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
