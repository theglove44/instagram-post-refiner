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
      }
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
