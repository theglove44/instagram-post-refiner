import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../lib/supabase-server.js';

/**
 * GET /api/hashtags
 * List all configured hashtags with their latest audit result.
 */
export async function GET() {
  try {
    const supabase = getServerSupabaseClient();

    const { data: configs, error } = await supabase
      .from('tat_hashtag_config')
      .select('*')
      .order('hashtag', { ascending: true });

    if (error) throw new Error(error.message);

    // Attach latest audit result to each hashtag
    const hashtags = await Promise.all(
      (configs || []).map(async (cfg) => {
        const { data: latest } = await supabase
          .from('tat_hashtag_audits')
          .select('audit_date, median_likes, median_comments, median_engagement, tier, top_posts_count')
          .eq('hashtag', cfg.hashtag)
          .order('audit_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        return { ...cfg, latestAudit: latest || null };
      })
    );

    return NextResponse.json({ success: true, hashtags });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hashtags
 * Add a new hashtag to the config.
 * Body: { hashtag: "#manchesterfood" }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const hashtag = (body.hashtag || '').trim().toLowerCase().replace(/^#/, '');

    if (!hashtag) {
      return NextResponse.json(
        { success: false, error: 'hashtag is required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('tat_hashtag_config')
      .insert({ hashtag })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: `#${hashtag} is already in the list` },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, hashtag: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hashtags?hashtag=manchesterfood
 * Remove a hashtag from the config.
 */
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const hashtag = (searchParams.get('hashtag') || '').replace(/^#/, '').toLowerCase();

  if (!hashtag) {
    return NextResponse.json(
      { success: false, error: 'hashtag query param required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('tat_hashtag_config')
      .delete()
      .eq('hashtag', hashtag);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
