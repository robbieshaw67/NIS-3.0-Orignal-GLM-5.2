// NIP v3.0 — Auth middleware (Spec §11, L13)
// "auth in front of everything except a data-free /health"
//
// Basic auth via NIP_AUTH_USER / NIP_AUTH_PASS env vars (out-of-band, L11).
// If the env vars are not set, auth is skipped in development (for the sandbox)
// but MUST be set in production. The /api/health and /api/seed endpoints are
// exempt (health is data-free; seed is dev-only).

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-allowed: health endpoint (data-free per spec)
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // In development with no auth configured, allow all (sandbox convenience)
  const authUser = process.env.NIP_AUTH_USER;
  const authPass = process.env.NIP_AUTH_PASS;
  if (!authUser || !authPass) {
    // No auth configured — allow in dev, but log a warning
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "NIP_AUTH_USER and NIP_AUTH_PASS must be set in production" },
        { status: 500 }
      );
    }
    return NextResponse.next();
  }

  // Check basic auth header
  const authHeader = req.headers.get("authorization");
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
