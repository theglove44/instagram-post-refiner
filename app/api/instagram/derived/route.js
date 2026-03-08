import { getSupabaseClient } from '@/lib/supabase';
import {
  calculateComponentRates,
  calculatePercentiles,
  calculatePerformanceScore,
  getBaselineWindow,
  calculateSummaryMedians,
  calculatePeriodDelta,
  calculateMedian,
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
        final_version,
        instagram_permalink,
        instagram_media_id,
        post_metrics (
          reach,
          views,
          likes,
          comments,
          saves,
          shares,
          engagement_rate,
          media_type,
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
        captionLength: post.final_version ? post.final_version.length : null,
        instagramPermalink: post.instagram_permalink,
        mediaType: latestMetrics?.media_type || null,
        metrics: latestMetrics ? {
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
    
    // Calculate percentiles and performance score for each post
    const postsWithPercentiles = processedPosts.map(post => ({
      ...post,
      percentiles: post.rates ? calculatePercentiles(post.rates, baseline) : null,
      performanceScore: post.rates ? calculatePerformanceScore(post.rates, baseline) : null,
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

    // Calculate content type breakdown
    const typeGroups = {};
    for (const post of processedPosts) {
      if (!post.mediaType || !post.rates) continue;
      if (!typeGroups[post.mediaType]) typeGroups[post.mediaType] = [];
      typeGroups[post.mediaType].push(post);
    }

    const contentTypeBreakdown = Object.entries(typeGroups).map(([type, typePosts]) => ({
      type,
      count: typePosts.length,
      medianEngagementRate: calculateMedian(typePosts.map(p => p.rates?.engagementRate).filter(v => v != null)),
      medianSaveRate: calculateMedian(typePosts.map(p => p.rates?.saveRate).filter(v => v != null)),
      medianShareRate: calculateMedian(typePosts.map(p => p.rates?.shareRate).filter(v => v != null)),
      medianReach: calculateMedian(typePosts.filter(p => p.metrics).map(p => p.metrics.reach).filter(v => v != null)),
      insufficientData: typePosts.length < 10,
    }));

    // Caption length analysis (#33)
    const captionBucketDefs = [
      { label: 'Short (0-100)', range: [0, 100] },
      { label: 'Medium (100-250)', range: [100, 250] },
      { label: 'Long (250-500)', range: [250, 500] },
      { label: 'Very Long (500+)', range: [500, Infinity] },
    ];

    const postsWithCaptions = processedPosts.filter(
      p => p.captionLength != null && p.rates?.engagementRate != null
    );

    const captionBuckets = captionBucketDefs.map(def => {
      const matching = postsWithCaptions.filter(
        p => p.captionLength >= def.range[0] && p.captionLength < def.range[1]
      );
      const medianEngagement = calculateMedian(
        matching.map(p => p.rates?.engagementRate).filter(v => v != null)
      );
      return {
        label: def.label,
        range: def.range[1] === Infinity ? [def.range[0], null] : def.range,
        count: matching.length,
        medianEngagement,
      };
    });

    const bestCaptionBucket = captionBuckets
      .filter(b => b.count > 0 && b.medianEngagement !== null)
      .sort((a, b) => b.medianEngagement - a.medianEngagement)[0] || null;

    const captionAnalysis = {
      buckets: captionBuckets,
      optimalBucket: bestCaptionBucket?.label || null,
      recommendation: bestCaptionBucket
        ? `Your posts between ${bestCaptionBucket.label.match(/\((.+)\)/)?.[1] || bestCaptionBucket.label} characters perform best`
        : 'Not enough data to determine optimal caption length yet',
    };

    // Post frequency analysis (#34)
    const postsWithDates = processedPosts.filter(
      p => p.publishedAt && p.rates?.engagementRate != null
    );

    // Group posts by ISO week
    const weekMap = {};
    for (const post of postsWithDates) {
      const date = new Date(post.publishedAt);
      const week = getISOWeek(date);
      if (!weekMap[week]) weekMap[week] = [];
      weekMap[week].push(post);
    }

    const weeklyData = Object.entries(weekMap)
      .map(([week, weekPosts]) => ({
        week,
        posts: weekPosts.length,
        medianEngagement: calculateMedian(
          weekPosts.map(p => p.rates?.engagementRate).filter(v => v != null)
        ),
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const freqBucketDefs = [
      { label: '1 post/week', min: 1, max: 1 },
      { label: '2-3 posts/week', min: 2, max: 3 },
      { label: '4-5 posts/week', min: 4, max: 5 },
      { label: '6+ posts/week', min: 6, max: Infinity },
    ];

    const freqBuckets = freqBucketDefs.map(def => {
      const matchingWeeks = weeklyData.filter(
        w => w.posts >= def.min && w.posts <= def.max
      );
      const medianEngagement = calculateMedian(
        matchingWeeks.map(w => w.medianEngagement).filter(v => v !== null)
      );
      return {
        label: def.label,
        count: matchingWeeks.length,
        medianEngagement,
      };
    });

    const bestFreqBucket = freqBuckets
      .filter(b => b.count > 0 && b.medianEngagement !== null)
      .sort((a, b) => b.medianEngagement - a.medianEngagement)[0] || null;

    // Current week progress (#39)
    const currentWeek = getISOWeek(new Date());
    const allPostsWithDates = processedPosts.filter(p => p.publishedAt);
    const currentWeekPosts = allPostsWithDates.filter(p => {
      const week = getISOWeek(new Date(p.publishedAt));
      return week === currentWeek;
    }).length;

    // Determine target from best bucket's max value
    const bestFreqDef = bestFreqBucket
      ? freqBucketDefs.find(d => d.label === bestFreqBucket.label)
      : null;
    const currentWeekTarget = bestFreqDef
      ? (bestFreqDef.max === Infinity ? bestFreqDef.min : bestFreqDef.max)
      : null;

    // Confidence based on number of weeks in the best bucket
    const confidenceLevel = !bestFreqBucket ? 'low'
      : bestFreqBucket.count >= 8 ? 'high'
      : bestFreqBucket.count >= 4 ? 'medium'
      : 'low';

    const frequencyAnalysis = {
      buckets: freqBuckets,
      optimalBucket: bestFreqBucket?.label || null,
      recommendation: bestFreqBucket
        ? `Weeks where you posted ${bestFreqBucket.label.replace(' posts/week', '').replace(' post/week', '')} time${bestFreqBucket.label.startsWith('1 ') ? '' : 's'} averaged higher engagement`
        : 'Not enough data to determine optimal posting frequency yet',
      weeklyData,
      currentWeekPosts,
      currentWeekTarget,
      confidenceLevel,
    };

    return Response.json({
      success: true,
      posts: postsWithPercentiles,
      summary,
      delta,
      baselineSize: baseline.length,
      contentTypeBreakdown,
      captionAnalysis,
      frequencyAnalysis,
    });
    
  } catch (error) {
    console.error('Derived metrics error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Returns ISO week string like "2026-W10"
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}
