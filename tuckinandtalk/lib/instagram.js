/**
 * Instagram Graph API v25.0 integration for @tuckinandtalk.
 *
 * All functions use Authorization Bearer header (not query-param tokens).
 * graphFetchWithRefresh auto-renews the stored token on 401/OAuthException
 * errors and returns { data, newToken, expiresIn } so callers can persist
 * the fresh token back to tat_accounts.
 */

const API_VERSION = 'v25.0';
export const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

// ---------------------------------------------------------------------------
// Low-level fetch helpers
// ---------------------------------------------------------------------------

async function parseGraphResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Meta API returned non-JSON (HTTP ${response.status}). ` +
      `The access token may be invalid or expired. ` +
      `Reconnect the Instagram account from Settings.`
    );
  }
}

export async function graphFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  return parseGraphResponse(response);
}

/**
 * Fetch with automatic token refresh on OAuthException / 401.
 * Returns { data, newToken, expiresIn }.
 * newToken is non-null only when a refresh occurred.
 */
export async function graphFetchWithRefresh(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const data = await parseGraphResponse(response);

  const isAuthError =
    response.status === 401 ||
    (data.error &&
      (data.error.code === 190 || data.error.type === 'OAuthException'));

  if (isAuthError) {
    try {
      const refreshed = await refreshLongLivedToken(accessToken);
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${refreshed.accessToken}`,
          ...options.headers,
        },
      });
      const retryData = await parseGraphResponse(retryResponse);
      return {
        data: retryData,
        newToken: refreshed.accessToken,
        expiresIn: refreshed.expiresIn,
      };
    } catch (refreshError) {
      throw new Error(
        `Token expired and refresh failed: ${data.error?.message || refreshError.message}`
      );
    }
  }

  return { data, newToken: null, expiresIn: null };
}

/**
 * Compute an ISO expiry timestamp from an expiresIn value (seconds).
 */
export function getTokenExpiryDate(expiresIn) {
  const d = new Date();
  d.setSeconds(d.getSeconds() + (expiresIn || 60 * 24 * 60 * 60));
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

/**
 * Build the Facebook Login for Business OAuth URL.
 */
export function getAuthUrl(state) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.TAT_INSTAGRAM_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error(
      'INSTAGRAM_APP_ID and TAT_INSTAGRAM_REDIRECT_URI must be configured.'
    );
  }

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'read_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ].join(',');

  return (
    `https://www.facebook.com/${API_VERSION}/dialog/oauth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&response_type=code` +
    (state ? `&state=${encodeURIComponent(state)}` : '')
  );
}

/**
 * Exchange an authorization code for a long-lived access token.
 * Returns { accessToken, expiresIn }
 */
export async function exchangeCodeForToken(code) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.TAT_INSTAGRAM_REDIRECT_URI;

  // Step 1: short-lived token
  const shortRes = await fetch(
    `${GRAPH_BASE}/oauth/access_token?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${clientSecret}` +
      `&code=${code}`
  );
  const shortData = await shortRes.json();
  if (shortData.error) throw new Error(shortData.error.message);

  // Step 2: long-lived token (~60 days)
  return exchangeForLongLivedToken(shortData.access_token);
}

/**
 * Exchange a short-lived user token for a long-lived one.
 */
