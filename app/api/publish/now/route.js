import { getServerSupabaseClient } from '@/lib/supabase-server';
import { executePublish } from '@/lib/publishing';
import {
  PUBLISH_NOW_CLAIMABLE_STATUSES,
  claimPostForPublishing,
} from '@/lib/publish-state';

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();

    // Fetch the scheduled post
    const { data: post, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return Response.json(
        { success: false, error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    if (!PUBLISH_NOW_CLAIMABLE_STATUSES.includes(post.status)) {
      return Response.json(
        { success: false, error: `Cannot publish a post with status "${post.status}". Must be "draft", "scheduled", or "failed".` },
        { status: 400 }
      );
    }

    // Verify at least 1 media upload exists
    const { data: mediaUploads, error: mediaError } = await supabase
      .from('media_uploads')
      .select('*')
      .eq('scheduled_post_id', id);

    if (mediaError) {
      throw new Error(mediaError.message);
    }

    if (!mediaUploads || mediaUploads.length < 1) {
      return Response.json(
        { success: false, error: 'Post must have at least 1 media upload before publishing' },
        { status: 400 }
      );
    }

    // Get Instagram account
    const { data: accounts, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (accountError || !accounts || accounts.length === 0) {
      return Response.json(
        { success: false, error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    const account = accounts[0];

    const claimedPost = await claimPostForPublishing(
      supabase,
      id,
      PUBLISH_NOW_CLAIMABLE_STATUSES
    );

    if (!claimedPost) {
      return Response.json(
        { success: false, error: 'Post is no longer claimable; another publisher may already be processing it' },
        { status: 409 }
      );
    }

    // Kick off publish in the background (do NOT await)
    const publishPromise = executePublish(account.access_token, account.instagram_user_id, claimedPost, mediaUploads, { dryRun: body.dryRun || false });
    publishPromise.catch(async (err) => {
      const supabase = getServerSupabaseClient();
      if (err.publishSucceeded) {
        await supabase.from('scheduled_posts').update({
          publish_error: err.message,
          updated_at: new Date().toISOString(),
        }).eq('id', claimedPost.id).eq('status', 'publishing');
        return;
      }

      const newRetryCount = (claimedPost.retry_count || 0) + 1;
      if (newRetryCount < 3) {
        await supabase.from('scheduled_posts').update({
          status: 'scheduled',
          scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          retry_count: newRetryCount,
          publish_error: err.message,
          updated_at: new Date().toISOString(),
        }).eq('id', claimedPost.id).eq('status', 'publishing');
      } else {
        await supabase.from('scheduled_posts').update({
          status: 'failed',
          publish_error: err.message,
          retry_count: newRetryCount,
          updated_at: new Date().toISOString(),
        }).eq('id', claimedPost.id).eq('status', 'publishing');
      }
    });

    return Response.json({ success: true, status: 'publishing', id: claimedPost.id });
  } catch (error) {
    console.error('Publish now API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to publish post' },
      { status: 500 }
    );
  }
}
