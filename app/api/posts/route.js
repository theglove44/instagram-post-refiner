import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch all posts ordered by creation date (newest first)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Format posts to match expected structure
    const posts = (data || []).map(post => ({
      id: post.post_id,
      topic: post.topic,
      aiVersion: post.ai_version,
      finalVersion: post.final_version,
      editCount: post.edit_count,
      createdAt: post.created_at,
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
