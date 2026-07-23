// NIP v3.0 — Proxy (formerly middleware)
// Cron endpoints require Bearer CRON_SECRET. All other requests pass through.

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bearer CRON_SECRET for job/cron endpoints (Vercel cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && (pathname.startsWith("/api/jobs.") || pathname.startsWith("/api/cron/"))) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      if (authHeader.slice(7) === cronSecret) {
        return NextResponse.next();
      }
    }
    return new NextResponse("unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
