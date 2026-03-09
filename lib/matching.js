// Text matching algorithm for comparing logged post captions against Instagram post captions.
// Uses word-level Jaccard similarity with stopword removal and topic anchoring.

// Regex covering common emoji Unicode ranges
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

const HASHTAG_REGEX = /#\w[\w.]*/g;
const MENTION_REGEX = /@\w[\w.]*/g;
const WHITESPACE_REGEX = /\s+/g;
const NON_ALPHA_REGEX = /[^a-z0-9\s]/g;

// Stopwords: common English words that carry no matching signal.
// Deliberately extensive — the whole point is to isolate distinctive content words.
const STOPWORDS = new Set([
  // Articles, pronouns, prepositions, conjunctions
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'our', 'us', 'you', 'your',
  'he', 'she', 'it', 'they', 'them', 'his', 'her', 'its', 'their',
  'this', 'that', 'these', 'those', 'who', 'which', 'what', 'where', 'when',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'but', 'and', 'or', 'if', 'while', 'as',
  'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'to', 'up',
  'with', 'about', 'against', 'between', 'through', 'during', 'before',
  'after', 'above', 'below', 'out', 'off', 'over', 'under', 'again',
  'then', 'once', 'here', 'there', 'why', 'any', 'also',
  // Common verbs
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'go', 'goes', 'went', 'gone', 'going', 'get', 'gets', 'got', 'getting',
  'make', 'makes', 'made', 'making', 'come', 'comes', 'came', 'coming',
  'take', 'takes', 'took', 'taking', 'know', 'knows', 'knew', 'knowing',
  'think', 'thinks', 'thought', 'see', 'sees', 'saw', 'seen', 'seeing',
  'want', 'wants', 'wanted', 'give', 'gives', 'gave', 'given',
  'say', 'says', 'said', 'tell', 'tells', 'told', 'find', 'found',
  'put', 'keep', 'keeps', 'kept', 'let', 'lets', 'look', 'looks', 'looked',
  'need', 'needs', 'needed', 'feel', 'feels', 'felt', 'try', 'tried',
  'leave', 'left', 'call', 'called', 'like', 'liked',
  // Common Instagram/social filler
  'tommo', 'swipe', 'left', 'right', 'sound', 'link', 'bio', 'save',
  'share', 'hit', 'tap', 'follow', 'post', 'reel', 'story', 'photo',
  'video', 'pic', 'check', 'comment', 'tag', 'dm',
  // Common adverbs and adjectives
  'really', 'absolutely', 'honestly', 'definitely', 'actually', 'literally',
  'totally', 'completely', 'quite', 'much', 'well', 'still', 'already',
  'even', 'back', 'now', 'never', 'always', 'ever', 'down',
  'around', 'away', 'long', 'little', 'big', 'new', 'old', 'good',
  'great', 'best', 'first', 'last', 'next', 'whole', 'lovely',
  // Common filler words in captions
  'one', 'two', 'time', 'day', 'thing', 'things', 'way', 'year',
  'people', 'place', 'bit', 'lot', 'couple', 'kind',
  'cant', 'dont', 'didnt', 'isnt', 'wasnt', 'wont', 'wouldnt',
  'ive', 'youve', 'weve', 'theyve', 'youre', 'were', 'theyre',
  'its', 'thats', 'whats', 'heres', 'theres',
]);

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
    .toLowerCase()
    .replace(NON_ALPHA_REGEX, ' ')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
}

/**
 * Extract distinctive content words from normalized text.
 * Removes stopwords and very short words (1-2 chars).
 */
function getContentWords(normalizedText) {
  if (!normalizedText) return new Set();

  const words = normalizedText.split(' ');
  const content = new Set();

  for (const word of words) {
    if (word.length >= 3 && !STOPWORDS.has(word)) {
      content.add(word);
    }
  }

  return content;
}

/**
 * Calculate word-level Jaccard similarity between two sets of content words.
 * Returns 0-1 where 1 means identical word sets.
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

/**
 * Check how many topic words appear in the IG caption content words.
 * Returns a ratio 0-1 of topic words found.
 */
function topicOverlap(topicText, contentWords) {
  if (!topicText) return 0;

  const topicWords = topicText
    .toLowerCase()
    .replace(NON_ALPHA_REGEX, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));

  if (topicWords.length === 0) return 0;

  let found = 0;
  for (const tw of topicWords) {
    // Check if any content word contains or matches the topic word
    for (const cw of contentWords) {
      if (cw === tw || cw.includes(tw) || tw.includes(cw)) {
        found++;
        break;
      }
    }
  }

  return found / topicWords.length;
}

/**
 * Calculate text similarity between two raw caption strings using
 * word-level Jaccard similarity on content words (stopwords removed).
 * Returns 0-1 where 1 means identical content word sets.
 */
export function calculateTextSimilarity(a, b) {
  const normA = normalizeCaption(a);
  const normB = normalizeCaption(b);

  if (normA === normB) return normA.length > 0 ? 1 : 0;
  if (!normA || !normB) return 0;

  const wordsA = getContentWords(normA);
  const wordsB = getContentWords(normB);

  return jaccardSimilarity(wordsA, wordsB);
}

/**
 * Determine match tier from a score.
 */
function getTier(score) {
  if (score >= 0.55) return 'auto_link';
  if (score >= 0.40) return 'suggested';
  return 'no_match';
}

/**
 * Score a logged post against an Instagram post.
 *
 * Uses word-level Jaccard similarity as the base, with topic anchoring
 * as a hard gate — if topic words don't appear in the IG caption,
 * the score is heavily penalized.
 */
export function scoreMatch(loggedPost, igPost) {
  const normA = normalizeCaption(loggedPost.final_version);
  const normB = normalizeCaption(igPost.caption);

  if (!normA || !normB) return { score: 0, textSimilarity: 0, tier: 'no_match' };

  const wordsA = getContentWords(normA);
  const wordsB = getContentWords(normB);

  const textSimilarity = jaccardSimilarity(wordsA, wordsB);

  let score = textSimilarity;

  // Topic anchoring: check if the logged post's topic words appear in the IG caption.
  // This is the strongest signal — if someone logs a post about "Guest Stalybridge",
  // the matching IG post MUST mention those words.
  if (loggedPost.topic) {
    const topicMatch = topicOverlap(loggedPost.topic, wordsB);

    if (topicMatch >= 0.5) {
      // Topic words found — boost confidence
      score += 0.15 * topicMatch;
    } else {
      // Topic words missing — heavy penalty, this is almost certainly wrong
      score *= 0.3;
    }
  }

  // Timestamp proximity boost: up to 0.05, linearly decreasing over 14 days
  if ((loggedPost.published_at || loggedPost.created_at) && igPost.timestamp) {
    const loggedDate = new Date(loggedPost.published_at || loggedPost.created_at);
    const igDate = new Date(igPost.timestamp);
    const daysDiff = Math.abs(igDate - loggedDate) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 14) {
      score += 0.05 * (1 - daysDiff / 14);
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
 * Only logged posts without an existing instagram_media_id are considered.
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
