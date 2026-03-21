import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const filter = searchParams.get('filter') || 'all';
    const mediaId = searchParams.get('mediaId');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

    // Build query for top-level comments only
    let query = supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('is_reply', false);

    // Apply filter
    switch (filter) {
      case 'unreplied':
        query = query.eq('reply_status', 'unreplied').eq('is_hidden', false);
        break;
      case 'replied':
        query = query.eq('reply_status', 'replied');
        break;
      case 'hidden':
        query = query.eq('is_hidden', true);
        break;
      case 'all':
      default:
        query = query.eq('is_hidden', false);
        break;
    }

    if (mediaId) {
      query = query.eq('instagram_media_id', mediaId);
    }

    if (search) {
      query = query.or(`text.ilike.%${search}%,username.ilike.%${search}%`);
    }

    // Order and paginate
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('timestamp', { ascending: false }).range(from, to);

    const { data: comments, count: total, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const commentList = comments || [];

    if (commentList.length === 0) {
      return Response.json({ success: true, comments: [], total: 0, page, limit });
    }

    // Fetch replies for each top-level comment
    const commentIds = commentList.map(c => c.instagram_comment_id);
    const { data: replies, error: repliesError } = await supabase
      .from('comments')
      .select('*')
      .in('parent_comment_id', commentIds)
      .order('timestamp', { ascending: true });

    if (repliesError) {
      console.error('Failed to fetch replies:', repliesError.message);
    }

    const repliesByParent = {};
    for (const reply of (replies || [])) {
      if (!repliesByParent[reply.parent_comment_id]) {
        repliesByParent[reply.parent_comment_id] = [];
      }
      repliesByParent[reply.parent_comment_id].push(reply);
    }

    // Fetch post context for each unique media ID
    const uniqueMediaIds = [...new Set(commentList.map(c => c.instagram_media_id).filter(Boolean))];
    const postContextMap = {};

    if (uniqueMediaIds.length > 0) {
      const { data: posts } = await supabase
        .from('posts')
        .select('instagram_media_id, topic, final_version')
        .in('instagram_media_id', uniqueMediaIds);

      for (const post of (posts || [])) {
        postContextMap[post.instagram_media_id] = {
          topic: post.topic || null,
          caption: post.final_version ? post.final_version.substring(0, 80) : null,
        };
      }
    }

    // Assemble response
    const enrichedComments = commentList.map(comment => ({
      ...comment,
      replies: repliesByParent[comment.instagram_comment_id] || [],
      postContext: postContextMap[comment.instagram_media_id] || null,
    }));

    return Response.json({
      success: true,
      comments: enrichedComments,
      total: total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Comments GET error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
