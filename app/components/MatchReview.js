'use client';

import { useState, useEffect } from 'react';

export default function MatchReview() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [runningMatch, setRunningMatch] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const res = await fetch('/api/posts/match');
      const data = await res.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const resolveSuggestion = async (id, action) => {
    setResolving(id);
    try {
      const res = await fetch('/api/posts/match', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: id, action }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestions(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to resolve suggestion:', err);
    } finally {
      setResolving(null);
    }
  };

  const runAutoMatch = async (mode = 'recent') => {
    setRunningMatch(true);
    setMatchResult(null);
    try {
      const res = await fetch('/api/posts/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          limit: mode === 'bulk' ? 500 : 100,
        }),
      });
      const data = await res.json();
      if (data.syncId) {
        // Poll for completion
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const healthRes = await fetch(`/api/instagram/health?_t=${Date.now()}`);
          const healthData = await healthRes.json();
          const linkSync = healthData.health?.syncHistory?.auto_linking;
          if (linkSync && linkSync.id === data.syncId && linkSync.status !== 'running') {
            setMatchResult(linkSync);
            loadSuggestions();
            break;
          }
        }
      }
    } catch (err) {
      console.error('Auto-match error:', err);
      setMatchResult({ status: 'error', error_details: { message: err.message } });
    } finally {
      setRunningMatch(false);
    }
  };

  const pending = suggestions.filter(s => s.status === 'pending');

  return (
    <div>
      {/* Auto-Match Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => runAutoMatch('recent')}
          disabled={runningMatch}
        >
          {runningMatch ? 'Matching...' : 'Run Auto-Match (Recent)'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => runAutoMatch('bulk')}
          disabled={runningMatch}
        >
          {runningMatch ? 'Matching...' : 'Scan Full History'}
        </button>
        {runningMatch && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span className="loading-spinner" style={{ width: '14px', height: '14px', display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Comparing captions...
          </span>
        )}
      </div>

      {/* Match Result Banner */}
      {matchResult && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-sm)',
          background: matchResult.status === 'error' ? 'var(--error-soft)' : 'var(--success-soft)',
          border: `1px solid ${matchResult.status === 'error' ? 'var(--error)' : 'var(--success)'}`,
          fontSize: '0.85rem',
        }}>
          {matchResult.status === 'error' ? (
            <span style={{ color: 'var(--error)' }}>
              Match failed: {matchResult.error_details?.errors?.[0]?.message || matchResult.error_details?.message || 'Unknown error'}
            </span>
          ) : (
            <span style={{ color: 'var(--success)' }}>
              Auto-linked: {matchResult.error_details?.autoLinked || 0} posts,
              Suggestions: {matchResult.error_details?.suggestionsCreated || 0} new
              {matchResult.posts_processed > 0 && ` (${matchResult.posts_processed} total matches)`}
            </span>
          )}
        </div>
      )}

      {/* Pending Suggestions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="loading-spinner" style={{ width: '28px', height: '28px' }} />
        </div>
      ) : pending.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
          <p>No pending match suggestions.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Run auto-match to find connections between your logged posts and Instagram posts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            {pending.length} suggestion{pending.length !== 1 ? 's' : ''} awaiting review
          </div>
          {pending.map(s => (
            <div key={s.id} style={{
              padding: '1rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${s.confidenceScore >= 0.85 ? 'var(--success)' : 'var(--warning)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                    {s.post?.topic || 'Untitled'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {s.post?.snippet || ''}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  marginLeft: '0.75rem',
                  background: s.confidenceScore >= 0.85 ? 'var(--success-soft)' : 'var(--warning-soft)',
                  color: s.confidenceScore >= 0.85 ? 'var(--success)' : 'var(--warning)',
                }}>
                  {Math.round(s.confidenceScore * 100)}% match
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                IG: {s.instagramCaption || '(No caption)'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => resolveSuggestion(s.id, 'accept')}
                  disabled={resolving === s.id}
                >
                  {resolving === s.id ? '...' : 'Accept & Link'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => resolveSuggestion(s.id, 'reject')}
                  disabled={resolving === s.id}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
