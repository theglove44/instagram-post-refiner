import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';
import {
  listAccountMedia,
  getPostInsights,
  getTokenExpiryDate,
  refreshLongLivedToken,
} from '../../../../lib/instagram.js';
import { delay, daysUntil } from '../../../../lib/utils.js';

const HOURS_THRESHOLD = 48; // Only fetch insights for posts older than this

/**
 * GET /api/insights/posts
 * Fetch and store per-post metrics for all posts that:
 *   1. Were published at least 48h ago (insights stabilise after 48h)
 *   2. Don't yet have a row in tat_post_metrics (or can be refreshed)
 *
 * Also accepts ?refresh=1 to re-fetch all post metrics (useful after a
 * long gap).
 *
 * Cron-triggerable via x-cron-secret header.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  try {
    const supabase = getServerSupabaseClient();

    // Load account
    const { data: account, error: accountError } = await supabase
      .from('tat_accounts')
      .select('id, instagram_user_id, access_token, token_expires_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) throw new Error(accountError.message);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'not_connected' },
        { status: 401 }
      );
    }

    let accessToken = account.access_token;

    // Auto-refresh token if expiring soon
    if (daysUntil(account.token_expires_at) < 7) {
      try {
        const refreshed = await refreshLongLivedToken(accessToken);
        accessToken = refreshed.accessToken;
        await supabase
          .from('tat_accounts')
          .update({
            access_token: accessToken,
            token_expires_at: getTokenExpiryDate(refreshed.expiresIn),
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);
      } catch {
        // Continue with existing token
      }
    }

    // Load all media from Instagram (up to 100 posts)
    const allMedia = await listAccountMedia(accessToken, account.instagram_user_id, 100);

    // Filter: published at least 48h ago
    const cutoff = new Date(Date.now() - HOURS_THRESHOLD * 60 * 60 * 1000);
    const eligibleMedia = allMedia.filter(
      (m) => m.timestamp && new Date(m.timestamp) < cutoff
    );

    if (!forceRefresh) {
      // Skip posts we already have metrics for
      const { data: existing } = await supabase
        .from('tat_post_metrics')
        .select('instagram_media_id')
        .limit(1000);

      const existingIds = new Set((existing || []).map((r) => r.instagram_media_id));
      const toFetch = eligibleMedia.filter((m) => !existingIds.has(m.id));

      if (toFetch.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No new posts to process.',
          processed: 0,
        });
      }

      return await fetchAndStoreInsights(
        supabase,
        account,
        accessToken,
        toFetch
      );
    }

    return await fetchAndStoreInsights(
      supabase,
      account,
      accessToken,
      eligibleMedia
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

async function fetchAndStoreInsights(supabase, account, accessToken, mediaList) {
  let processed = 0;
  let errors = 0;
  let currentToken = accessToken;

  for (const media of mediaList) {
    try {
      // Base insights
      const { insights, newToken: t1, expiresIn: e1 } = await getPostInsights(
        currentToken,
        media.id,
        media.media_product_type
      );

      if (t1) {
        currentToken = t1;
        await persistToken(supabase, account.id, t1, e1);
      }

      const row = {
        instagram_media_id: media.id,
        caption: media.caption || null,
        media_type: media.media_type || null,
        media_product_type: media.media_product_type || null,
        permalink: media.permalink || null,
        published_at: media.timestamp || null,
        like_count: media.like_count || null,
        comments_count: media.comments_count || null,
        reach: insights?.reach ?? null,
        reach_follower: insights?.reach_follower ?? null,
        reach_non_follower: insights?.reach_non_follower ?? null,
        saves: insights?.saved ?? null,
        shares: insights?.shares ?? null,
        views: insights?.views ?? null,
        follows: insights?.follows ?? null,
        profile_visits: insights?.profile_visits ?? null,
        total_interactions: insights?.total_interactions ?? null,
        reels_skip_rate: insights?.reels_skip_rate ?? null,
        reels_avg_watch_time: insights?.ig_reels_avg_watch_time ?? null,
        fetched_at: new Date().toISOString(),
      };

      await supabase
        .from('tat_post_metrics')
        .upsert(row, { onConflict: 'instagram_media_id' });

      processed++;
    } catch (err) {
      console.error(`Error fetching insights for ${media.id}: ${err.message}`);
      errors++;
    }

    // Respect Meta rate limits (~200 calls/hour)
    await delay(400);
  }

  return NextResponse.json({
    success: true,
    processed,
    errors,
    total: mediaList.length,
  });
}

async function persistToken(supabase, accountId, token, expiresIn) {
  await supabase
    .from('tat_accounts')
    .update({
      access_token: token,
      token_expires_at: getTokenExpiryDate(expiresIn),
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
}
