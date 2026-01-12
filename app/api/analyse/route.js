import { getSupabaseClient } from '@/lib/supabase';

// Common phrases that indicate marketing-speak to avoid
const MARKETING_PHRASES = [
  'absolute beaut',
  'this is what dreams are made of',
  'game changer',
  'to die for',
  'incredible',
  'amazing',
  'mind-blowing',
  'out of this world',
  'next level',
  'insane',
  'unreal',
  'obsessed',
  'you won\'t believe',
  'literally the best',
];

// Emojis that tend to feel salesy
const SALESY_EMOJIS = ['🤩', '🔥', '💯', '🚀', '😍', '🙌', '💪'];

// Good British expressions
const BRITISH_EXPRESSIONS = [
  'proper',
  'brilliant',
  'lovely',
  'bang on',
  'flipping',
  'moreish',
  'cracking',
  'cheeky',
  'smashed it',
  'bad boys',
  'cracker',
  'belter',
  'hoovered',
];

function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function findPhrases(text, phrases) {
  const lower = text.toLowerCase();
  return phrases.filter(phrase => lower.includes(phrase));
}

function countOccurrences(texts, searchFn) {
  const counts = {};
  texts.forEach(text => {
    const found = searchFn(text);
    found.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
  });
  return counts;
}

function extractCapitalizedWords(text) {
  // Find words that are ALL CAPS (2+ letters)
  const matches = text.match(/\b[A-Z]{2,}\b/g) || [];
  return matches.filter(word => !['I', 'OK', 'UK', 'US', 'TV', 'PR', 'Q3', 'Q4'].includes(word));
}

function extractEmojis(text) {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  return text.match(emojiRegex) || [];
}

function extractAllEmojis(text) {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  return text.match(emojiRegex) || [];
}

