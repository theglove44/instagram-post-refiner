import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('scheduled_posts')
      .select('*')
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      throw new Error(postsError.message);
    }

    if (!posts || posts.length === 0) {
      return Response.json({ success: true, posts: [] });
    }

    // Fetch media uploads for all returned posts in one query
    const postIds = posts.map(p => p.id);
    const { data: allMedia, error: mediaError } = await supabase
      .from('media_uploads')
      .select('scheduled_post_id, public_url, sort_order')
      .in('scheduled_post_id', postIds)
      .order('sort_order', { ascending: true });

    if (mediaError) {
      throw new Error(mediaError.message);
    }

    // Group media by post ID
    const mediaByPost = {};
    for (const m of (allMedia || [])) {
      if (!mediaByPost[m.scheduled_post_id]) {
        mediaByPost[m.scheduled_post_id] = [];
      }
      mediaByPost[m.scheduled_post_id].push(m);
    }

    // Enrich posts with media count and thumbnail
    const enrichedPosts = posts.map(post => {
      const postMedia = mediaByPost[post.id] || [];
      return {
        ...post,
        mediaCount: postMedia.length,
        thumbnailUrl: postMedia.length > 0 ? postMedia[0].public_url : null,
      };
    });

    return Response.json({ success: true, posts: enrichedPosts });
  } catch (error) {
    console.error('Publish list error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
