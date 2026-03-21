/**
 * Instagram Graph API Integration
 * Handles OAuth, publishing, and metrics fetching
 */

const INSTAGRAM_API_VERSION = 'v21.0';
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
export function getAuthUrl() {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Instagram App ID and Redirect URI must be configured');
  }

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ].join(',');

  return `https://www.facebook.com/${INSTAGRAM_API_VERSION}/dialog/oauth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&response_type=code`;
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

/**
 * Get media insights for a published post
 * Updated for Instagram API v21+ (impressions deprecated, use views)
 * Uses graphFetchWithRefresh for automatic token renewal.
 */
export async function getMediaInsights(accessToken, mediaId) {
  const typeUrl = `${GRAPH_API_BASE}/${mediaId}?fields=media_type`;
  const { data: mediaData, newToken: tokenAfterType, expiresIn: expiresAfterType } = await graphFetchWithRefresh(typeUrl, accessToken);

  const currentToken = tokenAfterType || accessToken;

  const metrics = ['reach', 'saved', 'shares', 'total_interactions', 'views'];

  const insightsUrl = `${GRAPH_API_BASE}/${mediaId}/insights?metric=${metrics.join(',')}`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(insightsUrl, currentToken);

  const finalToken = newToken || tokenAfterType;
  const finalExpiresIn = expiresIn || expiresAfterType;

  if (data.error) {
    console.warn('Insights error:', data.error.message);
    return { insights: null, newToken: finalToken, expiresIn: finalExpiresIn };
  }

  const insights = {};
  if (data.data) {
    data.data.forEach(metric => {
      insights[metric.name] = metric.values?.[0]?.value || 0;
    });
  }

  return { insights, newToken: finalToken, expiresIn: finalExpiresIn };
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
