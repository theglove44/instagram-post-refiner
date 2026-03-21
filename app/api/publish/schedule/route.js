import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, scheduledAt, timezone } = body;

    if (!id) {
      return Response.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return Response.json(
        { success: false, error: 'scheduledAt is required' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return Response.json(
        { success: false, error: 'scheduledAt must be a valid date in the future' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

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

    if (post.status !== 'draft' && post.status !== 'failed') {
      return Response.json(
        { success: false, error: `Cannot schedule a post with status "${post.status}". Must be "draft" or "failed".` },
        { status: 400 }
      );
    }

    // Verify at least 1 media upload exists
    const { count, error: mediaError } = await supabase
      .from('media_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('scheduled_post_id', id);

    if (mediaError) {
      throw new Error(mediaError.message);
    }

    if (!count || count < 1) {
      return Response.json(
        { success: false, error: 'Post must have at least 1 media upload before scheduling' },
        { status: 400 }
      );
    }

    // Update the post to scheduled
    const { data: updated, error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString(),
        timezone: timezone || post.timezone,
        updated_at: new Date().toISOString(),
        publish_error: null,
        retry_count: 0,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return Response.json({ success: true, post: updated });
  } catch (error) {
    console.error('Schedule API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to schedule post' },
      { status: 500 }
    );
  }
}
