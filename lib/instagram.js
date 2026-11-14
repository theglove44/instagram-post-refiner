/**
 * Instagram Graph API Integration
 * Handles OAuth, publishing, and metrics fetching
 */

const INSTAGRAM_API_VERSION = 'v24.0';
export const GRAPH_API_BASE = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

/**
 * Parse a Graph API response, throwing a clear error if Meta returns HTML
 * (e.g. login pages, server errors) instead of JSON.
 */
async function parseGraphResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Meta API returned non-JSON response (HTTP ${response.status}). ` +
      `This usually means the access token is invalid or expired. ` +
      `Try disconnecting and reconnecting your Instagram account.`
    );
  }
}

/**
 * Fetch helper for Graph API calls using Authorization Bearer header.
 * OAuth token exchange endpoints should NOT use this — they pass
 * credentials as query parameters per the OAuth spec.
 */
export async function graphFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  return parseGraphResponse(response);
}

/**
 * Fetch with automatic token refresh on 401/expired token errors.
 * Wraps graphFetch and retries once with a refreshed token on auth failure.
 * Returns { data, newToken, expiresIn } where newToken is set if a refresh occurred.
 */
export async function graphFetchWithRefresh(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const data = await parseGraphResponse(response);

  // Check for token expiry errors
  if (data.error && (
    data.error.code === 190 || // OAuthException - expired/invalid token
    data.error.type === 'OAuthException' ||
    response.status === 401
  )) {
    // Try to refresh the token
    try {
      const refreshed = await refreshLongLivedToken(accessToken);

      // Retry the original request with the new token
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${refreshed.accessToken}`,
          ...options.headers,
        },
      });
      const retryData = await parseGraphResponse(retryResponse);

      return { data: retryData, newToken: refreshed.accessToken, expiresIn: refreshed.expiresIn };
    } catch (refreshError) {
      // Refresh failed, throw original error
      throw new Error(`Token expired and refresh failed: ${data.error.message}`);
    }
  }

  return { data, newToken: null };
}

/**
 * Compute an ISO expiry date string from an expiresIn value (seconds).
 * Called by route handlers when graphFetchWithRefresh returns a newToken.
 */
export function getTokenExpiryDate(expiresIn) {
  const expiryDate = new Date();
  expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
  return expiryDate.toISOString();
}

/**
 * Get the OAuth authorization URL for Instagram
 */
export function getAuthUrl(state) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Instagram App ID and Redirect URI must be configured');
  }

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'read_insights',
    'business_management',
  ].join(',');

  return `https://www.facebook.com/${INSTAGRAM_API_VERSION}/dialog/oauth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&response_type=code` +
    (state ? `&state=${encodeURIComponent(state)}` : '');
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${clientSecret}` +
    `&code=${code}`
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  // Exchange for long-lived token (60 days)
  return exchangeForLongLivedToken(data.access_token);
}

/**
 * Exchange short-lived token for long-lived token
 */
export async function exchangeForLongLivedToken(shortLivedToken) {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;

  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?` +
    `grant_type=fb_exchange_token` +
    `&client_id=${clientId}` +
    `&client_secret=${clientSecret}` +
    `&fb_exchange_token=${shortLivedToken}`
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in, // seconds until expiry (typically 60 days)
  };
}

/**
 * Get connected Instagram Business Account
 */
export async function getInstagramAccount(accessToken) {
  const pagesData = await graphFetch(
    `${GRAPH_API_BASE}/me/accounts`,
    accessToken
  );

  if (pagesData.error) {
    throw new Error(pagesData.error.message);
  }

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('No Facebook Pages found. Please connect your Instagram to a Facebook Page. Make sure you granted "pages_show_list" permission during authorization.');
  }

  const page = pagesData.data[0];
  const igData = await graphFetch(
    `${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account`,
    accessToken
  );

  if (igData.error) {
    throw new Error(igData.error.message);
  }

  if (!igData.instagram_business_account) {
    throw new Error('No Instagram Business Account linked to this Facebook Page.');
  }

  const igAccountId = igData.instagram_business_account.id;
  const details = await graphFetch(
    `${GRAPH_API_BASE}/${igAccountId}?fields=id,username,profile_picture_url,followers_count,media_count`,
    accessToken
  );

  if (details.error) {
    throw new Error(details.error.message);
  }

  return {
    instagramUserId: details.id,
    username: details.username,
    profilePicture: details.profile_picture_url,
    followersCount: details.followers_count,
    mediaCount: details.media_count,
    facebookPageId: page.id,
    pageAccessToken: page.access_token,
  };
}

