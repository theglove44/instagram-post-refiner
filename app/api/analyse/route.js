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

// New analysis functions for SKILL.md enhancements

function analyseStructuralPatterns(posts) {
  let totalAiParagraphs = 0, totalFinalParagraphs = 0;
  let totalAiLineBreaks = 0, totalFinalLineBreaks = 0;
  let totalAiHashtags = 0, totalFinalHashtags = 0;
  let aiStartsWithEmoji = 0, finalStartsWithEmoji = 0;
  let aiEndsWithEmoji = 0, finalEndsWithEmoji = 0;
  
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  const hashtagRegex = /#\w+/g;
  
  posts.forEach(post => {
    const aiText = post.ai_version;
    const finalText = post.final_version;
    
    // Paragraph count (split by double newlines or significant breaks)
    const aiParas = aiText.split(/\n\s*\n/).filter(Boolean).length;
    const finalParas = finalText.split(/\n\s*\n/).filter(Boolean).length;
    totalAiParagraphs += aiParas;
    totalFinalParagraphs += finalParas;
    
    // Line breaks
    totalAiLineBreaks += (aiText.match(/\n/g) || []).length;
    totalFinalLineBreaks += (finalText.match(/\n/g) || []).length;
    
    // Hashtags
    totalAiHashtags += (aiText.match(hashtagRegex) || []).length;
    totalFinalHashtags += (finalText.match(hashtagRegex) || []).length;
    
    // Emoji at start/end
    const aiFirstChar = aiText.trim().substring(0, 2);
    const finalFirstChar = finalText.trim().substring(0, 2);
    const aiLastChars = aiText.trim().slice(-4);
    const finalLastChars = finalText.trim().slice(-4);
    
    if (emojiRegex.test(aiFirstChar)) aiStartsWithEmoji++;
    if (emojiRegex.test(finalFirstChar)) finalStartsWithEmoji++;
    emojiRegex.lastIndex = 0;
    if (emojiRegex.test(aiLastChars)) aiEndsWithEmoji++;
    emojiRegex.lastIndex = 0;
    if (emojiRegex.test(finalLastChars)) finalEndsWithEmoji++;
    emojiRegex.lastIndex = 0;
  });
  
  const count = posts.length;
  return {
    avgAiParagraphs: (totalAiParagraphs / count).toFixed(1),
    avgFinalParagraphs: (totalFinalParagraphs / count).toFixed(1),
    avgAiLineBreaks: (totalAiLineBreaks / count).toFixed(1),
    avgFinalLineBreaks: (totalFinalLineBreaks / count).toFixed(1),
    avgAiHashtags: (totalAiHashtags / count).toFixed(1),
    avgFinalHashtags: (totalFinalHashtags / count).toFixed(1),
    aiStartsWithEmojiPercent: Math.round((aiStartsWithEmoji / count) * 100),
    finalStartsWithEmojiPercent: Math.round((finalStartsWithEmoji / count) * 100),
    aiEndsWithEmojiPercent: Math.round((aiEndsWithEmoji / count) * 100),
    finalEndsWithEmojiPercent: Math.round((finalEndsWithEmoji / count) * 100)
  };
}

function analysePunctuation(posts) {
  let aiExclamations = 0, finalExclamations = 0;
  let aiQuestions = 0, finalQuestions = 0;
  let aiEllipsis = 0, finalEllipsis = 0;
  let aiAllCapsWords = 0, finalAllCapsWords = 0;
  
  posts.forEach(post => {
    const ai = post.ai_version;
    const final = post.final_version;
    
    aiExclamations += (ai.match(/!/g) || []).length;
    finalExclamations += (final.match(/!/g) || []).length;
    
    aiQuestions += (ai.match(/\?/g) || []).length;
    finalQuestions += (final.match(/\?/g) || []).length;
    
    aiEllipsis += (ai.match(/\.{3}|…/g) || []).length;
    finalEllipsis += (final.match(/\.{3}|…/g) || []).length;
  });
  
  const count = posts.length;
  return {
    avgAiExclamations: (aiExclamations / count).toFixed(1),
    avgFinalExclamations: (finalExclamations / count).toFixed(1),
    exclamationReduction: ((aiExclamations - finalExclamations) / Math.max(aiExclamations, 1) * 100).toFixed(0),
    avgAiQuestions: (aiQuestions / count).toFixed(1),
    avgFinalQuestions: (finalQuestions / count).toFixed(1),
    avgAiEllipsis: (aiEllipsis / count).toFixed(1),
    avgFinalEllipsis: (finalEllipsis / count).toFixed(1)
  };
}

function analyseSentenceMetrics(posts) {
  let totalAiSentences = 0, totalFinalSentences = 0;
  let totalAiSentenceLength = 0, totalFinalSentenceLength = 0;
  let aiShortSentences = 0, finalShortSentences = 0; // < 8 words
  
  posts.forEach(post => {
    const aiSentences = post.ai_version.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const finalSentences = post.final_version.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    totalAiSentences += aiSentences.length;
    totalFinalSentences += finalSentences.length;
    
    aiSentences.forEach(s => {
      const wordCount = s.trim().split(/\s+/).length;
      totalAiSentenceLength += wordCount;
      if (wordCount < 8) aiShortSentences++;
    });
    
    finalSentences.forEach(s => {
      const wordCount = s.trim().split(/\s+/).length;
      totalFinalSentenceLength += wordCount;
      if (wordCount < 8) finalShortSentences++;
    });
  });
  
  return {
    avgAiSentenceLength: (totalAiSentenceLength / Math.max(totalAiSentences, 1)).toFixed(1),
    avgFinalSentenceLength: (totalFinalSentenceLength / Math.max(totalFinalSentences, 1)).toFixed(1),
    avgAiSentencesPerPost: (totalAiSentences / posts.length).toFixed(1),
    avgFinalSentencesPerPost: (totalFinalSentences / posts.length).toFixed(1),
    aiShortSentencePercent: Math.round((aiShortSentences / Math.max(totalAiSentences, 1)) * 100),
    finalShortSentencePercent: Math.round((finalShortSentences / Math.max(totalFinalSentences, 1)) * 100)
  };
}

