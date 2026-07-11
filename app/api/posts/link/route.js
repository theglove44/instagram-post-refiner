import { getServerSupabaseClient } from '@/lib/supabase-server';
import { resolvePostIdentity } from '@/lib/post-identity';

async function resolvePublishedAt(supabase, instagramMediaId, suppliedTimestamp) {
  if (suppliedTimestamp) {
    const parsed = new Date(suppliedTimestamp);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('publishedAt must be a valid timestamp');
    }
    return parsed.toISOString();
  }

  if (!instagramMediaId) return null;

  const { data, error } = await supabase
    .from('posts')
    .select('published_at')
    .eq('instagram_media_id', instagramMediaId)
    .not('published_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.published_at || null;
}

// Link a logged post to an Instagram post
export async function POST(request) {
  try {
    const { postId, instagramMediaId, instagramPermalink, publishedAt } = await request.json();
    
    if (!postId) {
      return Response.json({ error: 'postId is required' }, { status: 400 });
    }
    
    const supabase = getServerSupabaseClient();
    const post = await resolvePostIdentity(supabase, postId);
    if (!post) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }

    let instagramPublishedAt;
    try {
      instagramPublishedAt = await resolvePublishedAt(supabase, instagramMediaId, publishedAt);
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('posts')
      .update({
        instagram_media_id: instagramMediaId || null,
        instagram_permalink: instagramPermalink || null,
        published_at: instagramPublishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
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
    
    const supabase = getServerSupabaseClient();
    const post = await resolvePostIdentity(supabase, postId);
    if (!post) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('posts')
      .update({
        instagram_media_id: null,
        instagram_permalink: null,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
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