/**
 * Publish a post to Instagram (text-only posts not supported, need image)
 */
export async function createMediaContainer(accessToken, instagramUserId, imageUrl, caption) {
  const data = await graphFetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
      }),
    }
  );

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.id;
}

/**
 * Publish the media container
 */
export async function publishMedia(accessToken, instagramUserId, containerId) {
  const data = await graphFetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media_publish`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
      }),
    }
  );

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.id;
}

// --- insight response parsing -------------------------------------------
// Meta returns a metric's value in `values[0].value` (lifetime/time-series)
// or in `total_value.value` (metric_type=total_value). An absent value means
// "no data", which is not the same as zero, so it maps to null.
function metricValue(metric) {
  return metric?.values?.[0]?.value ?? metric?.total_value?.value ?? null;
}

// Flatten a single-dimension breakdown to { DIMENSION: value }, or null when
// Meta sent no results. `upper` normalises enum-like keys: Meta documents them
// in capitals but returns some (story navigation) in lower case.
function breakdownMap(metric, { upper = false } = {}) {
  const results = metric?.total_value?.breakdowns?.[0]?.results;
  if (!results || results.length === 0) return null;
  const map = {};
  for (const result of results) {
    const key = String(result.dimension_values?.[0] ?? 'UNKNOWN');
    map[upper ? key.toUpperCase() : key] = result.value ?? null;
  }
  return map;
}

function metricsByName(list) {
  const byName = {};
  for (const metric of list || []) byName[metric.name] = metric;
  return byName;
}

const BASE_MEDIA_METRICS = ['reach', 'saved', 'shares', 'total_interactions', 'views'];

/**
 * The media insights a post supports depends on its type, and asking for an
 * unsupported metric fails the whole request. Verified against the live API
 * on 2026-11-14: FEED images and carousel parents accept the follower signals;
 * Reels accept reposts/total_views but not follows or profile visits.
 */
export function mediaInsightMetrics(mediaType, mediaProductType) {
  const isReel = mediaProductType === 'REELS';
  const isFeed = mediaProductType === 'FEED' && (mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM');
  if (isFeed) return [...BASE_MEDIA_METRICS, 'follows', 'profile_visits', 'profile_activity', 'reposts', 'total_views'];
  if (isReel) return [...BASE_MEDIA_METRICS, 'reposts', 'total_views'];
  return BASE_MEDIA_METRICS;
}

/**
 * Get media insights for a published post (two Graph calls).
 * Call 1 looks up the media type and, via a nested field, the profile_activity
 * breakdown (Meta rejects that breakdown alongside other metrics, and simply
 * omits it for media that don't support it). Call 2 fetches the metric set the
 * type supports. If Meta rejects the extended set, it retries with the base
 * set so the core numbers are never lost.
 * Uses graphFetchWithRefresh for automatic token renewal.
 */
export async function getMediaInsights(accessToken, mediaId) {
  let token = accessToken;
  let refreshed = null;
  const fetchGraph = async (url) => {
    const result = await graphFetchWithRefresh(url, token);
    if (result.newToken) {
      token = result.newToken;
      refreshed = { newToken: result.newToken, expiresIn: result.expiresIn };
    }
    return result.data;
  };
  const done = (insights) => ({ insights, newToken: refreshed?.newToken || null, expiresIn: refreshed?.expiresIn });

  let mediaData = await fetchGraph(
    `${GRAPH_API_BASE}/${mediaId}?fields=media_type,media_product_type,insights.metric(profile_activity).breakdown(action_type)`
  );
  if (mediaData.error) {
    mediaData = await fetchGraph(`${GRAPH_API_BASE}/${mediaId}?fields=media_type,media_product_type`);
  }

  const metrics = mediaInsightMetrics(mediaData.media_type, mediaData.media_product_type);
  let data = await fetchGraph(`${GRAPH_API_BASE}/${mediaId}/insights?metric=${metrics.join(',')}`);
  if (data.error && metrics !== BASE_MEDIA_METRICS) {
    console.warn(`Extended insights rejected for ${mediaId}, retrying base set:`, data.error.message);
    data = await fetchGraph(`${GRAPH_API_BASE}/${mediaId}/insights?metric=${BASE_MEDIA_METRICS.join(',')}`);
  }

  if (data.error) {
    console.warn('Insights error:', data.error.message);
    return done(null);
  }

  const insights = {};
  for (const metric of data.data || []) insights[metric.name] = metricValue(metric);
  const activity = metricsByName(mediaData.insights?.data).profile_activity;
  insights.profile_activity_breakdown = breakdownMap(activity, { upper: true });

  return done(insights);
}

/**
 * Get basic media details (likes, comments count from the media endpoint)
 * Uses graphFetchWithRefresh for automatic token renewal.
 */
export async function getMediaDetails(accessToken, mediaId) {
  const url = `${GRAPH_API_BASE}/${mediaId}?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    details: {
      id: data.id,
      caption: data.caption,
      mediaType: data.media_type,
      mediaProductType: data.media_product_type || null,
      permalink: data.permalink,
      timestamp: data.timestamp,
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
    },
    newToken,
    expiresIn,
  };
}

