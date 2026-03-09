'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BestPosts from '@/app/components/BestPosts';
import MatchReview from '@/app/components/MatchReview';

// Safe JSON parser — handles non-JSON error responses from the server
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `Request failed with status ${res.status}`);
  }
}

const SUB_NAV_LINKS = [
  { href: '/performance', label: 'Dashboard' },
  { href: '/performance/posts', label: 'Post Metrics' },
  { href: '/performance/timing', label: 'Timing' },
  { href: '/performance/content', label: 'Content' },
  { href: '/performance/hashtags', label: 'Hashtags' },
  { href: '/performance/audience', label: 'Audience' },
];

function SubNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      gap: '0.25rem',
      marginBottom: '1.5rem',
      borderBottom: '1px solid var(--border, #2a2a2a)',
      paddingBottom: '0.75rem',
      flexWrap: 'wrap',
    }}>
      {SUB_NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-primary, #fff)' : 'var(--text-muted, #888)',
              background: isActive ? 'rgba(225, 48, 108, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(225, 48, 108, 0.3)' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function PostMetricsPage() {
  const [posts, setPosts] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [error, setError] = useState(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [correlationData, setCorrelationData] = useState(null);
  const [derivedData, setDerivedData] = useState(null);

  useEffect(() => {
    checkInstagramConnection();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await safeJson(res);

      if (data.connected) {
        setInstagramConnected(true);
        loadMetrics();
        loadRecentPosts();
        loadDerivedMetrics();
      } else {
        setInstagramConnected(false);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const res = await fetch('/api/instagram/metrics');
      const data = await safeJson(res);

      if (data.error) {
        throw new Error(data.error);
      }

      setPosts(data.posts || []);
      calculateCorrelation(data.posts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDerivedMetrics = async () => {
    try {
      const res = await fetch('/api/instagram/derived');
      const data = await safeJson(res);
      if (data.success) {
        setDerivedData(data);
      }
    } catch (err) {
      console.error('Failed to load derived metrics:', err);
    }
  };

  const loadRecentPosts = async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch('/api/instagram/recent?limit=25');
      const data = await safeJson(res);

      if (data.error) {
        console.error('Recent posts error:', data.error);
      } else {
        setRecentPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to load recent posts:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  const calculateCorrelation = (postsData) => {
    if (!postsData || postsData.length < 3) {
      setCorrelationData(null);
      return;
    }

    const postsWithMetrics = postsData.filter(p => p.metrics);
    if (postsWithMetrics.length < 3) {
      setCorrelationData(null);
      return;
    }

    const lowEdits = postsWithMetrics.filter(p => p.editCount <= 3);
    const mediumEdits = postsWithMetrics.filter(p => p.editCount > 3 && p.editCount <= 7);
    const highEdits = postsWithMetrics.filter(p => p.editCount > 7);

    const avgEngagement = (items) => {
      const valid = items.filter(p =>
        p.metrics?.engagementRate !== null && p.metrics?.engagementRate !== undefined
      );
      if (valid.length === 0) return null;
      return valid.reduce((sum, p) => sum + parseFloat(p.metrics.engagementRate), 0) / valid.length;
    };

    const avgReach = (items) => {
      const valid = items.filter(p =>
        p.metrics?.reach !== null && p.metrics?.reach !== undefined
      );
      if (valid.length === 0) return null;
      return valid.reduce((sum, p) => sum + p.metrics.reach, 0) / valid.length;
    };

    const lowEng = avgEngagement(lowEdits);
    const medEng = avgEngagement(mediumEdits);
    const highEng = avgEngagement(highEdits);
    const lowReach = avgReach(lowEdits);
    const medReach = avgReach(mediumEdits);
    const highReach = avgReach(highEdits);
    const overallEng = avgEngagement(postsWithMetrics);

    setCorrelationData({
      lowEdits: {
        count: lowEdits.length,
        avgEngagement: lowEng !== null ? lowEng.toFixed(2) : null,
        avgReach: lowReach !== null ? Math.round(lowReach) : null,
      },
      mediumEdits: {
        count: mediumEdits.length,
        avgEngagement: medEng !== null ? medEng.toFixed(2) : null,
        avgReach: medReach !== null ? Math.round(medReach) : null,
      },
      highEdits: {
        count: highEdits.length,
        avgEngagement: highEng !== null ? highEng.toFixed(2) : null,
        avgReach: highReach !== null ? Math.round(highReach) : null,
      },
      totalPosts: postsWithMetrics.length,
      overallAvgEngagement: overallEng !== null ? overallEng.toFixed(2) : null,
    });
  };

  // Format number for display, handling null/undefined
  const formatNumber = (num) => {
    if (num === null || num === undefined) return null;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Render metric value or N/A with tooltip
  const renderMetric = (value) => {
    if (value === null || value === undefined) {
      return (
        <span className="metric-na" title="Not provided by Instagram API for this media/account or not available yet.">
          N/A
        </span>
      );
    }
    return formatNumber(value);
  };

  // Render rate value with percentage
  const renderRate = (value, decimals = 2) => {
    if (value === null || value === undefined) {
      return <span className="metric-na" title="Cannot calculate: reach unavailable">N/A</span>;
    }
    return `${value.toFixed(decimals)}%`;
  };

  // Render percentile badge
  const renderPercentile = (percentile, insufficientData = false) => {
    if (insufficientData || percentile === null || percentile === undefined) {
      return null;
    }
    const badgeClass = percentile >= 75 ? 'percentile-high'
      : percentile >= 50 ? 'percentile-mid'
      : percentile >= 25 ? 'percentile-low'
      : 'percentile-bottom';
    return <span className={`percentile-badge ${badgeClass}`}>P{percentile}</span>;
  };

  // Render composite performance score badge (0-100)
  const renderPerformanceScore = (score) => {
    if (score === null || score === undefined) {
      return <span className="score-badge score-none" title="Performance score unavailable (need 10+ posts)">--</span>;
    }
    const badgeClass = score >= 70 ? 'score-high'
      : score >= 40 ? 'score-mid'
      : 'score-low';
    return <span className={`score-badge ${badgeClass}`} title={`Composite performance score: ${score}/100`}>{score}</span>;
  };

  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <h1>📊 Post Metrics</h1>
        </header>
        <SubNav />
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading post metrics...</p>
        </div>
      </div>
    );
  }

  if (!instagramConnected) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>📊 Post Metrics</h1>
            <p>Detailed metrics for all your published posts</p>
          </div>
        </header>
        <SubNav />

        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📸</div>
          <h2 style={{ marginBottom: '1rem' }}>Connect Instagram to Track Performance</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Link your Instagram Business account to see engagement metrics,<br />
            reach, and how your edits correlate with performance.
          </p>
          <Link href="/settings" className="btn btn-primary">
            Go to Settings →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>📊 Post Metrics</h1>
          <p>Detailed metrics for all your published posts</p>
        </div>
      </header>

      <SubNav />

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Best Posts */}
      {derivedData?.posts && (
        <div className="card">
          <BestPosts posts={derivedData.posts} />
        </div>
      )}

      {/* Smart Post Matching */}
      {instagramConnected && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">🔗 Smart Post Matching</h2>
          </div>
          <MatchReview />
        </div>
      )}

      {/* Published Posts with Component Rates */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📊 Published Posts</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {(derivedData?.posts || posts).length} post{(derivedData?.posts || posts).length !== 1 ? 's' : ''} tracked
          </span>
        </div>

        {(derivedData?.posts || posts).length === 0 ? (
          <div className="empty-state">
            <p>No published posts with metrics yet.<br />
            Publish posts to Instagram to start tracking performance.</p>
          </div>
        ) : (
          <div className="performance-list">
            {(derivedData?.posts || posts).map((post) => (
              <div key={post.id} className="performance-item">
                <div className="performance-item-header">
                  <div>
                    <span className="performance-topic">{post.topic}</span>
                    {renderPerformanceScore(post.performanceScore)}
                    <span className="performance-edits">✏️ {post.editCount} edits</span>
                  </div>
                  {post.instagramPermalink && (
                    <a
                      href={post.instagramPermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      View on IG →
                    </a>
                  )}
                </div>

                {post.metrics ? (
                  <>
                    {/* Raw metrics row */}
                    <div className="metrics-row-compact">
                      <span title="Reach">🎯 {renderMetric(post.metrics.reach)}</span>
                      <span title="Likes">❤️ {renderMetric(post.metrics.likes)}</span>
                      <span title="Comments">💬 {renderMetric(post.metrics.comments)}</span>
                      <span title="Saves">🔖 {renderMetric(post.metrics.saves)}</span>
                      <span title="Shares">↗️ {renderMetric(post.metrics.shares)}</span>
                    </div>

                    {/* Component rates with percentiles */}
                    {post.rates && (
                      <div className="rates-grid">
                        <div className="rate-item">
                          <div className="rate-value-row">
                            <span className="rate-value">{renderRate(post.rates.engagementRate)}</span>
                            {renderPercentile(post.percentiles?.engagementRate, post.percentiles?.insufficientData)}
                          </div>
                          <span className="rate-label">ER (by reach)</span>
                        </div>
                        <div className="rate-item">
                          <div className="rate-value-row">
                            <span className="rate-value">{renderRate(post.rates.saveRate)}</span>
                            {renderPercentile(post.percentiles?.saveRate, post.percentiles?.insufficientData)}
                          </div>
                          <span className="rate-label">Save Rate</span>
                        </div>
                        <div className="rate-item">
                          <div className="rate-value-row">
                            <span className="rate-value">{renderRate(post.rates.shareRate, 3)}</span>
                            {renderPercentile(post.percentiles?.shareRate, post.percentiles?.insufficientData)}
                          </div>
                          <span className="rate-label">Share Rate</span>
                        </div>
                        <div className="rate-item">
                          <div className="rate-value-row">
                            <span className="rate-value">{renderRate(post.rates.commentRate, 3)}</span>
                            {renderPercentile(post.percentiles?.commentRate, post.percentiles?.insufficientData)}
                          </div>
                          <span className="rate-label">Comment Rate</span>
                        </div>
                      </div>
                    )}

                    {post.percentiles?.insufficientData && (
                      <p className="insufficient-data-note">
                        Percentiles unavailable (need 10+ posts for baseline)
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Metrics not yet available. Click refresh to fetch latest data.
                  </p>
                )}

                <div className="performance-item-footer">
                  Published {new Date(post.publishedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {post.metrics?.lastUpdated && (
                    <span> • Metrics updated {new Date(post.metrics.lastUpdated).toLocaleDateString('en-GB')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Instagram Posts */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📸 Recent Instagram Posts</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadRecentPosts}
            disabled={loadingRecent}
          >
            {loadingRecent ? '🔄' : '🔄 Refresh'}
          </button>
        </div>

        {loadingRecent && recentPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading recent posts...</p>
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="empty-state">
            <p>No recent posts found.</p>
          </div>
        ) : (
          <div className="recent-posts-grid">
            {recentPosts.map((post) => (
              <div key={post.id} className="recent-post-card">
                <div className="recent-post-caption">
                  {post.caption || '(No caption)'}
                </div>
                <div className="recent-post-metrics">
                  <span title="Likes">❤️ {formatNumber(post.likes)}</span>
                  <span title="Comments">💬 {formatNumber(post.comments)}</span>
                  {post.views && <span title="Views">👁 {formatNumber(post.views)}</span>}
                  {post.reach && <span title="Reach">🎯 {formatNumber(post.reach)}</span>}
                  {post.saves && <span title="Saves">🔖 {formatNumber(post.saves)}</span>}
                  {post.shares && <span title="Shares">↗️ {formatNumber(post.shares)}</span>}
                </div>
                {post.engagementRate && (
                  <div className="recent-post-engagement">
                    {post.engagementRate}% engagement
                  </div>
                )}
                <div className="recent-post-footer">
                  <span className="recent-post-type">{post.mediaType}</span>
                  <span className="recent-post-date">
                    {new Date(post.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="recent-post-link"
                  >
                    View →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
