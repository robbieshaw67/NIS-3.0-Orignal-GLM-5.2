// NIP v3.0 — Auth middleware (Spec §11, L13)
// "auth in front of everything except a data-free /health"
//
// Two auth paths:
//   1. Basic auth via NIP_AUTH_USER / NIP_AUTH_PASS (for the operator UI + manual API)
//   2. Bearer CRON_SECRET for /api/jobs.* paths (for Vercel cron — sends Bearer, not Basic)
//
// If no auth env vars are set, auth is skipped in development (sandbox convenience)
// but MUST be set in production.

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-allowed: health endpoint (data-free per spec)
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // In development with no auth configured, allow all (sandbox convenience)
  const authUser = process.env.NIP_AUTH_USER;
  const authPass = process.env.NIP_AUTH_PASS;
  const cronSecret = process.env.CRON_SECRET;
  if (!authUser || !authPass) {
    if (process.env.NODE_ENV === "production") {
      // In production with no auth, only allow health + cron (cron has its own CRON_SECRET check)
      if (pathname.startsWith("/api/cron/") || pathname.startsWith("/api/jobs.")) {
        return NextResponse.next();
      }
      return NextResponse.json(
        { ok: false, error: "NIP_AUTH_USER and NIP_AUTH_PASS must be set in production" },
        { status: 500 }
      );
    }
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");

  // Path 2: Bearer CRON_SECRET for job endpoints (Vercel cron sends Bearer, not Basic)
  if (cronSecret && (pathname.startsWith("/api/jobs.") || pathname === "/api/jobs.events")) {
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      if (token === cronSecret) {
        return NextResponse.next();
      }
    }
    // Fall through to Basic auth check (operator can also call job endpoints manually)
  }

  // Path 1: Basic auth for all other endpoints
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return NextResponse.json(
      { ok: false, error: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": 'Basic realm="NIP v3.0"' } }
    );
  }

  const encoded = authHeader.slice("Basic ".length);
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [user, pass] = decoded.split(":");
    if (user === authUser && pass === authPass) {
      return NextResponse.next();
    }
  } catch {
    // fall through to 401
  }

  return NextResponse.json(
    { ok: false, error: "Invalid credentials" },
    { status: 401, headers: { "WWW-Authenticate": 'Basic realm="NIP v3.0"' } }
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
