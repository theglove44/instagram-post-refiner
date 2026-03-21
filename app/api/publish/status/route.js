import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json(
        { success: false, error: 'id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data: post, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !post) {
      return Response.json(
        { success: false, error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      id: post.id,
      status: post.status,
      igMediaId: post.ig_media_id || null,
      igPermalink: post.ig_permalink || null,
      publishedAt: post.published_at || null,
      publishError: post.publish_error || null,
      retryCount: post.retry_count || 0,
    });
  } catch (error) {
    console.error('Status API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to fetch post status' },
      { status: 500 }
    );
  }
}
