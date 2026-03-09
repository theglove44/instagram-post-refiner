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
          media_product_type,
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
        mediaProductType: latestMetrics?.media_product_type || null,
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
      const typeKey = post.mediaProductType || post.mediaType;
      if (!typeKey || !post.rates) continue;
      if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
      typeGroups[typeKey].push(post);
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

    // Time analysis (#36) — day-of-week and hour-of-day engagement breakdown
    const timeAnalysis = buildTimeAnalysis(processedPosts);

    return Response.json({
      success: true,
      posts: postsWithPercentiles,
      summary,
      delta,
      baselineSize: baseline.length,
      contentTypeBreakdown,
      captionAnalysis,
      frequencyAnalysis,
      timeAnalysis,
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

// Shrinkage constants for time analysis
const TIME_MIN_N = 5;

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHourLabel(hour) {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

// Shrinkage score: regress toward global median for small samples
// weight = min(n, MIN_N) / MIN_N
function timeShrinkageScore(rawMedian, globalMedian, postCount) {
  const weight = Math.min(postCount, TIME_MIN_N) / TIME_MIN_N;
  return weight * rawMedian + (1 - weight) * globalMedian;
}

// Build time-of-day and day-of-week engagement analysis from stored metrics
function buildTimeAnalysis(processedPosts) {
  // Filter to posts with valid publishedAt and engagement rate
  const validPosts = processedPosts.filter(
    p => p.publishedAt != null && p.rates?.engagementRate != null
  );

  if (validPosts.length === 0) {
    return null;
  }

  // Compute global median engagement rate
  const allEngagementRates = validPosts.map(p => p.rates.engagementRate);
  const globalMedianEngagement = calculateMedian(allEngagementRates);

  // Group engagement rates by hour and day
  const hourGroups = {}; // hour -> [engagementRate, ...]
  const dayGroups = {};  // day -> [engagementRate, ...]
  const slotGroups = {}; // "day-hour" -> [engagementRate, ...]

  for (const post of validPosts) {
    const date = new Date(post.publishedAt);
    const hour = date.getHours();
    const day = date.getDay();
    const rate = post.rates.engagementRate;

    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(rate);

    if (!dayGroups[day]) dayGroups[day] = [];
    dayGroups[day].push(rate);

    const slotKey = `${day}-${hour}`;
    if (!slotGroups[slotKey]) slotGroups[slotKey] = [];
    slotGroups[slotKey].push(rate);
  }

  // Build hourly array (0-23)
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const rates = hourGroups[h] || [];
    const postCount = rates.length;
    const medianEngagement = postCount > 0 ? calculateMedian(rates) : null;
    const shrinkageScore = postCount > 0
      ? timeShrinkageScore(medianEngagement, globalMedianEngagement, postCount)
      : globalMedianEngagement;

    hourly.push({
      hour: h,
      label: formatHourLabel(h),
      medianEngagement,
      postCount,
      shrinkageScore,
    });
  }

  // Build daily array (0-6)
  const daily = [];
  for (let d = 0; d < 7; d++) {
    const rates = dayGroups[d] || [];
    const postCount = rates.length;
    const medianEngagement = postCount > 0 ? calculateMedian(rates) : null;
    const shrinkageScore = postCount > 0
      ? timeShrinkageScore(medianEngagement, globalMedianEngagement, postCount)
      : globalMedianEngagement;

    daily.push({
      day: d,
      label: DAY_LABELS[d],
      medianEngagement,
      postCount,
      shrinkageScore,
    });
  }

  // Build full 7x24 heatmap
  const heatmap = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const slotKey = `${d}-${h}`;
      const rates = slotGroups[slotKey] || [];
      const postCount = rates.length;
      const medianEngagement = postCount > 0 ? calculateMedian(rates) : null;
      const shrinkageScore = postCount > 0
        ? timeShrinkageScore(medianEngagement, globalMedianEngagement, postCount)
        : globalMedianEngagement;

      heatmap.push({
        day: d,
        hour: h,
        postCount,
        medianEngagement,
        shrinkageScore,
      });
    }
  }

  // Find best hour, day, and slot by shrinkage score
  const bestHourEntry = hourly
    .filter(h => h.postCount > 0)
    .sort((a, b) => b.shrinkageScore - a.shrinkageScore)[0] || null;

  const bestDayEntry = daily
    .filter(d => d.postCount > 0)
    .sort((a, b) => b.shrinkageScore - a.shrinkageScore)[0] || null;

  const bestSlotEntry = heatmap
    .filter(s => s.postCount > 0)
    .sort((a, b) => b.shrinkageScore - a.shrinkageScore)[0] || null;

  return {
    bestHour: bestHourEntry ? {
      hour: bestHourEntry.hour,
      label: bestHourEntry.label,
      medianEngagement: bestHourEntry.medianEngagement,
      postCount: bestHourEntry.postCount,
    } : null,
    bestDay: bestDayEntry ? {
      day: bestDayEntry.day,
      label: bestDayEntry.label,
      medianEngagement: bestDayEntry.medianEngagement,
      postCount: bestDayEntry.postCount,
    } : null,
    bestSlot: bestSlotEntry ? {
      day: bestSlotEntry.day,
      hour: bestSlotEntry.hour,
      dayLabel: DAY_LABELS[bestSlotEntry.day],
      hourLabel: formatHourLabel(bestSlotEntry.hour),
      medianEngagement: bestSlotEntry.medianEngagement,
      postCount: bestSlotEntry.postCount,
    } : null,
    hourly,
    daily,
    heatmap,
    globalMedianEngagement,
    totalPostsAnalyzed: validPosts.length,
  };
}