/**
 * Get recent media from Instagram account with optional cursor-based pagination.
 * When fetchAll is true, follows paging.next cursors until limit is reached.
 */
export async function getRecentMedia(accessToken, instagramUserId, limit = 25, fetchAll = false) {
  let allMedia = [];

  const firstPageData = await graphFetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=${Math.min(limit, 100)}`,
    accessToken
  );

  if (firstPageData.error) {
    throw new Error(firstPageData.error.message);
  }

  allMedia = allMedia.concat(firstPageData.data || []);
  let nextUrl = firstPageData.paging?.next || null;

  while (fetchAll && allMedia.length < limit && nextUrl) {
    // Use graphFetch to ensure the access token is sent as Bearer header —
    // Meta's paging.next URLs don't always include the token as a query param.
    const data = await graphFetch(nextUrl, accessToken);

    if (data.error) {
      throw new Error(data.error.message);
    }

    allMedia = allMedia.concat(data.data || []);
    nextUrl = data.paging?.next || null;
  }

  return allMedia.slice(0, limit);
}

/**
 * Get currently live stories for an Instagram Business Account.
 * Stories are ephemeral (24h), so this only returns stories that are currently active.
 */
export async function getStories(accessToken, instagramUserId) {
  const url = `${GRAPH_API_BASE}/${instagramUserId}/stories?fields=id,media_type,media_url,timestamp,caption`;
  const data = await graphFetch(url, accessToken);

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.data || [];
}

/**
 * Get insights for a single story media object.
 * Uses graphFetchWithRefresh for automatic token renewal.
 * Returns { insights, newToken, expiresIn } matching the pattern of getMediaInsights.
 */
export async function getStoryInsights(accessToken, storyMediaId) {
  const metrics = ['impressions', 'reach', 'replies', 'taps_forward', 'taps_back', 'exits'];
  const url = `${GRAPH_API_BASE}/${storyMediaId}/insights?metric=${metrics.join(',')}`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) {
    console.warn('Story insights error:', data.error.message);
    return { insights: null, newToken, expiresIn };
  }

  const insights = {};
  if (data.data) {
    data.data.forEach(metric => {
      insights[metric.name] = metric.values?.[0]?.value || 0;
    });
  }

  return { insights, newToken, expiresIn };
}

// =====================================================
// Content Publishing Functions (Phase 1)
// =====================================================

/**
 * Create a container for a single image post.
 * Supports alt_text (March 2025+) and user_tags.
 */
export async function createImageContainer(accessToken, instagramUserId, { imageUrl, caption, altText, userTags }) {
  const body = {
    image_url: imageUrl,
    caption: caption || '',
  };
  if (altText) body.alt_text = altText;
  if (userTags?.length) body.user_tags = JSON.stringify(userTags);

  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (data.error) throw new Error(data.error.message);
  return { containerId: data.id, newToken, expiresIn };
}

/**
 * Create a carousel container.
 * Step 1: Create child containers (image or video, no caption on children)
 * Step 2: Create parent container with caption and children array
 * Returns { containerId, childIds, newToken, expiresIn }
 */
export async function createCarouselContainer(accessToken, instagramUserId, { children, caption, userTags }) {
  let currentToken = accessToken;
  let latestNewToken = null;
  let latestExpiresIn = null;
  const childIds = [];

  // Create each child container
  for (const child of children) {
    const childBody = {};
    if (child.mediaType === 'VIDEO') {
      childBody.media_type = 'VIDEO';
      childBody.video_url = child.url;
    } else {
      childBody.image_url = child.url;
    }

    const { data, newToken, expiresIn } = await graphFetchWithRefresh(
      `${GRAPH_API_BASE}/${instagramUserId}/media`,
      currentToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childBody),
      }
    );

    if (newToken) {
      currentToken = newToken;
      latestNewToken = newToken;
      latestExpiresIn = expiresIn;
    }

    if (data.error) throw new Error(`Carousel child failed: ${data.error.message}`);
    childIds.push(data.id);
  }

  // Create parent carousel container
  const parentBody = {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: caption || '',
  };
  if (userTags?.length) parentBody.user_tags = JSON.stringify(userTags);

  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    currentToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parentBody),
    }
  );

  if (newToken) {
    latestNewToken = newToken;
    latestExpiresIn = expiresIn;
  }

  if (data.error) throw new Error(`Carousel parent failed: ${data.error.message}`);
  return { containerId: data.id, childIds, newToken: latestNewToken, expiresIn: latestExpiresIn };
}

/**
 * Create a container for a Reel (short-form video).
 */
export async function createReelContainer(accessToken, instagramUserId, { videoUrl, caption, coverUrl, userTags }) {
  const body = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    share_to_feed: true,
  };
  if (coverUrl) body.cover_url = coverUrl;
  if (userTags?.length) body.user_tags = JSON.stringify(userTags);

  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (data.error) throw new Error(data.error.message);
  return { containerId: data.id, newToken, expiresIn };
}

/**
 * Create a container for a Story.
 */
export async function createStoryContainer(accessToken, instagramUserId, { mediaUrl, mediaType }) {
  const body = { media_type: 'STORIES' };
  if (mediaType === 'VIDEO') {
    body.video_url = mediaUrl;
  } else {
    body.image_url = mediaUrl;
  }

  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (data.error) throw new Error(data.error.message);
  return { containerId: data.id, newToken, expiresIn };
}

/**
 * Check the status of a media container.
 * Returns { statusCode, id } where statusCode is one of:
 * EXPIRED, ERROR, FINISHED, IN_PROGRESS, PUBLISHED
 */
export async function checkContainerStatus(accessToken, containerId) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${containerId}?fields=status_code`,
    accessToken
  );

  if (data.error) throw new Error(data.error.message);
  return { statusCode: data.status_code, id: data.id, newToken, expiresIn };
}

