// NIP v3.0 — Page (Server Component wrapper)
//
// This server component exists ONLY so we can attach `export const dynamic = "force-dynamic"`.
// Route Segment Config options are not allowed in Client Components, so we wrap the
// client page here. This forces Vercel to render the HTML on every request instead of
// serving a stale prerendered shell from edge cache (which was referencing old JS chunks
// after redeploy).

import { PageClient } from "./page-client";

// Force dynamic rendering — never serve a cached static HTML shell.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default function Page() {
  return <PageClient />;
}
