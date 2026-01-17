import { getSupabaseClient } from '@/lib/supabase';
import { getRecentMedia, getMediaInsights } from '@/lib/instagram';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  
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
    
    // Fetch recent media
    const recentMedia = await getRecentMedia(accessToken, account.instagram_user_id, limit);
    
    // Fetch insights for each post (in parallel, but limit concurrency)
    const postsWithInsights = await Promise.all(
      recentMedia.map(async (media) => {
        try {
          const insights = await getMediaInsights(accessToken, media.id);
          const likes = media.like_count || 0;
          const comments = media.comments_count || 0;
          const saves = insights?.saved || 0;
          const shares = insights?.shares || 0;
          const reach = insights?.reach || 0;
          
          // Calculate engagement rate (only if we have reach data)
          let engagementRate = null;
          if (reach > 0) {
            const totalEngagement = likes + comments + saves;
            engagementRate = ((totalEngagement / reach) * 100).toFixed(1);
          }
          
          return {
            id: media.id,
            caption: media.caption?.slice(0, 150) + (media.caption?.length > 150 ? '...' : ''),
            mediaType: media.media_type,
            permalink: media.permalink,
            timestamp: media.timestamp,
            likes,
            comments,
            views: insights?.views || null,
            reach: reach || null,
            saves: saves || null,
            shares: shares || null,
            totalInteractions: insights?.total_interactions || null,
            avgWatchTime: insights?.ig_reels_avg_watch_time || null,
            replays: insights?.clips_replays_count || null,
            engagementRate: engagementRate ? parseFloat(engagementRate) : null,
          };
        } catch (err) {
          // Some posts may not have insights available
          return {
            id: media.id,
            caption: media.caption?.slice(0, 150) + (media.caption?.length > 150 ? '...' : ''),
            mediaType: media.media_type,
            permalink: media.permalink,
            timestamp: media.timestamp,
            likes: media.like_count || 0,
            comments: media.comments_count || 0,
          };
        }
      })
    );
    
    // Calculate time-based analytics
    const timeAnalysis = analyzePostingTimes(postsWithInsights);
    
    return Response.json({
      success: true,
      posts: postsWithInsights,
      timeAnalysis,
    });
    
  } catch (error) {
    console.error('Recent media error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function analyzePostingTimes(posts) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hourBuckets = {};
  const dayBuckets = {};
  
  posts.forEach(post => {
    if (!post.timestamp) return;
    
    const date = new Date(post.timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    // Use likes + comments as simple engagement metric (more reliable than rate)
    const engagement = (post.likes || 0) + (post.comments || 0);
    
    // Group by hour
    if (!hourBuckets[hour]) {
      hourBuckets[hour] = { totalEngagement: 0, count: 0 };
    }
    hourBuckets[hour].totalEngagement += engagement;
    hourBuckets[hour].count++;
    
    // Group by day
    if (!dayBuckets[day]) {
      dayBuckets[day] = { totalEngagement: 0, count: 0 };
    }
    dayBuckets[day].totalEngagement += engagement;
    dayBuckets[day].count++;
  });
  
  // Calculate averages and find best times
  const hourlyAvg = Object.entries(hourBuckets).map(([hour, data]) => ({
    hour: parseInt(hour),
    avgEngagement: Math.round(data.totalEngagement / data.count),
    postCount: data.count,
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);
  
  const dailyAvg = Object.entries(dayBuckets).map(([day, data]) => ({
    day: dayNames[parseInt(day)],
    dayIndex: parseInt(day),
    avgEngagement: Math.round(data.totalEngagement / data.count),
    postCount: data.count,
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);
  
  // Format best hour
  const bestHour = hourlyAvg[0];
  const bestHourFormatted = bestHour ? 
    `${bestHour.hour.toString().padStart(2, '0')}:00 - ${((bestHour.hour + 1) % 24).toString().padStart(2, '0')}:00` : 
    null;
  
  return {
    bestHour: bestHourFormatted,
    bestHourEngagement: bestHour?.avgEngagement,
    bestDay: dailyAvg[0]?.day,
    bestDayEngagement: dailyAvg[0]?.avgEngagement,
    hourlyBreakdown: hourlyAvg.slice(0, 5), // Top 5 hours
    dailyBreakdown: dailyAvg,
  };
}