export async function exchangeForLongLivedToken(shortLivedToken) {
  const res = await fetch(
    `${GRAPH_BASE}/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.INSTAGRAM_APP_ID}` +
      `&client_secret=${process.env.INSTAGRAM_APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Refresh a long-lived token (call before <7 days remaining).
 */
export async function refreshLongLivedToken(token) {
  const res = await fetch(
    `${GRAPH_BASE}/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.INSTAGRAM_APP_ID}` +
      `&client_secret=${process.env.INSTAGRAM_APP_SECRET}` +
      `&fb_exchange_token=${token}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// ---------------------------------------------------------------------------
// Account discovery
// ---------------------------------------------------------------------------

/**
 * After OAuth, find the Instagram Business Account linked to the user's
 * Facebook Pages. Returns account details ready to store in tat_accounts.
 */
export async function getInstagramAccount(accessToken) {
  // List Facebook Pages the user manages
  const pagesData = await graphFetch(`${GRAPH_BASE}/me/accounts`, accessToken);
  if (pagesData.error) throw new Error(pagesData.error.message);
  if (!pagesData.data?.length) {
    throw new Error(
      'No Facebook Pages found. Make sure your Instagram Business Account ' +
        'is linked to a Facebook Page and you granted pages_show_list permission.'
    );
  }

  // Find the page with a linked Instagram Business Account
  let igAccountId = null;
  let chosenPage = null;
  for (const page of pagesData.data) {
    const igData = await graphFetch(
      `${GRAPH_BASE}/${page.id}?fields=instagram_business_account`,
      accessToken
    );
    if (igData.instagram_business_account) {
      igAccountId = igData.instagram_business_account.id;
      chosenPage = page;
      break;
    }
  }

  if (!igAccountId) {
    throw new Error(
      'No Instagram Business Account linked to any of your Facebook Pages.'
    );
  }

  const details = await graphFetch(
    `${GRAPH_BASE}/${igAccountId}?fields=id,username,profile_picture_url,followers_count,media_count`,
    accessToken
  );
  if (details.error) throw new Error(details.error.message);

  return {
    instagramUserId: details.id,
    username: details.username,
    profilePicture: details.profile_picture_url,
    followersCount: details.followers_count,
    mediaCount: details.media_count,
    facebookPageId: chosenPage.id,
  };
}

// ---------------------------------------------------------------------------
// Weekly account-level insights (heartbeat)
// ---------------------------------------------------------------------------

/**
 * Fetch one week of account insights via three separate calls:
 *   1. Totals — reach, views, accounts_engaged (no breakdown)
 *   2. Reach by follow_type (FOLLOWER / NON_FOLLOWER)
 *   3. Views by media_product_type (POST / REELS / STORY)
 *
 * Meta does not support multiple breakdown dimensions in one call, and
 * saves/shares are not available at the account-insights level.
 */
export async function fetchWeeklyInsights(accessToken, igUserId, sinceUnix, untilUnix) {
  const base =
    `${GRAPH_BASE}/${igUserId}/insights` +
    `?period=day&metric_type=total_value&since=${sinceUnix}&until=${untilUnix}`;

  // Call 1: totals
  const { data: totalsData, newToken: t1, expiresIn: e1 } = await graphFetchWithRefresh(
    `${base}&metric=reach,views,accounts_engaged`,
    accessToken
  );
  if (totalsData.error) throw new Error(totalsData.error.message);

  let currentToken = t1 || accessToken;

  // Call 2: reach by follow_type
  const { data: followData, newToken: t2, expiresIn: e2 } = await graphFetchWithRefresh(
    `${base}&metric=reach&breakdown=follow_type`,
    currentToken
  );
  if (followData.error) throw new Error(followData.error.message);
  if (t2) currentToken = t2;

  // Call 3: views by media_product_type
  const { data: viewsData, newToken: t3, expiresIn: e3 } = await graphFetchWithRefresh(
    `${base}&metric=views&breakdown=media_product_type`,
    currentToken
  );
  if (viewsData.error) throw new Error(viewsData.error.message);
  if (t3) currentToken = t3;

  const newToken = t3 || t2 || t1 || null;
  const expiresIn = e3 || e2 || e1 || null;

  return {
    totals: totalsData.data || [],
    followBreakdown: followData.data || [],
    viewsBreakdown: viewsData.data || [],
    newToken,
    expiresIn,
  };
}

// ---------------------------------------------------------------------------
// Per-post insights
// ---------------------------------------------------------------------------

/**
 * Fetch the basic fields for a media object.
 */
export async function getMediaDetails(accessToken, mediaId) {
  const fields =
    'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count';
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_BASE}/${mediaId}?fields=${fields}`,
    accessToken
  );
  if (data.error) throw new Error(data.error.message);
  return { details: data, newToken, expiresIn };
}

/**
 * Fetch per-post insights with graceful fallback.
 *
 * Meta rejects the entire call if any metric is unavailable (common for
 * follows and profile_visits on reels). Strategy:
 *   1. Fetch core metrics (always works)
 *   2. Optionally fetch follows + profile_visits in a separate call
 * Results are merged so the caller gets everything available.
 */
export async function getPostInsights(accessToken, mediaId, mediaProductType) {
  const isReel =
    mediaProductType === 'REELS' ||
    mediaProductType === 'REELS_OVERLAY' ||
    mediaProductType === 'REEL';

  // Core metrics — reliable across post types
  const coreSets = isReel
    ? [
        'reach,views,saved,shares,total_interactions,ig_reels_avg_watch_time,reels_skip_rate',
        'reach,views,saved,shares,total_interactions',
        'reach,views',
      ]
    : [
        'reach,views,saved,shares,total_interactions',
        'reach,views',
      ];

  let lastToken = null;
  let lastExpiry = null;
  let insights = null;

  for (const metrics of coreSets) {
    const url = `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}`;
    const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);
    if (newToken) { lastToken = newToken; lastExpiry = expiresIn; }

    if (data.error) {
      console.warn(`Core insights attempt failed for ${mediaId}: ${data.error.message}`);
      continue;
    }

    insights = {};
    (data.data || []).forEach((m) => {
      insights[m.name] = m.values?.[0]?.value ?? m.value ?? 0;
    });
    break;
  }

  if (!insights) {
    console.warn(`All insight attempts failed for ${mediaId}`);
    return { insights: null, newToken: lastToken, expiresIn: lastExpiry };
  }

  // follows, profile_visits, and per-post follow_type breakdown are not
  // available at media level under Standard Access / Development mode.
  return { insights, newToken: lastToken, expiresIn: lastExpiry };
}

/**
 * Fetch reach broken down by follow_type (FOLLOWER / NON_FOLLOWER).
 * Returns { reachFollower, reachNonFollower, newToken, expiresIn }.
 */
export async function getReachByFollowType(accessToken, mediaId) {
  const url =
    `${GRAPH_BASE}/${mediaId}/insights?metric=reach&breakdown=follow_type&metric_type=total_value`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) {
    console.warn(`Reach breakdown error for ${mediaId}: ${data.error.message}`);
    return { reachFollower: null, reachNonFollower: null, newToken, expiresIn };
  }

  let reachFollower = 0;
  let reachNonFollower = 0;

  // total_value breakdown structure
  const reachMetric = data.data?.find((m) => m.name === 'reach');
  if (reachMetric?.total_value?.breakdowns) {
    for (const bd of reachMetric.total_value.breakdowns) {
      if (bd.dimension_keys?.includes('follow_type')) {
        for (const result of bd.results || []) {
          const followType = result.dimension_values?.[0];
          if (followType === 'FOLLOWER') reachFollower = result.value;
          if (followType === 'NON_FOLLOWER') reachNonFollower = result.value;
        }
      }
    }
  }

  return { reachFollower, reachNonFollower, newToken, expiresIn };
}

/**
 * List all media for an account with basic fields.
 * Returns up to `limit` items (max 100 per page; paginates automatically).
 */
export async function listAccountMedia(accessToken, igUserId, limit = 50) {
  const fields =
    'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count';
  const pageSize = Math.min(limit, 100);
  const url =
    `${GRAPH_BASE}/${igUserId}/media?fields=${fields}&limit=${pageSize}`;

  let all = [];
  let next = url;

  while (next && all.length < limit) {
    const { data, newToken } = await graphFetchWithRefresh(next, accessToken);
    if (data.error) throw new Error(data.error.message);
    all = all.concat(data.data || []);
    next = data.paging?.next || null;
    if (newToken) accessToken = newToken;
  }

  return all.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Hashtag Search API (3-step)
// ---------------------------------------------------------------------------

/**
 * Step 1: Resolve a hashtag string to a hashtag ID.
 * The hashtag_search endpoint requires the IG user ID as context.
 */
export async function resolveHashtagId(accessToken, igUserId, hashtag) {
  const tag = hashtag.replace(/^#/, '').toLowerCase();
  const url =
    `${GRAPH_BASE}/ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(tag)}`;
  const data = await graphFetch(url, accessToken);
  if (data.error) throw new Error(data.error.message);
  const id = data.data?.[0]?.id;
  if (!id) throw new Error(`Hashtag not found: #${tag}`);
  return id;
}

