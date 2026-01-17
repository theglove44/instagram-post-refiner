import { getSupabaseClient } from '@/lib/supabase';
import { getMediaInsights, getMediaDetails, getRecentMedia } from '@/lib/instagram';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('postId');
  
  try {
    const supabase = getSupabaseClient();
    
    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);
    
    if (!accounts || accounts.length === 0) {
      return Response.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }
    
    const account = accounts[0];
    const accessToken = account.access_token;
    
    // If postId provided, get metrics for specific post
    if (postId) {
      const { data: post } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (!post || !post.instagram_media_id) {
        return Response.json(
          { error: 'Post not found or not published to Instagram' },
          { status: 404 }
        );
      }
      
      // Get insights and details
      const [insights, details] = await Promise.all([
        getMediaInsights(accessToken, post.instagram_media_id),
        getMediaDetails(accessToken, post.instagram_media_id),
      ]);
      
      // Calculate engagement rate
      const totalEngagement = (details.likes || 0) + (details.comments || 0) + (insights?.saved || 0);
      const reach = insights?.reach || 1;
      const engagementRate = ((totalEngagement / reach) * 100).toFixed(2);
      
      // Store metrics snapshot
      await supabase
        .from('post_metrics')
        .insert({
          post_id: post.id,
          instagram_media_id: post.instagram_media_id,
          impressions: insights?.impressions || 0,
          reach: insights?.reach || 0,
          views: insights?.plays || 0,
          likes: details.likes || 0,
          comments: details.comments || 0,
          saves: insights?.saved || 0,
          shares: insights?.shares || 0,
          engagement_rate: engagementRate,
        });
      
      return Response.json({
        success: true,
        metrics: {
          impressions: insights?.impressions || 0,
          reach: insights?.reach || 0,
          views: insights?.plays || 0,
          likes: details.likes || 0,
          comments: details.comments || 0,
          saves: insights?.saved || 0,
          shares: insights?.shares || 0,
          engagementRate,
          permalink: details.permalink,
        }
      });
    }
    
    // Otherwise, return all posts with their latest metrics
    const { data: postsWithMetrics } = await supabase
      .from('posts')
      .select(`
        *,
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
    
    // Get latest metrics for each post
    const postsData = (postsWithMetrics || []).map(post => {
      const latestMetrics = post.post_metrics?.sort(
        (a, b) => new Date(b.fetched_at) - new Date(a.fetched_at)
      )[0] || null;
      
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
          engagementRate: latestMetrics.engagement_rate,
          lastUpdated: latestMetrics.fetched_at,
        } : null,
      };
    });
    
    return Response.json({
      success: true,
      posts: postsData,
    });
    
  } catch (error) {
    console.error('Metrics error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Refresh metrics for all published posts
export async function POST() {
  try {
    const supabase = getSupabaseClient();
    
    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);
    
    if (!accounts || accounts.length === 0) {
      return Response.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }
    
    const account = accounts[0];
    const accessToken = account.access_token;
    
    // Get all published posts
    const { data: publishedPosts } = await supabase
      .from('posts')
      .select('id, instagram_media_id')
      .not('instagram_media_id', 'is', null);
    
    if (!publishedPosts || publishedPosts.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }
    
    let updated = 0;
    const errors = [];
    
    // Fetch metrics for each post (with rate limiting consideration)
    for (const post of publishedPosts) {
      try {
        const [insights, details] = await Promise.all([
          getMediaInsights(accessToken, post.instagram_media_id),
          getMediaDetails(accessToken, post.instagram_media_id),
        ]);
        
        const totalEngagement = (details.likes || 0) + (details.comments || 0) + (insights?.saved || 0);
        const reach = insights?.reach || 1;
        const engagementRate = ((totalEngagement / reach) * 100).toFixed(2);
        
        await supabase
          .from('post_metrics')
          .insert({
            post_id: post.id,
            instagram_media_id: post.instagram_media_id,
            impressions: insights?.impressions || 0,
            reach: insights?.reach || 0,
            views: insights?.plays || 0,
            likes: details.likes || 0,
            comments: details.comments || 0,
            saves: insights?.saved || 0,
            shares: insights?.shares || 0,
            engagement_rate: engagementRate,
          });
        
        updated++;
      } catch (err) {
        errors.push({ postId: post.id, error: err.message });
      }
    }
    
    return Response.json({
      success: true,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error('Metrics refresh error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