function analyseTimeTrends(posts) {
  const byWeek = {};
  const editsByWeek = {};
  
  posts.forEach(post => {
    const date = new Date(post.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;
    editsByWeek[weekKey] = (editsByWeek[weekKey] || []).concat(post.edit_count);
  });
  
  const weeks = Object.keys(byWeek).sort();
  return weeks.map(week => ({
    week,
    posts: byWeek[week],
    avgEdits: editsByWeek[week].reduce((a, b) => a + b, 0) / editsByWeek[week].length
  }));
}

function calculateVoiceScore(analysis) {
  let score = 100;
  const factors = [];
  
  // Penalize remaining marketing phrases (each costs 5 points)
  const marketingPenalty = Math.min(30, analysis.marketingPhrasesRemaining * 5);
  score -= marketingPenalty;
  if (marketingPenalty > 0) factors.push({ name: 'Marketing phrases', impact: -marketingPenalty });
  
  // Penalize salesy emojis (each costs 3 points)
  const emojiPenalty = Math.min(15, analysis.salesyEmojisRemaining * 3);
  score -= emojiPenalty;
  if (emojiPenalty > 0) factors.push({ name: 'Salesy emojis', impact: -emojiPenalty });
  
  // Reward British expressions (each adds 3 points, max 15)
  const britishBonus = Math.min(15, analysis.britishExpressionsCount * 3);
  score += britishBonus;
  if (britishBonus > 0) factors.push({ name: 'British expressions', impact: +britishBonus });
  
  // Penalize excessive caps (more than 3 avg costs points)
  if (analysis.avgFinalCaps > 3) {
    const capsPenalty = Math.min(10, (analysis.avgFinalCaps - 3) * 2);
    score -= capsPenalty;
    factors.push({ name: 'Excessive caps', impact: -capsPenalty });
  }
  
  return { score: Math.max(0, Math.min(100, Math.round(score))), factors };
}

function analyseImprovementTrend(posts) {
  if (posts.length < 4) return null;
  
  const sorted = [...posts].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const midpoint = Math.floor(sorted.length / 2);
  
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((sum, p) => sum + p.edit_count, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.edit_count, 0) / secondHalf.length;
  
  const improvement = ((firstAvg - secondAvg) / firstAvg) * 100;
  
  return {
    firstHalfAvg: firstAvg.toFixed(1),
    secondHalfAvg: secondAvg.toFixed(1),
    improvement: improvement.toFixed(1),
    improving: secondAvg < firstAvg
  };
}

function analyseTopics(posts) {
  const topicStats = {};
  
  posts.forEach(post => {
    const topic = post.topic || 'Untitled';
    if (!topicStats[topic]) {
      topicStats[topic] = { count: 0, totalEdits: 0, edits: [] };
    }
    topicStats[topic].count++;
    topicStats[topic].totalEdits += post.edit_count;
    topicStats[topic].edits.push(post.edit_count);
  });
  
  return Object.entries(topicStats)
    .map(([topic, stats]) => ({
      topic,
      count: stats.count,
      avgEdits: (stats.totalEdits / stats.count).toFixed(1),
      minEdits: Math.min(...stats.edits),
      maxEdits: Math.max(...stats.edits)
    }))
    .sort((a, b) => b.count - a.count);
}

function analyseLengthChanges(posts) {
  let totalAiChars = 0, totalFinalChars = 0;
  let totalAiWords = 0, totalFinalWords = 0;
  
  posts.forEach(post => {
    totalAiChars += post.ai_version.length;
    totalFinalChars += post.final_version.length;
    totalAiWords += post.ai_version.split(/\s+/).filter(Boolean).length;
    totalFinalWords += post.final_version.split(/\s+/).filter(Boolean).length;
  });
  
  const avgAiChars = totalAiChars / posts.length;
  const avgFinalChars = totalFinalChars / posts.length;
  const avgAiWords = totalAiWords / posts.length;
  const avgFinalWords = totalFinalWords / posts.length;
  
  return {
    avgAiChars: Math.round(avgAiChars),
    avgFinalChars: Math.round(avgFinalChars),
    charChange: Math.round(avgFinalChars - avgAiChars),
    charChangePercent: (((avgFinalChars - avgAiChars) / avgAiChars) * 100).toFixed(1),
    avgAiWords: Math.round(avgAiWords),
    avgFinalWords: Math.round(avgFinalWords),
    wordChange: Math.round(avgFinalWords - avgAiWords),
    wordChangePercent: (((avgFinalWords - avgAiWords) / avgAiWords) * 100).toFixed(1)
  };
}

function analyseFullEmojis(aiVersions, finalVersions) {
  const aiEmojis = {};
  const finalEmojis = {};
  
  aiVersions.forEach(text => {
    extractAllEmojis(text).forEach(emoji => {
      aiEmojis[emoji] = (aiEmojis[emoji] || 0) + 1;
    });
  });
  
  finalVersions.forEach(text => {
    extractAllEmojis(text).forEach(emoji => {
      finalEmojis[emoji] = (finalEmojis[emoji] || 0) + 1;
    });
  });
  
  const added = Object.entries(finalEmojis)
    .filter(([emoji, count]) => count > (aiEmojis[emoji] || 0))
    .map(([emoji, count]) => [emoji, count - (aiEmojis[emoji] || 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const removed = Object.entries(aiEmojis)
    .filter(([emoji, count]) => count > (finalEmojis[emoji] || 0))
    .map(([emoji, count]) => [emoji, count - (finalEmojis[emoji] || 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const totalAi = Object.values(aiEmojis).reduce((a, b) => a + b, 0);
  const totalFinal = Object.values(finalEmojis).reduce((a, b) => a + b, 0);
  
  return {
    added,
    removed,
    avgAiEmojis: (totalAi / aiVersions.length).toFixed(1),
    avgFinalEmojis: (totalFinal / finalVersions.length).toFixed(1),
    mostUsedFinal: Object.entries(finalEmojis).sort((a, b) => b[1] - a[1]).slice(0, 8)
  };
}

function analyseLineChanges(aiVersion, finalVersion) {
  const aiLines = aiVersion.trim().split('\n').filter(Boolean);
  const finalLines = finalVersion.trim().split('\n').filter(Boolean);
  
  const aiSet = new Set(aiLines.map(l => l.trim().toLowerCase()));
  const finalSet = new Set(finalLines.map(l => l.trim().toLowerCase()));
  
  const removed = aiLines.filter(l => !finalSet.has(l.trim().toLowerCase()));
  const added = finalLines.filter(l => !aiSet.has(l.trim().toLowerCase()));
  
  return { removed, added };
}

function findCommonPatterns(items, minCount = 2) {
  const counts = {};
  items.forEach(item => {
    const key = item.trim().toLowerCase();
    if (key.length > 3) {
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  
  return Object.entries(counts)
    .filter(([_, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

function analyseWordFrequency(aiTexts, finalTexts) {
  const aiWords = {};
  const finalWords = {};
  
  aiTexts.forEach(text => {
    tokenize(text).forEach(word => {
      if (word.length > 3) aiWords[word] = (aiWords[word] || 0) + 1;
    });
  });
  
  finalTexts.forEach(text => {
    tokenize(text).forEach(word => {
      if (word.length > 3) finalWords[word] = (finalWords[word] || 0) + 1;
    });
  });
  
  // Words you add (in final but rarely in AI)
  const addedWords = Object.entries(finalWords)
    .filter(([word, count]) => count >= 2 && (!aiWords[word] || finalWords[word] > aiWords[word] * 1.5))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  // Words you remove (in AI but rarely in final)
  const removedWords = Object.entries(aiWords)
    .filter(([word, count]) => count >= 2 && (!finalWords[word] || aiWords[word] > finalWords[word] * 1.5))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  return { addedWords, removedWords };
}

function generateSuggestions(analysis) {
  const suggestions = [];
  
  // Marketing phrases to avoid
  if (analysis.marketingPhrasesRemoved.length > 0) {
    suggestions.push({
      type: 'avoid',
      title: 'Add to "Avoid" list',
      items: analysis.marketingPhrasesRemoved.map(([phrase, count]) => ({
        text: phrase,
        count,
        reason: `Removed ${count} time${count > 1 ? 's' : ''}`
      }))
    });
  }
  
  // Salesy emojis
  if (analysis.salesyEmojisRemoved.length > 0) {
    suggestions.push({
      type: 'emoji',
      title: 'Emojis to avoid',
      items: analysis.salesyEmojisRemoved.map(([emoji, count]) => ({
        text: emoji,
        count,
        reason: `Removed ${count} time${count > 1 ? 's' : ''}`
      }))
    });
  }
  
  // British expressions to encourage
  if (analysis.britishExpressionsAdded.length > 0) {
    suggestions.push({
      type: 'encourage',
      title: 'British expressions to use more',
      items: analysis.britishExpressionsAdded.map(([phrase, count]) => ({
        text: phrase,
        count,
        reason: `Added ${count} time${count > 1 ? 's' : ''}`
      }))
    });
  }
  
  // Over-capitalization
  if (analysis.capsReduction > 0) {
    suggestions.push({
      type: 'formatting',
      title: 'Reduce capitalization',
      items: [{
        text: `Average CAPS per post reduced from ${analysis.avgAiCaps.toFixed(1)} to ${analysis.avgFinalCaps.toFixed(1)}`,
        reason: 'Consider stricter caps guidelines'
      }]
    });
  }
  
  // Common line additions
  if (analysis.commonAdditions.length > 0) {
    suggestions.push({
      type: 'structure',
      title: 'Patterns you commonly add',
      items: analysis.commonAdditions.slice(0, 5).map(([pattern, count]) => ({
        text: pattern.substring(0, 80) + (pattern.length > 80 ? '...' : ''),
        count,
        reason: `Added similar content ${count} time${count > 1 ? 's' : ''}`
      }))
    });
  }
  
  return suggestions;
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return Response.json({
        totalPosts: 0,
        message: 'No posts to analyse yet. Log some posts first!',
        analysis: null,
        suggestions: []
      });
    }

    const posts = data;
    const aiVersions = posts.map(p => p.ai_version);
    const finalVersions = posts.map(p => p.final_version);
    
    // Analyse marketing phrases removed
    const aiMarketingPhrases = countOccurrences(aiVersions, text => findPhrases(text, MARKETING_PHRASES));
    const finalMarketingPhrases = countOccurrences(finalVersions, text => findPhrases(text, MARKETING_PHRASES));
    const marketingPhrasesRemoved = Object.entries(aiMarketingPhrases)
      .filter(([phrase, count]) => count > (finalMarketingPhrases[phrase] || 0))
      .map(([phrase, count]) => [phrase, count - (finalMarketingPhrases[phrase] || 0)])
      .sort((a, b) => b[1] - a[1]);
    
    // Analyse salesy emojis removed
    const aiEmojis = countOccurrences(aiVersions, text => extractEmojis(text).filter(e => SALESY_EMOJIS.includes(e)));
    const finalEmojis = countOccurrences(finalVersions, text => extractEmojis(text).filter(e => SALESY_EMOJIS.includes(e)));
    const salesyEmojisRemoved = Object.entries(aiEmojis)
      .filter(([emoji, count]) => count > (finalEmojis[emoji] || 0))
      .map(([emoji, count]) => [emoji, count - (finalEmojis[emoji] || 0)])
      .sort((a, b) => b[1] - a[1]);
    
    // Analyse British expressions added
    const aiBritish = countOccurrences(aiVersions, text => findPhrases(text, BRITISH_EXPRESSIONS));
    const finalBritish = countOccurrences(finalVersions, text => findPhrases(text, BRITISH_EXPRESSIONS));
    const britishExpressionsAdded = Object.entries(finalBritish)
      .filter(([phrase, count]) => count > (aiBritish[phrase] || 0))
      .map(([phrase, count]) => [phrase, count - (aiBritish[phrase] || 0)])
      .sort((a, b) => b[1] - a[1]);
    
    // Analyse capitalization
    const aiCapsPerPost = aiVersions.map(text => extractCapitalizedWords(text).length);
    const finalCapsPerPost = finalVersions.map(text => extractCapitalizedWords(text).length);
    const avgAiCaps = aiCapsPerPost.reduce((a, b) => a + b, 0) / aiCapsPerPost.length;
    const avgFinalCaps = finalCapsPerPost.reduce((a, b) => a + b, 0) / finalCapsPerPost.length;
    const capsReduction = avgAiCaps - avgFinalCaps;
    
    // Analyse line-level changes
    let allRemoved = [];
    let allAdded = [];
    posts.forEach(post => {
      const { removed, added } = analyseLineChanges(post.ai_version, post.final_version);
      allRemoved = allRemoved.concat(removed);
      allAdded = allAdded.concat(added);
    });
    
    const commonRemovals = findCommonPatterns(allRemoved);
    const commonAdditions = findCommonPatterns(allAdded);
    
    // Word frequency analysis
    const { addedWords, removedWords } = analyseWordFrequency(aiVersions, finalVersions);
    
    // Calculate average edit count
    const avgEditCount = posts.reduce((sum, p) => sum + p.edit_count, 0) / posts.length;
    
    // Tommo mentions analysis
    const aiTommoMentions = aiVersions.filter(t => t.toLowerCase().includes('tommo')).length;
    const finalTommoMentions = finalVersions.filter(t => t.toLowerCase().includes('tommo')).length;
    
    // New analytics
    const timeTrends = analyseTimeTrends(posts);
    const improvementTrend = analyseImprovementTrend(posts);
    const topicAnalysis = analyseTopics(posts);
    const lengthChanges = analyseLengthChanges(posts);
    const emojiAnalysis = analyseFullEmojis(aiVersions, finalVersions);
    
    // Count remaining issues for voice score
    const marketingPhrasesRemaining = Object.values(countOccurrences(finalVersions, text => findPhrases(text, MARKETING_PHRASES)))
      .reduce((a, b) => a + b, 0);
    const salesyEmojisRemaining = Object.values(countOccurrences(finalVersions, text => extractEmojis(text).filter(e => SALESY_EMOJIS.includes(e))))
      .reduce((a, b) => a + b, 0);
    const britishExpressionsCount = britishExpressionsAdded.reduce((sum, [_, count]) => sum + count, 0);
    
    const analysisForScore = {
      marketingPhrasesRemaining,
      salesyEmojisRemaining,
      britishExpressionsCount,
      avgFinalCaps
    };
    const voiceScore = calculateVoiceScore(analysisForScore);
    
    const analysis = {
      totalPosts: posts.length,
      avgEditCount: avgEditCount.toFixed(1),
      marketingPhrasesRemoved,
      salesyEmojisRemoved,
      britishExpressionsAdded,
      avgAiCaps,
      avgFinalCaps,
      capsReduction,
      commonRemovals,
      commonAdditions,
      addedWords,
      removedWords,
      tommoMentions: {
        ai: aiTommoMentions,
        final: finalTommoMentions,
        increased: finalTommoMentions > aiTommoMentions
      },
      // New analytics
      timeTrends,
      voiceScore,
      improvementTrend,
      topicAnalysis,
      lengthChanges,
      emojiAnalysis
    };
    
    const suggestions = generateSuggestions(analysis);

    return Response.json({
      totalPosts: posts.length,
      analysis,
      suggestions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analysis API error:', error);
    return Response.json(
      { error: error.message || 'Failed to analyse posts' },
      { status: 500 }
    );
  }
}
