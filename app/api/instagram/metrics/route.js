import { getSupabaseClient } from '@/lib/supabase';
import { getMediaInsights, getMediaDetails, getTokenExpiryDate } from '@/lib/instagram';

// Delay helper for rate limiting Meta API calls (~200 calls/user/hour)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to convert undefined/missing to null (never 0)
function nullIfMissing(value) {
  return value !== undefined && value !== null ? value : null;
}

// Calculate engagement rate only if we have valid data
function calculateEngagementRate(likes, comments, saves, shares, reach) {
  // Only calculate if we have reach and at least one engagement metric
  if (reach === null || reach === undefined || reach === 0) return null;

  const validLikes = likes ?? 0;
  const validComments = comments ?? 0;
  const validSaves = saves ?? 0;
  const validShares = shares ?? 0;

  // If all engagement metrics are null, we can't calculate
  if (likes === null && comments === null && saves === null && shares === null) return null;

  const totalEngagement = validLikes + validComments + validSaves + validShares;
  return ((totalEngagement / reach) * 100).toFixed(2);
}

// Count missing metrics in a record
function countMissingMetrics(metrics) {
  const fields = ['impressions', 'reach', 'views', 'likes', 'comments', 'saves', 'shares'];
  return fields.filter(f => metrics[f] === null || metrics[f] === undefined).length;
}

/**
 * Persist a refreshed access token to the instagram_accounts table.
 * Called whenever graphFetchWithRefresh returns a newToken.
 */
