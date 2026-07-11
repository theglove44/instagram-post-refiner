import { getServerSupabaseClient } from '@/lib/supabase-server';
import { canCancel } from '@/lib/publish-state';

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

    if (!canCancel(post.status)) {
      return Response.json(
        { success: false, error: `Cannot cancel a post with status "${post.status}". Must be "scheduled".` },
        { status: 400 }
      );
    }

    const { data: cancelled, error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!cancelled) {
      return Response.json(
        { success: false, error: 'Post state changed before cancellation; refresh and try again' },
        { status: 409 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Cancel API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to cancel scheduled post' },
      { status: 500 }
    );
  }
}
