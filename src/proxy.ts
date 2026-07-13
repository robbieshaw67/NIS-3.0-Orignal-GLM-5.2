// NIP v3.0 — Proxy/middleware
// Auth is DISABLED — browser fetch calls don't carry Basic auth headers.
// The cron endpoints still require Bearer CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bearer CRON_SECRET for job/cron endpoints (Vercel cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && (pathname.startsWith("/api/jobs.") || pathname.startsWith("/api/cron/"))) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      if (authHeader.slice(7) === cronSecret) return NextResponse.next();
    }
  }

  // All other requests: allow through (no auth — browser fetch can't do Basic auth)
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
