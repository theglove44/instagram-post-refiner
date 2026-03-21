import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return Response.json(
        { success: false, error: 'start and end query parameters are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return Response.json(
        { success: false, error: 'start and end must be valid ISO date strings' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // Fetch posts matching the calendar window:
    // 1. scheduled_at in range (for scheduled/publishing/cancelled)
    // 2. published_at in range (for published)
    // 3. status is draft (always include, no date filter)
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .or(
        `and(scheduled_at.gte.${startISO},scheduled_at.lte.${endISO},status.in.(scheduled,publishing,cancelled)),` +
        `and(published_at.gte.${startISO},published_at.lte.${endISO},status.eq.published),` +
        `status.eq.draft`
      );

    if (error) {
      throw new Error(error.message);
    }

    if (!posts || posts.length === 0) {
      return Response.json({ success: true, posts: [] });
    }

    // Get first media upload thumbnail for each post
    const postIds = posts.map(p => p.id);
    const { data: mediaUploads, error: mediaError } = await supabase
      .from('media_uploads')
      .select('scheduled_post_id, thumbnail_url, id')
      .in('scheduled_post_id', postIds)
      .order('created_at', { ascending: true });

    if (mediaError) {
      throw new Error(mediaError.message);
    }

    // Build a map of post_id -> first thumbnail
    const thumbnailMap = {};
    const mediaCountMap = {};
    for (const upload of (mediaUploads || [])) {
      if (!thumbnailMap[upload.scheduled_post_id]) {
        thumbnailMap[upload.scheduled_post_id] = upload.thumbnail_url;
      }
      mediaCountMap[upload.scheduled_post_id] = (mediaCountMap[upload.scheduled_post_id] || 0) + 1;
    }

    const calendarPosts = posts.map(post => ({
      id: post.id,
      caption: post.caption ? post.caption.substring(0, 100) : null,
      mediaType: post.media_type || null,
      status: post.status,
      scheduledAt: post.scheduled_at || null,
      publishedAt: post.published_at || null,
      thumbnailUrl: thumbnailMap[post.id] || null,
      mediaCount: mediaCountMap[post.id] || 0,
    }));

    return Response.json({ success: true, posts: calendarPosts });
  } catch (error) {
    console.error('Calendar API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to fetch calendar posts' },
      { status: 500 }
    );
  }
}
