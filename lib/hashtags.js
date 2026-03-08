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

// Calculate median of a numeric array
function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Jaccard similarity between two Sets
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Cluster posts by hashtag set similarity using Jaccard >= threshold
export function clusterHashtagSets(posts, threshold = 0.7) {
  // Filter to posts with both hashtags and engagement metrics
  const eligible = posts
    .map(post => {
      const tags = extractHashtags(post.finalVersion || post.final_version);
      if (tags.length === 0) return null;
      if (!post.metrics || post.metrics.engagementRate == null) return null;
      return {
        id: post.id,
        tags: new Set(tags),
        engagementRate: parseFloat(post.metrics.engagementRate),
        reach: post.metrics.reach != null ? post.metrics.reach : null,
      };
    })
    .filter(Boolean);

  if (eligible.length < 2) return [];

  // Greedy clustering
  const clusters = []; // Each cluster: { posts: [...eligible items] }

  for (const post of eligible) {
    let assigned = false;
    for (const cluster of clusters) {
      // Compare against the first post in the cluster (representative)
      if (jaccardSimilarity(post.tags, cluster.posts[0].tags) >= threshold) {
        cluster.posts.push(post);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      clusters.push({ posts: [post] });
    }
  }

  // Build result, filtering to clusters with >= 2 posts
  const results = clusters
    .filter(c => c.posts.length >= 2)
    .map(cluster => {
      const allTagSets = cluster.posts.map(p => p.tags);

      // Union of all tags
      const unionTags = new Set();
      for (const s of allTagSets) {
        for (const t of s) unionTags.add(t);
      }

      // Intersection (core tags present in every post)
      const coreTags = [...allTagSets[0]].filter(tag =>
        allTagSets.every(s => s.has(tag))
      );

      const engagementValues = cluster.posts.map(p => p.engagementRate);
      const reachValues = cluster.posts
        .map(p => p.reach)
        .filter(r => r !== null);

      return {
        tags: [...unionTags].sort(),
        coreTags: coreTags.sort(),
        postCount: cluster.posts.length,
        medianEngagement: parseFloat(median(engagementValues).toFixed(2)),
        medianReach: reachValues.length > 0 ? Math.round(median(reachValues)) : null,
        postIds: cluster.posts.map(p => p.id),
      };
    })
    .sort((a, b) => b.medianEngagement - a.medianEngagement);

  return results;
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

// Correlate hashtags with reach using lift vs baseline + shrinkage
export function correlateHashtagsWithReach(posts) {
  const hashtagReach = {};
  const allReachValues = [];

  posts.forEach(post => {
    if (!post.metrics) return;
    const reach = post.metrics.reach != null ? Number(post.metrics.reach) : null;
    if (reach === null || isNaN(reach)) return;

    allReachValues.push(reach);
    const hashtags = extractHashtags(post.finalVersion || post.final_version);
    hashtags.forEach(tag => {
      if (!hashtagReach[tag]) hashtagReach[tag] = [];
      hashtagReach[tag].push(reach);
    });
  });

  const baselineMedianReach = median(allReachValues);

  const correlations = Object.entries(hashtagReach)
    .filter(([_, values]) => values.length >= MIN_TAG_N)
    .map(([hashtag, values]) => {
      const medianReach = median(values);
      const reachLift = baselineMedianReach > 0
        ? (medianReach - baselineMedianReach) / baselineMedianReach
        : 0;
      const n = values.length;
      const shrinkageReachLift = (n / (n + SHRINKAGE_K)) * reachLift;

      return {
        hashtag,
        postCount: n,
        medianReach: Math.round(medianReach),
        baselineMedianReach: Math.round(baselineMedianReach),
        reachLift: parseFloat(reachLift.toFixed(4)),
        shrinkageReachLift: parseFloat(shrinkageReachLift.toFixed(4)),
      };
    })
    .sort((a, b) => b.shrinkageReachLift - a.shrinkageReachLift);

  return {
    bestPerforming: correlations.filter(c => c.shrinkageReachLift > 0).slice(0, 10),
    worstPerforming: correlations.filter(c => c.shrinkageReachLift < 0).slice(-10).reverse(),
    all: correlations,
    baselineMedianReach: Math.round(baselineMedianReach),
    minNRequired: MIN_TAG_N,
    totalWithMetrics: allReachValues.length,
  };
}

// Get dual rankings: engagement + reach, with star performers
export function getDualRankings(posts) {
  const engagementRanking = correlateHashtagsWithEngagement(posts);
  const reachRanking = correlateHashtagsWithReach(posts);

  const engagementMap = {};
  engagementRanking.all.forEach(item => { engagementMap[item.hashtag] = item; });
  const reachMap = {};
  reachRanking.all.forEach(item => { reachMap[item.hashtag] = item; });

  const allHashtagNames = new Set([
    ...engagementRanking.all.map(h => h.hashtag),
    ...reachRanking.all.map(h => h.hashtag),
  ]);

  const allHashtags = [...allHashtagNames].map(hashtag => ({
    hashtag,
    engagement: engagementMap[hashtag] || null,
    reach: reachMap[hashtag] || null,
  }));

  const topEngagement = new Set(
    engagementRanking.all
      .filter(h => h.meetsMinN && h.liftScore > 0)
      .slice(0, 10)
      .map(h => h.hashtag)
  );
  const topReach = new Set(
    reachRanking.all
      .filter(h => h.shrinkageReachLift > 0)
      .slice(0, 10)
      .map(h => h.hashtag)
  );

  const dualPerformers = [...topEngagement]
    .filter(tag => topReach.has(tag))
    .map(hashtag => ({
      hashtag,
      engagement: engagementMap[hashtag],
      reach: reachMap[hashtag],
    }));

  return { engagementRanking, reachRanking, dualPerformers, allHashtags };
}

// Analyze hashtag rotation and detect overuse patterns
// posts: sorted by published date, newest first
// postsWithMetrics: optional, posts with engagement data for underusedGems
export function analyzeHashtagRotation(posts, postsWithMetrics = []) {
  const postsWithTags = posts
    .map(post => ({
      ...post,
      hashtags: extractHashtags(post.finalVersion || post.final_version),
    }))
    .filter(p => p.hashtags.length > 0);

  if (postsWithTags.length === 0) {
    return { stalenessScores: [], currentStreak: 0, longestStreak: 0, warnings: [], underusedGems: [] };
  }

  const recentWindow = postsWithTags.slice(0, 10);
  const windowSize = recentWindow.length;

  const hashtagUsageCount = {};
  recentWindow.forEach(post => {
    post.hashtags.forEach(tag => {
      hashtagUsageCount[tag] = (hashtagUsageCount[tag] || 0) + 1;
    });
  });

  const stalenessScores = Object.entries(hashtagUsageCount)
    .map(([hashtag, usedInLast10]) => {
      const staleness = parseFloat((usedInLast10 / windowSize).toFixed(2));
      let status = 'healthy';
      if (staleness >= 0.7) status = 'overused';
      else if (staleness >= 0.4) status = 'moderate';
      return { hashtag, staleness, usedInLast10, status };
    })
    .sort((a, b) => b.staleness - a.staleness);

  // Detect consecutive similar set streaks
  let currentStreak = 1;
  for (let i = 0; i < postsWithTags.length - 1; i++) {
    const setA = new Set(postsWithTags[i].hashtags);
    const setB = new Set(postsWithTags[i + 1].hashtags);
    if (jaccardSimilarity(setA, setB) >= 0.7) {
      currentStreak++;
    } else {
      break;
    }
  }

  let longestStreak = 1;
  let tempStreak = 1;
  for (let i = 0; i < postsWithTags.length - 1; i++) {
    const setA = new Set(postsWithTags[i].hashtags);
    const setB = new Set(postsWithTags[i + 1].hashtags);
    if (jaccardSimilarity(setA, setB) >= 0.7) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 1;
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const warnings = [];
  if (currentStreak >= 3) {
    warnings.push({
      type: 'consecutive_reuse',
      message: `Last ${currentStreak} posts use very similar hashtag sets — try mixing it up`,
      severity: currentStreak >= 5 ? 'error' : 'warning',
    });
  }

  const overusedTags = stalenessScores.filter(s => s.status === 'overused');
  if (overusedTags.length > 0) {
    const threshold = Math.ceil(windowSize * 0.7);
    warnings.push({
      type: 'overused_tags',
      tags: overusedTags.map(t => t.hashtag),
      message: `${overusedTags.length} hashtag${overusedTags.length > 1 ? 's' : ''} used in ${threshold}+ of last ${windowSize} posts`,
      severity: 'warning',
    });
  }

  let underusedGems = [];
  if (postsWithMetrics.length > 0) {
    const correlations = correlateHashtagsWithEngagement(postsWithMetrics);
    const positiveLifters = correlations.all.filter(c => c.liftScore > 0);

    underusedGems = positiveLifters
      .filter(tag => {
        const staleness = hashtagUsageCount[tag.hashtag]
          ? hashtagUsageCount[tag.hashtag] / windowSize
          : 0;
        return staleness < 0.2;
      })
      .map(tag => {
        const lastUsedIndex = postsWithTags.findIndex(p => p.hashtags.includes(tag.hashtag));
        return {
          hashtag: tag.hashtag,
          staleness: hashtagUsageCount[tag.hashtag]
            ? parseFloat((hashtagUsageCount[tag.hashtag] / windowSize).toFixed(2))
            : 0,
          lastUsedPostsAgo: lastUsedIndex >= 0 ? lastUsedIndex + 1 : null,
          engagementLift: tag.liftScore,
        };
      })
      .sort((a, b) => b.engagementLift - a.engagementLift)
      .slice(0, 10);
  }

  return { stalenessScores, currentStreak, longestStreak, warnings, underusedGems };
}

// Generate recommended hashtag sets from available analysis data
export function generateRecommendedSets(posts, postsWithMetrics) {
  const sets = [];

  // Need at least some hashtags with metrics to generate useful sets
  const engagementData = postsWithMetrics.length > 0
    ? correlateHashtagsWithEngagement(postsWithMetrics)
    : null;
  const reachData = postsWithMetrics.length > 0
    ? correlateHashtagsWithReach(postsWithMetrics)
    : null;

  // All hashtags sorted by engagement lift
  const allByEngagement = engagementData?.all || [];
  // All hashtags sorted by reach lift
  const allByReach = reachData?.all || [];

  // Frequency data for freshness heuristic
  const frequency = countHashtagFrequency(posts);
  const totalPosts = posts.length;

  // If we have fewer than 5 hashtags with any metrics, not enough data
  if (allByEngagement.length < 5 && allByReach.length < 5) {
    return [];
  }

  // Helper: compute average lifts for a set of tags
  function computeSetMetadata(tags) {
    let engLiftSum = 0;
    let engLiftCount = 0;
    let reachLiftSum = 0;
    let reachLiftCount = 0;

    const engMap = Object.fromEntries(allByEngagement.map(t => [t.hashtag, t]));
    const reachMap = Object.fromEntries(allByReach.map(t => [t.hashtag, t]));

    tags.forEach(tag => {
      if (engMap[tag]) {
        engLiftSum += engMap[tag].liftScore;
        engLiftCount++;
      }
      if (reachMap[tag]) {
        reachLiftSum += reachMap[tag].liftScore;
        reachLiftCount++;
      }
    });

    return {
      engagementLiftAvg: engLiftCount > 0 ? parseFloat((engLiftSum / engLiftCount).toFixed(2)) : null,
      reachLiftAvg: reachLiftCount > 0 ? parseFloat((reachLiftSum / reachLiftCount).toFixed(2)) : null,
    };
  }

  // Helper: deduplicate and cap a tag list
  function pickTags(rankedTags, count = 20) {
    const seen = new Set();
    const result = [];
    for (const tag of rankedTags) {
      const name = typeof tag === 'string' ? tag : tag.hashtag;
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
      if (result.length >= count) break;
    }
    return result;
  }

  // Set 1: Top Performers (by engagement lift)
  if (allByEngagement.length >= 5) {
    const qualified = allByEngagement.filter(t => t.meetsMinN && t.liftScore > 0);
    const rest = allByEngagement.filter(t => !t.meetsMinN || t.liftScore <= 0);
    const ranked = [...qualified, ...rest.filter(t => t.liftScore > 0)];
    const tags = pickTags(ranked, 20);

    if (tags.length >= 5) {
      const meta = computeSetMetadata(tags);
      sets.push({
        name: 'Top Performers',
        description: 'Hashtags with the highest engagement lift score. These tags consistently appear on posts that outperform your baseline engagement rate.',
        tags,
        engagementLiftAvg: meta.engagementLiftAvg,
        reachLiftAvg: meta.reachLiftAvg,
      });
    }
  }

  // Set 2: Reach Maximizer (by reach lift)
  if (allByReach.length >= 5) {
    const qualified = allByReach.filter(t => t.meetsMinN && t.liftScore > 0);
    const rest = allByReach.filter(t => !t.meetsMinN || t.liftScore <= 0);
    const ranked = [...qualified, ...rest.filter(t => t.liftScore > 0)];
    const tags = pickTags(ranked, 20);

    if (tags.length >= 5) {
      const meta = computeSetMetadata(tags);
      sets.push({
        name: 'Reach Maximizer',
        description: 'Hashtags associated with the highest reach. Use this set when your goal is maximum visibility and discovery.',
        tags,
        engagementLiftAvg: meta.engagementLiftAvg,
        reachLiftAvg: meta.reachLiftAvg,
      });
    }
  }

  // Set 3: Fresh Mix (underused tags + good performers with low frequency)
  if (allByEngagement.length >= 5) {
    const tagUsage = allByEngagement.map(t => {
      const freq = frequency[t.hashtag]?.count || 0;
      const usageRate = totalPosts > 0 ? freq / totalPosts : 0;
      return { ...t, usageRate, freq };
    });

    const fresh = tagUsage
      .filter(t => t.usageRate < 0.3 && t.liftScore >= 0)
      .sort((a, b) => b.liftScore - a.liftScore);

    const rare = tagUsage
      .filter(t => t.usageRate < 0.15)
      .sort((a, b) => b.liftScore - a.liftScore);

    const candidates = [...fresh, ...rare];
    const tags = pickTags(candidates, 20);

    if (tags.length >= 5) {
      const meta = computeSetMetadata(tags);
      sets.push({
        name: 'Fresh Mix',
        description: 'Underused hashtags with solid performance. Rotate these in to avoid algorithm staleness and reach new audiences.',
        tags,
        engagementLiftAvg: meta.engagementLiftAvg,
        reachLiftAvg: meta.reachLiftAvg,
      });
    }
  }

  // Set 4: Balanced (40% engagement, 30% reach, 30% fresh)
  if (allByEngagement.length >= 5) {
    const engTags = allByEngagement.filter(t => t.liftScore > 0).map(t => t.hashtag);
    const reachTags = allByReach.filter(t => t.liftScore > 0).map(t => t.hashtag);
    const freshTags = allByEngagement
      .filter(t => {
        const freq = frequency[t.hashtag]?.count || 0;
        return totalPosts > 0 && (freq / totalPosts) < 0.3 && t.liftScore >= 0;
      })
      .map(t => t.hashtag);

    const targetSize = 20;
    const engCount = Math.round(targetSize * 0.4);
    const reachCount = Math.round(targetSize * 0.3);

    const seen = new Set();
    const balanced = [];

    for (const tag of engTags) {
      if (balanced.length >= engCount) break;
      if (!seen.has(tag)) { seen.add(tag); balanced.push(tag); }
    }
    for (const tag of reachTags) {
      if (balanced.length >= engCount + reachCount) break;
      if (!seen.has(tag)) { seen.add(tag); balanced.push(tag); }
    }
    for (const tag of freshTags) {
      if (balanced.length >= targetSize) break;
      if (!seen.has(tag)) { seen.add(tag); balanced.push(tag); }
    }
    for (const tag of engTags) {
      if (balanced.length >= targetSize) break;
      if (!seen.has(tag)) { seen.add(tag); balanced.push(tag); }
    }

    if (balanced.length >= 5) {
      const meta = computeSetMetadata(balanced);
      sets.push({
        name: 'Balanced',
        description: 'A blend of top engagement (40%), top reach (30%), and fresh/underused (30%) hashtags. A well-rounded default choice.',
        tags: balanced,
        engagementLiftAvg: meta.engagementLiftAvg,
        reachLiftAvg: meta.reachLiftAvg,
      });
    }
  }

  // Set 5: Best Cluster — find which group of co-occurring tags performs best
  if (postsWithMetrics.length >= 3) {
    const postTagSets = postsWithMetrics
      .filter(p => p.metrics?.engagementRate != null)
      .map(p => ({
        tags: extractHashtags(p.finalVersion || p.final_version),
        engagement: parseFloat(p.metrics.engagementRate),
      }))
      .filter(p => p.tags.length >= 3);

    if (postTagSets.length >= 2) {
      const clusters = [];
      const assigned = new Set();

      for (let i = 0; i < postTagSets.length; i++) {
        if (assigned.has(i)) continue;
        const cluster = { posts: [i], allTags: new Set(postTagSets[i].tags) };
        assigned.add(i);

        for (let j = i + 1; j < postTagSets.length; j++) {
          if (assigned.has(j)) continue;
          const overlap = postTagSets[j].tags.filter(t => cluster.allTags.has(t)).length;
          const similarity = overlap / Math.min(postTagSets[i].tags.length, postTagSets[j].tags.length);
          if (similarity >= 0.5) {
            cluster.posts.push(j);
            postTagSets[j].tags.forEach(t => cluster.allTags.add(t));
            assigned.add(j);
          }
        }
        clusters.push(cluster);
      }

      const scoredClusters = clusters
        .filter(c => c.posts.length >= 2)
        .map(c => {
          const avgEng = c.posts.reduce((sum, idx) => sum + postTagSets[idx].engagement, 0) / c.posts.length;
          return { ...c, avgEngagement: avgEng, tagCount: c.allTags.size };
        })
        .sort((a, b) => b.avgEngagement - a.avgEngagement);

      if (scoredClusters.length > 0) {
        const best = scoredClusters[0];
        let clusterTags = [...best.allTags];

        if (clusterTags.length < 15) {
          const topEngTags = allByEngagement
            .filter(t => t.liftScore > 0)
            .map(t => t.hashtag);
          for (const tag of topEngTags) {
            if (clusterTags.length >= 20) break;
            if (!clusterTags.includes(tag)) clusterTags.push(tag);
          }
        }

        clusterTags = clusterTags.slice(0, 25);

        if (clusterTags.length >= 5) {
          const meta = computeSetMetadata(clusterTags);
          sets.push({
            name: 'Best Cluster',
            description: `Based on your top-performing group of ${best.posts.length} posts that share similar hashtags (avg ${best.avgEngagement.toFixed(1)}% ER). Padded with top individual performers.`,
            tags: clusterTags,
            engagementLiftAvg: meta.engagementLiftAvg,
            reachLiftAvg: meta.reachLiftAvg,
          });
        }
      }
    }
  }

  return sets;
}
