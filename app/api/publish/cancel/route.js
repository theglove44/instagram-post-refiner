import { getSupabaseClient } from '@/lib/supabase';

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
        { success: false, error: `Cannot cancel a post with status "${post.status}". Must be "scheduled".` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(updateError.message);
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
