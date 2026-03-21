import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

    let query = supabase
      .from('mentions')
      .select('*', { count: 'exact' });

    if (type) {
      query = query.eq('mention_type', type);
    }

    if (status) {
      query = query.eq('reply_status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('timestamp', { ascending: false }).range(from, to);

    const { data: mentions, count: total, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({
      success: true,
      mentions: mentions || [],
      total: total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Mentions GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
