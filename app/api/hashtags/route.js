import { getSupabaseClient } from '@/lib/supabase';
import { getHashtagStats, correlateHashtagsWithEngagement, extractHashtags } from '@/lib/hashtags';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    // Get all posts
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Format posts
    const formattedPosts = (posts || []).map(post => ({
      id: post.post_id,
      topic: post.topic,
      finalVersion: post.final_version,
      editCount: post.edit_count,
      createdAt: post.created_at,
      instagramMediaId: post.instagram_media_id,
      instagramPermalink: post.instagram_permalink,
    }));
    
    // Get basic hashtag stats
    const stats = getHashtagStats(formattedPosts);
    
    // Get posts with metrics for correlation analysis
    const { data: postsWithMetrics } = await supabase
      .from('posts')
      .select(`
        *,
        post_metrics (
          engagement_rate,
          reach,
          likes,
          comments,
          saves,
          fetched_at
        )
      `)
      .not('instagram_media_id', 'is', null);
    
    // Format posts with their latest metrics
    const postsForCorrelation = (postsWithMetrics || []).map(post => {
      const latestMetrics = post.post_metrics?.sort(
        (a, b) => new Date(b.fetched_at) - new Date(a.fetched_at)
      )[0] || null;
      
      return {
        id: post.post_id,
        finalVersion: post.final_version,
        metrics: latestMetrics ? {
          engagementRate: latestMetrics.engagement_rate,
          reach: latestMetrics.reach,
          likes: latestMetrics.likes,
          comments: latestMetrics.comments,
          saves: latestMetrics.saves,
        } : null,
      };
    }).filter(p => p.metrics);
    
    // Calculate correlations if we have posts with metrics
    const correlations = postsForCorrelation.length > 0 
      ? correlateHashtagsWithEngagement(postsForCorrelation)
      : null;
    
    // Calculate hashtag trends over time (last 30 days vs previous)
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
    
    const recentPosts = formattedPosts.filter(p => new Date(p.createdAt) >= thirtyDaysAgo);
    const olderPosts = formattedPosts.filter(p => {
      const date = new Date(p.createdAt);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });
    
    const recentStats = getHashtagStats(recentPosts);
    const olderStats = getHashtagStats(olderPosts);
    
    // Find trending (appearing more in recent vs older) - show underlying counts
    const trending = recentStats.all
      .map(recent => {
        const older = olderStats.all.find(o => o.hashtag === recent.hashtag);
        const olderCount = older?.count || 0;
        const growth = olderCount > 0 ? ((recent.count - olderCount) / olderCount * 100) : (recent.count > 0 ? 100 : 0);
        return { 
          ...recent, 
          growth: Math.round(growth),
          recentCount: recent.count,
          previousCount: olderCount,
        };
      })
      .filter(h => h.count >= 2)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10);
    
    return Response.json({
      success: true,
      stats,
      correlations,
      trending,
      postsWithHashtags: formattedPosts.filter(p => extractHashtags(p.finalVersion).length > 0).length,
      postsWithMetrics: postsForCorrelation.length,
    });
    
  } catch (error) {
    console.error('Hashtags API error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
