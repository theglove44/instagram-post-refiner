/**
 * Instagram Graph API Integration
 * Handles OAuth, publishing, and metrics fetching
 */

const INSTAGRAM_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

/**
 * Fetch helper for Graph API calls using Authorization Bearer header.
 * OAuth token exchange endpoints should NOT use this — they pass
 * credentials as query parameters per the OAuth spec.
 */
async function graphFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  return response.json();
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

  const data = await response.json();

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
      const retryData = await retryResponse.json();

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
  // First get Facebook Pages
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

  // Get Instagram account linked to the first page
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

  // Get Instagram account details
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
 * For now, this creates a "container" that can be published with an image
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

  return data.id; // container ID
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

  return data.id; // media ID
}

/**
 * Get media insights for a published post
 * Updated for Instagram API v21+ (impressions deprecated, use views)
 * Uses graphFetchWithRefresh for automatic token renewal.
 */
export async function getMediaInsights(accessToken, mediaId) {
  // First try to get the media type
  const typeUrl = `${GRAPH_API_BASE}/${mediaId}?fields=media_type`;
  const { data: mediaData, newToken: tokenAfterType } = await graphFetchWithRefresh(typeUrl, accessToken);

  // Use the refreshed token for subsequent requests if one was returned
  const currentToken = tokenAfterType || accessToken;

  // Core metrics available for all media types
  const metrics = ['reach', 'saved', 'shares', 'total_interactions', 'views'];

  const insightsUrl = `${GRAPH_API_BASE}/${mediaId}/insights?metric=${metrics.join(',')}`;
  const { data, newToken } = await graphFetchWithRefresh(insightsUrl, currentToken);

  if (data.error) {
    console.warn('Insights error:', data.error.message);
    return { insights: null, newToken: newToken || tokenAfterType };
  }

  // Parse the insights data into a simpler format
  const insights = {};
  if (data.data) {
    data.data.forEach(metric => {
      insights[metric.name] = metric.values?.[0]?.value || 0;
    });
  }

  return { insights, newToken: newToken || tokenAfterType };
}

/**
 * Get basic media details (likes, comments count from the media endpoint)
 * Uses graphFetchWithRefresh for automatic token renewal.
 */
export async function getMediaDetails(accessToken, mediaId) {
  const url = `${GRAPH_API_BASE}/${mediaId}?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count`;
  const { data, newToken } = await graphFetchWithRefresh(url, accessToken);

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    details: {
      id: data.id,
      caption: data.caption,
      mediaType: data.media_type,
      permalink: data.permalink,
      timestamp: data.timestamp,
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
    },
    newToken,
  };
}

/**
 * Get recent media from Instagram account with optional cursor-based pagination.
 * When fetchAll is true, follows paging.next cursors until limit is reached or
 * there are no more pages.
 */
export async function getRecentMedia(accessToken, instagramUserId, limit = 25, fetchAll = false) {
  let allMedia = [];
  let nextUrl = null;

  // First page uses graphFetch with Bearer header
  const firstPageData = await graphFetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=${Math.min(limit, 100)}`,
    accessToken
  );

  if (firstPageData.error) {
    throw new Error(firstPageData.error.message);
  }

  allMedia = allMedia.concat(firstPageData.data || []);
  nextUrl = firstPageData.paging?.next || null;

  // Follow pagination cursors if fetchAll is enabled
  while (fetchAll && allMedia.length < limit && nextUrl) {
    // Subsequent pages use the full URL returned by the API (includes access_token)
    const response = await fetch(nextUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    allMedia = allMedia.concat(data.data || []);
    nextUrl = data.paging?.next || null;
  }

  return allMedia.slice(0, limit);
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
