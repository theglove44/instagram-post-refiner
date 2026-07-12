import { getServerSupabaseClient } from '@/lib/supabase-server';
import { buildTrainingExport, fetchTrainingPosts } from '@/lib/training-data';

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const data = await fetchTrainingPosts(supabase);

    return Response.json(buildTrainingExport(data || []), {
      headers: {
        'Content-Disposition': 'attachment; filename="instagram-voice-training.json"',
      },
    });
  } catch (error) {
    console.error('Training export error:', error);
    return Response.json({ error: error.message || 'Failed to export training data' }, { status: 500 });
  }
}
