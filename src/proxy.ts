// NIP v3.0 — Middleware
// 1) Prevents Vercel edge cache from serving stale HTML after redeploy.
// 2) Cron endpoints require Bearer CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bearer CRON_SECRET for job/cron endpoints (Vercel cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && (pathname.startsWith("/api/jobs.") || pathname.startsWith("/api/cron/"))) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      if (authHeader.slice(7) === cronSecret) {
        const res = NextResponse.next();
        res.headers.set("Cache-Control", "no-store, max-age=0");
        return res;
      }
    }
    // Not authorized — return 401
    return new NextResponse("unauthorized", { status: 401 });
  }

  // All other requests: allow through, but force no-store so Vercel edge cache
  // never serves stale HTML referencing old JS chunks after a redeploy.
  const res = NextResponse.next();
  if (!pathname.startsWith("/_next/static/")) {
    // Static assets in /_next/static/ are content-hashed and safe to cache.
    // Everything else (HTML, RSC payloads, API responses) must not be cached.
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static/|_next/image/|favicon\\.ico|logo\\.svg).*)"],
};
