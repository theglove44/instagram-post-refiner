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

// Correlate hashtags with engagement metrics (ignoring NULL values)
export function correlateHashtagsWithEngagement(posts) {
  const hashtagMetrics = {};
  
  posts.forEach(post => {
    // Only process posts that have Instagram metrics
    if (!post.metrics) return;
    
    const hashtags = extractHashtags(post.finalVersion || post.final_version);
    
    // Only use non-null values for calculations
    const engagement = post.metrics.engagementRate !== null && post.metrics.engagementRate !== undefined
      ? parseFloat(post.metrics.engagementRate)
      : null;
    const reach = post.metrics.reach !== null && post.metrics.reach !== undefined
      ? post.metrics.reach
      : null;
    const likes = post.metrics.likes !== null && post.metrics.likes !== undefined
      ? post.metrics.likes
      : null;
    
    hashtags.forEach(tag => {
      if (!hashtagMetrics[tag]) {
        hashtagMetrics[tag] = {
          postCount: 0,
          engagementSum: 0,
          engagementCount: 0,
          reachSum: 0,
          reachCount: 0,
          likesSum: 0,
          likesCount: 0,
        };
      }
      hashtagMetrics[tag].postCount++;
      
      // Only add to sums if value is not null
      if (engagement !== null) {
        hashtagMetrics[tag].engagementSum += engagement;
        hashtagMetrics[tag].engagementCount++;
      }
      if (reach !== null) {
        hashtagMetrics[tag].reachSum += reach;
        hashtagMetrics[tag].reachCount++;
      }
      if (likes !== null) {
        hashtagMetrics[tag].likesSum += likes;
        hashtagMetrics[tag].likesCount++;
      }
    });
  });
  
  // Calculate averages (only from non-null values) and sort by performance
  const correlations = Object.entries(hashtagMetrics)
    .filter(([_, data]) => data.postCount >= 1 && data.engagementCount > 0)
    .map(([hashtag, data]) => ({
      hashtag,
      postCount: data.postCount,
      avgEngagement: data.engagementCount > 0 
        ? (data.engagementSum / data.engagementCount).toFixed(2) 
        : null,
      avgReach: data.reachCount > 0 
        ? Math.round(data.reachSum / data.reachCount) 
        : null,
      avgLikes: data.likesCount > 0 
        ? Math.round(data.likesSum / data.likesCount) 
        : null,
      dataCompleteness: Math.round((data.engagementCount / data.postCount) * 100),
    }))
    .sort((a, b) => {
      // Sort by engagement, treating null as lowest
      const aEng = a.avgEngagement !== null ? parseFloat(a.avgEngagement) : -1;
      const bEng = b.avgEngagement !== null ? parseFloat(b.avgEngagement) : -1;
      return bEng - aEng;
    });
  
  return {
    bestPerforming: correlations.slice(0, 10),
    worstPerforming: correlations.filter(c => c.avgEngagement !== null).slice(-10).reverse(),
    all: correlations,
  };
}