/**
 * Check the content publishing rate limit for an account.
 * Returns { quotaUsage, quotaTotal, quotaDuration }
 */
export async function checkPublishingLimit(accessToken, instagramUserId) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/content_publishing_limit?fields=quota_usage,config{quota_total,quota_duration}`,
    accessToken
  );

  if (data.error) throw new Error(data.error.message);

  return {
    quotaUsage: data.quota_usage || 0,
    quotaTotal: data.config?.quota_total || 100,
    quotaDuration: data.config?.quota_duration || 86400,
    newToken,
    expiresIn,
  };
}

// =====================================================
// Engagement Functions (Phase 2)
// =====================================================

/**
 * Fetch all comments on a media object, including nested replies.
 * Returns { comments, newToken, expiresIn } where comments is an array.
 */
export async function getMediaComments(accessToken, mediaId) {
  const fields = 'id,text,timestamp,username,replies{id,text,timestamp,username}';
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${mediaId}/comments?fields=${fields}&limit=100`,
    accessToken
  );

  if (data.error) throw new Error(data.error.message);
  return { comments: data.data || [], newToken, expiresIn };
}

/**
 * Reply to a comment.
 * Returns { commentId, newToken, expiresIn }.
 */
export async function replyToComment(accessToken, commentId, message) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${commentId}/replies`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }
  );

  if (data.error) throw new Error(data.error.message);
  return { commentId: data.id, newToken, expiresIn };
}

/**
 * Hide or unhide a comment.
 */
export async function hideComment(accessToken, commentId, hide) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${commentId}`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hide }),
    }
  );

  if (data.error) throw new Error(data.error.message);
  return { success: data.success !== false, newToken, expiresIn };
}

/**
 * Delete a comment.
 */
export async function deleteComment(accessToken, commentId) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${commentId}`,
    accessToken,
    { method: 'DELETE' }
  );

  if (data.error) throw new Error(data.error.message);
  return { success: data.success !== false, newToken, expiresIn };
}

/**
 * Get media where the account is photo-tagged.
 */
export async function getTaggedMedia(accessToken, instagramUserId) {
  const fields = 'id,media_type,media_url,permalink,timestamp,caption,username';
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/tags?fields=${fields}`,
    accessToken
  );

  if (data.error) throw new Error(data.error.message);
  return { media: data.data || [], newToken, expiresIn };
}

