import { getSupabaseClient } from '@/lib/supabase';
import { getMediaInsights, getMediaDetails, getTokenExpiryDate } from '@/lib/instagram';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nullIfMissing(value) {
  return value !== undefined && value !== null ? value : null;
}

function calculateEngagementRate(likes, comments, saves, shares, reach) {
  if (reach === null || reach === undefined || reach === 0) return null;
  const validLikes = likes ?? 0;
  const validComments = comments ?? 0;
  const validSaves = saves ?? 0;
  const validShares = shares ?? 0;
  if (likes === null && comments === null && saves === null && shares === null) return null;
  const totalEngagement = validLikes + validComments + validSaves + validShares;
  return ((totalEngagement / reach) * 100).toFixed(2);
}

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

/**
 * POST /api/instagram/metrics/backfill
 * Processes a batch of posts that have never had metrics fetched.
 * Designed to be called by a nightly cron job or manually from settings.
 *
 * Body: { batchSize?: number } — default 50
 * Returns: { processed, remaining, errors }
 */
export async function POST(request) {
  const supabase = getSupabaseClient();

  try {
    let batchSize = 50;
    try {
      const body = await request.json();
      if (body.batchSize) batchSize = Math.max(1, Math.min(100, body.batchSize));
    } catch {
      // defaults
    }

    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'No Instagram account connected' }, { status: 400 });
    }

    const account = accounts[0];
    let accessToken = account.access_token;

    // Find all published posts
    const { data: allPublished } = await supabase
      .from('posts')
      .select('id, instagram_media_id')
      .not('instagram_media_id', 'is', null)
      .order('published_at', { ascending: false });

    if (!allPublished || allPublished.length === 0) {
      return Response.json({ success: true, processed: 0, remaining: 0, errors: 0 });
    }

    // Find which ones already have metrics (in chunks to avoid query limits)
    const CHUNK = 500;
    const hasMetrics = new Set();
    for (let i = 0; i < allPublished.length; i += CHUNK) {
      const chunk = allPublished.slice(i, i + CHUNK);
      const { data: existing } = await supabase
        .from('post_metrics')
        .select('post_id')
        .in('post_id', chunk.map(p => p.id));
      (existing || []).forEach(m => hasMetrics.add(m.post_id));
    }

    const neverFetched = allPublished.filter(p => !hasMetrics.has(p.id));
    const batch = neverFetched.slice(0, batchSize);
    const remaining = neverFetched.length - batch.length;

    if (batch.length === 0) {
      console.log('Metrics backfill: All posts already have metrics');
      return Response.json({ success: true, processed: 0, remaining: 0, errors: 0 });
    }

    console.log(`Metrics backfill: Processing ${batch.length} of ${neverFetched.length} posts without metrics`);

    // Create sync record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({ sync_type: 'metrics_backfill', status: 'running' })
      .select()
      .single();

    // Process in background, return immediately
    processBackfillBatch(syncRecord?.id, batch, remaining, account, accessToken);

    return Response.json({
      success: true,
      syncId: syncRecord?.id,
      status: 'running',
      batchSize: batch.length,
      totalRemaining: neverFetched.length,
    });
  } catch (error) {
    console.error('Metrics backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/instagram/metrics/backfill
 * Returns the count of posts still needing metrics (for the settings UI).
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data: allPublished } = await supabase
      .from('posts')
      .select('id')
      .not('instagram_media_id', 'is', null);

    if (!allPublished || allPublished.length === 0) {
      return Response.json({ success: true, total: 0, withMetrics: 0, remaining: 0 });
    }

    const CHUNK = 500;
    const hasMetrics = new Set();
    for (let i = 0; i < allPublished.length; i += CHUNK) {
      const chunk = allPublished.slice(i, i + CHUNK);
      const { data: existing } = await supabase
        .from('post_metrics')
        .select('post_id')
        .in('post_id', chunk.map(p => p.id));
      (existing || []).forEach(m => hasMetrics.add(m.post_id));
    }

    const remaining = allPublished.filter(p => !hasMetrics.has(p.id)).length;

    // Get latest backfill sync status
    const { data: lastSync } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'metrics_backfill')
      .order('started_at', { ascending: false })
      .limit(1);

    return Response.json({
      success: true,
      total: allPublished.length,
      withMetrics: hasMetrics.size,
      remaining,
      lastSync: lastSync?.[0] || null,
    });
  } catch (error) {
    console.error('Metrics backfill status error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function processBackfillBatch(syncId, batch, remaining, account, accessToken) {
  const supabase = getSupabaseClient();
  const API_CALLS_PER_POST = 2;
  const HOURLY_BUDGET = 200;
  const DELAY_PER_POST_MS = Math.ceil((3600 / (HOURLY_BUDGET / API_CALLS_PER_POST)) * 1000);

  let processed = 0;
  const errors = [];

  try {
    for (let i = 0; i < batch.length; i++) {
      const post = batch[i];
      if (i % 10 === 0) {
        console.log(`Metrics backfill: ${i + 1}/${batch.length}...`);
      }

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
          media_product_type: detailsResult.details?.mediaProductType || null,
        };

        const engagementRate = calculateEngagementRate(
          metrics.likes, metrics.comments, metrics.saves, metrics.shares, metrics.reach
        );

        const { error: insertError } = await supabase
          .from('post_metrics')
          .insert({
            post_id: post.id,
            instagram_media_id: post.instagram_media_id,
            ...metrics,
            engagement_rate: engagementRate,
          });

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        processed++;
      } catch (err) {
        errors.push({ postId: post.id, error: err.message });
      }

      if (i < batch.length - 1) {
        await delay(DELAY_PER_POST_MS);
      }
    }

    console.log(`Metrics backfill complete: ${processed}/${batch.length} processed, ${errors.length} errors, ${remaining} still remaining`);

    if (syncId) {
      await supabase
        .from('sync_status')
        .update({
          status: errors.length === batch.length ? 'error' : 'success',
          completed_at: new Date().toISOString(),
          posts_processed: processed,
          errors_count: errors.length,
          error_details: errors.length > 0 ? { errors, remaining } : { remaining },
        })
        .eq('id', syncId);
    }
  } catch (error) {
    console.error('Backfill batch error:', error);
    if (syncId) {
      await supabase
        .from('sync_status')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          errors_count: 1,
          error_details: { message: error.message },
        })
        .eq('id', syncId);
    }
  }
}
