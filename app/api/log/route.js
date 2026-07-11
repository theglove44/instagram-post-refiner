import { getServerSupabaseClient } from '@/lib/supabase-server';
import { POST_ORIGINS } from '@/lib/post-origin';

export async function POST(request) {
  try {
    const supabase = getServerSupabaseClient();
    const { topic, aiVersion, finalVersion, editCount } = await request.json();

    if (!aiVersion || !finalVersion) {
      return Response.json(
        { error: 'Both AI and final versions are required' },
        { status: 400 }
      );
    }

    // Insert new post into Supabase
    const { data, error } = await supabase
      .from('posts')
      .insert({
        topic: topic || 'Untitled',
        ai_version: aiVersion,
        final_version: finalVersion,
        edit_count: editCount || 0,
        origin: POST_ORIGINS.TRAINING_PAIR,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Format response to match expected structure
    const newPost = {
      id: data.id,
      postId: data.post_id,
      post_id: data.post_id,
      topic: data.topic,
      aiVersion: data.ai_version,
      finalVersion: data.final_version,
      editCount: data.edit_count,
      createdAt: data.created_at,
    };

    // Get total count
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    return Response.json({
      success: true,
      post: newPost,
      totalPosts: count || 1
    });
  } catch (error) {
    console.error('Log API error:', error);
    return Response.json(
      { error: error.message || 'Failed to log post' },
      { status: 500 }
    );
  }
}