/**
 * Get media where the account is @mentioned in the caption.
 */
export async function getMentionedMedia(accessToken, instagramUserId) {
  const fields = 'id,media_type,media_url,permalink,timestamp,caption,username';
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/mentioned_media?fields=${fields}`,
    accessToken
  );

  if (data.error) throw new Error(data.error.message);
  return { media: data.data || [], newToken, expiresIn };
}

/**
 * Subscribe the app to webhook events for an Instagram account.
 * Fields: 'comments', 'mentions', 'messages'
 */
export async function subscribeToWebhooks(accessToken, instagramUserId, fields) {
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/subscribed_apps`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscribed_fields: fields }),
    }
  );

  if (data.error) throw new Error(data.error.message);
  return { success: data.success !== false, newToken, expiresIn };
}

/**
 * Refresh a long-lived token (call before it expires)
 */
export async function refreshLongLivedToken(longLivedToken) {
  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?` +
    `grant_type=fb_exchange_token` +
    `&client_id=${process.env.INSTAGRAM_APP_ID}` +
    `&client_secret=${process.env.INSTAGRAM_APP_SECRET}` +
    `&fb_exchange_token=${longLivedToken}`
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Account-level views split by follower vs non-follower for a single day,
 * with a per-media-product-type breakdown (POST / REELS / STORY / VIDEO).
 * Graph API v24: the `views` metric supports the follow_type breakdown at
 * account level. This is the data that distinguishes "reached our followers"
 * from "reached strangers" — the piece missing from older analyses.
 */
export async function getViewsFollowBreakdown(accessToken, instagramUserId) {
  const url =
    `${GRAPH_API_BASE}/${instagramUserId}/insights` +
    `?metric=views&period=day&metric_type=total_value` +
    `&breakdown=follow_type,media_product_type`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) {
    throw new Error(data.error.message);
  }

  const entry = data.data?.[0];
  let follower = 0;
  let nonFollower = 0;
  const byProduct = {};

  for (const breakdown of entry?.total_value?.breakdowns || []) {
    for (const result of breakdown.results || []) {
      const [followType, product] = result.dimension_values || [];
      const count = result.value || 0;
      if (product) {
        byProduct[product] = byProduct[product] || { follower: 0, nonFollower: 0 };
        byProduct[product][followType === 'FOLLOWER' ? 'follower' : 'nonFollower'] += count;
      }
      if (followType === 'FOLLOWER') follower += count;
      else nonFollower += count;
    }
  }

  return {
    totalViews: entry?.total_value?.value ?? null,
    follower,
    nonFollower,
    byProduct,
    newToken,
    expiresIn,
  };
}

const STORY_METRICS = 'views,reach,replies,navigation,profile_activity,follows';

/**
 * Live Stories with their insights, in one call (Graph API v24 pattern).
 * v24 removed the per-story insights edge, so insights are requested as a
 * nested field on /stories. The navigation breakdown can't share a request
 * with other metrics, so the insights edge is requested twice under aliases
 * (`core` and `nav`) — still one HTTP call. If Meta rejects that form, the
 * previous un-aliased request runs so the nightly capture is never lost.
 * Returns [{ id, mediaType, timestamp, insights: {...} }].
 */
export async function getStoriesWithInsights(accessToken, instagramUserId) {
  const base = `${GRAPH_API_BASE}/${instagramUserId}/stories?fields=id,media_type,timestamp,`;
  let { data, newToken, expiresIn } = await graphFetchWithRefresh(
    base +
      `insights.metric(${STORY_METRICS},link_clicks).as(core),` +
      `insights.metric(navigation).breakdown(story_navigation_action_type).as(nav)`,
    accessToken
  );

  if (data.error) {
    console.warn('Aliased story insights rejected, retrying plain request:', data.error.message);
    const retry = await graphFetchWithRefresh(base + `insights.metric(${STORY_METRICS})`, newToken || accessToken);
    data = retry.data;
    newToken = retry.newToken || newToken;
    expiresIn = retry.expiresIn || expiresIn;
  }

  if (data.error) {
    throw new Error(data.error.message);
  }

  const stories = (data.data || []).map(story => {
    const insights = {};
    for (const metric of (story.core || story.insights)?.data || []) {
      insights[metric.name] = metricValue(metric);
    }
    if (story.nav) {
      const navigation = metricsByName(story.nav.data).navigation;
      insights.navigation = insights.navigation ?? metricValue(navigation);
      insights.navigation_breakdown = breakdownMap(navigation, { upper: true });
    }
    return {
      id: story.id,
      mediaType: story.media_type,
      timestamp: story.timestamp,
      insights,
    };
  });

  return { stories, newToken, expiresIn };
}

// --- account-level insights (evening cron) --------------------------------

async function accountInsights(accessToken, instagramUserId, query) {
  const { data } = await graphFetchWithRefresh(
    `${GRAPH_API_BASE}/${instagramUserId}/insights?${query}`,
    accessToken
  );
  if (data.error) throw new Error(data.error.message);
  return metricsByName(data.data);
}

/**
 * One UTC day of account totals — 2 Graph calls.
 *   follows_and_unfollows (follow_type): FOLLOWER = follows, NON_FOLLOWER = unfollows
 *   reach (follow_type), sharing that request because the breakdown matches
 *   profile_links_taps (contact_button_type)
 * Meta returns only a window total for these (no daily series), so each day
 * is its own request. An empty breakdown is stored as null: Meta sends nothing
 * both for "zero" and for "not processed yet" (recent days lag ~2 days).
 */
export async function getDailyAccountInsights(accessToken, instagramUserId, date) {
  const since = Date.parse(`${date}T00:00:00Z`) / 1000;
  const window = `period=day&metric_type=total_value&since=${since}&until=${since + 86400}`;

  const split = await accountInsights(accessToken, instagramUserId,
    `metric=reach,follows_and_unfollows&breakdown=follow_type&${window}`);
  const taps = await accountInsights(accessToken, instagramUserId,
    `metric=profile_links_taps&breakdown=contact_button_type&${window}`);

  const followSplit = breakdownMap(split.follows_and_unfollows) || {};
  const reachSplit = breakdownMap(split.reach) || {};
  return {
    date,
    follows: followSplit.FOLLOWER ?? null,
    unfollows: followSplit.NON_FOLLOWER ?? null,
    reach: metricValue(split.reach),
    reachFollower: reachSplit.FOLLOWER ?? null,
    reachNonFollower: reachSplit.NON_FOLLOWER ?? null,
    profileLinkTaps: metricValue(taps.profile_links_taps),
    profileLinkTapsByType: breakdownMap(taps.profile_links_taps, { upper: true }),
  };
}

/**
 * Followers online by hour for up to the last 30 days — 1 Graph call.
 * Hour keys are Pacific-time hours of the day ending at `endTime`. The two
 * most recent days come back empty (Meta lag) and are dropped.
 */
export async function getOnlineFollowers(accessToken, instagramUserId) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 29 * 86400;
  const byName = await accountInsights(accessToken, instagramUserId,
    `metric=online_followers&period=lifetime&since=${since}&until=${until}`);
  const days = (byName.online_followers?.values || [])
    .filter((v) => v.value && Object.keys(v.value).length > 0)
    .map((v) => ({ endTime: v.end_time, hours: v.value }));
  return { days };
}

/**
 * Who engaged this month, for comparison with follower_demographics —
 * 4 Graph calls (Meta allows one demographic breakdown per request).
 */
export async function getEngagedAudienceDemographics(accessToken, instagramUserId) {
  const result = {};
  for (const breakdown of ['age', 'gender', 'country', 'city']) {
    const byName = await accountInsights(accessToken, instagramUserId,
      `metric=engaged_audience_demographics&period=lifetime&timeframe=this_month&metric_type=total_value&breakdown=${breakdown}`);
    result[breakdown] = breakdownMap(byName.engaged_audience_demographics);
  }
  return result;
}

/**
 * Enhanced insights for a single Reel (Graph API v24 metric set).
 * Watch time is in milliseconds; skip rate is 0-1.
 */
export async function getReelEnhancedInsights(accessToken, mediaId) {
  const metrics = [
    'views',
    'total_views',
    'ig_reels_avg_watch_time',
    'ig_reels_video_view_total_time',
    'reels_skip_rate',
    'reposts',
    'saved',
    'shares',
    'total_interactions',
  ];
  const url =
    `${GRAPH_API_BASE}/${mediaId}/insights` +
    `?metric=${metrics.join(',')}&metric_type=total_value`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) {
    throw new Error(data.error.message);
  }

  const insights = {};
  for (const metric of data.data || []) {
    insights[metric.name] = metric.values?.[0]?.value ?? null;
  }

  return { insights, newToken, expiresIn };
}
