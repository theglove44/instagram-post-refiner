import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();

    const { data: counts, error } = await supabase
      .from('engagement_counts')
      .select('count_type, count')
      .in('count_type', ['unreplied_comments', 'unseen_mentions']);

    if (error) {
      throw new Error(error.message);
    }

    const countMap = {};
    for (const row of (counts || [])) {
      countMap[row.count_type] = row.count || 0;
    }

    return Response.json({
      success: true,
      unrepliedComments: countMap['unreplied_comments'] || 0,
      unseenMentions: countMap['unseen_mentions'] || 0,
    });
  } catch (error) {
    console.error('Comment counts error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
