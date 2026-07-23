// NIP v3.0 — Page (Server Component wrapper)
// Wraps the client component so the route works correctly.

import { PageClient } from "./page-client";

export default function Page() {
  return <PageClient />;
}
