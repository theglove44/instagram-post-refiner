import { getSupabaseClient } from '@/lib/supabase';

// Link a logged post to an Instagram post
export async function POST(request) {
  try {
    const { postId, instagramMediaId, instagramPermalink } = await request.json();
    
    if (!postId) {
      return Response.json({ error: 'postId is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // Update the post with Instagram link (use post_id which is the UUID)
    const { data, error } = await supabase
      .from('posts')
      .update({
        instagram_media_id: instagramMediaId || null,
        instagram_permalink: instagramPermalink || null,
        published_at: instagramMediaId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('post_id', postId)
      .select()
      .single();
    
    if (error) {
      console.error('Link error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    return Response.json({
      success: true,
      post: data,
    });
    
  } catch (error) {
    console.error('Link post error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Unlink a post from Instagram
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    
    if (!postId) {
      return Response.json({ error: 'postId is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('posts')
      .update({
        instagram_media_id: null,
        instagram_permalink: null,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('post_id', postId)
      .select()
      .single();
    
    if (error) {
      console.error('Unlink error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    return Response.json({
      success: true,
      post: data,
    });
    
  } catch (error) {
    console.error('Unlink post error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
