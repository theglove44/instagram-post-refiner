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

// Constants for sample gating and shrinkage
const MIN_N = 5; // Minimum posts to label as "best"
const SHRINKAGE_K = 10; // Shrinkage constant

// Calculate shrinkage score: regress toward global mean for small samples
function shrinkageScore(bucketMean, globalMean, n, k = SHRINKAGE_K) {
  // score = (n/(n+k)) * bucket_mean + (k/(n+k)) * global_mean
  return (n / (n + k)) * bucketMean + (k / (n + k)) * globalMean;
}

function analyzePostingTimes(posts) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hourBuckets = {};
  const dayBuckets = {};
  
  // Use engagement rate by reach (not raw interactions)
  let globalSum = 0;
  let globalCount = 0;
  
  posts.forEach(post => {
    if (!post.timestamp) return;
    
    const date = new Date(post.timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    // Use engagement rate by reach if available, otherwise skip
    const engagementRate = post.engagementRate;
    if (engagementRate === null || engagementRate === undefined) return;
    
    globalSum += engagementRate;
    globalCount++;
    
    // Group by hour
    if (!hourBuckets[hour]) {
      hourBuckets[hour] = { sum: 0, count: 0 };
    }
    hourBuckets[hour].sum += engagementRate;
    hourBuckets[hour].count++;
    
    // Group by day
    if (!dayBuckets[day]) {
      dayBuckets[day] = { sum: 0, count: 0 };
    }
    dayBuckets[day].sum += engagementRate;
    dayBuckets[day].count++;
  });
  
  const globalMean = globalCount > 0 ? globalSum / globalCount : 0;
  
  // Calculate shrinkage-adjusted scores for hours
  const hourlyData = Object.entries(hourBuckets).map(([hour, data]) => {
    const bucketMean = data.sum / data.count;
    const score = shrinkageScore(bucketMean, globalMean, data.count);
    return {
      hour: parseInt(hour),
      avgEngagementRate: parseFloat(bucketMean.toFixed(2)),
      shrinkageScore: parseFloat(score.toFixed(2)),
      postCount: data.count,
      meetsMinN: data.count >= MIN_N,
    };
  }).sort((a, b) => b.shrinkageScore - a.shrinkageScore);
  
  // Calculate shrinkage-adjusted scores for days
  const dailyData = Object.entries(dayBuckets).map(([day, data]) => {
    const bucketMean = data.sum / data.count;
    const score = shrinkageScore(bucketMean, globalMean, data.count);
    return {
      day: dayNames[parseInt(day)],
      dayIndex: parseInt(day),
      avgEngagementRate: parseFloat(bucketMean.toFixed(2)),
      shrinkageScore: parseFloat(score.toFixed(2)),
      postCount: data.count,
      meetsMinN: data.count >= MIN_N,
    };
  }).sort((a, b) => b.shrinkageScore - a.shrinkageScore);
  
  // Best hour/day: only from buckets meeting MIN_N
  const validHours = hourlyData.filter(h => h.meetsMinN);
  const validDays = dailyData.filter(d => d.meetsMinN);
  
  const bestHour = validHours[0];
  const bestDay = validDays[0];
  
  const bestHourFormatted = bestHour ? 
    `${bestHour.hour.toString().padStart(2, '0')}:00 - ${((bestHour.hour + 1) % 24).toString().padStart(2, '0')}:00` : 
    null;
  
  return {
    bestHour: bestHourFormatted,
    bestHourEngagementRate: bestHour?.avgEngagementRate,
    bestHourPostCount: bestHour?.postCount,
    bestDay: bestDay?.day,
    bestDayEngagementRate: bestDay?.avgEngagementRate,
    bestDayPostCount: bestDay?.postCount,
    hourlyBreakdown: hourlyData.slice(0, 8), // Top 8 hours
    dailyBreakdown: dailyData,
    globalMean: parseFloat(globalMean.toFixed(2)),
    totalPostsAnalyzed: globalCount,
    minNRequired: MIN_N,
    insufficientData: validHours.length === 0 && validDays.length === 0,
  };
}
