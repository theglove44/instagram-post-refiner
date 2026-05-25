import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../lib/supabase-server.js';

/**
 * GET /api/competitors
 * List all competitor configurations with their latest snapshot.
 */
export async function GET() {
  try {
    const supabase = getServerSupabaseClient();

    const { data: configs, error } = await supabase
      .from('tat_competitor_config')
      .select('*')
      .order('username', { ascending: true });

    if (error) throw new Error(error.message);

    // Attach latest snapshot to each competitor
    const competitors = await Promise.all(
      (configs || []).map(async (cfg) => {
        const { data: latest } = await supabase
          .from('tat_competitor_snapshots')
          .select('snapshot_date, followers_count, media_count, median_engagement_rate')
          .eq('username', cfg.username)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Previous snapshot for growth calculation
        const { data: prev } = await supabase
          .from('tat_competitor_snapshots')
          .select('snapshot_date, followers_count')
          .eq('username', cfg.username)
          .order('snapshot_date', { ascending: false })
          .range(1, 1)
          .maybeSingle();

        const growthRate =
          latest?.followers_count && prev?.followers_count
            ? ((latest.followers_count - prev.followers_count) / prev.followers_count) * 100
            : null;

        return { ...cfg, latestSnapshot: latest || null, growthRate };
      })
    );

    return NextResponse.json({ success: true, competitors });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/competitors
 * Add a competitor handle to track.
 * Body: { username: "manchesterfoodscene", display_name: "Manchester Food Scene" }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const username = (body.username || '').trim().toLowerCase().replace(/^@/, '');
    const displayName = body.display_name?.trim() || null;

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'username is required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('tat_competitor_config')
      .insert({ username, display_name: displayName })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: `@${username} is already being tracked` },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, competitor: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/competitors?username=manchesterfoodscene
 * Remove a competitor from tracking.
 */
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const username = (searchParams.get('username') || '').replace(/^@/, '').toLowerCase();

  if (!username) {
    return NextResponse.json(
      { success: false, error: 'username query param required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('tat_competitor_config')
      .delete()
      .eq('username', username);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
