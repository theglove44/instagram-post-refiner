'use client';

import { useState, useEffect, useCallback } from 'react';
import SkipRateBadge from '../../components/SkipRateBadge.js';
import { formatNumber, formatPercent, computeNonFollowerRatio, formatDate } from '../../../lib/utils.js';

const SORT_OPTIONS = [
  { key: 'published_at', label: 'Most Recent', desc: true },
  { key: 'reach', label: 'Reach', desc: true },
  { key: 'saves', label: 'Saves', desc: true },
  { key: 'non_follower_ratio', label: 'Non-Follower %', desc: true },
  { key: 'follows', label: 'Follows', desc: true },
  { key: 'reels_skip_rate', label: 'Skip Rate (worst)', desc: true },
];

export default function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortKey, setSortKey] = useState('published_at');
  const [filterType, setFilterType] = useState('ALL');
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts/list');
      const data = await res.json();
      if (data.success) setPosts(data.posts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/insights/posts');
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`Synced ${data.processed} posts (${data.errors} errors).`);
        fetchPosts();
      } else {
        setSyncMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Enrich with computed fields
  const enriched = posts.map((p) => ({
    ...p,
    non_follower_ratio: computeNonFollowerRatio(p.reach_non_follower, p.reach_follower),
    is_reel: p.media_product_type === 'REELS' || p.media_product_type === 'REEL',
  }));

  // Filter
  const filtered = filterType === 'ALL'
    ? enriched
    : filterType === 'REELS'
    ? enriched.filter((p) => p.is_reel)
    : enriched.filter((p) => !p.is_reel);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'non_follower_ratio') {
      return (b.non_follower_ratio ?? -1) - (a.non_follower_ratio ?? -1);
    }
    if (sortKey === 'reels_skip_rate') {
      // Sort reels with data first (worst skip rate first), non-reels last
      if (a.reels_skip_rate === null && b.reels_skip_rate === null) return 0;
      if (a.reels_skip_rate === null) return 1;
      if (b.reels_skip_rate === null) return -1;
      return b.reels_skip_rate - a.reels_skip_rate;
    }
    if (sortKey === 'published_at') {
      return new Date(b.published_at) - new Date(a.published_at);
    }
    return (b[sortKey] ?? -1) - (a[sortKey] ?? -1);
  });

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Posts Feed</h1>
          <p>Per-post insights fetched 48h+ after publish — {sorted.length} posts</p>
        </div>
        <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
          {syncing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Syncing…</> : 'Fetch Insights'}
        </button>
      </div>

      {syncMessage && (
        <div className={`alert ${syncMessage.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>
          {syncMessage}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['ALL', 'REELS', 'POSTS'].map((t) => (
          <button
            key={t}
            className={`sort-btn ${filterType === t ? 'active' : ''}`}
            onClick={() => setFilterType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sort controls */}
      <div className="sort-controls">
        {SORT_OPTIONS.map((opt) => (
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
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading posts…</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3>No post metrics yet</h3>
          <p>
            Click &quot;Fetch Insights&quot; to pull metrics for posts published at least
            48 hours ago. Insights include reach, saves, follows, profile visits,
            and Reel-specific skip rate and watch time.
          </p>
        </div>
      ) : (
        <div className="posts-grid">
          {sorted.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post }) {
  const nonFollowerPct = post.non_follower_ratio !== null
    ? formatPercent(post.non_follower_ratio)
    : '—';

  const typeLabel = post.is_reel ? 'REEL' : post.media_type === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : 'POST';

  return (
    <div className="post-card">
      <div className="post-card-header">
        <span className="post-card-type">{typeLabel}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {post.is_reel && <SkipRateBadge rate={post.reels_skip_rate} />}
          <span className="post-card-date">{formatDate(post.published_at)}</span>
        </div>
      </div>

      {post.caption && (
        <p className="post-card-caption">{post.caption}</p>
      )}

      <div className="post-card-metrics">
        <div className="post-metric">
          <span className="post-metric-value">{formatNumber(post.reach)}</span>
          <span className="post-metric-label">Reach</span>
        </div>
        <div className="post-metric">
          <span className="post-metric-value" style={{ color: 'var(--accent-terra)' }}>{nonFollowerPct}</span>
          <span className="post-metric-label">Non-Follower</span>
        </div>
        <div className="post-metric">
          <span className="post-metric-value" style={{ color: 'var(--accent-mustard)' }}>{formatNumber(post.saves)}</span>
          <span className="post-metric-label">Saves</span>
        </div>
        <div className="post-metric">
          <span className="post-metric-value">{formatNumber(post.follows)}</span>
          <span className="post-metric-label">Follows</span>
        </div>
        <div className="post-metric">
          <span className="post-metric-value">{formatNumber(post.profile_visits)}</span>
          <span className="post-metric-label">Profile</span>
        </div>
        <div className="post-metric">
          <span className="post-metric-value">{formatNumber(post.shares)}</span>
          <span className="post-metric-label">Shares</span>
        </div>
      </div>

      {post.is_reel && post.reels_avg_watch_time !== null && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>AVG WATCH</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', color: 'var(--text-number)' }}>
              {Number(post.reels_avg_watch_time).toFixed(1)}s
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>VIEWS</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', color: 'var(--text-number)' }}>
              {formatNumber(post.views)}
            </span>
          </div>
        </div>
      )}

      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="post-card-link"
        >
          View on Instagram →
        </a>
      )}
    </div>
  );
}
