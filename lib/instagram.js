/**
 * Instagram Graph API Integration
 * Handles OAuth, publishing, and metrics fetching
 */

const INSTAGRAM_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

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
  const pagesResponse = await fetch(
    `${GRAPH_API_BASE}/me/accounts?access_token=${accessToken}`
  );
  const pagesData = await pagesResponse.json();
  
  if (pagesData.error) {
    throw new Error(pagesData.error.message);
  }
  
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('No Facebook Pages found. Please connect your Instagram to a Facebook Page. Make sure you granted "pages_show_list" permission during authorization.');
  }
  
  // Get Instagram account linked to the first page
  const page = pagesData.data[0];
  const igResponse = await fetch(
    `${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
  );
  const igData = await igResponse.json();
  
  if (igData.error) {
    throw new Error(igData.error.message);
  }
  
  if (!igData.instagram_business_account) {
    throw new Error('No Instagram Business Account linked to this Facebook Page.');
  }
  
  // Get Instagram account details
  const igAccountId = igData.instagram_business_account.id;
  const detailsResponse = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}?fields=id,username,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
  );
  const details = await detailsResponse.json();
  
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
  const response = await fetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: accessToken,
      }),
    }
  );
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.id; // container ID
}

/**
 * Publish the media container
 */
export async function publishMedia(accessToken, instagramUserId, containerId) {
  const response = await fetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.id; // media ID
}

/**
 * Get media insights for a published post
 * Updated for Instagram API v21+ (impressions deprecated, use views)
 */
export async function getMediaInsights(accessToken, mediaId) {
  // First try to get the media type
  const mediaResponse = await fetch(
    `${GRAPH_API_BASE}/${mediaId}?fields=media_type&access_token=${accessToken}`
  );
  const mediaData = await mediaResponse.json();
  const mediaType = mediaData.media_type;
  
  // Core metrics available for all media types
  let metrics = ['reach', 'saved', 'shares', 'total_interactions', 'views'];
  
  const response = await fetch(
    `${GRAPH_API_BASE}/${mediaId}/insights?metric=${metrics.join(',')}&access_token=${accessToken}`
  );
  
  const data = await response.json();
  
  if (data.error) {
    console.warn('Insights error:', data.error.message);
    return null;
  }
  
  // Parse the insights data into a simpler format
  const insights = {};
  if (data.data) {
    data.data.forEach(metric => {
      insights[metric.name] = metric.values?.[0]?.value || 0;
    });
  }
  
  return insights;
}

/**
 * Get basic media details (likes, comments count from the media endpoint)
 */
export async function getMediaDetails(accessToken, mediaId) {
  const response = await fetch(
    `${GRAPH_API_BASE}/${mediaId}?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&access_token=${accessToken}`
  );
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return {
    id: data.id,
    caption: data.caption,
    mediaType: data.media_type,
    permalink: data.permalink,
    timestamp: data.timestamp,
    likes: data.like_count || 0,
    comments: data.comments_count || 0,
  };
}

/**
 * Get recent media from Instagram account
 */
export async function getRecentMedia(accessToken, instagramUserId, limit = 25) {
  const response = await fetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
  );
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.data || [];
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
