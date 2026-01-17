import { getSupabaseClient } from '@/lib/supabase';
import { getMediaInsights, getMediaDetails } from '@/lib/instagram';

// Helper to convert undefined/missing to null (never 0)
function nullIfMissing(value) {
  return value !== undefined && value !== null ? value : null;
}

// Calculate engagement rate only if we have valid data
function calculateEngagementRate(likes, comments, saves, reach) {
  // Only calculate if we have reach and at least one engagement metric
  if (reach === null || reach === undefined || reach === 0) return null;
  
  const validLikes = likes ?? 0;
  const validComments = comments ?? 0;
  const validSaves = saves ?? 0;
  
  // If all engagement metrics are null, we can't calculate
  if (likes === null && comments === null && saves === null) return null;
  
  const totalEngagement = validLikes + validComments + validSaves;
  return ((totalEngagement / reach) * 100).toFixed(2);
}

// Count missing metrics in a record
function countMissingMetrics(metrics) {
  const fields = ['impressions', 'reach', 'views', 'likes', 'comments', 'saves', 'shares'];
  return fields.filter(f => metrics[f] === null || metrics[f] === undefined).length;
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
    const accessToken = account.access_token;
    
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
      
      // Get insights and details
      const [insights, details] = await Promise.all([
        getMediaInsights(accessToken, post.instagram_media_id),
        getMediaDetails(accessToken, post.instagram_media_id),
      ]);
      
      const metrics = {
        impressions: nullIfMissing(insights?.impressions),
        reach: nullIfMissing(insights?.reach),
        views: nullIfMissing(insights?.plays),
        likes: nullIfMissing(details?.likes ?? details?.like_count),
        comments: nullIfMissing(details?.comments ?? details?.comments_count),
        saves: nullIfMissing(insights?.saved),
        shares: nullIfMissing(insights?.shares),
      };
      
      const engagementRate = calculateEngagementRate(
        metrics.likes, metrics.comments, metrics.saves, metrics.reach
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

// Refresh metrics for all published posts
export async function POST() {
  const supabase = getSupabaseClient();
  let syncId = null;
  
  try {
    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'metrics',
        status: 'running',
      })
      .select()
      .single();
    
    syncId = syncRecord?.id;
    
    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);
    
    if (!accounts || accounts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'error', 0, 0, 1, { message: 'No Instagram account connected' });
      return Response.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }
    
    const account = accounts[0];
    const accessToken = account.access_token;
    
    // Get all published posts
    const { data: publishedPosts } = await supabase
      .from('posts')
      .select('id, instagram_media_id')
      .not('instagram_media_id', 'is', null);
    
    if (!publishedPosts || publishedPosts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'success', 0, 0, 0);
      return Response.json({ success: true, updated: 0, syncId });
    }
    
    let updated = 0;
    let totalMissing = 0;
    const errors = [];
    
    // Fetch metrics for each post
    for (const post of publishedPosts) {
      try {
        const [insights, details] = await Promise.all([
          getMediaInsights(accessToken, post.instagram_media_id),
          getMediaDetails(accessToken, post.instagram_media_id),
        ]);
        
        const metrics = {
          impressions: nullIfMissing(insights?.impressions),
          reach: nullIfMissing(insights?.reach),
          views: nullIfMissing(insights?.plays),
          likes: nullIfMissing(details?.likes ?? details?.like_count),
          comments: nullIfMissing(details?.comments ?? details?.comments_count),
          saves: nullIfMissing(insights?.saved),
          shares: nullIfMissing(insights?.shares),
        };
        
        const engagementRate = calculateEngagementRate(
          metrics.likes, metrics.comments, metrics.saves, metrics.reach
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
    }
    
    // Update sync status
    await updateSyncStatus(
      supabase, 
      syncId, 
      errors.length === publishedPosts.length ? 'error' : 'success',
      updated,
      totalMissing,
      errors.length,
      errors.length > 0 ? { errors } : null
    );
    
    return Response.json({
      success: true,
      updated,
      metricsMissing: totalMissing,
      errors: errors.length > 0 ? errors : undefined,
      syncId,
    });
    
  } catch (error) {
    console.error('Metrics refresh error:', error);
    if (syncId) {
      await updateSyncStatus(supabase, syncId, 'error', 0, 0, 1, { message: error.message });
    }
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
