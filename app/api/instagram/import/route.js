import { getSupabaseClient } from '@/lib/supabase';
import { getRecentMedia, getTokenExpiryDate } from '@/lib/instagram';

// Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Extract a short topic string from an Instagram caption.
 * Takes the first line, strips hashtags and emojis, truncates to 60 chars.
 */
function extractTopic(caption) {
  if (!caption) return 'Untitled';
  // Take first line
  const firstLine = caption.split('\n')[0].trim();
  // Remove hashtags
  const noHashtags = firstLine.replace(/#\w+/g, '').trim();
  // Remove emojis (basic pattern)
  const noEmojis = noHashtags.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '').trim();
  // Truncate to 60 chars
  const truncated = noEmojis.length > 60 ? noEmojis.substring(0, 57) + '...' : noEmojis;
  return truncated || 'Untitled';
}

/**
 * Background import processing. Runs after the HTTP response is sent.
 * Fetches all media from Instagram and inserts new posts into the database.
 */
async function processImportInBackground(syncId) {
  const supabase = getSupabaseClient();

  try {
    // 1. Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'error', 0, { message: 'No Instagram account connected' });
      return;
    }

    const account = accounts[0];
    let accessToken = account.access_token;

    // 2. Fetch ALL media from Instagram
    console.log('Import: Fetching all media from Instagram...');
    const allMedia = await getRecentMedia(accessToken, account.instagram_user_id, 5000, true);
    console.log(`Import: Fetched ${allMedia.length} media items from Instagram`);

    // 3. Get all existing posts that have an instagram_media_id
    const { data: existingPosts } = await supabase
      .from('posts')
      .select('instagram_media_id')
      .not('instagram_media_id', 'is', null);

    // 4. Build a Set of existing instagram_media_ids to skip duplicates
    const existingIds = new Set((existingPosts || []).map(p => p.instagram_media_id));

    // 5. Filter to only new posts
    const newMedia = allMedia.filter(m => !existingIds.has(m.id));
    console.log(`Import: ${newMedia.length} new posts to import (${existingIds.size} already exist)`);

    if (newMedia.length === 0) {
      await updateSyncStatus(supabase, syncId, 'success', 0, null);
      return;
    }

    // 6. Batch insert in chunks of 50
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    const errors = [];

    for (let i = 0; i < newMedia.length; i += BATCH_SIZE) {
      const batch = newMedia.slice(i, i + BATCH_SIZE);

      const rows = batch.map((media, idx) => ({
        post_id: `ig_${media.id}`,
        topic: extractTopic(media.caption),
        ai_version: media.caption || '',
        final_version: media.caption || '',
        edit_count: 0,
        instagram_media_id: media.id,
        instagram_permalink: media.permalink,
        published_at: media.timestamp,
        media_type: media.media_type || null,
        media_product_type: media.media_product_type || null,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('posts')
        .insert(rows)
        .select();

      if (insertError) {
        console.error(`Import batch error (offset ${i}):`, insertError.message);
        errors.push({ batch: i, error: insertError.message });
      } else {
        totalInserted += (inserted || []).length;
      }
    }

    console.log(`Import: Inserted ${totalInserted} posts, ${errors.length} batch errors`);

    // 7. Update sync status
    await updateSyncStatus(
      supabase,
      syncId,
      errors.length > 0 && totalInserted === 0 ? 'error' : 'success',
      totalInserted,
      errors.length > 0 ? { errors } : null
    );
  } catch (error) {
    console.error('Background import error:', error);
    await updateSyncStatus(getSupabaseClient(), syncId, 'error', 0, { message: error.message });
  }
}

async function updateSyncStatus(supabase, syncId, status, postsProcessed, errorDetails = null) {
  if (!syncId) return;

  await supabase
    .from('sync_status')
    .update({
      status,
      completed_at: new Date().toISOString(),
      posts_processed: postsProcessed,
      errors_count: errorDetails ? 1 : 0,
      error_details: errorDetails,
    })
    .eq('id', syncId);
}

/**
 * POST /api/instagram/import
 * Start importing all Instagram posts into the database.
 * Returns immediately with a syncId; processing continues in the background.
 */
export async function POST() {
  const supabase = getSupabaseClient();

  try {
    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'import',
        status: 'running',
      })
      .select()
      .single();

    const syncId = syncRecord?.id;

    // Fire and forget -- processing continues after response is sent
    processImportInBackground(syncId);

    return Response.json({ success: true, syncId, status: 'running' });
  } catch (error) {
    console.error('Import start error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instagram/import
 * Returns the latest import sync status so the UI can poll for completion.
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data: lastSync } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'import')
      .order('started_at', { ascending: false })
      .limit(1);

    const sync = lastSync?.[0] || null;

    if (!sync) {
      return Response.json({ status: null, message: 'No import has been run yet' });
    }

    return Response.json({
      status: sync.status,
      postsProcessed: sync.posts_processed,
      completedAt: sync.completed_at,
      startedAt: sync.started_at,
      errorDetails: sync.error_details,
    });
  } catch (error) {
    console.error('Import status error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
