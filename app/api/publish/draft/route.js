import { getSupabaseClient } from '@/lib/supabase';
import { deleteAllPostMedia } from '@/lib/media';

export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const { id, caption, mediaType, altText, userTags, coverUrl, sourcePostId } = await request.json();

    // Caption defaults to empty string in the DB, so allow it to be missing
    // mediaType defaults to 'IMAGE' if not provided

    if (id) {
      // Update existing draft — only allow if status is 'draft' or 'failed'
      const { data: existing, error: fetchError } = await supabase
        .from('scheduled_posts')
        .select('id, status')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!existing) {
        return Response.json(
          { success: false, error: 'Draft not found' },
          { status: 404 }
        );
      }

      if (existing.status !== 'draft' && existing.status !== 'failed') {
        return Response.json(
          { success: false, error: `Cannot edit a post with status "${existing.status}"` },
          { status: 400 }
        );
      }

      const updates = { updated_at: new Date().toISOString() };
      if (caption !== undefined) updates.caption = caption;
      if (mediaType) updates.media_type = mediaType;
      if (altText !== undefined) updates.alt_text = altText || null;
      if (userTags !== undefined) updates.user_tags = userTags || null;
      if (coverUrl !== undefined) updates.cover_url = coverUrl || null;
      if (sourcePostId !== undefined) updates.source_post_id = sourcePostId || null;

      const { data, error } = await supabase
        .from('scheduled_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return Response.json({ success: true, post: data });
    }

    // Insert new draft
    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        caption: caption || '',
        media_type: mediaType || 'IMAGE',
        alt_text: altText || null,
        user_tags: userTags || null,
        cover_url: coverUrl || null,
        source_post_id: sourcePostId || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ success: true, post: data });
  } catch (error) {
    console.error('Draft POST error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to save draft' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json(
        { success: false, error: 'Missing required query param: id' },
        { status: 400 }
      );
    }

    const { data: post, error: postError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (postError) {
      throw new Error(postError.message);
    }

    if (!post) {
      return Response.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      );
    }

    const { data: media, error: mediaError } = await supabase
      .from('media_uploads')
      .select('*')
      .eq('scheduled_post_id', id)
      .order('sort_order', { ascending: true });

    if (mediaError) {
      throw new Error(mediaError.message);
    }

    return Response.json({ success: true, post, media: media || [] });
  } catch (error) {
    console.error('Draft GET error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json(
        { success: false, error: 'Missing required query param: id' },
        { status: 400 }
      );
    }

    // Delete media files from storage first
    try {
      await deleteAllPostMedia(id);
    } catch (storageError) {
      // Log but don't block deletion if storage cleanup fails
      console.warn('Storage cleanup warning:', storageError.message);
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Draft DELETE error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
