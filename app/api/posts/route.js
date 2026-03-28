import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    // Fetch all posts ordered by creation date (newest first)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Format posts to match expected structure
    // Sort by published_at (falling back to created_at), so unlinked posts
    // interleave chronologically instead of sinking to the bottom
    const sorted = (data || []).sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at);
      const dateB = new Date(b.published_at || b.created_at);
      return dateB - dateA;
    });

    const posts = sorted.map(post => ({
      id: post.post_id,
      topic: post.topic,
      aiVersion: post.ai_version,
      finalVersion: post.final_version,
      editCount: post.edit_count,
      createdAt: post.created_at,
      instagramMediaId: post.instagram_media_id,
      instagramPermalink: post.instagram_permalink,
      publishedAt: post.published_at,
      mediaType: post.media_type || null,
      mediaProductType: post.media_product_type || null,
    }));

    return Response.json({ posts });
  } catch (error) {
    console.error('Posts API error:', error);
    return Response.json(
      { error: error.message || 'Failed to load posts' },
      { status: 500 }
    );
  }
}
