import { getSupabaseClient } from '@/lib/supabase';

export async function PUT(request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { id } = await params;
    const { status } = await request.json();

    if (!status || !['seen', 'replied'].includes(status)) {
      return Response.json(
        { success: false, error: 'Status must be "seen" or "replied"' },
        { status: 400 }
      );
    }

    // Check the current status before updating
    const { data: existing, error: fetchError } = await supabase
      .from('mentions')
      .select('reply_status')
      .eq('id', id)
      .single();

    if (fetchError) {
      return Response.json(
        { success: false, error: 'Mention not found' },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from('mentions')
      .update({ reply_status: status })
      .eq('id', id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // If transitioning from unseen, decrement unseen_mentions count (not below 0)
    if (existing.reply_status === 'unseen') {
      const { data: countRow } = await supabase
        .from('engagement_counts')
        .select('count')
        .eq('count_type', 'unseen_mentions')
        .single();

      const currentCount = countRow?.count || 0;
      const newCount = Math.max(0, currentCount - 1);

      await supabase
        .from('engagement_counts')
        .upsert({
          count_type: 'unseen_mentions',
          count: newCount,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'count_type',
        });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Mention PUT error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
