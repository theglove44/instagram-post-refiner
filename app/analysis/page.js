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
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Crunching the numbers...</p>
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
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--error)' }}>Error: {error}</p>
          <button className="btn btn-primary" onClick={loadAnalysis} style={{ marginTop: '1rem' }}>
            Retry
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
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No posts to analyse yet. Log some posts first!
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

      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          ← Back to Logger
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
            {analysis.totalPosts}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Posts Logged</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
            {analysis.avgEditCount}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Avg Edits</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
            {analysis.avgAiCaps.toFixed(1)} → {analysis.avgFinalCaps.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>CAPS Reduction</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: analysis.tommoMentions.increased ? 'var(--success)' : 'var(--text-muted)' }}>
            {analysis.tommoMentions.ai} → {analysis.tommoMentions.final}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tommo Mentions</div>
        </div>
      </div>

      <div className="main-grid">
        {/* Things You Remove */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🚫 Things You Remove</h2>
          </div>
          
          {analysis.marketingPhrasesRemoved.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Marketing Phrases
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.marketingPhrasesRemoved.map(([phrase, count]) => (
                  <span key={phrase} className="tag tag-removed">
                    "{phrase}" <span style={{ opacity: 0.7 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.salesyEmojisRemoved.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Salesy Emojis
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.salesyEmojisRemoved.map(([emoji, count]) => (
                  <span key={emoji} className="tag tag-removed">
                    {emoji} <span style={{ opacity: 0.7 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.removedWords.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Words You Remove
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.removedWords.slice(0, 12).map(([word, count]) => (
                  <span key={word} className="tag tag-neutral">
                    {word} <span style={{ opacity: 0.7 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.marketingPhrasesRemoved.length === 0 && 
           analysis.salesyEmojisRemoved.length === 0 && 
           analysis.removedWords.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No significant removal patterns detected yet.</p>
          )}
        </div>

        {/* Things You Add */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">✅ Things You Add</h2>
          </div>
          
          {analysis.britishExpressionsAdded.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                British Expressions
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.britishExpressionsAdded.map(([phrase, count]) => (
                  <span key={phrase} className="tag tag-added">
                    "{phrase}" <span style={{ opacity: 0.7 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.addedWords.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Words You Add
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {analysis.addedWords.slice(0, 12).map(([word, count]) => (
                  <span key={word} className="tag tag-neutral">
                    {word} <span style={{ opacity: 0.7 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.britishExpressionsAdded.length === 0 && analysis.addedWords.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No significant addition patterns detected yet.</p>
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
          >
            {copiedSkill ? '✓ Copied!' : '📋 Copy Updates'}
          </button>
        </div>
        
        <div style={{ 
          background: 'var(--bg-input)', 
          padding: '1rem', 
          borderRadius: '8px',
          whiteSpace: 'pre-wrap',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          lineHeight: '1.6',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {generateSkillUpdates()}
        </div>
      </div>

      {/* Common Line Changes */}
      {(analysis.commonRemovals.length > 0 || analysis.commonAdditions.length > 0) && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📊 Common Line Changes</h2>
          </div>
          
          <div className="main-grid" style={{ gap: '1rem' }}>
            {analysis.commonRemovals.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--error)', marginBottom: '0.75rem' }}>
                  Lines Often Removed
                </h3>
                {analysis.commonRemovals.slice(0, 5).map(([line, count], i) => (
                  <div key={i} style={{ 
                    padding: '0.5rem', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem'
                  }}>
                    <span style={{ color: 'var(--error)' }}>×{count}</span> {line.substring(0, 60)}...
                  </div>
                ))}
              </div>
            )}
            
            {analysis.commonAdditions.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '0.75rem' }}>
                  Lines Often Added
                </h3>
                {analysis.commonAdditions.slice(0, 5).map(([line, count], i) => (
                  <div key={i} style={{ 
                    padding: '0.5rem', 
                    background: 'rgba(34, 197, 94, 0.1)', 
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem'
                  }}>
                    <span style={{ color: 'var(--success)' }}>×{count}</span> {line.substring(0, 60)}...
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <p>Analysis updates automatically as you log more posts.</p>
        <button className="btn btn-secondary" onClick={loadAnalysis} style={{ marginTop: '0.5rem' }}>
          🔄 Refresh Analysis
        </button>
      </div>
    </div>
  );
}
