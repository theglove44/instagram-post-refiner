/**
 * Derived metrics calculations with NULL-safety
 * All rate calculations return NULL if reach is NULL or 0
 */

// Calculate component rates from raw metrics
export function calculateComponentRates(metrics) {
  if (!metrics) return null;
  
  const { reach, likes, comments, saves, shares } = metrics;
  
  // If reach is NULL or 0, all rates are NULL
  if (reach === null || reach === undefined || reach === 0) {
    return {
      likeRate: null,
      commentRate: null,
      saveRate: null,
      shareRate: null,
      engagementRate: null,
      engagementTotal: null,
    };
  }
  
  // Calculate individual rates (NULL if component is NULL)
  const likeRate = likes !== null && likes !== undefined 
    ? parseFloat(((likes / reach) * 100).toFixed(2)) 
    : null;
  const commentRate = comments !== null && comments !== undefined 
    ? parseFloat(((comments / reach) * 100).toFixed(3)) 
    : null;
  const saveRate = saves !== null && saves !== undefined 
    ? parseFloat(((saves / reach) * 100).toFixed(2)) 
    : null;
  const shareRate = shares !== null && shares !== undefined 
    ? parseFloat(((shares / reach) * 100).toFixed(3)) 
    : null;
  
  // Calculate total engagement (sum only present components)
  const components = [likes, comments, saves, shares].filter(v => v !== null && v !== undefined);
  const engagementTotal = components.length > 0 
    ? components.reduce((sum, v) => sum + v, 0) 
    : null;
  
  // Engagement rate (by reach)
  const engagementRate = engagementTotal !== null 
    ? parseFloat(((engagementTotal / reach) * 100).toFixed(2)) 
    : null;
  
  return {
    likeRate,
    commentRate,
    saveRate,
    shareRate,
    engagementRate,
    engagementTotal,
  };
}

// Calculate percentile rank: (#baseline_values <= post_value) / n * 100
export function calculatePercentile(value, baselineValues) {
  if (value === null || value === undefined) return null;
  if (!baselineValues || baselineValues.length < 10) return null;
  
  // Filter out nulls from baseline
  const validBaseline = baselineValues.filter(v => v !== null && v !== undefined);
  if (validBaseline.length < 10) return null;
  
  const countLessOrEqual = validBaseline.filter(v => v <= value).length;
  return Math.round((countLessOrEqual / validBaseline.length) * 100);
}

// Get percentiles for all component rates
export function calculatePercentiles(rates, baselineRates) {
  if (!rates || !baselineRates || baselineRates.length < 10) {
    return {
      engagementRate: null,
      likeRate: null,
      commentRate: null,
      saveRate: null,
      shareRate: null,
      insufficientData: true,
    };
  }
  
  return {
    engagementRate: calculatePercentile(
      rates.engagementRate, 
      baselineRates.map(b => b.engagementRate)
    ),
    likeRate: calculatePercentile(
      rates.likeRate, 
      baselineRates.map(b => b.likeRate)
    ),
    commentRate: calculatePercentile(
      rates.commentRate, 
      baselineRates.map(b => b.commentRate)
    ),
    saveRate: calculatePercentile(
      rates.saveRate, 
      baselineRates.map(b => b.saveRate)
    ),
    shareRate: calculatePercentile(
      rates.shareRate, 
      baselineRates.map(b => b.shareRate)
    ),
    insufficientData: false,
  };
}

// Calculate median from array of values (ignoring nulls)
export function calculateMedian(values) {
  const valid = values.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Get baseline distribution for a media type (or overall if < 10 posts of that type)
export function getBaselineWindow(posts, mediaType = null, windowSize = 30) {
  let filtered = posts;
  
  // Try media-type specific baseline first
  if (mediaType) {
    const typeFiltered = posts.filter(p => p.mediaType === mediaType);
    if (typeFiltered.length >= 10) {
      filtered = typeFiltered;
    }
  }
  
  // Get last N posts with rates
  return filtered
    .filter(p => p.rates && p.rates.engagementRate !== null)
    .slice(0, windowSize)
    .map(p => p.rates);
}

// Calculate summary medians for last 28 days
export function calculateSummaryMedians(posts, days = 28) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const recentPosts = posts.filter(p => {
    const postDate = new Date(p.publishedAt || p.fetched_at);
    return postDate >= cutoff && p.rates;
  });
  
  if (recentPosts.length === 0) return null;
  
  return {
    engagementRate: calculateMedian(recentPosts.map(p => p.rates.engagementRate)),
    likeRate: calculateMedian(recentPosts.map(p => p.rates.likeRate)),
    commentRate: calculateMedian(recentPosts.map(p => p.rates.commentRate)),
    saveRate: calculateMedian(recentPosts.map(p => p.rates.saveRate)),
    shareRate: calculateMedian(recentPosts.map(p => p.rates.shareRate)),
    postCount: recentPosts.length,
  };
}

// Calculate delta vs previous period
export function calculatePeriodDelta(posts, days = 28) {
  const now = new Date();
  const currentStart = new Date();
  currentStart.setDate(now.getDate() - days);
  const previousStart = new Date();
  previousStart.setDate(now.getDate() - (days * 2));
  
  const currentPosts = posts.filter(p => {
    const postDate = new Date(p.publishedAt || p.fetched_at);
    return postDate >= currentStart && postDate <= now && p.rates;
  });
  
  const previousPosts = posts.filter(p => {
    const postDate = new Date(p.publishedAt || p.fetched_at);
    return postDate >= previousStart && postDate < currentStart && p.rates;
  });
  
  if (currentPosts.length < 3 || previousPosts.length < 3) {
    return null;
  }
  
  const currentMedian = calculateMedian(currentPosts.map(p => p.rates.engagementRate));
  const previousMedian = calculateMedian(previousPosts.map(p => p.rates.engagementRate));
  
  if (currentMedian === null || previousMedian === null || previousMedian === 0) {
    return null;
  }
  
  return {
    current: currentMedian,
    previous: previousMedian,
    delta: parseFloat(((currentMedian - previousMedian) / previousMedian * 100).toFixed(1)),
  };
}