async function persistRefreshedToken(supabase, accountId, newToken, expiresIn) {
  const updateData = { access_token: newToken };
  if (expiresIn) {
    updateData.token_expires_at = getTokenExpiryDate(expiresIn);
  }
  await supabase
    .from('instagram_accounts')
    .update(updateData)
    .eq('id', accountId);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('postId');

  try {
    const supabase = getSupabaseClient();

    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return Response.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    const account = accounts[0];
    let accessToken = account.access_token;

    // If postId provided, get metrics for specific post
    if (postId) {
      const { data: post } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (!post || !post.instagram_media_id) {
        return Response.json(
          { error: 'Post not found or not published to Instagram' },
          { status: 404 }
        );
      }

      // Get insights and details (both now return { insights/details, newToken, expiresIn })
      const [insightsResult, detailsResult] = await Promise.all([
        getMediaInsights(accessToken, post.instagram_media_id),
        getMediaDetails(accessToken, post.instagram_media_id),
      ]);

      const insights = insightsResult.insights;
      const details = detailsResult.details;

      // Persist refreshed token if either call triggered a refresh
      const refreshedToken = insightsResult.newToken || detailsResult.newToken;
      if (refreshedToken) {
        const expiresIn = insightsResult.expiresIn || detailsResult.expiresIn;
        await persistRefreshedToken(supabase, account.id, refreshedToken, expiresIn);
      }

      const metrics = {
        // impressions is deprecated since April 2025; column kept for historical data only
        impressions: null,
        reach: nullIfMissing(insights?.reach),
        views: nullIfMissing(insights?.views),
        likes: nullIfMissing(details?.likes ?? details?.like_count),
        comments: nullIfMissing(details?.comments ?? details?.comments_count),
        saves: nullIfMissing(insights?.saved),
        shares: nullIfMissing(insights?.shares),
        total_interactions: nullIfMissing(insights?.total_interactions),
        media_type: detailsResult.details?.mediaType || null,
      };

      const engagementRate = calculateEngagementRate(
        metrics.likes, metrics.comments, metrics.saves, metrics.shares, metrics.reach
      );

      // Store metrics snapshot
      await supabase
        .from('post_metrics')
        .insert({
          post_id: post.id,
          instagram_media_id: post.instagram_media_id,
          ...metrics,
          engagement_rate: engagementRate,
        });

      return Response.json({
        success: true,
        metrics: {
          ...metrics,
          engagementRate,
          permalink: details?.permalink,
        }
      });
    }

    // Otherwise, return all posts with their latest metrics
    const { data: postsWithMetrics } = await supabase
      .from('posts')
      .select(`
        *,
        post_metrics (
          impressions,
          reach,
          views,
          likes,
          comments,
          saves,
          shares,
          total_interactions,
          engagement_rate,
          fetched_at
        )
      `)
      .not('instagram_media_id', 'is', null)
      .order('published_at', { ascending: false });

    // Get latest metrics for each post
    const postsData = (postsWithMetrics || []).map(post => {
      const latestMetrics = post.post_metrics?.sort(
        (a, b) => new Date(b.fetched_at) - new Date(a.fetched_at)
      )[0] || null;

      return {
        id: post.id,
        topic: post.topic,
        editCount: post.edit_count,
        publishedAt: post.published_at,
        instagramPermalink: post.instagram_permalink,
        metrics: latestMetrics ? {
          impressions: latestMetrics.impressions,
          reach: latestMetrics.reach,
          views: latestMetrics.views,
          likes: latestMetrics.likes,
          comments: latestMetrics.comments,
          saves: latestMetrics.saves,
          shares: latestMetrics.shares,
          totalInteractions: latestMetrics.total_interactions,
          engagementRate: latestMetrics.engagement_rate,
          lastUpdated: latestMetrics.fetched_at,
        } : null,
      };
    });

    // Get last sync status
    const { data: lastSync } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'metrics')
      .order('completed_at', { ascending: false })
      .limit(1);

    return Response.json({
      success: true,
      posts: postsData,
      lastSync: lastSync?.[0] || null,
    });

  } catch (error) {
    console.error('Metrics error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Background metrics processing. Runs after the HTTP response is sent.
 * On a real server (not serverless), this continues executing even after
 * the response is returned to the client.
 *
 * Only refreshes posts published in the last `days` days (default 30)
 * plus any posts that have never had metrics fetched.
 */
async function processMetricsInBackground(syncId, { days = 30 } = {}) {
  const supabase = getSupabaseClient();

  try {
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'error', 0, 0, 1, { message: 'No Instagram account connected' });
      return;
    }

    const account = accounts[0];
    let accessToken = account.access_token;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get posts published within the window
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, instagram_media_id')
      .not('instagram_media_id', 'is', null)
      .gte('published_at', cutoffDate);

    // Get posts that have never had metrics fetched (regardless of age)
    const { data: allPublished } = await supabase
      .from('posts')
      .select('id, instagram_media_id')
      .not('instagram_media_id', 'is', null)
      .lt('published_at', cutoffDate);

    // Filter to those with no metrics at all
    let neverFetched = [];
    if (allPublished && allPublished.length > 0) {
      const { data: existingMetrics } = await supabase
        .from('post_metrics')
        .select('post_id')
        .in('post_id', allPublished.map(p => p.id));

      const hasMetrics = new Set((existingMetrics || []).map(m => m.post_id));
      neverFetched = allPublished.filter(p => !hasMetrics.has(p.id));
    }

    // Combine: recent posts + never-fetched older posts
    const publishedPosts = [...(recentPosts || []), ...neverFetched];

    if (!publishedPosts || publishedPosts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'success', 0, 0, 0);
      return;
    }

    let updated = 0;
    let totalMissing = 0;
    const errors = [];

    // Rate limiting derived from Meta's ~200 calls/user/hour budget
    const API_CALLS_PER_POST = 2;
    const HOURLY_BUDGET = 200;
    const DELAY_PER_POST_MS = Math.ceil((3600 / (HOURLY_BUDGET / API_CALLS_PER_POST)) * 1000); // ~36s

    for (let i = 0; i < publishedPosts.length; i++) {
      const post = publishedPosts[i];
      try {
        const [insightsResult, detailsResult] = await Promise.all([
          getMediaInsights(accessToken, post.instagram_media_id),
          getMediaDetails(accessToken, post.instagram_media_id),
        ]);

        const insights = insightsResult.insights;
        const details = detailsResult.details;

        const refreshedToken = insightsResult.newToken || detailsResult.newToken;
        if (refreshedToken) {
          const expiresIn = insightsResult.expiresIn || detailsResult.expiresIn;
          await persistRefreshedToken(supabase, account.id, refreshedToken, expiresIn);
          accessToken = refreshedToken;
        }

        const metrics = {
          impressions: null,
          reach: nullIfMissing(insights?.reach),
          views: nullIfMissing(insights?.views),
          likes: nullIfMissing(details?.likes ?? details?.like_count),
          comments: nullIfMissing(details?.comments ?? details?.comments_count),
          saves: nullIfMissing(insights?.saved),
          shares: nullIfMissing(insights?.shares),
          total_interactions: nullIfMissing(insights?.total_interactions),
          media_type: detailsResult.details?.mediaType || null,
        };

        const engagementRate = calculateEngagementRate(
          metrics.likes, metrics.comments, metrics.saves, metrics.shares, metrics.reach
        );

        totalMissing += countMissingMetrics(metrics);

        await supabase
          .from('post_metrics')
          .insert({
            post_id: post.id,
            instagram_media_id: post.instagram_media_id,
            ...metrics,
            engagement_rate: engagementRate,
          });

        updated++;
      } catch (err) {
        errors.push({ postId: post.id, error: err.message });
      }

      if (i < publishedPosts.length - 1) {
        await delay(DELAY_PER_POST_MS);
      }
    }

    await updateSyncStatus(
      supabase,
      syncId,
      errors.length === publishedPosts.length ? 'error' : 'success',
      updated,
      totalMissing,
      errors.length,
      errors.length > 0 ? { errors } : null
    );
  } catch (error) {
    console.error('Background metrics refresh error:', error);
    await updateSyncStatus(getSupabaseClient(), syncId, 'error', 0, 0, 1, { message: error.message });
  }
}

// Refresh metrics for recent published posts.
// Returns immediately with a syncId; processing continues in the background.
// The frontend polls GET /api/instagram/health to track progress.
// Accepts optional JSON body: { days: 30 } to control the lookback window.
export async function POST(request) {
  const supabase = getSupabaseClient();

  try {
    // Parse optional body
    let days = 30;
    try {
      const body = await request.json();
      if (body.days) days = Math.max(1, Math.min(365, body.days));
    } catch {
      // No body or invalid JSON — use default
    }

    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'metrics',
        status: 'running',
      })
      .select()
      .single();

    const syncId = syncRecord?.id;

    // Fire and forget — processing continues after response is sent
    processMetricsInBackground(syncId, { days });

    return Response.json({ success: true, syncId, status: 'running' });
  } catch (error) {
    console.error('Metrics refresh error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function updateSyncStatus(supabase, syncId, status, postsProcessed, metricsMissing, errorsCount, errorDetails = null) {
  if (!syncId) return;

  await supabase
    .from('sync_status')
    .update({
      status,
      completed_at: new Date().toISOString(),
      posts_processed: postsProcessed,
      metrics_missing: metricsMissing,
      errors_count: errorsCount,
      error_details: errorDetails,
    })
    .eq('id', syncId);
}
