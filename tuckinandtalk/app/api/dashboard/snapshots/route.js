import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';

/**
 * GET /api/dashboard/snapshots
 * Return the last 12 weekly snapshots, newest first, for the dashboard trend chart.
 */
export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('tat_weekly_snapshots')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, snapshots: data || [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
