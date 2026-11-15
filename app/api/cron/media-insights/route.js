/**
 * GET /api/cron/media-insights
 * Collects the Graph API v24-only signals the nightly metrics sync doesn't:
 *   1. Account views split by follower vs non-follower (with product-type breakdown)
 *   2. Enhanced Reel insights (watch time, skip rate, reposts) for recent Reels
 *
 * Stored in account_insights_cache:
 *   - insight_type `views_follow_split:<YYYY-MM-DD>` — one row per day
 *   - insight_type `reel_insights:<media_id>` — upserted per Reel
 *   - insight_type `story_insights:<media_id>` — upserted per live Story
 *   - insight_type `account_daily:<YYYY-MM-DD>` — follows/unfollows, reach split,
 *     profile link taps for one UTC day (last 3 days re-collected each run)
 *   - insight_type `online_followers:latest` — hourly online followers, ~28 days
 *   - insight_type `engaged_demographics:<YYYY-MM>` — this month's engaged audience
 *   - insight_type `fb_page_daily:<YYYY-MM-DD>` — Facebook Page views, viewers,
 *     followers, follows/unfollows for one Pacific day (same window as account days)
 *   - insight_type `fb_post_views:<media_id>` — Facebook views vs total views
 *     for the 25 most recent posts (lib/facebook-page.js)
 *
 * Stories expire after 24h, so this sweep is the only chance to capture them.
 * Called via: curl -H "x-cron-secret: ..." http://localhost:3000/api/cron/media-insights
 * Cost: ~1 call + 1 per recent Reel + 1 for Stories + 2 per account day (3 by
 * default) + 1 online + 4 demographics + 4 Facebook ≈ 24 calls — well inside
 * 200/hour. One-off backfill: ?accountDays=28 adds up to 56 calls (cap 28);
 * the Facebook Page backfill rides along at no extra cost.
 */
import { getServerSupabaseClient } from '@/lib/supabase-server';
import {
  getViewsFollowBreakdown,
  getReelEnhancedInsights,
  getStoriesWithInsights,
  getDailyAccountInsights,
  getOnlineFollowers,
  getEngagedAudienceDemographics,
  getTokenExpiryDate,
} from '@/lib/instagram';
import { syncFacebookInsights } from '@/lib/facebook-page';

function todayKey() {
  return new Date(Date.now()).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ACCOUNT_DAYS = 3;
const MAX_ACCOUNT_DAYS = 28;

// Complete UTC days, newest first: yesterday, the day before, ...
function recentUtcDays(count) {
  const midnight = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  return Array.from({ length: count }, (_, i) => new Date(midnight - (i + 1) * DAY_MS).toISOString().slice(0, 10));
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
    const accountDays = Math.max(1, Math.min(
      parseInt(searchParams.get('accountDays') || String(DEFAULT_ACCOUNT_DAYS), 10) || DEFAULT_ACCOUNT_DAYS,
      MAX_ACCOUNT_DAYS
    ));

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
    const summary = { reelsSynced: 0, reelsFailed: 0, storiesSynced: 0, accountDaysSynced: 0, accountDaysFailed: 0, accountErrors: [] };
    const cacheUpsert = (insightType, data) => supabase.from('account_insights_cache').upsert(
      { instagram_user_id: instagramUserId, insight_type: insightType, data: { ...data, capturedAt: new Date().toISOString() } },
      { onConflict: 'instagram_user_id,insight_type' }
    );

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

    // 3. Stories sweep — Stories expire after 24h, so capture while they are live.
    // Final capture is the last nightly run before expiry (~18h into their life).
    let storiesSynced = 0;
    try {
      const { stories, newToken: storyToken, expiresIn: storyExpires } =
        await getStoriesWithInsights(accessToken, instagramUserId);
      await updateTokenIfRefreshed(supabase, instagramUserId, storyToken, storyExpires);
      accessToken = storyToken || accessToken;

      for (const story of stories) {
        await supabase.from('account_insights_cache').upsert(
          {
            instagram_user_id: instagramUserId,
            insight_type: `story_insights:${story.id}`,
            data: {
              ...story.insights,
              mediaType: story.mediaType,
              postedAt: story.timestamp,
              capturedAt: new Date().toISOString(),
            },
          },
          { onConflict: 'instagram_user_id,insight_type' }
        );
        storiesSynced++; // eslint-disable-line no-unused-vars
      }
      summary.storiesSynced = storiesSynced;
    } catch (err) {
      console.warn('Stories sweep failed:', err.message);
      summary.storiesError = err.message;
    }

    // 4. Account follower signals. Meta's daily figures settle ~2 days late, so
    // the last few days are re-collected each run and overwrite earlier captures.
    for (const date of recentUtcDays(accountDays)) {
      try {
        const day = await getDailyAccountInsights(accessToken, instagramUserId, date);
        await cacheUpsert(`account_daily:${date}`, day);
        summary.accountDaysSynced++;
      } catch (err) {
        console.warn(`Account insights failed for ${date}:`, err.message);
        summary.accountDaysFailed++;
        if (summary.accountDaysFailed === 1) summary.accountErrors.push(`account_daily: ${err.message}`);
      }
    }

    try {
      const online = await getOnlineFollowers(accessToken, instagramUserId);
      await cacheUpsert('online_followers:latest', online);
    } catch (err) {
      console.warn('Online followers failed:', err.message);
      summary.accountErrors.push(`online_followers: ${err.message}`);
    }

    try {
      const demographics = await getEngagedAudienceDemographics(accessToken, instagramUserId);
      await cacheUpsert(`engaged_demographics:${todayKey().slice(0, 7)}`, demographics);
    } catch (err) {
      console.warn('Engaged audience demographics failed:', err.message);
      summary.accountErrors.push(`engaged_demographics: ${err.message}`);
    }

    // 5. Facebook: Page trend + crossposted views. Never aborts the run.
    let facebook;
    try {
      const { newToken, expiresIn, ...fbSummary } = await syncFacebookInsights({
        userToken: accessToken,
        pageId: account.facebook_page_id || null,
        instagramUserId,
        save: cacheUpsert,
        days: accountDays,
      });
      await updateTokenIfRefreshed(supabase, instagramUserId, newToken, expiresIn);
      facebook = fbSummary;
    } catch (err) {
      console.warn('Facebook sweep failed:', err.message);
      facebook = { errors: [`facebook: ${err.message}`] };
    }

    return Response.json({ success: true, viewsSplit, ...summary, facebook });
  } catch (error) {
    console.error('Media insights sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
