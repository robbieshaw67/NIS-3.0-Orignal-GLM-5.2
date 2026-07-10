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
  title: "NIP v3.0 — Narrative Intelligence Platform",
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