/**
 * Step 2: Fetch top_media for a resolved hashtag ID.
 * Returns up to 9 posts with like_count and comments_count.
 */
export async function getHashtagTopMedia(accessToken, hashtagId, igUserId) {
  const fields = 'id,like_count,comments_count,media_type,timestamp';
  const url =
    `${GRAPH_BASE}/${hashtagId}/top_media` +
    `?user_id=${igUserId}&fields=${fields}&limit=9`;
  const data = await graphFetch(url, accessToken);
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

// ---------------------------------------------------------------------------
// Business Discovery (competitor benchmarking)
// ---------------------------------------------------------------------------

/**
 * Fetch public profile data for a competitor handle using Business Discovery.
 * Returns followers_count, media_count, and recent_posts (last 20).
 */
export async function getBusinessDiscovery(accessToken, igUserId, targetHandle) {
  const mediaFields = 'id,like_count,comments_count,media_type,timestamp';
  // The target handle must be passed via .username(HANDLE); the metrics follow
  // as a field selector in braces. The previous .fields(...) form omitted the
  // handle, so Meta returned "(#100) The parameter username is required."
  const fields =
    `business_discovery.username(${targetHandle})` +
    `{username,followers_count,media_count,` +
    `media.limit(20){${mediaFields}}}`;

  const url = `${GRAPH_BASE}/${igUserId}?fields=${encodeURIComponent(fields)}`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) throw new Error(data.error.message);

  const bd = data.business_discovery;
  if (!bd) {
    throw new Error(
      `Business Discovery returned no data for @${targetHandle}. ` +
        `Make sure the account is a public Business or Creator account.`
    );
  }

  return {
    username: bd.username,
    followersCount: bd.followers_count,
    mediaCount: bd.media_count,
    recentPosts: bd.media?.data || [],
    newToken,
    expiresIn,
  };
}

// ---------------------------------------------------------------------------
// Account insights (follower count fallback)
// ---------------------------------------------------------------------------

/**
 * Fetch current follower count from the IG user node.
 */
export async function getFollowerCount(accessToken, igUserId) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_BASE}/${igUserId}?fields=followers_count`,
    accessToken
  );
  if (data.error) throw new Error(data.error.message);
  return { followersCount: data.followers_count, newToken, expiresIn };
}
