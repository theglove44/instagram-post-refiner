/**
 * GET /api/insights/pulse
 * One call feeding the phone dashboard: views split, stories, growth,
 * ranked posts and best slots. Read-only, all from Supabase.
 */
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getPulseData } from '@/lib/pulse';

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const data = await getPulseData(supabase);
    return Response.json({ success: true, ...data });
  } catch (error) {
    console.error('Pulse data error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
