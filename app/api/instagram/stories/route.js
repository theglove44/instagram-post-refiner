import { getSupabaseClient } from '@/lib/supabase';
import { getStories, getStoryInsights, getTokenExpiryDate } from '@/lib/instagram';

// Delay helper for rate limiting Meta API calls
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to convert undefined/missing to null
function nullIfMissing(value) {
  return value !== undefined && value !== null ? value : null;
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

/**
 * GET /api/instagram/stories
 * Returns all stored story metrics from Supabase, ordered by posted_at DESC.
 * Includes a summary: totalStories, avgReach, avgCompletionRate.
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data: stories, error } = await supabase
      .from('story_metrics')
      .select('*')
      .order('posted_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const storyList = stories || [];

    // Compute summary statistics
    const totalStories = storyList.length;
    let avgReach = 0;
    let avgCompletionRate = 0;

    if (totalStories > 0) {
      const reachValues = storyList.filter(s => s.reach !== null).map(s => s.reach);
      avgReach = reachValues.length > 0
        ? Math.round(reachValues.reduce((sum, v) => sum + v, 0) / reachValues.length)
        : 0;

      // Completion rate = 1 - (exits / impressions)
      // Only compute for stories where we have both values and impressions > 0
      const completionRates = storyList
        .filter(s => s.impressions !== null && s.impressions > 0 && s.exits !== null)
        .map(s => 1 - (s.exits / s.impressions));

      avgCompletionRate = completionRates.length > 0
        ? parseFloat((completionRates.reduce((sum, v) => sum + v, 0) / completionRates.length).toFixed(4))
        : 0;
    }

    // Get last sync status for stories
    const { data: lastSync } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'stories')
      .order('completed_at', { ascending: false })
      .limit(1);

    return Response.json({
      success: true,
      stories: storyList,
      summary: {
        totalStories,
        avgReach,
        avgCompletionRate,
      },
      lastSync: lastSync?.[0] || null,
    });
  } catch (error) {
    console.error('Stories GET error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Background story processing. Runs after the HTTP response is sent.
 * Fetches live stories from Meta API and upserts insights into story_metrics.
 */
async function processStoriesInBackground(syncId) {
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

    // Fetch currently live stories
    let stories;
    try {
      stories = await getStories(accessToken, account.instagram_user_id);
    } catch (err) {
      await updateSyncStatus(supabase, syncId, 'error', 0, 0, 1, { message: `Failed to fetch stories: ${err.message}` });
      return;
    }

    if (!stories || stories.length === 0) {
      await updateSyncStatus(supabase, syncId, 'success', 0, 0, 0, { message: 'No live stories found' });
      return;
    }

    let processed = 0;
    const errors = [];

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      try {
        const { insights, newToken, expiresIn } = await getStoryInsights(accessToken, story.id);

        if (newToken) {
          await persistRefreshedToken(supabase, account.id, newToken, expiresIn);
          accessToken = newToken;
        }

        const row = {
          instagram_media_id: story.id,
          instagram_user_id: account.instagram_user_id,
          media_type: story.media_type || null,
          impressions: nullIfMissing(insights?.impressions),
          reach: nullIfMissing(insights?.reach),
          replies: nullIfMissing(insights?.replies),
          taps_forward: nullIfMissing(insights?.taps_forward),
          taps_back: nullIfMissing(insights?.taps_back),
          exits: nullIfMissing(insights?.exits),
          posted_at: story.timestamp || null,
          fetched_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('story_metrics')
          .upsert(row, { onConflict: 'instagram_media_id' });

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        processed++;
      } catch (err) {
        errors.push({ storyId: story.id, error: err.message });
      }

      // Rate limit: 2s delay between stories to stay within API budget
      if (i < stories.length - 1) {
        await delay(2000);
      }
    }

    await updateSyncStatus(
      supabase,
      syncId,
      errors.length === stories.length ? 'error' : 'success',
      processed,
      0,
      errors.length,
      errors.length > 0 ? { errors } : null
    );
  } catch (error) {
    console.error('Background stories refresh error:', error);
    await updateSyncStatus(getSupabaseClient(), syncId, 'error', 0, 0, 1, { message: error.message });
  }
}

/**
 * POST /api/instagram/stories
 * Fetches live stories from Meta API and stores their insights.
 * Returns immediately with a syncId; processing continues in the background.
 */
export async function POST() {
  const supabase = getSupabaseClient();

  try {
    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'stories',
        status: 'running',
      })
      .select()
      .single();

    const syncId = syncRecord?.id;

    // Fire and forget — processing continues after response is sent
    processStoriesInBackground(syncId);

    return Response.json({ success: true, syncId, status: 'running' });
  } catch (error) {
    console.error('Stories sync error:', error);
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
