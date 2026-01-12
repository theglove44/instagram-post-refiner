'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedSkill, setCopiedSkill] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyse');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load analysis');
      }
      
      setAnalysis(data.analysis);
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSkillUpdates = () => {
    if (!analysis) return '';
    
    let updates = `## Suggested SKILL.md Updates\n\nBased on analysis of ${analysis.totalPosts} logged posts:\n\n`;
    
    // Tone Descriptors - Natural language voice description
    if (analysis.toneDescriptors && analysis.toneDescriptors.length > 0) {
      updates += `### Voice Characteristics:\n`;
      analysis.toneDescriptors.forEach(descriptor => {
        updates += `- ${descriptor}\n`;
      });
      updates += '\n';
    }
    
    // Before/After Examples
    if (analysis.beforeAfterExamples && analysis.beforeAfterExamples.length > 0) {
      updates += `### Transformation Examples:\n`;
      analysis.beforeAfterExamples.forEach(example => {
        updates += `**${example.topic}** (${example.editCount} edits)\n`;
        updates += `- Before: "${example.before}"\n`;
        updates += `- After: "${example.after}"\n\n`;
      });
    }
    
    // Structural/Formatting Rules
    updates += `### Formatting Rules:\n`;
    if (analysis.structuralPatterns) {
      const sp = analysis.structuralPatterns;
      if (parseFloat(sp.avgFinalLineBreaks) !== parseFloat(sp.avgAiLineBreaks)) {
        updates += `- Line breaks: ${sp.avgAiLineBreaks} → ${sp.avgFinalLineBreaks} avg per post\n`;
      }
      if (parseFloat(sp.avgFinalHashtags) !== parseFloat(sp.avgAiHashtags)) {
        updates += `- Hashtags: ${sp.avgAiHashtags} → ${sp.avgFinalHashtags} avg per post\n`;
      }
      if (sp.aiStartsWithEmojiPercent !== sp.finalStartsWithEmojiPercent) {
        updates += `- Posts starting with emoji: ${sp.aiStartsWithEmojiPercent}% → ${sp.finalStartsWithEmojiPercent}%\n`;
      }
      if (sp.aiEndsWithEmojiPercent !== sp.finalEndsWithEmojiPercent) {
        updates += `- Posts ending with emoji: ${sp.aiEndsWithEmojiPercent}% → ${sp.finalEndsWithEmojiPercent}%\n`;
      }
    }
    updates += '\n';
    
    // Punctuation Rules
    if (analysis.punctuation) {
      const p = analysis.punctuation;
      updates += `### Punctuation Guidelines:\n`;
      if (parseFloat(p.exclamationReduction) > 20) {
        updates += `- Reduce exclamation marks: ${p.avgAiExclamations} → ${p.avgFinalExclamations} per post (${p.exclamationReduction}% reduction)\n`;
      }
      if (parseFloat(p.avgFinalQuestions) !== parseFloat(p.avgAiQuestions)) {
        updates += `- Questions per post: ${p.avgAiQuestions} → ${p.avgFinalQuestions}\n`;
      }
      if (parseFloat(p.avgFinalEllipsis) !== parseFloat(p.avgAiEllipsis)) {
        updates += `- Ellipsis usage: ${p.avgAiEllipsis} → ${p.avgFinalEllipsis} per post\n`;
      }
      updates += '\n';
    }
    
    // Sentence Structure
    if (analysis.sentenceMetrics) {
      const sm = analysis.sentenceMetrics;
      updates += `### Sentence Structure:\n`;
      updates += `- Average sentence length: ${sm.avgAiSentenceLength} → ${sm.avgFinalSentenceLength} words\n`;
      updates += `- Short sentences (<8 words): ${sm.aiShortSentencePercent}% → ${sm.finalShortSentencePercent}%\n`;
      updates += '\n';
    }
    
    // Opening/Closing Patterns
    if (analysis.openingClosing) {
      const oc = analysis.openingClosing;
      updates += `### Opening & Closing Patterns:\n`;
      if (oc.openingPatterns.aiStartsWithI !== oc.openingPatterns.finalStartsWithI) {
        updates += `- Posts starting with "I": ${oc.openingPatterns.aiStartsWithI} → ${oc.openingPatterns.finalStartsWithI}\n`;
      }
      if (oc.openingPatterns.aiStartsWithQuestion !== oc.openingPatterns.finalStartsWithQuestion) {
        updates += `- Posts opening with question: ${oc.openingPatterns.aiStartsWithQuestion} → ${oc.openingPatterns.finalStartsWithQuestion}\n`;
      }
      if (oc.closingPatterns.aiHasCTA !== oc.closingPatterns.finalHasCTA) {
        updates += `- Posts with CTA in closing: ${oc.closingPatterns.aiHasCTA} → ${oc.closingPatterns.finalHasCTA}\n`;
      }
      updates += '\n';
    }
    
    // Avoid section
    if (analysis.marketingPhrasesRemoved.length > 0) {
      updates += `### Phrases to Avoid:\n`;
      analysis.marketingPhrasesRemoved.forEach(([phrase, count]) => {
        updates += `- "${phrase}" (removed ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Emoji section
    if (analysis.salesyEmojisRemoved.length > 0) {
      updates += `### Emojis to Avoid:\n`;
      analysis.salesyEmojisRemoved.forEach(([emoji, count]) => {
        updates += `- ${emoji} (removed ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // British expressions
    if (analysis.britishExpressionsAdded.length > 0) {
      updates += `### British Expressions to Encourage:\n`;
      analysis.britishExpressionsAdded.forEach(([phrase, count]) => {
        updates += `- "${phrase}" (added ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Caps guidance
    if (analysis.capsReduction > 0.5) {
      updates += `### Capitalization:\n`;
      updates += `- AI averages ${analysis.avgAiCaps.toFixed(1)} CAPS words, you reduce to ${analysis.avgFinalCaps.toFixed(1)}\n`;
      updates += `- Suggested rule: "Maximum 2-3 capitalized words per post"\n\n`;
    }
    
    // Words to use more
    if (analysis.addedWords.length > 0) {
      updates += `### Words You Frequently Add:\n`;
      analysis.addedWords.slice(0, 10).forEach(([word, count]) => {
        updates += `- "${word}" (${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Words to use less
    if (analysis.removedWords.length > 0) {
      updates += `### Words to Reduce/Avoid:\n`;
      analysis.removedWords.slice(0, 10).forEach(([word, count]) => {
        updates += `- "${word}" (removed ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Length guidance
    if (analysis.lengthChanges) {
      const lc = analysis.lengthChanges;
      updates += `### Length Guidelines:\n`;
      updates += `- Character count: ${lc.avgAiChars} → ${lc.avgFinalChars} (${lc.charChangePercent}%)\n`;
      updates += `- Word count: ${lc.avgAiWords} → ${lc.avgFinalWords} (${lc.wordChangePercent}%)\n`;
    }
    
    return updates;
  };

  const copySkillUpdates = async () => {
    const updates = generateSkillUpdates();
    try {
      await navigator.clipboard.writeText(updates);
      setCopiedSkill(true);
      setTimeout(() => setCopiedSkill(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <h1>📊 Post Analysis</h1>
          <p>Analysing your edit patterns...</p>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
          <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Crunching the numbers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <header className="header">
          <h1>📊 Post Analysis</h1>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <p style={{ color: 'var(--error)', marginBottom: '1.5rem' }}>Error: {error}</p>
          <button className="btn btn-primary" onClick={loadAnalysis}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container">
        <header className="header">
          <h1>📊 Post Analysis</h1>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: '0.5' }}>📭</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            No posts to analyse yet.<br/>Log some posts first!
          </p>
          <Link href="/" className="btn btn-primary">
            ← Back to Logger
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>📊 Post Analysis</h1>
        <p>Patterns from {analysis.totalPosts} logged posts • Avg {analysis.avgEditCount} edits per post</p>
      </header>

      <Link href="/" className="back-link">
        ← Back to Logger
      </Link>

      {/* Voice Score - Prominent Display */}
      {analysis.voiceScore && (
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voice Consistency Score</h2>
          <div style={{ 
            fontSize: '4rem', 
            fontWeight: '700',
            background: analysis.voiceScore.score >= 80 ? 'linear-gradient(135deg, var(--success), #00ff88)' 
              : analysis.voiceScore.score >= 60 ? 'linear-gradient(135deg, var(--warning), #ffcc00)'
              : 'linear-gradient(135deg, var(--error), #ff6b6b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            {analysis.voiceScore.score}%
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {analysis.voiceScore.score >= 80 ? 'Excellent! Your voice is shining through.' 
              : analysis.voiceScore.score >= 60 ? 'Good progress. Keep refining!'
              : 'Keep editing - your voice will emerge.'}
          </p>
          {analysis.voiceScore.factors.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              {analysis.voiceScore.factors.map((factor, i) => (
                <span key={i} className={`tag ${factor.impact > 0 ? 'tag-added' : 'tag-removed'}`}>
                  {factor.name}: {factor.impact > 0 ? '+' : ''}{factor.impact}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value accent">
            {analysis.totalPosts}
          </div>
          <div className="stat-label">Posts Logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-value warning">
            {analysis.avgEditCount}
          </div>
          <div className="stat-label">Avg Edits</div>
        </div>
        <div className="stat-card">
          <div className="stat-value success">
            {analysis.avgAiCaps.toFixed(1)} → {analysis.avgFinalCaps.toFixed(1)}
          </div>
          <div className="stat-label">CAPS Reduction</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={analysis.tommoMentions.increased ? { color: 'var(--success)' } : {}}>
            {analysis.tommoMentions.ai} → {analysis.tommoMentions.final}
          </div>
          <div className="stat-label">Tommo Mentions</div>
        </div>
      </div>

      {/* Improvement Trend */}
      {analysis.improvementTrend && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📈 Improvement Trend</h2>
            <span className={`tag ${analysis.improvementTrend.improving ? 'tag-added' : 'tag-removed'}`}>
              {analysis.improvementTrend.improving ? '↓ Fewer edits needed' : '↑ More edits needed'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                {analysis.improvementTrend.firstHalfAvg}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Early Posts Avg</div>
            </div>
            <div>
              <div style={{ 
                fontSize: '2rem', 
                fontWeight: '700',
                color: analysis.improvementTrend.improving ? 'var(--success)' : 'var(--error)'
              }}>
                {analysis.improvementTrend.improving ? '↓' : '↑'} {Math.abs(parseFloat(analysis.improvementTrend.improvement))}%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Change</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: analysis.improvementTrend.improving ? 'var(--success)' : 'var(--warning)' }}>
                {analysis.improvementTrend.secondHalfAvg}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Recent Posts Avg</div>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {analysis.improvementTrend.improving 
              ? "You're getting better at prompting Claude - your posts need fewer edits over time!"
              : "Your recent posts need more edits. Consider updating your prompting strategy."}
          </p>
        </div>
      )}

      {/* Time Trends Chart */}
      {analysis.timeTrends && analysis.timeTrends.length > 1 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📅 Activity Over Time</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '120px', padding: '0 0.5rem' }}>
            {analysis.timeTrends.slice(-12).map((week, i) => {
              const maxPosts = Math.max(...analysis.timeTrends.map(w => w.posts));
              const height = (week.posts / maxPosts) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {week.posts}
                  </div>
                  <div style={{
                    width: '100%',
                    height: `${height}%`,
                    minHeight: '4px',
                    background: 'linear-gradient(180deg, var(--accent), var(--ig-purple))',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease'
                  }} title={`Week of ${week.week}: ${week.posts} posts, ${week.avgEdits.toFixed(1)} avg edits`} />
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '0.25rem', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px' }}>
                    {new Date(week.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Length Changes */}
      {analysis.lengthChanges && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📏 Length Changes</h2>
          </div>
          <div className="main-grid" style={{ gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Characters</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                {analysis.lengthChanges.avgAiChars} → {analysis.lengthChanges.avgFinalChars}
              </div>
              <div style={{ 
                fontSize: '0.85rem', 
                color: analysis.lengthChanges.charChange < 0 ? 'var(--success)' : 'var(--warning)',
                marginTop: '0.25rem'
              }}>
                {analysis.lengthChanges.charChange > 0 ? '+' : ''}{analysis.lengthChanges.charChange} ({analysis.lengthChanges.charChangePercent}%)
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Words</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                {analysis.lengthChanges.avgAiWords} → {analysis.lengthChanges.avgFinalWords}
              </div>
              <div style={{ 
                fontSize: '0.85rem', 
                color: analysis.lengthChanges.wordChange < 0 ? 'var(--success)' : 'var(--warning)',
                marginTop: '0.25rem'
              }}>
                {analysis.lengthChanges.wordChange > 0 ? '+' : ''}{analysis.lengthChanges.wordChange} ({analysis.lengthChanges.wordChangePercent}%)
              </div>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {analysis.lengthChanges.charChange < 0 
              ? "You tend to shorten posts - keeping them concise!"
              : analysis.lengthChanges.charChange > 20
              ? "You often expand posts - adding more detail and personality."
              : "Post lengths stay fairly consistent after editing."}
          </p>
        </div>
      )}

      {/* Topic Analysis */}
      {analysis.topicAnalysis && analysis.topicAnalysis.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">🏷️ Topic Analysis</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analysis.topicAnalysis.slice(0, 8).map((topic, i) => {
              const maxCount = analysis.topicAnalysis[0].count;
              const width = (topic.count / maxCount) * 100;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '120px', fontSize: '0.85rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topic.topic}
                  </div>
                  <div style={{ flex: 1, height: '24px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${width}%`,
                      height: '100%',
                      background: parseFloat(topic.avgEdits) > parseFloat(analysis.avgEditCount) 
                        ? 'linear-gradient(90deg, var(--warning), var(--ig-orange))'
                        : 'linear-gradient(90deg, var(--success), #00ff88)',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'white',
                      fontWeight: '500'
                    }}>
                      {topic.count} post{topic.count > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ width: '80px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {topic.avgEdits} avg edits
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Topics highlighted in orange need more edits than average ({analysis.avgEditCount}).
          </p>
        </div>
      )}

      {/* Emoji Analysis */}
      {analysis.emojiAnalysis && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">😊 Emoji Patterns</h2>
          </div>
          
          <div className="main-grid" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {analysis.emojiAnalysis.avgAiEmojis} → {analysis.emojiAnalysis.avgFinalEmojis}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg emojis per post</div>
            </div>
            
            {analysis.emojiAnalysis.mostUsedFinal.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Your go-to emojis:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {analysis.emojiAnalysis.mostUsedFinal.map(([emoji, count], i) => (
                    <span key={i} style={{ 
                      fontSize: '1.5rem', 
                      padding: '0.25rem 0.5rem', 
                      background: 'var(--bg-card-hover)', 
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'default'
                    }} title={`Used ${count} times`}>
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="main-grid" style={{ gap: '1.5rem' }}>
            {analysis.emojiAnalysis.added.length > 0 && (
              <div>
                <h3 className="section-title" style={{ color: 'var(--success)' }}>Emojis You Add</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {analysis.emojiAnalysis.added.map(([emoji, count], i) => (
                    <span key={i} className="tag tag-added">
                      {emoji} <span style={{ opacity: 0.6 }}>×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.emojiAnalysis.removed.length > 0 && (
              <div>
                <h3 className="section-title" style={{ color: 'var(--error)' }}>Emojis You Remove</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {analysis.emojiAnalysis.removed.map(([emoji, count], i) => (
                    <span key={i} className="tag tag-removed">
                      {emoji} <span style={{ opacity: 0.6 }}>×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="main-grid">
        {/* Things You Remove */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🚫 Things You Remove</h2>
          </div>
          
          {analysis.marketingPhrasesRemoved.length > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <h3 className="section-title" style={{ color: 'var(--error)' }}>
                Marketing Phrases
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.marketingPhrasesRemoved.map(([phrase, count]) => (
                  <span key={phrase} className="tag tag-removed">
                    "{phrase}" <span style={{ opacity: 0.6 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.salesyEmojisRemoved.length > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <h3 className="section-title" style={{ color: 'var(--error)' }}>
                Salesy Emojis
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.salesyEmojisRemoved.map(([emoji, count]) => (
                  <span key={emoji} className="tag tag-removed">
                    {emoji} <span style={{ opacity: 0.6 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.removedWords.length > 0 && (
            <div>
              <h3 className="section-title">
                Words You Remove
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.removedWords.slice(0, 12).map(([word, count]) => (
                  <span key={word} className="tag tag-neutral">
                    {word} <span style={{ opacity: 0.5 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.marketingPhrasesRemoved.length === 0 && 
           analysis.salesyEmojisRemoved.length === 0 && 
           analysis.removedWords.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No significant removal patterns detected yet.</p>
          )}
        </div>

        {/* Things You Add */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">✅ Things You Add</h2>
          </div>
          
          {analysis.britishExpressionsAdded.length > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <h3 className="section-title" style={{ color: 'var(--success)' }}>
                British Expressions
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.britishExpressionsAdded.map(([phrase, count]) => (
                  <span key={phrase} className="tag tag-added">
                    "{phrase}" <span style={{ opacity: 0.6 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.addedWords.length > 0 && (
            <div>
              <h3 className="section-title">
                Words You Add
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.addedWords.slice(0, 12).map(([word, count]) => (
                  <span key={word} className="tag tag-neutral">
                    {word} <span style={{ opacity: 0.5 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.britishExpressionsAdded.length === 0 && analysis.addedWords.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No significant addition patterns detected yet.</p>
          )}
        </div>
      </div>

      {/* Suggested Skill Updates */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📝 Suggested SKILL.md Updates</h2>
          <button 
            className="btn btn-primary"
            onClick={copySkillUpdates}
            style={{ padding: '0.6rem 1.25rem' }}
          >
            {copiedSkill ? '✓ Copied!' : '📋 Copy Updates'}
          </button>
        </div>
        
        <div className="code-block">
          {generateSkillUpdates()}
        </div>
      </div>

      {/* Common Line Changes */}
      {(analysis.commonRemovals.length > 0 || analysis.commonAdditions.length > 0) && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📊 Common Line Changes</h2>
          </div>
          
          <div className="main-grid" style={{ gap: '1.5rem' }}>
            {analysis.commonRemovals.length > 0 && (
              <div>
                <h3 className="section-title" style={{ color: 'var(--error)' }}>
                  Lines Often Removed
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {analysis.commonRemovals.slice(0, 5).map(([line, count], i) => (
                    <div key={i} style={{ 
                      padding: '0.75rem 1rem', 
                      background: 'var(--error-soft)', 
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--error)',
                      fontSize: '0.85rem',
                      lineHeight: '1.5'
                    }}>
                      <span style={{ color: 'var(--error)', fontWeight: '600' }}>×{count}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                        {line.substring(0, 60)}{line.length > 60 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.commonAdditions.length > 0 && (
              <div>
                <h3 className="section-title" style={{ color: 'var(--success)' }}>
                  Lines Often Added
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {analysis.commonAdditions.slice(0, 5).map(([line, count], i) => (
                    <div key={i} style={{ 
                      padding: '0.75rem 1rem', 
                      background: 'var(--success-soft)', 
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--success)',
                      fontSize: '0.85rem',
                      lineHeight: '1.5'
                    }}>
                      <span style={{ color: 'var(--success)', fontWeight: '600' }}>×{count}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                        {line.substring(0, 60)}{line.length > 60 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <p style={{ marginBottom: '1rem' }}>Analysis updates automatically as you log more posts.</p>
        <button className="btn btn-secondary" onClick={loadAnalysis}>
          🔄 Refresh Analysis
        </button>
      </div>
    </div>
  );
}
