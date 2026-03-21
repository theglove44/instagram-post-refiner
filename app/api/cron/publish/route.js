/**
 * GET /api/cron/publish
 * Scheduled publishing cron — runs every minute via systemd timer.
 * Finds posts due for publishing and processes them.
 *
 * Called via: curl http://localhost:3000/api/cron/publish
 * Processes max 5 posts per invocation to avoid timeout.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { executePublish } from '@/lib/publishing';

const MAX_POSTS_PER_RUN = 5;

export async function GET() {
  const supabase = getSupabaseClient();
  const results = [];

  try {
    // Find posts due for publishing
    const { data: duePosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(MAX_POSTS_PER_RUN);

    if (fetchError) throw new Error(fetchError.message);
    if (!duePosts || duePosts.length === 0) {
      return Response.json({ success: true, processed: 0, results: [] });
    }

    // Get the instagram account
    const { data: accounts, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (accountError) throw new Error(accountError.message);
    if (!accounts || accounts.length === 0) {
      return Response.json({ success: false, error: 'No Instagram account connected' }, { status: 400 });
    }

    const account = accounts[0];

    // Process each due post
    for (const post of duePosts) {
      try {
        // Set status to publishing
        await supabase
          .from('scheduled_posts')
          .update({ status: 'publishing', updated_at: new Date().toISOString() })
          .eq('id', post.id);

        // Fetch media uploads
        const { data: media } = await supabase
          .from('media_uploads')
          .select('*')
          .eq('scheduled_post_id', post.id)
          .order('sort_order', { ascending: true });

        if (!media || media.length === 0) {
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'failed',
              publish_error: 'No media files attached',
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);
          results.push({ id: post.id, status: 'failed', error: 'No media files' });
          continue;
        }

        // Execute publish
        const result = await executePublish(
          account.access_token,
          account.instagram_user_id,
          post,
          media
        );

        results.push({ id: post.id, status: 'published', mediaId: result.mediaId });
      } catch (err) {
        console.error(`Cron publish failed for post ${post.id}:`, err);

        const newRetryCount = (post.retry_count || 0) + 1;
        if (newRetryCount < 3) {
          // Retry in 5 minutes
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'scheduled',
              scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              retry_count: newRetryCount,
              publish_error: err.message,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);
          results.push({ id: post.id, status: 'retry', attempt: newRetryCount, error: err.message });
        } else {
          // Permanent failure
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'failed',
              publish_error: err.message,
              retry_count: newRetryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);
          results.push({ id: post.id, status: 'failed', error: err.message });
        }
      }
    }

    console.log(`Cron publish completed: ${results.length} posts processed`);
    return Response.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error('Cron publish error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
