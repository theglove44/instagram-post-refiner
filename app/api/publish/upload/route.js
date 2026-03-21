import { getSupabaseClient } from '@/lib/supabase';
import { validateMediaFile, uploadBufferToStorage, deleteFromStorage } from '@/lib/media';

export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const formData = await request.formData();

    const file = formData.get('file');
    const scheduledPostId = formData.get('scheduledPostId');
    const sortOrder = parseInt(formData.get('sortOrder') || '0', 10);

    if (!scheduledPostId) {
      return Response.json(
        { success: false, error: 'scheduledPostId is required' },
        { status: 400 }
      );
    }

    const validation = validateMediaFile(file);
    if (!validation.valid) {
      return Response.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath, publicUrl } = await uploadBufferToStorage(
      buffer,
      scheduledPostId,
      file.name,
      file.type
    );

    const { data: upload, error: insertError } = await supabase
      .from('media_uploads')
      .insert({
        scheduled_post_id: scheduledPostId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        public_url: publicUrl,
        media_type: validation.mediaType,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    // Update scheduled_posts media_type based on total media count
    const { count } = await supabase
      .from('media_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('scheduled_post_id', scheduledPostId);

    if (count > 1) {
      await supabase
        .from('scheduled_posts')
        .update({ media_type: 'CAROUSEL' })
        .eq('id', scheduledPostId);
    } else if (count === 1 && validation.mediaType === 'VIDEO') {
      await supabase
        .from('scheduled_posts')
        .update({ media_type: 'REELS' })
        .eq('id', scheduledPostId);
    }

    return Response.json({ success: true, upload });
  } catch (error) {
    console.error('Upload API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to upload media' },
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
        { success: false, error: 'id query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch the row to get storage_path and scheduled_post_id
    const { data: upload, error: fetchError } = await supabase
      .from('media_uploads')
      .select('storage_path, scheduled_post_id')
      .eq('id', id)
      .single();

    if (fetchError || !upload) {
      return Response.json(
        { success: false, error: 'Media upload not found' },
        { status: 404 }
      );
    }

    await deleteFromStorage(upload.storage_path);

    const { error: deleteError } = await supabase
      .from('media_uploads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Update scheduled_posts media_type based on remaining media
    const { data: remaining, error: countError } = await supabase
      .from('media_uploads')
      .select('media_type')
      .eq('scheduled_post_id', upload.scheduled_post_id);

    if (countError) {
      throw new Error(countError.message);
    }

    let newMediaType = 'IMAGE';
    if (remaining.length > 1) {
      newMediaType = 'CAROUSEL';
    } else if (remaining.length === 1 && remaining[0].media_type === 'VIDEO') {
      newMediaType = 'REELS';
    }

    await supabase
      .from('scheduled_posts')
      .update({ media_type: newMediaType })
      .eq('id', upload.scheduled_post_id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete upload API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to delete media' },
      { status: 500 }
    );
  }
}
