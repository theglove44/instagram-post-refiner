// Text matching algorithm for comparing logged post captions against Instagram post captions.
// Uses bigram-based Dice coefficient for robust fuzzy matching, with timestamp and topic boosts.

// Regex covering common emoji Unicode ranges
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

const HASHTAG_REGEX = /#\w[\w.]*/g;
const MENTION_REGEX = /@\w[\w.]*/g;
const WHITESPACE_REGEX = /\s+/g;

/**
 * Normalize caption text for comparison by stripping hashtags, mentions,
 * emoji, and collapsing whitespace.
 */
export function normalizeCaption(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(HASHTAG_REGEX, '')
    .replace(MENTION_REGEX, '')
    .replace(EMOJI_REGEX, '')
    .replace(WHITESPACE_REGEX, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extract character bigrams from a string.
 * Returns a Map of bigram -> count for multiset comparison.
 */
function getBigrams(str) {
  const bigrams = new Map();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  return bigrams;
}

/**
 * Calculate text similarity between two raw caption strings using
 * the Dice coefficient on character bigrams.
 * Returns 0-1 where 1 means identical normalized text.
 */
export function calculateTextSimilarity(a, b) {
  const normA = normalizeCaption(a);
  const normB = normalizeCaption(b);

  if (normA === normB) return normA.length > 0 ? 1 : 0;
  if (!normA || !normB) return 0;

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  // Count shared bigrams (using minimum count for duplicates)
  let intersection = 0;
  for (const [bigram, countA] of bigramsA) {
    const countB = bigramsB.get(bigram) || 0;
    intersection += Math.min(countA, countB);
  }

  const totalA = normA.length - 1;
  const totalB = normB.length - 1;

  if (totalA + totalB === 0) return 0;

  // Dice coefficient: 2 * |intersection| / (|A| + |B|)
  return (2 * intersection) / (totalA + totalB);
}

/**
 * Determine match tier from a score.
 */
function getTier(score) {
  if (score >= 0.85) return 'auto_link';
  if (score >= 0.60) return 'suggested';
  return 'no_match';
}

/**
 * Score a logged post against an Instagram post.
 *
 * Combines text similarity with optional boosts for timestamp proximity
 * and topic mention in the caption.
 */
export function scoreMatch(loggedPost, igPost) {
  const textSimilarity = calculateTextSimilarity(
    loggedPost.final_version,
    igPost.caption
  );

  let score = textSimilarity;

  // Timestamp proximity boost: up to 0.05, linearly decreasing over 14 days
  if (loggedPost.created_at && igPost.timestamp) {
    const loggedDate = new Date(loggedPost.created_at);
    const igDate = new Date(igPost.timestamp);
    const daysDiff = Math.abs(igDate - loggedDate) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 14) {
      score += 0.05 * (1 - daysDiff / 14);
    }
  }

  // Topic mention boost: 0.03 if logged topic appears in IG caption
  if (loggedPost.topic && igPost.caption) {
    const topicLower = loggedPost.topic.toLowerCase();
    const captionLower = igPost.caption.toLowerCase();
    if (captionLower.includes(topicLower)) {
      score += 0.03;
    }
  }

  score = Math.min(score, 1.0);

  return {
    score,
    textSimilarity,
    tier: getTier(score),
  };
}

/**
 * Rank all Instagram post candidates against a single logged post.
 * Returns only matches at 'suggested' tier or above, sorted by score descending.
 */
export function rankCandidates(loggedPost, igPosts) {
  const scored = igPosts
    .map((igPost) => {
      const { score, textSimilarity, tier } = scoreMatch(loggedPost, igPost);
      return { igPost, score, textSimilarity, tier };
    })
    .filter((result) => result.tier !== 'no_match')
    .sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Find best matches between logged posts and Instagram posts.
 *
 * Uses greedy assignment: processes highest-confidence matches first
 * to prevent duplicate IG post assignments.
 *
 * Only logged posts without an existing instagram_post_id are considered.
 * Returns matches with score >= 0.60.
 */
export function findBestMatches(loggedPosts, igPosts) {
  // Build all candidate pairs with scores
  const allCandidates = [];

  for (const loggedPost of loggedPosts) {
    // Skip already-linked posts
    if (loggedPost.instagram_media_id) continue;

    for (const igPost of igPosts) {
      const { score, textSimilarity, tier } = scoreMatch(loggedPost, igPost);
      if (tier !== 'no_match') {
        allCandidates.push({ loggedPost, igPost, score, textSimilarity, tier });
      }
    }
  }

  // Sort by score descending for greedy assignment
  allCandidates.sort((a, b) => b.score - a.score);

  const usedIgIds = new Set();
  const usedLoggedIds = new Set();
  const matches = [];

  for (const candidate of allCandidates) {
    const igId = candidate.igPost.id;
    const loggedId = candidate.loggedPost.id;

    if (usedIgIds.has(igId) || usedLoggedIds.has(loggedId)) continue;

    usedIgIds.add(igId);
    usedLoggedIds.add(loggedId);
    matches.push({
      loggedPost: candidate.loggedPost,
      igPost: candidate.igPost,
      score: candidate.score,
      tier: candidate.tier,
    });
  }

  return matches;
}
