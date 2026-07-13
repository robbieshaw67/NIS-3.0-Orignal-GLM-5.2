import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Force all pages to be dynamically rendered — we never want Vercel to
  // prerender a static HTML shell that could go stale after a redeploy.
  // (The page.tsx also sets `export const dynamic = "force-dynamic"`, but
  // this header is a belt-and-suspenders safety net.)
  async headers() {
    return [
      {
        // Match all routes except hashed static assets (which ARE safe to cache).
        source: "/((?!_next/static/|_next/image/|favicon\\.ico|logo\\.svg).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
