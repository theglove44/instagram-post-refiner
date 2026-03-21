import { getSupabaseClient } from '@/lib/supabase';

export async function PUT(request) {
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

    if (post.status !== 'scheduled') {
      return Response.json(
        { success: false, error: `Cannot reschedule a post with status "${post.status}". Must be "scheduled".` },
        { status: 400 }
      );
    }

    const updateData = {
      scheduled_at: scheduledDate.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    const { data: updated, error: updateError } = await supabase
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return Response.json({ success: true, post: updated });
  } catch (error) {
    console.error('Reschedule API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to reschedule post' },
      { status: 500 }
    );
  }
}
