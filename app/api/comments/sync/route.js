import { getSupabaseClient } from '@/lib/supabase';
import { getMediaComments, getTokenExpiryDate } from '@/lib/instagram';

// Delay helper for rate limiting Meta API calls
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Persist a refreshed access token to the instagram_accounts table.
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
 * Background comment sync processing.
 * Fetches comments from Meta API for each post and upserts into the comments table.
 */
async function processCommentSyncInBackground(syncId, account, postsToSync) {
  const supabase = getSupabaseClient();

  try {
    let accessToken = account.access_token;
    let processed = 0;
    const errors = [];

    for (let i = 0; i < postsToSync.length; i++) {
      const post = postsToSync[i];

      try {
        const { comments, newToken, expiresIn } = await getMediaComments(accessToken, post.instagram_media_id);

        if (newToken) {
          await persistRefreshedToken(supabase, account.id, newToken, expiresIn);
          accessToken = newToken;
        }

        // Upsert each top-level comment and its replies
        for (const comment of comments) {
          const { error: upsertError } = await supabase
            .from('comments')
            .upsert({
              instagram_comment_id: comment.id,
              instagram_media_id: post.instagram_media_id,
              username: comment.username,
              text: comment.text,
              timestamp: comment.timestamp,
              is_reply: false,
              parent_comment_id: null,
            }, { onConflict: 'instagram_comment_id' });

          if (upsertError) {
            console.error(`Comment upsert failed: ${upsertError.message}`);
          }

          // Process replies
          const replies = comment.replies?.data || [];
          for (const reply of replies) {
            const isOwnReply = reply.username === account.instagram_username;

            const { error: replyUpsertError } = await supabase
              .from('comments')
              .upsert({
                instagram_comment_id: reply.id,
                instagram_media_id: post.instagram_media_id,
                username: reply.username,
                text: reply.text,
                timestamp: reply.timestamp,
                is_reply: true,
                parent_comment_id: comment.id,
                is_own_reply: isOwnReply,
              }, { onConflict: 'instagram_comment_id' });

            if (replyUpsertError) {
              console.error(`Reply upsert failed: ${replyUpsertError.message}`);
            }

            // If this is the account owner's reply, mark parent as replied
            if (isOwnReply) {
              await supabase
                .from('comments')
                .update({ reply_status: 'replied' })
                .eq('instagram_comment_id', comment.id);
            }
          }
        }

        processed++;
      } catch (err) {
        errors.push({ mediaId: post.instagram_media_id, error: err.message });
      }

      // Rate limit: 2s delay between posts
      if (i < postsToSync.length - 1) {
        await delay(2000);
      }
    }

    // Update unreplied comment count in engagement_counts
    const { count: unrepliedCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_reply', false)
      .eq('reply_status', 'unreplied')
      .eq('is_hidden', false);

    await supabase
      .from('engagement_counts')
      .upsert({
        count_type: 'unreplied_comments',
        count: unrepliedCount || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'count_type' });

    // Update sync status
    await updateSyncStatus(
      supabase,
      syncId,
      errors.length === postsToSync.length ? 'error' : 'success',
      processed,
      errors.length,
      errors.length > 0 ? { errors } : null
    );

    console.log(`Comment sync complete: ${processed}/${postsToSync.length} posts processed, ${errors.length} errors`);
  } catch (error) {
    console.error('Background comment sync error:', error);
    await updateSyncStatus(getSupabaseClient(), syncId, 'error', 0, 1, { message: error.message });
  }
}

async function updateSyncStatus(supabase, syncId, status, postsProcessed, errorsCount, errorDetails = null) {
  if (!syncId) return;

  await supabase
    .from('sync_status')
    .update({
      status,
      completed_at: new Date().toISOString(),
      posts_processed: postsProcessed,
      errors_count: errorsCount,
      error_details: errorDetails,
    })
    .eq('id', syncId);
}

export async function POST(request) {
  const supabase = getSupabaseClient();

  try {
    let days = 7;
    let mediaId = null;

    try {
      const body = await request.json();
      if (body.days) days = Math.max(1, Math.min(365, body.days));
      if (body.mediaId) mediaId = body.mediaId;
    } catch {
      // No body or invalid JSON — use defaults
    }

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

    // Build query for posts to sync
    let postsQuery = supabase
      .from('posts')
      .select('id, instagram_media_id')
      .not('instagram_media_id', 'is', null);

    if (mediaId) {
      postsQuery = postsQuery.eq('instagram_media_id', mediaId);
    } else {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      postsQuery = postsQuery.gte('published_at', cutoffDate);
    }

    const { data: postsToSync } = await postsQuery;

    if (!postsToSync || postsToSync.length === 0) {
      return Response.json({
        success: true,
        syncId: null,
        postsToSync: 0,
        message: 'No posts found to sync comments for',
      });
    }

    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'comments',
        status: 'running',
      })
      .select()
      .single();

    const syncId = syncRecord?.id;

    // Fire and forget — processing continues after response is sent
    processCommentSyncInBackground(syncId, account, postsToSync);

    return Response.json({
      success: true,
      syncId,
      postsToSync: postsToSync.length,
      status: 'running',
    });
  } catch (error) {
    console.error('Comment sync error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
