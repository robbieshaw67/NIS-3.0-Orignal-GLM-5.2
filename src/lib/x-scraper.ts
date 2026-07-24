// NIP v3.0 — X/Twitter Scraper
// Fetches real tweets using X's public GraphQL API (no API key needed).
// Uses the web app's bearer token — same approach as Nitter but directly from X.
//
// Flow:
//   1. Lookup user ID by screen name (UserByScreenName GraphQL)
//   2. Fetch user tweets (UserTweets GraphQL)
//   3. Parse tweets from the nested timeline response
//
// Rate limits: X's guest/web tier allows ~50-100 requests per hour per IP.
// The adapter stores a watermark (last tweet ID) so it only fetches new tweets.

const BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export interface Tweet {
  id: string;
  text: string;
  createdAt: string; // ISO date
  authorHandle: string;
  authorName: string;
  replyTo?: string; // tweet ID if this is a reply
  retweetOf?: string; // tweet ID if this is a retweet
  quoteTweetOf?: string; // tweet ID if this is a quote tweet
  mediaUrls?: string[];
  url: string;
}

export interface XFetchResult {
  tweets: Tweet[];
  userId: string;
  error?: string;
}

// ── Step 1: Lookup user ID by screen name ──
async function lookupUserId(handle: string): Promise<string | null> {
  const cleanHandle = handle.replace("@", "").toLowerCase();
  const variables = JSON.stringify({
    screen_name: cleanHandle,
    withSafetyModeUserField: true,
  });
  const features = JSON.stringify({
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  });

  const url = `https://api.x.com/graphql/xmU6X_CKVnQ5lSrCbAmJsg/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${BEARER}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    return data.data?.user?.result?.rest_id ?? null;
  } catch {
    return null;
  }
}

// ── Step 2: Fetch user tweets ──
export async function fetchTweets(handle: string, count: number = 10, sinceTweetId?: string): Promise<XFetchResult> {
  const cleanHandle = handle.replace("@", "").toLowerCase();

  const userId = await lookupUserId(cleanHandle);
  if (!userId) {
    return { tweets: [], userId: "", error: `Could not lookup user @${cleanHandle}` };
  }

  const variables: any = {
    userId,
    count: Math.min(count, 20),
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: false,
    withVoice: false,
    withV2Timeline: true,
  };
  if (sinceTweetId) {
    variables.cursor = `t:${sinceTweetId}`;
  }

  const features = JSON.stringify({
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  });

  const url = `https://api.x.com/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(features)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${BEARER}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      return { tweets: [], userId, error: `HTTP ${resp.status}` };
    }

    const data = await resp.json();
    const instructions = data.data?.user?.result?.timeline_v2?.timeline?.instructions || [];

    // Extract entries from TimelineAddEntries
    let entries: any[] = [];
    for (const inst of instructions) {
      if (inst.entries) entries = entries.concat(inst.entries);
    }

    const tweets: Tweet[] = [];
    for (const entry of entries) {
      // Skip cursor entries (they're pagination markers)
      if (entry.content?.cursorType) continue;
      // Skip promoted content
      if (entry.content?.promotedMetadata) continue;

      const tweet = entry.content?.itemContent?.tweet_results?.result;
      if (!tweet?.legacy?.full_text) continue;

      // Skip retweets (we want original content from this user)
      // Actually keep them — they show what the user is amplifying
      const legacy = tweet.legacy;

      const tweetData: Tweet = {
        id: legacy.id_str,
        text: decodeHtmlEntities(legacy.full_text),
        createdAt: new Date(legacy.created_at).toISOString(),
        authorHandle: cleanHandle,
        authorName: tweet.core?.user_results?.result?.legacy?.name || cleanHandle,
        url: `https://x.com/${cleanHandle}/status/${legacy.id_str}`,
      };

      // Detect reply
      if (legacy.in_reply_to_status_id_str) {
        tweetData.replyTo = legacy.in_reply_to_status_id_str;
      }

      // Detect retweet
      if (legacy.retweeted_status_result?.result?.legacy?.id_str) {
        tweetData.retweetOf = legacy.retweeted_status_result.result.legacy.id_str;
      }

      // Detect quote tweet
      if (tweet.legacy?.quoted_status_permalink?.expanded) {
        const quoteMatch = tweet.legacy.quoted_status_permalink.expanded.match(/status\/(\d+)/);
        if (quoteMatch) tweetData.quoteTweetOf = quoteMatch[1];
      }

      // Extract media URLs
      const media = legacy.entities?.media || legacy.extended_entities?.media || [];
      if (media.length > 0) {
        tweetData.mediaUrls = media.map((m: any) => m.media_url_https || m.media_url).filter(Boolean);
      }

      tweets.push(tweetData);
    }

    return { tweets, userId };
  } catch (e: any) {
    return { tweets: [], userId, error: e.message };
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
