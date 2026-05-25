'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatNumber, formatDate } from '../../../lib/utils.js';

const TIER_ORDER = { COMPETITIVE: 0, REACHABLE: 1, LOCAL: 2, UNKNOWN: 3 };

export default function HashtagsPage() {
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [newHashtag, setNewHashtag] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null);
  const [sortKey, setSortKey] = useState('tier');
  const [auditResult, setAuditResult] = useState(null);

  const fetchHashtags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hashtags');
      const data = await res.json();
      if (data.success) setHashtags(data.hashtags || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHashtags();
  }, [fetchHashtags]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHashtag.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtag: newHashtag }),
      });
      const data = await res.json();
      if (data.success) {
        setNewHashtag('');
        fetchHashtags();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (hashtag) => {
    if (!confirm(`Remove #${hashtag} from your list?`)) return;
    try {
      const res = await fetch(`/api/hashtags?hashtag=${encodeURIComponent(hashtag)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchHashtags();
      else setMessage({ type: 'error', text: data.error });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleAudit = async () => {
    setAuditing(true);
    setAuditResult(null);
    setMessage(null);
    try {
      const res = await fetch('/api/hashtags/audit', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) {
        setAuditResult(data);
        fetchHashtags();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAuditing(false);
    }
  };

  const sorted = [...hashtags].sort((a, b) => {
    if (sortKey === 'tier') return (TIER_ORDER[a.tier || 'UNKNOWN'] ?? 3) - (TIER_ORDER[b.tier || 'UNKNOWN'] ?? 3);
    if (sortKey === 'alpha') return a.hashtag.localeCompare(b.hashtag);
    if (sortKey === 'median_likes') return (b.latestAudit?.median_likes ?? -1) - (a.latestAudit?.median_likes ?? -1);
    return 0;
  });

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Hashtag Audit</h1>
          <p>Monthly benchmark — discover which tags are worth using</p>
        </div>
        <button className="btn btn-secondary" onClick={handleAudit} disabled={auditing || hashtags.filter(h => h.active).length === 0}>
          {auditing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Auditing…</> : 'Run Audit'}
        </button>
      </div>

      {/* Rate limit notice */}
      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        Meta allows 30 unique hashtag searches per 7-day rolling window.
        The audit engine tracks this and will pause if the limit is reached.
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      {auditResult && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          Audited {auditResult.processed} hashtags · {auditResult.errors} errors ·
          {auditResult.remainingBudget} searches remaining this week
        </div>
      )}

      {/* Add hashtag */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontWeight: 400 }}>Add Hashtag</h3>
        <form onSubmit={handleAdd}>
          <div className="input-row">
            <input
              className="form-input"
              placeholder="#manchesterfood"
              value={newHashtag}
              onChange={(e) => setNewHashtag(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={adding}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {/* Sort controls */}
      <div className="sort-controls">
        {[
          { key: 'tier', label: 'By Tier' },
          { key: 'median_likes', label: 'By Bar (likes)' },
          { key: 'alpha', label: 'Alphabetical' },
        ].map((opt) => (
          <button
            key={opt.key}
            className={`sort-btn ${sortKey === opt.key ? 'active' : ''}`}
            onClick={() => setSortKey(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3>No hashtags configured</h3>
          <p>Add hashtags you want to track above. Once added, run an audit to see how competitive each tag is.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hashtag</th>
                <th>Tier</th>
                <th>Median Likes</th>
                <th>Median Comments</th>
                <th>Last Audited</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>#{tag.hashtag}</span>
                  </td>
                  <td>
                    <TierBadge tier={tag.tier || tag.latestAudit?.tier} />
                  </td>
                  <td className="td-mono">
                    {tag.latestAudit?.median_likes != null ? formatNumber(Math.round(tag.latestAudit.median_likes)) : '—'}
                  </td>
                  <td className="td-mono">
                    {tag.latestAudit?.median_comments != null ? formatNumber(Math.round(tag.latestAudit.median_comments)) : '—'}
                  </td>
                  <td className="td-muted">
                    {tag.latestAudit?.audit_date ? formatDate(tag.latestAudit.audit_date) : 'Never'}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(tag.hashtag)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tier legend */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12, fontWeight: 400 }}>Tier Legend</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <TierBadge tier="LOCAL" />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6 }}>
              <strong>Under 1k median likes</strong> — low competition, great for discoverability in niche audiences. Ideal for local Manchester searches.
            </p>
          </div>
          <div>
            <TierBadge tier="REACHABLE" />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6 }}>
              <strong>1k–5k median likes</strong> — moderate competition. Your best posts can appear in top media. Sweet spot for growth.
            </p>
          </div>
          <div>
            <TierBadge tier="COMPETITIVE" />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6 }}>
              <strong>5k+ median likes</strong> — high competition. Hard to appear in top media unless a post goes viral. Use sparingly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TierBadge({ tier }) {
  const t = (tier || 'UNKNOWN').toUpperCase();
  const cls = t === 'COMPETITIVE' ? 'competitive' : t === 'REACHABLE' ? 'reachable' : t === 'LOCAL' ? 'local' : 'unknown';
  return <span className={`tier-badge ${cls}`}>{t}</span>;
}
