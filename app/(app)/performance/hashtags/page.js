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

function formatNumber(num) {
  if (num === null || num === undefined) return null;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// --- Sub-navigation ---
const SUB_NAV_ITEMS = [
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
      borderBottom: '1px solid var(--border-color, #2a2a2a)',
      paddingBottom: '0.75rem',
      flexWrap: 'wrap',
    }}>
      {SUB_NAV_ITEMS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
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

// --- Recommended Set Card ---
function RecommendedSetCard({ set }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(set.tags.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = set.tags.join(' ');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      background: 'var(--card-bg, #141414)',
      border: '1px solid var(--border-color, #2a2a2a)',
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #fff)', margin: 0 }}>
          {set.name}
        </h3>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'var(--success-color, #22c55e)' : 'var(--accent-color, #e1306c)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', margin: 0, lineHeight: 1.4 }}>
        {set.description}
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {set.engagementLiftAvg !== null && set.engagementLiftAvg !== undefined && (
          <span style={{
            background: set.engagementLiftAvg > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: set.engagementLiftAvg > 0 ? '#22c55e' : '#ef4444',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            {set.engagementLiftAvg > 0 ? '+' : ''}{set.engagementLiftAvg}% eng lift
          </span>
        )}
        {set.reachLiftAvg !== null && set.reachLiftAvg !== undefined && (
          <span style={{
            background: set.reachLiftAvg > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: set.reachLiftAvg > 0 ? '#3b82f6' : '#ef4444',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            {set.reachLiftAvg > 0 ? '+' : ''}{set.reachLiftAvg}% reach lift
          </span>
        )}
        <span style={{
          background: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--text-secondary, #aaa)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
        }}>
          {set.tags.length} tags
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {set.tags.map(tag => (
          <span
            key={tag}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary, #ccc)',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Hashtag Combinations ---
function HashtagCombinations({ hashtagSets }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!hashtagSets || hashtagSets.length === 0) {
    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Hashtag Combinations
        </h3>
        <p className="insufficient-data-note">
          No hashtag combination patterns found. Need at least 2 posts with similar hashtag sets and engagement data.
        </p>
      </div>
    );
  }

  const topIndex = 0; // First cluster has highest median engagement (pre-sorted)

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Hashtag Combinations
      </h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Groups of posts using similar hashtag sets (Jaccard similarity {'>'} = 0.7)
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {hashtagSets.map((cluster, i) => {
          const isTop = i === topIndex;
          const isExpanded = expandedIndex === i;
          return (
            <div
              key={i}
              style={{
                background: 'var(--bg-input)',
                border: isTop ? '1px solid var(--success)' : '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                position: 'relative',
              }}
            >
              {isTop && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '12px',
                  background: 'var(--success)',
                  color: '#000',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Top Performer
                </span>
              )}

              {/* Core tags as pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {cluster.coreTags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      background: isTop ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: isTop ? 'var(--success)' : 'var(--text-secondary)',
                      border: isTop ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border)',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Stats row */}
              <div style={{
                display: 'flex',
                gap: '1.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: cluster.tags.length > cluster.coreTags.length ? '0.5rem' : 0,
              }}>
                <span>{cluster.postCount} posts</span>
                <span style={{ color: isTop ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {cluster.medianEngagement}% median ER
                </span>
                {cluster.medianReach !== null && (
                  <span>{cluster.medianReach.toLocaleString()} median reach</span>
                )}
              </div>

              {/* Expandable full tag list */}
              {cluster.tags.length > cluster.coreTags.length && (
                <>
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '4px 0',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                    }}
                  >
                    {isExpanded ? 'Hide all tags' : `View all ${cluster.tags.length} tags`}
                  </button>
                  {isExpanded && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.3rem',
                      marginTop: '0.5rem',
                    }}>
                      {cluster.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            background: cluster.coreTags.includes(tag)
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(255, 255, 255, 0.03)',
                            color: cluster.coreTags.includes(tag) ? 'var(--text-secondary)' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: cluster.coreTags.includes(tag) ? 500 : 400,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Hashtags Page ---
export default function HashtagsPage() {
  const [hashtagData, setHashtagData] = useState(null);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkInstagramConnection();
    loadHashtagData();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await safeJson(res);
      if (data.connected) {
        setInstagramConnected(true);
      }
    } catch (err) {
      console.error('Failed to check Instagram connection:', err);
    }
  };

  const loadHashtagData = async () => {
    setLoadingHashtags(true);
    try {
      const res = await fetch('/api/hashtags');
      const data = await safeJson(res);
      if (data.success) {
        setHashtagData(data);
      }
    } catch (err) {
      console.error('Failed to load hashtag data:', err);
      setError(err.message);
    } finally {
      setLoadingHashtags(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>
      <PerformanceSubNav />

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: '1.5rem' }}>
        # Hashtag Analytics
      </h1>

      {!instagramConnected && !loadingHashtags && !hashtagData && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Connect your Instagram account to see hashtag analytics.
          </p>
          <Link
            href="/performance"
            style={{
              color: 'var(--accent-color, #e1306c)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--error, #ef4444)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          borderLeft: '3px solid var(--error, #ef4444)',
        }}>
          {error}
        </div>
      )}

      {/* Recommended Hashtag Sets */}
      {hashtagData?.recommendedSets?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Recommended Hashtag Sets</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Optimized sets generated from your performance data. Copy and paste directly into your posts.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1rem',
          }}>
            {hashtagData.recommendedSets.map((set, idx) => (
              <RecommendedSetCard key={idx} set={set} />
            ))}
          </div>
        </div>
      )}

      {/* Hashtag Analytics Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title"># Hashtag Analytics</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadHashtagData}
            disabled={loadingHashtags}
          >
            {loadingHashtags ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loadingHashtags && !hashtagData ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Analyzing hashtags...</p>
          </div>
        ) : !hashtagData || hashtagData.stats?.totalUnique === 0 ? (
          <div className="empty-state">
            <p>No hashtags found in your posts yet.<br/>Add hashtags to your posts to see analytics here.</p>
          </div>
        ) : (
          <>
            {/* Hashtag Overview Stats */}
            <div className="hashtag-overview">
              <div className="hashtag-stat">
                <span className="hashtag-stat-value">{hashtagData.stats.totalUnique}</span>
                <span className="hashtag-stat-label">Unique Hashtags</span>
              </div>
              <div className="hashtag-stat">
                <span className="hashtag-stat-value">{hashtagData.stats.totalUsage}</span>
                <span className="hashtag-stat-label">Total Usage</span>
              </div>
              <div className="hashtag-stat">
                <span className="hashtag-stat-value">{hashtagData.stats.avgPerPost}</span>
                <span className="hashtag-stat-label">Avg per Post</span>
              </div>
              <div className="hashtag-stat">
                <span className="hashtag-stat-value">{hashtagData.postsWithHashtags}</span>
                <span className="hashtag-stat-label">Posts with #</span>
              </div>
            </div>

            {/* Hashtag Health */}
            {hashtagData.rotation && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Hashtag Health
                </h3>

                {/* Warning banners */}
                {hashtagData.rotation.warnings.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {hashtagData.rotation.warnings.map((w, i) => (
                      <div
                        key={i}
                        style={{
                          background: w.severity === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'var(--warning-soft)',
                          color: w.severity === 'error' ? 'var(--error)' : 'var(--warning)',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          borderLeft: `3px solid ${w.severity === 'error' ? 'var(--error)' : 'var(--warning)'}`,
                        }}
                      >
                        {w.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Streak indicator */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  background: hashtagData.rotation.currentStreak <= 2
                    ? 'var(--success-soft)'
                    : hashtagData.rotation.currentStreak <= 4
                      ? 'var(--warning-soft)'
                      : 'rgba(239, 68, 68, 0.12)',
                  color: hashtagData.rotation.currentStreak <= 2
                    ? 'var(--success)'
                    : hashtagData.rotation.currentStreak <= 4
                      ? 'var(--warning)'
                      : 'var(--error)',
                }}>
                  <span style={{ fontWeight: 600 }}>{hashtagData.rotation.currentStreak}</span>
                  <span>consecutive posts with similar hashtag sets</span>
                  {hashtagData.rotation.longestStreak > hashtagData.rotation.currentStreak && (
                    <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>
                      (longest: {hashtagData.rotation.longestStreak})
                    </span>
                  )}
                </div>

                {/* Overused hashtags */}
                {hashtagData.rotation.stalenessScores.filter(s => s.status !== 'healthy').length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Overused / Moderate Tags
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {hashtagData.rotation.stalenessScores
                        .filter(s => s.status !== 'healthy')
                        .slice(0, 10)
                        .map(tag => (
                          <div
                            key={tag.hashtag}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.4rem 0',
                            }}
                          >
                            <span style={{
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              minWidth: '120px',
                            }}>
                              {tag.hashtag}
                            </span>
                            <div style={{
                              flex: 1,
                              maxWidth: '120px',
                              height: '6px',
                              borderRadius: '3px',
                              background: 'var(--bg-secondary)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${Math.round(tag.staleness * 100)}%`,
                                height: '100%',
                                borderRadius: '3px',
                                background: tag.status === 'overused'
                                  ? 'var(--error)'
                                  : 'var(--warning)',
                              }} />
                            </div>
                            <span style={{
                              fontSize: '0.75rem',
                              color: tag.status === 'overused' ? 'var(--error)' : 'var(--warning)',
                              minWidth: '60px',
                            }}>
                              {Math.round(tag.staleness * 100)}% used
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: tag.status === 'overused'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'var(--warning-soft)',
                              color: tag.status === 'overused'
                                ? 'var(--error)'
                                : 'var(--warning)',
                            }}>
                              {tag.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Underused gems */}
                {hashtagData.rotation.underusedGems.length > 0 && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Fresh Alternatives — High performers you haven't used recently
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {hashtagData.rotation.underusedGems.map(gem => (
                        <div
                          key={gem.hashtag}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            background: 'var(--success-soft)',
                          }}
                        >
                          <span style={{
                            fontSize: '0.85rem',
                            color: 'var(--success)',
                            fontWeight: 500,
                            minWidth: '120px',
                          }}>
                            {gem.hashtag}
                          </span>
                          <span style={{
                            fontSize: '0.8rem',
                            color: 'var(--success)',
                          }}>
                            +{gem.engagementLift}% lift
                          </span>
                          {gem.lastUsedPostsAgo !== null && (
                            <span style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}>
                              last used {gem.lastUsedPostsAgo} post{gem.lastUsedPostsAgo !== 1 ? 's' : ''} ago
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Most Used Hashtags */}
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Most Used Hashtags</h3>
              <div className="hashtag-cloud">
                {hashtagData.stats.top.slice(0, 15).map((tag, i) => (
                  <span
                    key={tag.hashtag}
                    className="hashtag-pill"
                    style={{
                      fontSize: `${Math.max(0.75, Math.min(1.2, 0.75 + tag.count * 0.1))}rem`,
                      opacity: Math.max(0.6, 1 - i * 0.03),
                    }}
                  >
                    {tag.hashtag}
                    <span className="hashtag-count">{tag.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Trending Hashtags */}
            {hashtagData.trending && hashtagData.trending.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Trending (Last 30 Days)
                </h3>
                <div className="hashtag-list">
                  {hashtagData.trending.slice(0, 5).map((tag) => (
                    <div key={tag.hashtag} className="hashtag-trend-item">
                      <span className="hashtag-name">{tag.hashtag}</span>
                      <span className="hashtag-usage">
                        {tag.previousCount} &rarr; {tag.recentCount}
                      </span>
                      <span className={`hashtag-growth ${tag.growth > 0 ? 'positive' : tag.growth < 0 ? 'negative' : ''}`}>
                        {tag.growth > 0 ? '\u2191' : tag.growth < 0 ? '\u2193' : '\u2192'} {Math.abs(tag.growth)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Star Performers */}
            {hashtagData.dualPerformers && hashtagData.dualPerformers.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Star Performers
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Top 10 for both engagement and reach lift
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {hashtagData.dualPerformers.map((dp) => (
                    <div key={dp.hashtag} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.15), rgba(34, 197, 94, 0.15))',
                      border: '1px solid rgba(225, 48, 108, 0.3)',
                      borderRadius: '8px', padding: '0.5rem 0.75rem',
                    }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {dp.hashtag}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, borderRadius: '4px',
                        padding: '2px 6px', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e',
                      }}>
                        +{(dp.engagement.liftScore)}% ER
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, borderRadius: '4px',
                        padding: '2px 6px', background: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa',
                      }}>
                        +{Math.round(dp.reach.shrinkageReachLift * 100)}% reach
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dual Ranking: Engagement + Reach columns */}
            {(hashtagData.correlations || hashtagData.reachCorrelations) && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Hashtag Rankings (min n={hashtagData.correlations?.minNRequired || hashtagData.reachCorrelations?.minNRequired || 5})
                </h3>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
                }}>
                  {/* Best for Engagement */}
                  <div style={{
                    background: 'var(--card-bg, #141414)', borderRadius: '8px',
                    padding: '1rem', border: '1px solid var(--border-color, #2a2a2a)',
                  }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Best for Engagement
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Baseline ER: {hashtagData.correlations?.baselineMean ?? '\u2014'}%
                    </p>
                    {hashtagData.correlations?.bestPerforming?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {hashtagData.correlations.bestPerforming.slice(0, 10).map((tag, i) => {
                          const isDual = hashtagData.dualPerformers?.some(dp => dp.hashtag === tag.hashtag);
                          return (
                            <div key={tag.hashtag} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.35rem 0.5rem', borderRadius: '6px',
                              background: isDual ? 'rgba(225, 48, 108, 0.08)' : 'transparent',
                            }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '1.5rem' }}>
                                #{i + 1}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', flex: 1 }}>
                                {tag.hashtag}
                                {isDual && <span style={{ marginLeft: '4px', fontSize: '0.7rem' }} title="Star performer">*</span>}
                              </span>
                              <span style={{
                                fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px',
                                padding: '2px 6px',
                                background: tag.liftScore > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: tag.liftScore > 0 ? '#22c55e' : '#ef4444',
                              }}>
                                {tag.liftScore > 0 ? '+' : ''}{tag.liftScore}%
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                n={tag.postCount}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="insufficient-data-note">
                        No hashtags with positive engagement lift yet.
                      </p>
                    )}
                  </div>

                  {/* Best for Reach */}
                  <div style={{
                    background: 'var(--card-bg, #141414)', borderRadius: '8px',
                    padding: '1rem', border: '1px solid var(--border-color, #2a2a2a)',
                  }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Best for Reach
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Baseline median: {hashtagData.reachCorrelations?.baselineMedianReach != null
                        ? formatNumber(hashtagData.reachCorrelations.baselineMedianReach)
                        : '\u2014'}
                    </p>
                    {hashtagData.reachCorrelations?.bestPerforming?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {hashtagData.reachCorrelations.bestPerforming.slice(0, 10).map((tag, i) => {
                          const isDual = hashtagData.dualPerformers?.some(dp => dp.hashtag === tag.hashtag);
                          return (
                            <div key={tag.hashtag} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.35rem 0.5rem', borderRadius: '6px',
                              background: isDual ? 'rgba(225, 48, 108, 0.08)' : 'transparent',
                            }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '1.5rem' }}>
                                #{i + 1}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', flex: 1 }}>
                                {tag.hashtag}
                                {isDual && <span style={{ marginLeft: '4px', fontSize: '0.7rem' }} title="Star performer">*</span>}
                              </span>
                              <span style={{
                                fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px',
                                padding: '2px 6px',
                                background: tag.shrinkageReachLift > 0 ? 'rgba(96, 165, 250, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: tag.shrinkageReachLift > 0 ? '#60a5fa' : '#ef4444',
                              }}>
                                {tag.shrinkageReachLift > 0 ? '+' : ''}{Math.round(tag.shrinkageReachLift * 100)}%
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                n={tag.postCount}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="insufficient-data-note">
                        No hashtags with positive reach lift yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Negative Lift Hashtags */}
            {hashtagData.correlations && hashtagData.correlations.worstPerforming?.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Negative Engagement Lift (Consider Replacing)
                </h3>
                <div className="hashtag-performance-list">
                  {hashtagData.correlations.worstPerforming.slice(0, 5).map((tag) => (
                    <div key={tag.hashtag} className="hashtag-performance-item low-performing">
                      <span className="hashtag-name">{tag.hashtag}</span>
                      <div className="hashtag-metrics">
                        <span className="hashtag-lift negative">{tag.liftScore}% lift</span>
                        <span className="hashtag-engagement">{tag.tagMean}% ER</span>
                        <span className="hashtag-posts">n={tag.postCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtag Combinations */}
            <HashtagCombinations hashtagSets={hashtagData.hashtagSets} />
          </>
        )}
      </div>
    </div>
  );
}
