/**
 * POST /api/instagram/metrics/catchup
 * Re-measures older posts so they pick up the follower signals Phase 1 added
 * (follows, profile visits, reposts, total views). Only new snapshots carry
 * them, and posts that already had metrics were never re-fetched.
 *
 * Capped and resumable: each run takes the newest posts still waiting (see
 * lib/signal-catchup.js), at most 50, and leaves the rest for the next run.
 * Cost is 3 Graph calls per post (two for insights, one for likes/comments), so
 * the default 40 posts is 120 calls and the 50 cap is 150 — inside Meta's
 * ~200/hour. Posts are spaced 54s apart so no hour ever exceeds the budget.
 *
 * Returns immediately ({ success, syncId, status: "running" }); the work
 * continues in the background (Cloudflare times out at 100s). Progress is in
 * sync_status (sync_type "signal_catchup") and shows on /api/instagram/health.
 * Meant for its own systemd timer (deploy/instagram-signal-catchup.timer),
 * well away from the 03:00 nightly run. It also refuses to start while a
 * backfill, refresh or earlier catch-up is still running.
 *
 * GET returns how many posts are still waiting (no Graph calls).
 */
import { delay } from '@/lib/utils';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getMediaInsights, getMediaDetails, getTokenExpiryDate } from '@/lib/instagram';
import { buildSnapshotRow, insertPostMetrics } from '@/lib/post-metrics';
import { findCatchupCandidates } from '@/lib/signal-catchup';

const SYNC_TYPE = 'signal_catchup';
const DEFAULT_BATCH = 40;
const MAX_BATCH = 50;
const GRAPH_CALLS_PER_POST = 3;
const HOURLY_BUDGET = 200;
const DELAY_PER_POST_MS = Math.ceil((3600 / (HOURLY_BUDGET / GRAPH_CALLS_PER_POST)) * 1000); // 54s
const BUSY_WINDOW_MS = 3 * 60 * 60 * 1000;
const FAILURE_MEMORY_MS = 7 * 24 * 60 * 60 * 1000;

async function persistRefreshedToken(supabase, accountId, newToken, expiresIn) {
  const updateData = { access_token: newToken };
  if (expiresIn) updateData.token_expires_at = getTokenExpiryDate(expiresIn);
  await supabase.from('instagram_accounts').update(updateData).eq('id', accountId);
}

async function isOtherSyncRunning(supabase) {
  const since = new Date(Date.now() - BUSY_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('sync_status')
    .select('id, sync_type')
    .in('sync_type', ['metrics_backfill', 'metrics', SYNC_TYPE])
    .eq('status', 'running')
    .gte('started_at', since)
    .limit(1);
  return (data || []).length > 0;
}

// Posts that failed in the last week (deleted media, permission gaps) sit out,
// so a handful of dead posts at the front can't starve the rest every night.
async function recentlyFailedPostIds(supabase) {
  const since = new Date(Date.now() - FAILURE_MEMORY_MS).toISOString();
  const { data } = await supabase
    .from('sync_status')
    .select('error_details')
    .eq('sync_type', SYNC_TYPE)
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(20);
  const ids = new Set();
  for (const row of data || []) {
    for (const e of row.error_details?.errors || []) if (e?.postId) ids.add(e.postId);
  }
  return ids;
}

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const { totalRemaining } = await findCatchupCandidates(supabase, { limit: 0 });
    const { data: lastSync } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', SYNC_TYPE)
      .order('started_at', { ascending: false })
      .limit(1);
    return Response.json({ success: true, remaining: totalRemaining, lastSync: lastSync?.[0] || null });
  } catch (error) {
    console.error('Signal catch-up status error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const supabase = getServerSupabaseClient();

  try {
    let batchSize = DEFAULT_BATCH;
    try {
      const body = await request.json();
      if (body.batchSize) batchSize = Math.max(1, Math.min(MAX_BATCH, Math.floor(body.batchSize)));
    } catch {
      // defaults
    }

    const { data: accounts } = await supabase.from('instagram_accounts').select('*').limit(1);
    if (!accounts || accounts.length === 0) {
      return Response.json({ success: false, error: 'No Instagram account connected' }, { status: 400 });
    }
    const account = accounts[0];

    if (await isOtherSyncRunning(supabase)) {
      return Response.json({ success: true, skipped: true, reason: 'Another metrics job is still running; try again later.' });
    }

    const skipPostIds = await recentlyFailedPostIds(supabase);
    const { candidates, totalRemaining } = await findCatchupCandidates(supabase, { limit: batchSize, skipPostIds });

    if (candidates.length === 0) {
      return Response.json({ success: true, processed: 0, remaining: 0, errors: 0 });
    }

    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({ sync_type: SYNC_TYPE, status: 'running' })
      .select()
      .single();

    processCatchupBatch(syncRecord?.id, candidates, totalRemaining - candidates.length, account);

    return Response.json({
      success: true,
      syncId: syncRecord?.id,
      status: 'running',
      batchSize: candidates.length,
      totalRemaining,
    });
  } catch (error) {
    console.error('Signal catch-up error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function processCatchupBatch(syncId, batch, remaining, account) {
  const supabase = getServerSupabaseClient();
  let accessToken = account.access_token;
  let processed = 0;
  const errors = [];

  try {
    for (let i = 0; i < batch.length; i++) {
      const post = batch[i];
      try {
        const [insightsResult, detailsResult] = await Promise.all([
          getMediaInsights(accessToken, post.instagram_media_id),
          getMediaDetails(accessToken, post.instagram_media_id),
        ]);

        const refreshedToken = insightsResult.newToken || detailsResult.newToken;
        if (refreshedToken) {
          await persistRefreshedToken(supabase, account.id, refreshedToken, insightsResult.expiresIn || detailsResult.expiresIn);
          accessToken = refreshedToken;
        }

        // Without insights the new row would hold no reach and become the
        // "latest" snapshot everything else reads, so keep the old one.
        if (!insightsResult.insights) throw new Error('Meta returned no insights');

        const { error: insertError } = await insertPostMetrics(
          supabase,
          buildSnapshotRow(post, insightsResult.insights, detailsResult.details)
        );
        if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
        processed++;
      } catch (err) {
        errors.push({ postId: post.id, error: err.message });
      }

      if (i < batch.length - 1) await delay(DELAY_PER_POST_MS);
    }

    console.log(`Signal catch-up complete: ${processed}/${batch.length} processed, ${errors.length} errors, ${remaining} still waiting`);

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
    console.error('Signal catch-up batch error:', error);
    if (syncId) {
      await supabase
        .from('sync_status')
        .update({ status: 'error', completed_at: new Date().toISOString(), errors_count: 1, error_details: { message: error.message } })
        .eq('id', syncId);
    }
  }
}
