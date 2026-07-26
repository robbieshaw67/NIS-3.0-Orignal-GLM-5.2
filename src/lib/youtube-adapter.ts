// NIP v3.0 — YouTube Adapter
// Uses YouTube's public RSS feed (feeds/videos.xml?channel_id=UC...) for video
// discovery, and youtube-transcript for captions (best-effort, graceful fallback
// when rate-limited).
//
// No API key needed — same approach as the YouTube embed timeline.
//
// To add a YouTube channel:
//   1. Go to Setup → Add Source → YouTube
//   2. Set Handle to the UC... channel ID (e.g. UCqK_GSMbpiV8spgD3ZGloSw)
//      or @channelname — the adapter resolves handles automatically.

import { YoutubeTranscript } from "youtube-transcript";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO date
  author: string;
  url: string;
}

export interface YouTubeFetchResult {
  videos: YouTubeVideo[];
  channelId: string;
  error?: string;
}

// ── Resolve @channelname to UC... channel ID ──
export async function resolveChannelId(handle: string): Promise<string | null> {
  // Already a channel ID
  if (handle.startsWith("UC") && handle.length >= 20) {
    return handle;
  }

  // Remove @ prefix
  const cleanHandle = handle.replace("@", "").toLowerCase();

  // Fetch the channel page
  try {
    const resp = await fetch(`https://www.youtube.com/@${cleanHandle}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return null;

    const html = await resp.text();

    // Try multiple patterns to extract channel ID
    const patterns = [
      /"channelId":"(UC[\w-]+)"/,
      /channel_id=(UC[\w-]+)/,
      /"externalId":"(UC[\w-]+)"/,
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }

    return null;
  } catch {
    return null;
  }
}

// ── Fetch videos from YouTube RSS feed ──
export async function fetchYouTubeVideos(channelId: string, maxResults: number = 10): Promise<YouTubeFetchResult> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return { videos: [], channelId, error: `HTTP ${resp.status}` };
    }

    const xml = await resp.text();

    // Parse XML entries
    const entries: YouTubeVideo[] = [];
    const entryMatches = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

    for (const entryMatch of entryMatches.slice(0, maxResults)) {
      const entry = entryMatch[1];
      const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
      const author = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>/)?.[1] || "Unknown";

      if (videoId && title) {
        entries.push({
          videoId,
          title: decodeHtmlEntities(title),
          publishedAt: published || new Date().toISOString(),
          author: decodeHtmlEntities(author),
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    return { videos: entries, channelId };
  } catch (e: any) {
    return { videos: [], channelId, error: e.message };
  }
}

// ── Fetch transcript for a video (best-effort, graceful fallback) ──
export async function fetchTranscript(videoId: string): Promise<{
  transcript: string;
  hasTimestamps: boolean;
  error?: string;
}> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });

    if (!segments || segments.length === 0) {
      return { transcript: "", hasTimestamps: false, error: "no captions available" };
    }

    // Build full transcript text with timestamps
    const lines = segments.map((seg: any) => {
      const minutes = Math.floor(seg.offset / 60);
      const seconds = Math.floor(seg.offset % 60);
      return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}] ${seg.text}`;
    });

    return {
      transcript: lines.join("\n"),
      hasTimestamps: true,
    };
  } catch (e: any) {
    // Rate-limited or no captions — graceful fallback
    return {
      transcript: "",
      hasTimestamps: false,
      error: e.message || "transcript-fetch-failed",
    };
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