function analyseOpeningClosing(posts) {
  const aiOpenings = [];
  const finalOpenings = [];
  const aiClosings = [];
  const finalClosings = [];
  
  posts.forEach(post => {
    const aiLines = post.ai_version.trim().split('\n').filter(Boolean);
    const finalLines = post.final_version.trim().split('\n').filter(Boolean);
    
    if (aiLines.length > 0) {
      aiOpenings.push(aiLines[0].substring(0, 50));
      aiClosings.push(aiLines[aiLines.length - 1].substring(0, 50));
    }
    if (finalLines.length > 0) {
      finalOpenings.push(finalLines[0].substring(0, 50));
      finalClosings.push(finalLines[finalLines.length - 1].substring(0, 50));
    }
  });
  
  // Detect patterns in openings
  const openingPatterns = {
    aiStartsWithQuestion: aiOpenings.filter(o => o.includes('?')).length,
    finalStartsWithQuestion: finalOpenings.filter(o => o.includes('?')).length,
    aiStartsWithYou: aiOpenings.filter(o => o.toLowerCase().startsWith('you')).length,
    finalStartsWithYou: finalOpenings.filter(o => o.toLowerCase().startsWith('you')).length,
    aiStartsWithI: aiOpenings.filter(o => /^i\s/i.test(o)).length,
    finalStartsWithI: finalOpenings.filter(o => /^i\s/i.test(o)).length,
  };
  
  // Detect CTA patterns in closings
  const closingPatterns = {
    aiHasCTA: aiClosings.filter(c => /follow|link|comment|share|check out|click|tap/i.test(c)).length,
    finalHasCTA: finalClosings.filter(c => /follow|link|comment|share|check out|click|tap/i.test(c)).length,
  };
  
  return {
    openingPatterns,
    closingPatterns,
    sampleOpenings: finalOpenings.slice(0, 3),
    sampleClosings: finalClosings.slice(0, 3)
  };
}

function extractBeforeAfterExamples(posts) {
  // Get posts with significant edits to show transformation examples
  const examples = [];
  
  const sortedByEdits = [...posts].sort((a, b) => b.edit_count - a.edit_count);
  
  sortedByEdits.slice(0, 5).forEach(post => {
    if (post.edit_count >= 2) {
      // Find a specific changed line to highlight
      const aiLines = post.ai_version.split('\n').filter(Boolean);
      const finalLines = post.final_version.split('\n').filter(Boolean);
      
      // Find first significantly different line
      for (let i = 0; i < Math.min(aiLines.length, finalLines.length, 3); i++) {
        if (aiLines[i] !== finalLines[i] && aiLines[i].length > 10) {
          examples.push({
            topic: post.topic,
            before: aiLines[i].substring(0, 100),
            after: finalLines[i] ? finalLines[i].substring(0, 100) : '(removed)',
            editCount: post.edit_count
          });
          break;
        }
      }
    }
  });
  
  return examples.slice(0, 3);
}

function generateToneDescriptors(analysis) {
  const descriptors = [];
  
  // Based on punctuation
  if (parseFloat(analysis.punctuation.exclamationReduction) > 30) {
    descriptors.push('Less enthusiastic/salesy, more understated');
  }
  
  // Based on sentence length
  if (parseFloat(analysis.sentenceMetrics.avgFinalSentenceLength) < parseFloat(analysis.sentenceMetrics.avgAiSentenceLength)) {
    descriptors.push('Prefers shorter, punchier sentences');
  }
  
  // Based on structure
  if (parseFloat(analysis.structuralPatterns.avgFinalLineBreaks) > parseFloat(analysis.structuralPatterns.avgAiLineBreaks)) {
    descriptors.push('Uses more line breaks for readability');
  }
  
  // Based on caps
  if (analysis.capsReduction > 1) {
    descriptors.push('Avoids excessive capitalization');
  }
  
  // Based on British expressions
  if (analysis.britishExpressionsAdded.length > 0) {
    descriptors.push('Incorporates British colloquialisms');
  }
  
  // Based on emoji usage
  if (analysis.structuralPatterns.finalStartsWithEmojiPercent < analysis.structuralPatterns.aiStartsWithEmojiPercent) {
    descriptors.push('Rarely starts posts with emoji');
  }
  
  // Based on length changes
  if (analysis.lengthChanges.charChange < -50) {
    descriptors.push('Tends to condense and tighten copy');
  } else if (analysis.lengthChanges.charChange > 50) {
    descriptors.push('Expands with personal details and context');
  }
  
  return descriptors;
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
    
    // SKILL.md enhancement analytics
    const structuralPatterns = analyseStructuralPatterns(posts);
    const punctuation = analysePunctuation(posts);
    const sentenceMetrics = analyseSentenceMetrics(posts);
    const openingClosing = analyseOpeningClosing(posts);
    const beforeAfterExamples = extractBeforeAfterExamples(posts);
    
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
      emojiAnalysis,
      // SKILL.md enhancements
      structuralPatterns,
      punctuation,
      sentenceMetrics,
      openingClosing,
      beforeAfterExamples
    };
    
    // Generate tone descriptors after analysis object is complete
    analysis.toneDescriptors = generateToneDescriptors(analysis);
    
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
