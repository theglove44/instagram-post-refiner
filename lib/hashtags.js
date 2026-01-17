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

// Correlate hashtags with engagement metrics
export function correlateHashtagsWithEngagement(posts) {
  const hashtagMetrics = {};
  
  posts.forEach(post => {
    // Only process posts that have Instagram metrics
    if (!post.metrics) return;
    
    const hashtags = extractHashtags(post.finalVersion || post.final_version);
    const engagement = parseFloat(post.metrics.engagementRate) || 0;
    const reach = post.metrics.reach || 0;
    const likes = post.metrics.likes || 0;
    
    hashtags.forEach(tag => {
      if (!hashtagMetrics[tag]) {
        hashtagMetrics[tag] = {
          postCount: 0,
          totalEngagement: 0,
          totalReach: 0,
          totalLikes: 0,
          engagementRates: [],
        };
      }
      hashtagMetrics[tag].postCount++;
      hashtagMetrics[tag].totalEngagement += engagement;
      hashtagMetrics[tag].totalReach += reach;
      hashtagMetrics[tag].totalLikes += likes;
      hashtagMetrics[tag].engagementRates.push(engagement);
    });
  });
  
  // Calculate averages and sort by performance
  const correlations = Object.entries(hashtagMetrics)
    .filter(([_, data]) => data.postCount >= 1)
    .map(([hashtag, data]) => ({
      hashtag,
      postCount: data.postCount,
      avgEngagement: (data.totalEngagement / data.postCount).toFixed(2),
      avgReach: Math.round(data.totalReach / data.postCount),
      avgLikes: Math.round(data.totalLikes / data.postCount),
    }))
    .sort((a, b) => parseFloat(b.avgEngagement) - parseFloat(a.avgEngagement));
  
  return {
    bestPerforming: correlations.slice(0, 10),
    worstPerforming: correlations.slice(-10).reverse(),
    all: correlations,
  };
}
