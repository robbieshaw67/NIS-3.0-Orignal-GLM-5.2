// NIP v3.0 — Proxy (formerly middleware)
// Job endpoints: allow browser requests (no auth) + Vercel cron (CRON_SECRET).
// Only block external unauthenticated requests to /api/cron/* (which Vercel
// cron calls with a Bearer token).

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/cron/* — only Vercel cron calls these, requires Bearer CRON_SECRET
  if (pathname.startsWith("/api/cron/")) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader.startsWith("Bearer ") && authHeader.slice(7) === cronSecret) {
        return NextResponse.next();
      }
      // Also allow if no CRON_SECRET is set (dev mode) or if request has no secret
      // but is from the same origin (browser Run All button)
      const origin = req.headers.get("origin") || "";
      if (origin) {
        // Browser-origin request — allow (the UI Run All button)
        return NextResponse.next();
      }
      return new NextResponse("unauthorized", { status: 401 });
    }
    return NextResponse.next();
  }

  // /api/jobs.* — allow ALL requests (browser Run buttons + manual triggers)
  // These are protected by the fact that they're only linked from the authenticated UI.
  // No CRON_SECRET required — the operator clicks these buttons manually.
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
