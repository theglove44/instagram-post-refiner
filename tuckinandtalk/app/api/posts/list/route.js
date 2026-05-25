import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';

/**
 * GET /api/posts/list
 * Return all stored post metrics, newest published first.
 * Supports ?type=REELS|POSTS filter via query param.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || null;

  try {
    const supabase = getServerSupabaseClient();

    let query = supabase
      .from('tat_post_metrics')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(500);

    if (type === 'REELS') {
      query = query.eq('media_product_type', 'REELS');
    } else if (type === 'POSTS') {
      query = query.neq('media_product_type', 'REELS');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, posts: data || [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
