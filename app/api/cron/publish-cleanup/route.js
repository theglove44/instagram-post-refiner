/**
 * GET /api/cron/publish-cleanup
 * Daily cleanup for the publishing pipeline.
 * 1. Fails posts stuck in 'publishing' for >24 hours
 * 2. Deletes orphaned media uploads (no scheduled_post_id, older than 24h)
 *
 * Called via systemd timer alongside the nightly cron.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { deleteFromStorage } from '@/lib/media';

export async function GET() {
  const supabase = getSupabaseClient();
  const results = {};

  try {
    // 1. Fail stale publishing posts (stuck >24h)
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stalePosts, error: staleError } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('status', 'publishing')
      .lt('updated_at', staleThreshold);

    if (staleError) throw new Error(staleError.message);

    if (stalePosts && stalePosts.length > 0) {
      const staleIds = stalePosts.map(p => p.id);
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          publish_error: 'Timed out — stuck in publishing for >24 hours',
          updated_at: new Date().toISOString(),
        })
        .in('id', staleIds);

      // Log the timeout
      for (const id of staleIds) {
        await supabase.from('publishing_log').insert({
          scheduled_post_id: id,
          action: 'timeout',
          details: { reason: 'Stuck in publishing state for >24 hours' },
        });
      }
    }

    results.stalePostsFailed = stalePosts?.length || 0;

    // 2. Clean up orphaned media (no post reference, older than 24h)
    const { data: orphanedMedia, error: orphanError } = await supabase
      .from('media_uploads')
      .select('id, storage_path')
      .is('scheduled_post_id', null)
      .lt('created_at', staleThreshold);

    if (orphanError) throw new Error(orphanError.message);

    let deletedCount = 0;
    if (orphanedMedia && orphanedMedia.length > 0) {
      for (const media of orphanedMedia) {
        try {
          await deleteFromStorage(media.storage_path);
        } catch {
          // Storage delete failed — proceed with DB cleanup anyway
        }
        await supabase.from('media_uploads').delete().eq('id', media.id);
        deletedCount++;
      }
    }

    results.orphanedMediaDeleted = deletedCount;

    // 3. Clean up media from cancelled posts (older than 7 days)
    const cancelledThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: cancelledPosts, error: cancelError } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('status', 'cancelled')
      .lt('updated_at', cancelledThreshold);

    if (cancelError) throw new Error(cancelError.message);

    let cancelledCleaned = 0;
    if (cancelledPosts && cancelledPosts.length > 0) {
      for (const post of cancelledPosts) {
        const { data: media } = await supabase
          .from('media_uploads')
          .select('id, storage_path')
          .eq('scheduled_post_id', post.id);

        if (media) {
          for (const m of media) {
            try { await deleteFromStorage(m.storage_path); } catch { /* noop */ }
          }
        }

        // Delete the post (cascades to media_uploads and publishing_log)
        await supabase.from('scheduled_posts').delete().eq('id', post.id);
        cancelledCleaned++;
      }
    }

    results.cancelledPostsCleaned = cancelledCleaned;

    console.log('Publish cleanup completed:', JSON.stringify(results));
    return Response.json({ success: true, results });
  } catch (error) {
    console.error('Publish cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
