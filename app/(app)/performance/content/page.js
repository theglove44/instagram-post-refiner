'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Safe JSON parser — handles non-JSON error responses from the server
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `Request failed with status ${res.status}`);
  }
}

// Format number for display, handling null/undefined
function formatNumber(num) {
  if (num === null || num === undefined) return null;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Render rate value with percentage, or N/A
function renderRate(value, decimals = 2) {
  if (value === null || value === undefined) {
    return <span className="metric-na" title="Cannot calculate: reach unavailable">N/A</span>;
  }
  return `${value.toFixed(decimals)}%`;
}

// Render metric value or N/A with tooltip
function renderMetric(value) {
  if (value === null || value === undefined) {
    return (
      <span className="metric-na" title="Not provided by Instagram API for this media/account or not available yet.">
        N/A
      </span>
    );
  }
  return formatNumber(value);
}

const SUB_NAV_LINKS = [
  { href: '/performance', label: 'Dashboard' },
  { href: '/performance/posts', label: 'Post Metrics' },
  { href: '/performance/timing', label: 'Timing' },
  { href: '/performance/content', label: 'Content' },
  { href: '/performance/hashtags', label: 'Hashtags' },
  { href: '/performance/audience', label: 'Audience' },
];

function PerformanceSubNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      gap: '0.25rem',
      marginBottom: '1.5rem',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      padding: '0.25rem 0',
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
              color: isActive ? '#fff' : 'var(--text-muted, #888)',
              background: isActive ? 'var(--accent-color, #e1306c)' : 'transparent',
              border: isActive ? 'none' : '1px solid var(--border-color, #2a2a2a)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function ContentAnalysisPage() {
  const [loading, setLoading] = useState(true);
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
        // Load metrics and derived data in parallel
        await Promise.all([
          loadMetrics(),
          loadDerivedMetrics(),
        ]);
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

    // Group by edit count ranges
    const lowEdits = postsWithMetrics.filter(p => p.editCount <= 3);
    const mediumEdits = postsWithMetrics.filter(p => p.editCount > 3 && p.editCount <= 7);
    const highEdits = postsWithMetrics.filter(p => p.editCount > 7);

    // Calculate averages ignoring null values
    const avgEngagement = (posts) => {
      const validPosts = posts.filter(p =>
        p.metrics?.engagementRate !== null && p.metrics?.engagementRate !== undefined
      );
      if (validPosts.length === 0) return null;
      return validPosts.reduce((sum, p) => sum + parseFloat(p.metrics.engagementRate), 0) / validPosts.length;
    };

    const avgReach = (posts) => {
      const validPosts = posts.filter(p =>
        p.metrics?.reach !== null && p.metrics?.reach !== undefined
      );
      if (validPosts.length === 0) return null;
      return validPosts.reduce((sum, p) => sum + p.metrics.reach, 0) / validPosts.length;
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

  // Not connected state
  if (!instagramConnected && !loading) {
    return (
      <div>
        <PerformanceSubNav />
        <div className="card">
          <div className="empty-state">
            <p>Connect your Instagram account to see content analysis.</p>
            <Link href="/settings" style={{
              display: 'inline-block',
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              background: 'var(--accent-color, #e1306c)',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}>
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div>
        <PerformanceSubNav />
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
            Loading content analysis...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <PerformanceSubNav />
        <div className="card">
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--error-color, #ef4444)' }}>
            <p>Failed to load content analysis: {error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); checkInstagramConnection(); }}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1.25rem',
                background: 'var(--accent-color, #e1306c)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasContentType = derivedData?.contentTypeBreakdown && derivedData.contentTypeBreakdown.length > 0;
  const hasCaptionAnalysis = derivedData?.captionAnalysis;
  const hasAnyData = correlationData || hasContentType || hasCaptionAnalysis;

  return (
    <div>
      <PerformanceSubNav />

      {!hasAnyData && (
        <div className="card">
          <div className="empty-state">
            <p>No content analysis data yet.<br />
            Publish and log more posts to start seeing content patterns.</p>
          </div>
        </div>
      )}

      {/* Cross-Format Comparison */}
      {hasContentType && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Cross-Format Comparison</h2>
          </div>
          <div className="content-type-grid">
            {derivedData.contentTypeBreakdown.map((ct) => (
              <div key={ct.type} className="content-type-card">
                <div className="content-type-header">
                  <span className="content-type-name">
                    {ct.type}
                  </span>
                  <span className="content-type-count">
                    {ct.count} post{ct.count !== 1 ? 's' : ''}
                  </span>
                </div>
                {ct.insufficientData && (
                  <div className="content-type-warning">Small sample (n={ct.count})</div>
                )}
                <div className="content-type-stats">
                  <div className="content-type-stat">
                    <span className="content-type-stat-value">{renderRate(ct.medianEngagementRate)}</span>
                    <span className="content-type-stat-label">Engagement</span>
                  </div>
                  <div className="content-type-stat">
                    <span className="content-type-stat-value">{renderRate(ct.medianSaveRate)}</span>
                    <span className="content-type-stat-label">Save Rate</span>
                  </div>
                  <div className="content-type-stat">
                    <span className="content-type-stat-value">{renderRate(ct.medianShareRate, 3)}</span>
                    <span className="content-type-stat-label">Share Rate</span>
                  </div>
                  <div className="content-type-stat">
                    <span className="content-type-stat-value">{ct.medianReach !== null ? formatNumber(ct.medianReach) : <span className="metric-na">N/A</span>}</span>
                    <span className="content-type-stat-label">Reach</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {derivedData.contentTypeBreakdown.length >= 2 && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                Format Insights
              </h3>
              {(() => {
                const sorted = [...derivedData.contentTypeBreakdown].filter(ct => ct.medianEngagementRate != null);
                const bestEngagement = sorted.sort((a, b) => (b.medianEngagementRate || 0) - (a.medianEngagementRate || 0))[0];
                const bestReach = [...derivedData.contentTypeBreakdown].filter(ct => ct.medianReach != null)
                  .sort((a, b) => (b.medianReach || 0) - (a.medianReach || 0))[0];

                const formatName = (type) => type === 'Reel' ? 'Reels' : 'Posts';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {bestEngagement && (
                      <div>
                        <span style={{ color: '#22c55e', fontWeight: 500 }}>{formatName(bestEngagement.type)}</span>
                        {' '}drive the highest engagement ({bestEngagement.medianEngagementRate?.toFixed(2)}% median ER)
                      </div>
                    )}
                    {bestReach && bestReach.type !== bestEngagement?.type && (
                      <div>
                        <span style={{ color: '#3b82f6', fontWeight: 500 }}>{formatName(bestReach.type)}</span>
                        {' '}get the most reach ({formatNumber(bestReach.medianReach)} median)
                      </div>
                    )}
                    {derivedData.contentTypeBreakdown.map(ct => {
                      const total = derivedData.contentTypeBreakdown.reduce((sum, c) => sum + c.count, 0);
                      const pct = total > 0 ? ((ct.count / total) * 100).toFixed(0) : 0;
                      return (
                        <div key={ct.type} style={{ color: 'var(--text-muted)' }}>
                          {formatName(ct.type)}: {pct}% of your content ({ct.count} posts)
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Edits vs Performance Correlation */}
      {correlationData && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Edits vs Performance Correlation</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Based on {correlationData.totalPosts} published posts with metrics
          </p>

          <div className="correlation-grid">
            <div className="correlation-card">
              <div className="correlation-label">Low Edits (1-3)</div>
              <div className="correlation-value">
                {correlationData.lowEdits.avgEngagement !== null ? `${correlationData.lowEdits.avgEngagement}%` : renderMetric(null)}
              </div>
              <div className="correlation-sublabel">avg engagement</div>
              <div className="correlation-meta">
                {correlationData.lowEdits.count} posts • {correlationData.lowEdits.avgReach !== null ? `${formatNumber(correlationData.lowEdits.avgReach)} avg reach` : 'N/A reach'}
              </div>
            </div>
            <div className="correlation-card">
              <div className="correlation-label">Medium Edits (4-7)</div>
              <div className="correlation-value">
                {correlationData.mediumEdits.avgEngagement !== null ? `${correlationData.mediumEdits.avgEngagement}%` : renderMetric(null)}
              </div>
              <div className="correlation-sublabel">avg engagement</div>
              <div className="correlation-meta">
                {correlationData.mediumEdits.count} posts • {correlationData.mediumEdits.avgReach !== null ? `${formatNumber(correlationData.mediumEdits.avgReach)} avg reach` : 'N/A reach'}
              </div>
            </div>
            <div className="correlation-card">
              <div className="correlation-label">High Edits (8+)</div>
              <div className="correlation-value">
                {correlationData.highEdits.avgEngagement !== null ? `${correlationData.highEdits.avgEngagement}%` : renderMetric(null)}
              </div>
              <div className="correlation-sublabel">avg engagement</div>
              <div className="correlation-meta">
                {correlationData.highEdits.count} posts • {correlationData.highEdits.avgReach !== null ? `${formatNumber(correlationData.highEdits.avgReach)} avg reach` : 'N/A reach'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <strong>Insight:</strong>{' '}
              {correlationData.highEdits.avgEngagement === null || correlationData.lowEdits.avgEngagement === null
                ? 'Not enough data with metrics yet. Link more posts to Instagram to see patterns.'
                : parseFloat(correlationData.highEdits.avgEngagement) > parseFloat(correlationData.lowEdits.avgEngagement)
                ? 'Posts with more edits tend to perform better! Your refinement process is paying off.'
                : parseFloat(correlationData.lowEdits.avgEngagement) > parseFloat(correlationData.highEdits.avgEngagement)
                ? 'Posts with fewer edits are performing well. Claude may be getting better at matching your voice.'
                : 'Edit count doesn\'t seem to significantly impact performance yet. Keep logging more posts for clearer patterns.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Caption Length vs Performance */}
      {hasCaptionAnalysis && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Caption Length vs Performance</h2>
          </div>

          {derivedData.captionAnalysis.buckets.every(b => b.count === 0) ? (
            <div className="empty-state">
              <p>No posts with caption data and metrics yet.<br />
              Publish posts to Instagram to start seeing caption length patterns.</p>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                Median engagement rate by caption length bucket
              </p>

              <div className="analysis-bar-list">
                {derivedData.captionAnalysis.buckets.map(bucket => {
                  const maxEngagement = Math.max(
                    ...derivedData.captionAnalysis.buckets
                      .filter(b => b.medianEngagement !== null)
                      .map(b => b.medianEngagement),
                    1
                  );
                  const widthPct = bucket.medianEngagement !== null
                    ? Math.max((bucket.medianEngagement / maxEngagement) * 100, 4)
                    : 0;
                  const isOptimal = bucket.label === derivedData.captionAnalysis.optimalBucket;

                  return (
                    <div key={bucket.label} className={`analysis-bar-item ${isOptimal ? 'optimal' : ''}`}>
                      <div className="analysis-bar-label">
                        <span className="analysis-bar-name">{bucket.label}</span>
                        <span className="analysis-bar-meta">{bucket.count} post{bucket.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="analysis-bar-track">
                        {bucket.medianEngagement !== null ? (
                          <div
                            className={`analysis-bar-fill ${isOptimal ? 'optimal' : ''}`}
                            style={{ width: `${widthPct}%` }}
                          >
                            <span className="analysis-bar-value">{bucket.medianEngagement.toFixed(2)}%</span>
                          </div>
                        ) : (
                          <span className="analysis-bar-na">No data</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {derivedData.captionAnalysis.optimalBucket && (
                <div className="recommendation-text">
                  <strong>Recommendation:</strong> {derivedData.captionAnalysis.recommendation}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
