import { getSupabaseClient } from '@/lib/supabase';

export async function PUT(request) {
  try {
    const supabase = getSupabaseClient();
    const { scheduledPostId, order } = await request.json();

    if (!scheduledPostId) {
      return Response.json(
        { success: false, error: 'scheduledPostId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(order) || order.length === 0) {
      return Response.json(
        { success: false, error: 'order must be a non-empty array' },
        { status: 400 }
      );
    }

    const updates = order.map(({ id, sortOrder }) =>
      supabase
        .from('media_uploads')
        .update({ sort_order: sortOrder })
        .eq('id', id)
        .eq('scheduled_post_id', scheduledPostId)
    );

    const results = await Promise.all(updates);

    const failed = results.find(r => r.error);
    if (failed) {
      throw new Error(failed.error.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Reorder API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to reorder media' },
      { status: 500 }
    );
  }
}
