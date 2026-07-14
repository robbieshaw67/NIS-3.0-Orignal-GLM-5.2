import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NIP v3.0 — Narrative Intelligence Platform [BUILD 6a97e17]",
  description: "A reading instrument for semiconductor/AI investment signals. Four rooms: Stream · Debates · Judgment · Action.",
  keywords: ["NIP", "narrative intelligence", "semiconductor", "investment signals", "DRAM", "Hyperscaler"],
  authors: [{ name: "NIP v3.0" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "NIP v3.0",
    description: "A reading instrument for semiconductor/AI investment signals.",
    url: "https://chat.z.ai",
    siteName: "NIP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NIP v3.0",
    description: "A reading instrument for semiconductor/AI investment signals.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Cache-busting + auto-reload logic.
          Problem: browser caches JS chunks for 1 year (immutable). If the user
          has an old HTML page cached that references old chunk hashes, those
          chunks may 404 or contain old code.

          Solution:
          1. On script load error (chunk 404) → reload with cache-busting query param
          2. On unhandled rejection → log for debugging
          3. Check a build marker in the DOM — if missing, force reload with ?v=<build>
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var BUILD = '6a97e17';

            // 1. Detect chunk load failures (404 on _next/static/chunks/*.js)
            window.addEventListener('error', function(e) {
              var t = e.target || {};
              if (t && t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_next/static/chunks/') > -1) {
                console.error('[NIP] Chunk failed:', t.src);
                if (!window.__nipReloaded) {
                  window.__nipReloaded = true;
                  var url = new URL(window.location.href);
                  url.searchParams.set('v', BUILD + '-' + Date.now());
                  window.location.replace(url.toString());
                }
              }
            }, true);

            // 2. Log unhandled rejections for debugging
            window.addEventListener('unhandledrejection', function(e) {
              console.error('[NIP] Unhandled rejection:', e.reason);
            });

            // 3. If we have a ?v= param from a previous cache-bust attempt,
            //    and the page still doesn't have the build marker, show a diagnostic overlay
            window.addEventListener('DOMContentLoaded', function() {
              var hasBuild = document.body.innerHTML.indexOf('build 6a97') > -1 ||
                            document.body.innerHTML.indexOf('Source List Manager') > -1;
              var url = new URL(window.location.href);
              var hasVParam = url.searchParams.has('v');

              if (hasVParam && !hasBuild) {
                // We tried to cache-bust but the page still doesn't have new code
                // Show a diagnostic overlay with instructions
                var overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:white;padding:16px;font-family:monospace;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
                overlay.innerHTML = '<b>NIP v3 Cache Diagnostic</b><br>' +
                  'Build marker: ' + (hasBuild ? 'FOUND' : 'NOT FOUND') + '<br>' +
                  'Cache-bust attempted: ' + (hasVParam ? 'YES' : 'NO') + '<br>' +
                  'URL: ' + window.location.href + '<br><br>' +
                  '<b>Your browser has stale cached JavaScript.</b><br>' +
                  'To fix: Open DevTools (F12) → Application tab → Storage → Click "Clear site data" → Then refresh.<br>' +
                  'Or try: Settings → Clear browsing data → Cached images and files.<br><br>' +
                  '<button onclick="this.parentElement.remove()" style="background:white;color:#dc2626;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">Dismiss</button>';
                document.body.appendChild(overlay);
              }
            });
          })();
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
