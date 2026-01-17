// Extract hashtags from text
export function extractHashtags(text) {
  if (!text) return [];
  // Match hashtags: # followed by word characters (letters, numbers, underscores)
  const matches = text.match(/#[\w]+/g) || [];
  // Normalize to lowercase and remove duplicates
  const unique = [...new Set(matches.map(tag => tag.toLowerCase()))];
  return unique;
}

// Count hashtag frequency across multiple posts
export function countHashtagFrequency(posts) {
  const frequency = {};
  
  posts.forEach(post => {
    const hashtags = extractHashtags(post.finalVersion || post.final_version);
    hashtags.forEach(tag => {
      if (!frequency[tag]) {
        frequency[tag] = { count: 0, posts: [] };
      }
      frequency[tag].count++;
      frequency[tag].posts.push(post.id || post.post_id);
    });
  });
  
  return frequency;
}

// Get hashtag stats sorted by frequency
export function getHashtagStats(posts) {
  const frequency = countHashtagFrequency(posts);
  
  const stats = Object.entries(frequency)
    .map(([hashtag, data]) => ({
      hashtag,
      count: data.count,
      postIds: data.posts,
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    totalUnique: stats.length,
    totalUsage: stats.reduce((sum, s) => sum + s.count, 0),
    avgPerPost: posts.length > 0 ? (stats.reduce((sum, s) => sum + s.count, 0) / posts.length).toFixed(1) : 0,
    top: stats.slice(0, 20),
    all: stats,
  };
}

// Constants for hashtag ranking
const MIN_TAG_N = 5; // Minimum posts for hashtag to be ranked
const SHRINKAGE_K = 10; // Shrinkage constant for lift calculation

// Calculate baseline mean (overall or by media type)
export function calculateBaselineMean(posts) {
  let sum = 0;
  let count = 0;
  
  posts.forEach(post => {
    if (!post.metrics) return;
    const engagement = post.metrics.engagementRate !== null && post.metrics.engagementRate !== undefined
      ? parseFloat(post.metrics.engagementRate)
      : null;
    if (engagement !== null) {
      sum += engagement;
      count++;
    }
  });
  
  return count > 0 ? sum / count : 0;
}

// Correlate hashtags with engagement using lift vs baseline + shrinkage
export function correlateHashtagsWithEngagement(posts) {
  const hashtagMetrics = {};
  const baselineMean = calculateBaselineMean(posts);
  
  posts.forEach(post => {
    if (!post.metrics) return;
    
    const hashtags = extractHashtags(post.finalVersion || post.final_version);
    
    const engagement = post.metrics.engagementRate !== null && post.metrics.engagementRate !== undefined
      ? parseFloat(post.metrics.engagementRate)
      : null;
    const reach = post.metrics.reach !== null && post.metrics.reach !== undefined
      ? post.metrics.reach
      : null;
    
    hashtags.forEach(tag => {
      if (!hashtagMetrics[tag]) {
        hashtagMetrics[tag] = {
          postCount: 0,
          engagementSum: 0,
          engagementCount: 0,
          reachSum: 0,
          reachCount: 0,
        };
      }
      hashtagMetrics[tag].postCount++;
      
      if (engagement !== null) {
        hashtagMetrics[tag].engagementSum += engagement;
        hashtagMetrics[tag].engagementCount++;
      }
      if (reach !== null) {
        hashtagMetrics[tag].reachSum += reach;
        hashtagMetrics[tag].reachCount++;
      }
    });
  });
  
  // Calculate lift scores with shrinkage
  const correlations = Object.entries(hashtagMetrics)
    .filter(([_, data]) => data.engagementCount > 0)
    .map(([hashtag, data]) => {
      const tagMean = data.engagementSum / data.engagementCount;
      const n = data.engagementCount;
      const rawLift = tagMean - baselineMean;
      // Shrinkage: lift_score = (n/(n+k)) * raw_lift
      const liftScore = (n / (n + SHRINKAGE_K)) * rawLift;
      
      return {
        hashtag,
        postCount: n,
        tagMean: parseFloat(tagMean.toFixed(2)),
        baselineMean: parseFloat(baselineMean.toFixed(2)),
        rawLift: parseFloat(rawLift.toFixed(2)),
        liftScore: parseFloat(liftScore.toFixed(2)),
        avgReach: data.reachCount > 0 
          ? Math.round(data.reachSum / data.reachCount) 
          : null,
        meetsMinN: n >= MIN_TAG_N,
      };
    })
    .sort((a, b) => b.liftScore - a.liftScore);
  
  // Only show hashtags with positive lift AND meeting minimum n
  const positiveLift = correlations.filter(c => c.liftScore > 0 && c.meetsMinN);
  const negativeLift = correlations.filter(c => c.liftScore < 0 && c.meetsMinN);
  
  return {
    bestPerforming: positiveLift.slice(0, 10),
    worstPerforming: negativeLift.slice(-10).reverse(),
    all: correlations,
    baselineMean: parseFloat(baselineMean.toFixed(2)),
    minNRequired: MIN_TAG_N,
    totalWithMetrics: posts.filter(p => p.metrics?.engagementRate != null).length,
  };
}
