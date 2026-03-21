import { calculateBestTimes } from '@/lib/best-times';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timezone = searchParams.get('timezone') || 'Europe/London';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const { bestTimes, totalPostsAnalysed } = await calculateBestTimes({
      timezone,
      limit,
      minPosts: 2,
    });

    return Response.json({
      success: true,
      bestTimes,
      totalPostsAnalysed,
    });
  } catch (error) {
    console.error('Best times error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
