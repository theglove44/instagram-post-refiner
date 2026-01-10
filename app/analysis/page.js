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
    
    // Avoid section
    if (analysis.marketingPhrasesRemoved.length > 0) {
      updates += `### Add to "Avoid" list:\n`;
      analysis.marketingPhrasesRemoved.forEach(([phrase, count]) => {
        updates += `- "${phrase}" (removed ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Emoji section
    if (analysis.salesyEmojisRemoved.length > 0) {
      updates += `### Emojis to avoid:\n`;
      analysis.salesyEmojisRemoved.forEach(([emoji, count]) => {
        updates += `- ${emoji} (removed ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // British expressions
    if (analysis.britishExpressionsAdded.length > 0) {
      updates += `### British expressions to encourage:\n`;
      analysis.britishExpressionsAdded.forEach(([phrase, count]) => {
        updates += `- "${phrase}" (added ${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Caps guidance
    if (analysis.capsReduction > 0.5) {
      updates += `### Capitalization note:\n`;
      updates += `AI averages ${analysis.avgAiCaps.toFixed(1)} CAPS words per post, you reduce to ${analysis.avgFinalCaps.toFixed(1)}.\n`;
      updates += `Consider adding: "Maximum 2-3 capitalized words per post"\n\n`;
    }
    
    // Words to use more
    if (analysis.addedWords.length > 0) {
      updates += `### Words you frequently add:\n`;
      analysis.addedWords.slice(0, 10).forEach(([word, count]) => {
        updates += `- "${word}" (${count}x)\n`;
      });
      updates += '\n';
    }
    
    // Words to use less
    if (analysis.removedWords.length > 0) {
      updates += `### Words to avoid/reduce:\n`;
      analysis.removedWords.slice(0, 10).forEach(([word, count]) => {
        updates += `- "${word}" (removed ${count}x)\n`;
      });
      updates += '\n';
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
