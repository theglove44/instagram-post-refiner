import { getSupabaseClient } from '@/lib/supabase';
import { 
  calculateComponentRates, 
  calculatePercentiles, 
  getBaselineWindow,
  calculateSummaryMedians,
  calculatePeriodDelta,
} from '@/lib/derived-metrics';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('postId');
  
  try {
    const supabase = getSupabaseClient();
    
    // Get all published posts with their latest metrics
    const { data: postsWithMetrics } = await supabase
      .from('posts')
      .select(`
        id,
        topic,
        edit_count,
        published_at,
        instagram_permalink,
        instagram_media_id,
        post_metrics (
          impressions,
          reach,
          views,
          likes,
          comments,
          saves,
          shares,
          engagement_rate,
          fetched_at
        )
      `)
      .not('instagram_media_id', 'is', null)
      .order('published_at', { ascending: false });
    
    if (!postsWithMetrics || postsWithMetrics.length === 0) {
      return Response.json({
        success: true,
        posts: [],
        summary: null,
        delta: null,
      });
    }
    
    // Process each post: get latest metrics and calculate rates
    const processedPosts = postsWithMetrics.map(post => {
      const latestMetrics = post.post_metrics?.sort(
        (a, b) => new Date(b.fetched_at) - new Date(a.fetched_at)
      )[0] || null;
      
      const rates = latestMetrics ? calculateComponentRates({
        reach: latestMetrics.reach,
        likes: latestMetrics.likes,
        comments: latestMetrics.comments,
        saves: latestMetrics.saves,
        shares: latestMetrics.shares,
      }) : null;
      
      return {
        id: post.id,
        topic: post.topic,
        editCount: post.edit_count,
        publishedAt: post.published_at,
        instagramPermalink: post.instagram_permalink,
        metrics: latestMetrics ? {
          impressions: latestMetrics.impressions,
          reach: latestMetrics.reach,
          views: latestMetrics.views,
          likes: latestMetrics.likes,
          comments: latestMetrics.comments,
          saves: latestMetrics.saves,
          shares: latestMetrics.shares,
          lastUpdated: latestMetrics.fetched_at,
        } : null,
        rates,
      };
    });
    
    // Get baseline for percentile calculation (last 30 posts with valid rates)
    const baseline = getBaselineWindow(processedPosts, null, 30);
    
    // Calculate percentiles for each post
    const postsWithPercentiles = processedPosts.map(post => ({
      ...post,
      percentiles: post.rates ? calculatePercentiles(post.rates, baseline) : null,
    }));
    
    // If specific post requested, return just that one
    if (postId) {
      const post = postsWithPercentiles.find(p => p.id === parseInt(postId));
      if (!post) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      return Response.json({ success: true, post });
    }
    
    // Calculate summary medians for last 28 days
    const summary = calculateSummaryMedians(processedPosts, 28);
    
    // Calculate delta vs previous 28 days
    const delta = calculatePeriodDelta(processedPosts, 28);
    
    return Response.json({
      success: true,
      posts: postsWithPercentiles,
      summary,
      delta,
      baselineSize: baseline.length,
    });
    
  } catch (error) {
    console.error('Derived metrics error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
