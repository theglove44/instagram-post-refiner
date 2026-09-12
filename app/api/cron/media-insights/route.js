/**
 * GET /api/cron/media-insights
 * Collects the Graph API v24-only signals the nightly metrics sync doesn't:
 *   1. Account views split by follower vs non-follower (with product-type breakdown)
 *   2. Enhanced Reel insights (watch time, skip rate, reposts) for recent Reels
 *
 * Stored in account_insights_cache:
 *   - insight_type `views_follow_split:<YYYY-MM-DD>` — one row per day
 *   - insight_type `reel_insights:<media_id>` — upserted per Reel
 *
 * Called via: curl -H "x-cron-secret: ..." http://localhost:3000/api/cron/media-insights
 * Cost: ~2 calls + 1 per recent Reel — well inside the 200/hour limit.
 */
import { getServerSupabaseClient } from '@/lib/supabase-server';
import {
  getViewsFollowBreakdown,
  getReelEnhancedInsights,
  getTokenExpiryDate,
} from '@/lib/instagram';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function updateTokenIfRefreshed(supabase, instagramUserId, newToken, expiresIn) {
  if (!newToken) return;
  await supabase
    .from('instagram_accounts')
    .update({
      access_token: newToken,
      token_expires_at: getTokenExpiryDate(expiresIn || 60 * 24 * 60 * 60),
      updated_at: new Date().toISOString(),
    })
    .eq('instagram_user_id', instagramUserId);
}

export async function GET(request) {
  try {
    const supabase = getServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10) || 7, 30);

    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'No Instagram account connected' }, { status: 400 });
    }
    const account = accounts[0];
    let accessToken = account.access_token;
    const instagramUserId = account.instagram_user_id;
    const summary = { reelsSynced: 0, reelsFailed: 0 };

    // 1. Account views split (follower vs non-follower)
    let viewsSplit = null;
    try {
      const breakdown = await getViewsFollowBreakdown(accessToken, instagramUserId);
      await updateTokenIfRefreshed(supabase, instagramUserId, breakdown.newToken, breakdown.expiresIn);
      accessToken = breakdown.newToken || accessToken;
      viewsSplit = {
        date: todayKey(),
        totalViews: breakdown.totalViews,
        follower: breakdown.follower,
        nonFollower: breakdown.nonFollower,
        byProduct: breakdown.byProduct,
      };
      await supabase.from('account_insights_cache').upsert(
        {
          instagram_user_id: instagramUserId,
          insight_type: `views_follow_split:${todayKey()}`,
          data: viewsSplit,
        },
        { onConflict: 'instagram_user_id,insight_type' }
      );
    } catch (err) {
      return Response.json({ success: false, error: `Views split failed: ${err.message}` }, { status: 502 });
    }

    // 2. Enhanced insights for recent Reels
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id,instagram_media_id,published_at')
      .not('instagram_media_id', 'is', null)
      .gte('published_at', cutoff);

    // Identify which recent posts are Reels via their latest metric row
    const mediaIds = (recentPosts || []).map(p => p.instagram_media_id);
    let reelIds = new Set();
    if (mediaIds.length > 0) {
      const { data: rows } = await supabase
        .from('post_metrics')
        .select('instagram_media_id,media_type,media_product_type,fetched_at')
        .in('instagram_media_id', mediaIds)
        .order('fetched_at', { ascending: true });
      const latest = {};
      for (const row of rows || []) latest[row.instagram_media_id] = row;
      for (const [mediaId, row] of Object.entries(latest)) {
        if (row.media_product_type === 'REELS' || row.media_type === 'VIDEO') reelIds.add(mediaId);
      }
    }

    for (const mediaId of reelIds) {
      try {
        const result = await getReelEnhancedInsights(accessToken, mediaId);
        await updateTokenIfRefreshed(supabase, instagramUserId, result.newToken, result.expiresIn);
        accessToken = result.newToken || accessToken;
        const post = recentPosts.find(p => p.instagram_media_id === mediaId);
        await supabase.from('account_insights_cache').upsert(
          {
            instagram_user_id: instagramUserId,
            insight_type: `reel_insights:${mediaId}`,
            data: { ...result.insights, published_at: post?.published_at || null, capturedAt: new Date().toISOString() },
          },
          { onConflict: 'instagram_user_id,insight_type' }
        );
        summary.reelsSynced++;
      } catch (err) {
        console.warn(`Reel insights failed for ${mediaId}:`, err.message);
        summary.reelsFailed++;
      }
    }

    return Response.json({ success: true, viewsSplit, ...summary });
  } catch (error) {
    console.error('Media insights sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
