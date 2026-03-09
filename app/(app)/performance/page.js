'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MilestoneMarkers from '@/app/components/MilestoneMarkers';
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

function HashtagCombinations({ hashtagSets }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!hashtagSets || hashtagSets.length === 0) {
    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          🔗 Hashtag Combinations
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
        🔗 Hashtag Combinations
      </h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Groups of posts using similar hashtag sets (Jaccard similarity {'>'}= 0.7)
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

export default function PerformancePage() {
  const [posts, setPosts] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [accountInsights, setAccountInsights] = useState(null);
  const [timeAnalysis, setTimeAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [correlationData, setCorrelationData] = useState(null);
  const [hashtagData, setHashtagData] = useState(null);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [dataHealth, setDataHealth] = useState(null);
  const [derivedData, setDerivedData] = useState(null);
  const [refreshDays, setRefreshDays] = useState(30);
  const [refreshResult, setRefreshResult] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [growthDays, setGrowthDays] = useState(30);
  const [storyData, setStoryData] = useState(null);
  const [loadingStories, setLoadingStories] = useState(false);
  const [syncingStories, setSyncingStories] = useState(false);

  useEffect(() => {
    checkInstagramConnection();
    loadHashtagData();
    loadDataHealth();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await safeJson(res);
      
      if (data.connected) {
        setInstagramConnected(true);
        loadMetrics();
        loadRecentPosts();
        loadAccountInsights();
        loadDerivedMetrics();
        loadGrowthData();
        loadStoryData();
      } else {
        setInstagramConnected(false);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
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
        if (data.timeAnalysis) {
          setTimeAnalysis(data.timeAnalysis);
        }
      }
    } catch (err) {
      console.error('Failed to load recent posts:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  const loadAccountInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch('/api/instagram/insights');
      const data = await safeJson(res);
      
      if (data.error) {
        console.error('Account insights error:', data.error);
      } else {
        setAccountInsights(data);
      }
    } catch (err) {
      console.error('Failed to load account insights:', err);
    } finally {
      setLoadingInsights(false);
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

  const refreshMetrics = async () => {
    setRefreshing(true);
    setError(null);
    setRefreshResult(null);
    try {
      const res = await fetch('/api/instagram/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: refreshDays }),
      });
      const data = await safeJson(res);

      if (!data.success) {
        throw new Error(data.error || 'Failed to start metrics refresh');
      }

      // Poll sync status until complete
      // Timeout scales with post count: ~36s per post + 2 min buffer
      const syncId = data.syncId;
      const postCount = data.postCount || 0;
      const estimatedSeconds = postCount * 36 + 120;
      const maxPolls = Math.max(60, Math.ceil(estimatedSeconds / 10)); // poll every 10s
      let syncResult = null;
      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise(r => setTimeout(r, 10000));
        const healthRes = await fetch(`/api/instagram/health?_t=${Date.now()}`);
        const healthData = await safeJson(healthRes);
        const metricSync = healthData.health?.syncHistory?.metrics;

        // Update progress message
        if (postCount > 0) {
          const elapsed = (poll + 1) * 10;
          const estimatedDone = Math.min(postCount, Math.floor(elapsed / 36));
          setRefreshResult(`Processing ${estimatedDone}/${postCount} posts... (~${Math.ceil((estimatedSeconds - elapsed) / 60)} min remaining)`);
        }

        if (metricSync && metricSync.id === syncId && metricSync.status !== 'running') {
          if (metricSync.status === 'error') {
            throw new Error(metricSync.error_details?.message || 'Metrics refresh failed');
          }
          syncResult = metricSync;
          break;
        }
      }
      if (!syncResult) {
        throw new Error(`Metrics refresh timed out after ${Math.ceil(estimatedSeconds / 60)} minutes. The background process may still be running — check back shortly.`);
      }

      // Show result summary
      const processed = syncResult?.posts_processed || 0;
      const errors = syncResult?.errors_count || 0;
      if (processed === 0) {
        setRefreshResult(`No posts found published in the last ${refreshDays} day${refreshDays === 1 ? '' : 's'}. Try a longer timeframe.`);
      } else {
        setRefreshResult(`Updated metrics for ${processed} post${processed === 1 ? '' : 's'}${errors > 0 ? ` (${errors} error${errors === 1 ? '' : 's'})` : ''}.`);
      }

      // Reload all data sections that depend on metrics
      await Promise.all([
        loadMetrics(),
        loadDataHealth(),
        loadDerivedMetrics(),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
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
    } finally {
      setLoadingHashtags(false);
    }
  };

  const loadDataHealth = async () => {
    try {
      const res = await fetch('/api/instagram/health');
      const data = await safeJson(res);
      if (data.success) {
        setDataHealth(data.health);
      }
    } catch (err) {
      console.error('Failed to load data health:', err);
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

  const loadGrowthData = async (days) => {
    const d = days ?? growthDays;
    setLoadingGrowth(true);
    try {
      const res = await fetch(`/api/instagram/growth?days=${d}`);
      const data = await safeJson(res);
      if (data.error) {
        console.error('Growth data error:', data.error);
      } else {
        setGrowthData(data);
      }
    } catch (err) {
      console.error('Failed to load growth data:', err);
    } finally {
      setLoadingGrowth(false);
    }
  };

  const loadStoryData = async () => {
    setLoadingStories(true);
    try {
      const res = await fetch('/api/instagram/stories');
      const data = await safeJson(res);
      if (!data.error) setStoryData(data);
    } catch (err) {
      console.error('Failed to load stories:', err);
    } finally {
      setLoadingStories(false);
    }
  };

  const syncStories = async () => {
    setSyncingStories(true);
    try {
      const res = await fetch('/api/instagram/stories', { method: 'POST' });
      const data = await safeJson(res);
      if (data.success) {
        setTimeout(() => { loadStoryData(); setSyncingStories(false); }, 5000);
      } else {
        setSyncingStories(false);
      }
    } catch (err) {
      console.error('Failed to sync stories:', err);
      setSyncingStories(false);
    }
  };

  const handleGrowthDaysChange = (newDays) => {
    setGrowthDays(newDays);
    loadGrowthData(newDays);
  };

  // Build SVG polyline for the growth chart
  const renderGrowthChart = () => {
    const snapshots = growthData?.snapshots || [];
    if (snapshots.length < 2) return null;

    const followers = snapshots.map(s => s.followers_count).filter(v => v !== null);
    if (followers.length < 2) return null;

    const minVal = Math.min(...followers);
    const maxVal = Math.max(...followers);
    const range = maxVal - minVal || 1;

    const chartWidth = 800;
    const chartHeight = 200;
    const padTop = 20;
    const padBottom = 30;
    const padLeft = 10;
    const padRight = 10;
    const plotWidth = chartWidth - padLeft - padRight;
    const plotHeight = chartHeight - padTop - padBottom;

    // Build polyline points
    const points = followers.map((val, i) => {
      const x = padLeft + (i / (followers.length - 1)) * plotWidth;
      const y = padTop + plotHeight - ((val - minVal) / range) * plotHeight;
      return `${x},${y}`;
    }).join(' ');

    // Build area fill path
    const firstX = padLeft;
    const lastX = padLeft + plotWidth;
    const areaPath = `M${firstX},${padTop + plotHeight} ` +
      followers.map((val, i) => {
        const x = padLeft + (i / (followers.length - 1)) * plotWidth;
        const y = padTop + plotHeight - ((val - minVal) / range) * plotHeight;
        return `L${x},${y}`;
      }).join(' ') +
      ` L${lastX},${padTop + plotHeight} Z`;

    // X-axis labels (show ~5 dates evenly spaced)
    const labelCount = Math.min(5, snapshots.length);
    const labelIndices = Array.from({ length: labelCount }, (_, i) =>
      Math.round((i / (labelCount - 1)) * (snapshots.length - 1))
    );

    // Y-axis: show min and max
    const yLabels = [
      { val: maxVal, y: padTop },
      { val: minVal, y: padTop + plotHeight },
    ];
    if (range > 0) {
      const midVal = Math.round(minVal + range / 2);
      yLabels.splice(1, 0, { val: midVal, y: padTop + plotHeight / 2 });
    }

    return (
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="growth-chart-svg"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <line
            key={i}
            x1={padLeft}
            y1={label.y}
            x2={chartWidth - padRight}
            y2={label.y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#growthGradient)"
          opacity="0.3"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* X-axis date labels */}
        {labelIndices.map((idx) => {
          const x = padLeft + (idx / (snapshots.length - 1)) * plotWidth;
          const date = new Date(snapshots[idx].snapshot_date);
          const label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return (
            <text
              key={idx}
              x={x}
              y={chartHeight - 5}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="11"
              fontFamily="inherit"
            >
              {label}
            </text>
          );
        })}

        {/* Y-axis labels */}
        {yLabels.map((label, i) => (
          <text
            key={`y-${i}`}
            x={chartWidth - padRight - 5}
            y={label.y - 5}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="inherit"
          >
            {formatNumber(label.val)}
          </text>
        ))}

        {/* Endpoint dot */}
        {(() => {
          const lastIdx = followers.length - 1;
          const cx = padLeft + (lastIdx / (followers.length - 1)) * plotWidth;
          const cy = padTop + plotHeight - ((followers[lastIdx] - minVal) / range) * plotHeight;
          return <circle cx={cx} cy={cy} r="4" fill="var(--accent)" />;
        })()}
      </svg>
    );
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

  // Format number for display, handling null/undefined
  const formatNumber = (num) => {
    if (num === null || num === undefined) return null;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Render metric value or N/A with tooltip
  const renderMetric = (value, label = '') => {
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
          <h1>📈 Performance</h1>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (!instagramConnected) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>📈 Performance</h1>
            <p>Track how your posts perform on Instagram</p>
          </div>
        </header>

        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📸</div>
          <h2 style={{ marginBottom: '1rem' }}>Connect Instagram to Track Performance</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Link your Instagram Business account to see engagement metrics,<br/>
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
          <h1>📈 Performance</h1>
          <p>Track how your posts perform on Instagram</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={refreshDays}
            onChange={(e) => setRefreshDays(Number(e.target.value))}
            disabled={refreshing}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            className="btn btn-secondary"
            onClick={refreshMetrics}
            disabled={refreshing}
          >
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Metrics'}
          </button>
        </div>
      </header>

      {refreshResult && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: refreshResult.includes('No posts') ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          border: `1px solid ${refreshResult.includes('No posts') ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          color: refreshResult.includes('No posts') ? '#eab308' : '#22c55e',
          fontSize: '0.85rem',
          marginBottom: '0.5rem',
        }}>
          {refreshResult}
        </div>
      )}

      {error && (
        <div className="card" style={{ marginTop: '1.5rem', background: 'var(--error-soft)', borderColor: 'var(--error)' }}>
          <p style={{ color: 'var(--error)' }}>Error: {error}</p>
        </div>
      )}

      {/* Data Health Panel */}
      {dataHealth && (
        <div className="card data-health-card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">🩺 Data Health</h2>
            <span className={`health-status ${dataHealth.lastSyncStatus}`}>
              {dataHealth.lastSyncStatus === 'success' ? '✓ Healthy' : 
               dataHealth.lastSyncStatus === 'error' ? '⚠ Issues' : 
               '○ No sync yet'}
            </span>
          </div>
          <div className="data-health-grid">
            <div className="health-stat">
              <span className="health-stat-label">Last Sync</span>
              <span className="health-stat-value">
                {dataHealth.lastSyncAt 
                  ? new Date(dataHealth.lastSyncAt).toLocaleString('en-GB', { 
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                    })
                  : 'Never'}
              </span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">Missing Metrics</span>
              <span className="health-stat-value" style={{ color: dataHealth.nullMetricsPercent > 30 ? 'var(--warning)' : 'var(--text)' }}>
                {dataHealth.nullMetricsPercent}%
              </span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">Recent Errors</span>
              <span className="health-stat-value" style={{ color: dataHealth.recentErrors > 0 ? 'var(--error)' : 'var(--success)' }}>
                {dataHealth.recentErrors}
              </span>
            </div>
          </div>
          {dataHealth.fieldHealth && dataHealth.fieldHealth.some(f => f.missing > 0) && (
            <details className="health-details">
              <summary>View metric availability</summary>
              <div className="field-health-list">
                {dataHealth.fieldHealth.map(field => (
                  <div key={field.field} className="field-health-item">
                    <span className="field-name">{field.field}</span>
                    <div className="field-bar">
                      <div 
                        className="field-bar-fill" 
                        style={{ width: `${field.availablePercent}%` }}
                      />
                    </div>
                    <span className="field-percent">{field.availablePercent}%</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Follower Growth */}
      {instagramConnected && (
        <div className="card growth-chart-card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📈 Follower Growth</h2>
            <div className="growth-timeframe-selector">
              {[
                { label: '7d', value: 7 },
                { label: '30d', value: 30 },
                { label: '90d', value: 90 },
                { label: 'All', value: 'all' },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  className={`growth-timeframe-btn ${growthDays === value ? 'active' : ''}`}
                  onClick={() => handleGrowthDaysChange(value)}
                  disabled={loadingGrowth}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadingGrowth && !growthData ? (
            <div className="empty-state">
              <div className="spinner" />
              <p>Loading growth data...</p>
            </div>
          ) : !growthData?.snapshots || growthData.snapshots.length < 2 ? (
            <div className="empty-state">
              <p>No growth data yet. Daily snapshots start recording automatically.</p>
            </div>
          ) : (
            <>
              <div className="growth-stats">
                <div className="growth-stat-item">
                  <span className="growth-stat-value">
                    {formatNumber(growthData.snapshots[growthData.snapshots.length - 1].followers_count)}
                  </span>
                  <span className="growth-stat-label">Current Followers</span>
                </div>
                <div className="growth-stat-item">
                  <span className="growth-stat-value" style={{ color: growthData.growth.totalGrowth >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {growthData.growth.totalGrowth >= 0 ? '+' : ''}{formatNumber(growthData.growth.totalGrowth)}
                  </span>
                  <span className="growth-stat-label">Total Change</span>
                </div>
                <div className="growth-stat-item">
                  <span className="growth-stat-value">
                    {growthData.growth.daily7dAvg !== null
                      ? `${growthData.growth.daily7dAvg >= 0 ? '+' : ''}${growthData.growth.daily7dAvg}/day`
                      : 'N/A'}
                  </span>
                  <span className="growth-stat-label">7d Avg</span>
                </div>
                <div className="growth-stat-item">
                  <span className="growth-stat-value" style={{ color: growthData.growth.growthPercent >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {growthData.growth.growthPercent >= 0 ? '+' : ''}{growthData.growth.growthPercent}%
                  </span>
                  <span className="growth-stat-label">Growth Rate</span>
                </div>
              </div>

              <div className="growth-chart-container">
                {renderGrowthChart()}
              </div>

              {growthData.growth.periodDays > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.5rem' }}>
                  Showing {growthData.growth.periodDays} day{growthData.growth.periodDays !== 1 ? 's' : ''} of data
                  {growthData.growth.daily30dAvg !== null && ` — 30d avg: ${growthData.growth.daily30dAvg >= 0 ? '+' : ''}${growthData.growth.daily30dAvg}/day`}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Follower Milestones */}
      {instagramConnected && growthData && (
        <MilestoneMarkers
          milestones={growthData.milestones || []}
          nextMilestone={growthData.nextMilestone || null}
        />
      )}

      {/* Account Overview */}
      {accountInsights && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">👤 Account Overview</h2>
          </div>
          <div className="account-overview-grid">
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.account?.followers)}</span>
              <span className="account-stat-label">Followers</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.account?.posts)}</span>
              <span className="account-stat-label">Posts</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.insights?.reach)}</span>
              <span className="account-stat-label">Reach (28d)</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.insights?.accountsEngaged)}</span>
              <span className="account-stat-label">Engaged (28d)</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.insights?.profileViews)}</span>
              <span className="account-stat-label">Profile Views</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.insights?.websiteClicks)}</span>
              <span className="account-stat-label">Website Clicks</span>
            </div>
          </div>
          
          {/* Demographics */}
          {accountInsights.demographics && (
            <div className="demographics-section">
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Audience Demographics</h3>
              <div className="demographics-grid">
                {accountInsights.demographics.gender && (
                  <div className="demo-card">
                    <div className="demo-title">Gender Split</div>
                    <div className="demo-bar">
                      <div 
                        className="demo-bar-fill male" 
                        style={{ width: `${(accountInsights.demographics.gender.male / (accountInsights.demographics.gender.male + accountInsights.demographics.gender.female) * 100)}%` }}
                      />
                    </div>
                    <div className="demo-labels">
                      <span>♂ {Math.round(accountInsights.demographics.gender.male / (accountInsights.demographics.gender.male + accountInsights.demographics.gender.female) * 100)}%</span>
                      <span>♀ {Math.round(accountInsights.demographics.gender.female / (accountInsights.demographics.gender.male + accountInsights.demographics.gender.female) * 100)}%</span>
                    </div>
                  </div>
                )}
                {accountInsights.demographics.topCountries && (
                  <div className="demo-card">
                    <div className="demo-title">Top Countries</div>
                    {accountInsights.demographics.topCountries.slice(0, 3).map((c, i) => (
                      <div key={i} className="demo-item">
                        <span>{c.country}</span>
                        <span>{formatNumber(c.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {accountInsights.demographics.topCities && (
                  <div className="demo-card">
                    <div className="demo-title">Top Cities</div>
                    {accountInsights.demographics.topCities.slice(0, 3).map((c, i) => (
                      <div key={i} className="demo-item">
                        <span>{c.city}</span>
                        <span>{formatNumber(c.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Best Times to Post — Heatmap (#37) & Post Now Indicator (#38) */}
      {derivedData?.timeAnalysis ? (() => {
        const ta = derivedData.timeAnalysis;
        const { heatmap, hourly, daily, bestHour, bestDay, bestSlot, globalMedianEngagement, totalPostsAnalyzed } = ta;

        // Current time lookups
        const now = new Date();
        const currentDow = now.getDay(); // 0=Sun
        const currentHour = now.getHours();
        const currentSlot = heatmap?.find(s => s.day === currentDow && s.hour === currentHour);

        // Percentile rank of current slot among slots with data
        const slotsWithData = (heatmap || []).filter(s => s.postCount > 0);
        let percentileRank = 50;
        if (currentSlot && currentSlot.postCount > 0 && slotsWithData.length > 0) {
          const lowerCount = slotsWithData.filter(s => s.shrinkageScore < currentSlot.shrinkageScore).length;
          percentileRank = (lowerCount / slotsWithData.length) * 100;
        }
        const isGreen = percentileRank >= 75;
        const isAmber = percentileRank >= 50 && percentileRank < 75;
        const trafficColor = isGreen ? 'var(--success)' : isAmber ? 'var(--warning)' : 'var(--error)';
        const trafficBg = isGreen ? 'var(--success-soft)' : isAmber ? 'var(--warning-soft)' : 'var(--error-soft)';
        const trafficText = isGreen ? 'Great time to post!' : isAmber ? 'Decent time to post' : 'Not ideal — consider waiting';

        // Day/hour labels
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const formatHourLabel = (h) => {
          if (h === 0) return '12a';
          if (h < 12) return `${h}a`;
          if (h === 12) return '12p';
          return `${h - 12}p`;
        };

        // Reorder heatmap rows: Monday-first (1,2,3,4,5,6,0)
        const mondayFirstOrder = [1, 2, 3, 4, 5, 6, 0];
        const mondayDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Compute heatmap color range
        const scores = (heatmap || []).filter(s => s.postCount > 0).map(s => s.shrinkageScore);
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 1;
        const scoreRange = maxScore - minScore || 1;

        const getCellColor = (slot) => {
          if (!slot || slot.postCount === 0) return 'rgba(255,255,255,0.03)';
          const t = (slot.shrinkageScore - minScore) / scoreRange; // 0=worst, 1=best
          // Interpolate: red(0) -> amber(0.5) -> green(1)
          if (t < 0.5) {
            const p = t / 0.5;
            const r = Math.round(239 + (234 - 239) * p);
            const g = Math.round(68 + (179 - 68) * p);
            const b = Math.round(68 + (8 - 68) * p);
            const a = 0.15 + (0.3 - 0.15) * p;
            return `rgba(${r},${g},${b},${a})`;
          }
          const p = (t - 0.5) / 0.5;
          const r = Math.round(234 + (34 - 234) * p);
          const g = Math.round(179 + (197 - 179) * p);
          const b = Math.round(8 + (94 - 8) * p);
          const a = 0.3 + (0.5 - 0.3) * p;
          return `rgba(${r},${g},${b},${a})`;
        };

        const isBestSlot = (day, hour) =>
          bestSlot && bestSlot.day === day && bestSlot.hour === hour;

        // Reorder daily array to Monday-first
        const dailyMonFirst = mondayFirstOrder.map(d => (daily || []).find(dd => dd.day === d)).filter(Boolean);

        // Top 5 hours sorted by shrinkageScore descending
        const topHours = [...(hourly || [])]
          .filter(h => h.postCount > 0)
          .sort((a, b) => b.shrinkageScore - a.shrinkageScore)
          .slice(0, 5);

        // Check if bestSlot is "now"
        const bestSlotIsNow = bestSlot && bestSlot.day === currentDow && bestSlot.hour === currentHour;

        return (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">⏰ Best Times to Post</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              Engagement heatmap from {totalPostsAnalyzed || 0} posts — shrinkage-adjusted scores
            </p>

            {/* Post Now? indicator (#38) */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)',
              background: trafficBg, border: `1px solid ${trafficColor}33`,
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', background: trafficColor,
                  display: 'inline-block', flexShrink: 0,
                  boxShadow: `0 0 8px ${trafficColor}`,
                }} />
                <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>
                  {trafficText}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {dayNames[currentDow]} {formatHourLabel(currentHour)}
                  {currentSlot?.postCount > 0 && ` — ${currentSlot.medianEngagement}% median ER`}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Your audience is most active on{' '}
                <strong style={{ color: 'var(--text)' }}>{bestDay?.label || 'N/A'}</strong> at{' '}
                <strong style={{ color: 'var(--text)' }}>{bestHour?.label || 'N/A'}</strong>
              </div>
              {bestSlot && !bestSlotIsNow && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Next best window: <strong style={{ color: 'var(--text-secondary)' }}>
                    {bestSlot.dayLabel} {bestSlot.hourLabel}
                  </strong>
                </div>
              )}
            </div>

            {/* 7x24 Heatmap Grid (#37) */}
            {heatmap && heatmap.length > 0 && (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '42px repeat(24, 30px)',
                  gridTemplateRows: 'auto repeat(7, 30px)',
                  gap: 2, minWidth: '42px + 24 * 32px',
                  width: 'fit-content',
                }}>
                  {/* Column header: hours */}
                  <div /> {/* empty top-left corner */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={`h-${h}`} style={{
                      fontSize: '0.65rem', color: 'var(--text-muted)',
                      textAlign: 'center', lineHeight: '20px',
                    }}>
                      {h % 3 === 0 ? formatHourLabel(h) : ''}
                    </div>
                  ))}

                  {/* Rows: days (Monday-first) */}
                  {mondayFirstOrder.map((dayIdx, rowIdx) => (
                    <React.Fragment key={`row-${dayIdx}`}>
                      {/* Row label */}
                      <div style={{
                        fontSize: '0.75rem', color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', paddingRight: 6,
                        position: 'sticky', left: 0, background: 'var(--bg-card)',
                        zIndex: 1,
                      }}>
                        {mondayDayLabels[rowIdx]}
                      </div>
                      {/* 24 hour cells */}
                      {Array.from({ length: 24 }, (_, h) => {
                        const slot = heatmap.find(s => s.day === dayIdx && s.hour === h);
                        const best = isBestSlot(dayIdx, h);
                        const isNow = dayIdx === currentDow && h === currentHour;
                        return (
                          <div
                            key={`c-${dayIdx}-${h}`}
                            title={slot
                              ? `${dayNamesFull[dayIdx]} ${formatHourLabel(h)}: ${slot.postCount} post${slot.postCount !== 1 ? 's' : ''}, ${slot.medianEngagement}% engagement`
                              : `${dayNamesFull[dayIdx]} ${formatHourLabel(h)}: no data`}
                            style={{
                              width: 30, height: 30, borderRadius: 4,
                              background: getCellColor(slot),
                              border: best
                                ? '2px solid var(--success)'
                                : isNow
                                  ? '2px solid var(--accent)'
                                  : '1px solid rgba(255,255,255,0.04)',
                              cursor: 'default',
                              transition: 'transform 0.1s ease',
                            }}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>

                {/* Legend */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                }}>
                  <span>Low</span>
                  <div style={{
                    display: 'flex', gap: 1,
                  }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                      const fakeSlot = { postCount: 1, shrinkageScore: minScore + t * scoreRange };
                      return (
                        <div key={t} style={{
                          width: 16, height: 10, borderRadius: 2,
                          background: getCellColor(fakeSlot),
                        }} />
                      );
                    })}
                  </div>
                  <span>High</span>
                  <span style={{ marginLeft: '0.75rem' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', verticalAlign: 'middle', marginRight: 3 }} />
                    No data
                  </span>
                  <span style={{ marginLeft: '0.75rem' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, border: '2px solid var(--success)', verticalAlign: 'middle', marginRight: 3 }} />
                    Best
                  </span>
                  <span style={{ marginLeft: '0.5rem' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, border: '2px solid var(--accent)', verticalAlign: 'middle', marginRight: 3 }} />
                    Now
                  </span>
                </div>
              </div>
            )}

            {/* Daily engagement pills */}
            {dailyMonFirst.length > 0 && (() => {
              const maxDayScore = Math.max(...dailyMonFirst.map(d => d.shrinkageScore || 0));
              return (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Engagement by Day
                  </h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {dailyMonFirst.map((d) => {
                      const intensity = maxDayScore > 0 ? d.shrinkageScore / maxDayScore : 0;
                      const isBest = bestDay && d.day === bestDay.day;
                      return (
                        <div key={d.day} title={`${d.label}: ${d.medianEngagement}% ER, ${d.postCount} posts`} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                          background: `rgba(34, 197, 94, ${0.08 + intensity * 0.35})`,
                          border: isBest ? '1px solid var(--success)' : '1px solid var(--border)',
                          minWidth: 52,
                        }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{d.label.slice(0, 3)}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.medianEngagement}%</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>n={d.postCount}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Top 5 posting hours */}
            {topHours.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Top Posting Hours
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {topHours.map((h, i) => (
                    <div key={h.hour} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                      background: i === 0 ? 'var(--success-soft)' : 'var(--bg-input)',
                      border: i === 0 ? '1px solid rgba(0,210,106,0.2)' : '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 24 }}>#{i + 1}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', minWidth: 42 }}>
                        {h.label}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {h.medianEngagement}% ER
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {h.postCount} post{h.postCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })() : (
        /* Fallback if no derived timeAnalysis — show old timeAnalysis from recent endpoint */
        timeAnalysis && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">⏰ Best Times to Post</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Not enough data for the engagement heatmap yet. Publish more posts to unlock time analysis.
            </p>
          </div>
        )
      )}

      {/* Correlation Analysis */}
      {correlationData && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">🔗 Edits vs Performance Correlation</h2>
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

      {/* Caption Length Analysis (#33) */}
      {derivedData?.captionAnalysis && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📏 Caption Length vs Performance</h2>
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

      {/* Posting Frequency Analysis (#34, #39) */}
      {derivedData?.frequencyAnalysis && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📅 Posting Cadence</h2>
          </div>

          {derivedData.frequencyAnalysis.buckets.every(b => b.count === 0) ? (
            <div className="empty-state">
              <p>No weekly posting data available yet.<br />
              Publish posts across multiple weeks to see frequency patterns.</p>
            </div>
          ) : (
            <>
              {/* Recommendation hero */}
              {derivedData.frequencyAnalysis.optimalBucket && (() => {
                const freq = derivedData.frequencyAnalysis;
                const bucketLabel = freq.optimalBucket;
                const bestBucket = freq.buckets.find(b => b.label === bucketLabel);
                const totalWeeks = freq.buckets.reduce((sum, b) => sum + b.count, 0);

                // Calculate % higher engagement vs other buckets
                const otherBuckets = freq.buckets.filter(
                  b => b.label !== bucketLabel && b.medianEngagement !== null && b.count > 0
                );
                const otherAvg = otherBuckets.length > 0
                  ? otherBuckets.reduce((sum, b) => sum + b.medianEngagement, 0) / otherBuckets.length
                  : null;
                const pctHigher = otherAvg && bestBucket?.medianEngagement
                  ? Math.round(((bestBucket.medianEngagement - otherAvg) / otherAvg) * 100)
                  : null;

                // Extract the range text (e.g. "2-3" from "2-3 posts/week")
                const rangeText = bucketLabel.replace(' posts/week', '').replace(' post/week', '');

                const confidenceColor = freq.confidenceLevel === 'high'
                  ? 'var(--success)'
                  : freq.confidenceLevel === 'medium'
                    ? 'var(--warning)'
                    : 'var(--text-muted)';
                const confidenceBg = freq.confidenceLevel === 'high'
                  ? 'var(--success-soft)'
                  : freq.confidenceLevel === 'medium'
                    ? 'var(--warning-soft)'
                    : 'rgba(255,255,255,0.06)';

                return (
                  <div style={{
                    padding: '1.25rem',
                    background: 'var(--accent-soft)',
                    border: '1px solid rgba(225, 48, 108, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
                        Aim for {rangeText} post{rangeText === '1' ? '' : 's'} per week
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        background: confidenceBg,
                        color: confidenceColor,
                      }}>
                        {freq.confidenceLevel} confidence
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                      Based on {totalWeeks} week{totalWeeks !== 1 ? 's' : ''} of data
                      {pctHigher !== null && pctHigher > 0
                        ? `, your engagement is ${pctHigher}% higher when posting ${rangeText} time${rangeText === '1' ? '' : 's'} per week`
                        : ''}
                    </p>
                  </div>
                );
              })()}

              {/* This week's progress */}
              {derivedData.frequencyAnalysis.currentWeekTarget !== null && (() => {
                const freq = derivedData.frequencyAnalysis;
                const current = freq.currentWeekPosts;
                const target = freq.currentWeekTarget;
                const pct = Math.min((current / target) * 100, 100);
                const isComplete = current >= target;

                return (
                  <div style={{
                    padding: '1rem 1.25rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1.5rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        This week
                      </span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: isComplete ? 'var(--success)' : 'var(--text)',
                      }}>
                        {current} of {target} post{target !== 1 ? 's' : ''}
                        {isComplete ? ' \u2713' : ''}
                      </span>
                    </div>
                    <div style={{
                      height: '6px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isComplete ? 'var(--success)' : 'var(--accent)',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })()}

              {/* Frequency bucket breakdown */}
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                Median engagement rate grouped by how many posts you published per week
              </p>

              <div className="analysis-bar-list">
                {derivedData.frequencyAnalysis.buckets.map(bucket => {
                  const maxEngagement = Math.max(
                    ...derivedData.frequencyAnalysis.buckets
                      .filter(b => b.medianEngagement !== null)
                      .map(b => b.medianEngagement),
                    1
                  );
                  const widthPct = bucket.medianEngagement !== null
                    ? Math.max((bucket.medianEngagement / maxEngagement) * 100, 4)
                    : 0;
                  const isOptimal = bucket.label === derivedData.frequencyAnalysis.optimalBucket;

                  return (
                    <div key={bucket.label} className={`analysis-bar-item ${isOptimal ? 'optimal' : ''}`}>
                      <div className="analysis-bar-label">
                        <span className="analysis-bar-name">{bucket.label}</span>
                        <span className="analysis-bar-meta">
                          {bucket.count} week{bucket.count !== 1 ? 's' : ''}
                          {bucket.medianEngagement !== null ? ` \u00b7 ${bucket.medianEngagement.toFixed(2)}% ER` : ''}
                        </span>
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
            </>
          )}
        </div>
      )}

      {/* Rate Summary (28-day medians) */}
      {derivedData?.summary && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📈 Rate Summary (Last 28 Days)</h2>
            {derivedData.delta && (
              <span className={`delta-badge ${derivedData.delta.delta >= 0 ? 'positive' : 'negative'}`}>
                {derivedData.delta.delta >= 0 ? '↑' : '↓'} {Math.abs(derivedData.delta.delta)}% vs prev
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            Median rates from {derivedData.summary.postCount} posts • Baseline: {derivedData.baselineSize} posts
          </p>
          <div className="rate-summary-grid">
            <div className="rate-summary-item">
              <span className="rate-summary-value">{renderRate(derivedData.summary.engagementRate)}</span>
              <span className="rate-summary-label">ER (by reach)</span>
            </div>
            <div className="rate-summary-item">
              <span className="rate-summary-value">{renderRate(derivedData.summary.saveRate)}</span>
              <span className="rate-summary-label">Save Rate</span>
            </div>
            <div className="rate-summary-item">
              <span className="rate-summary-value">{renderRate(derivedData.summary.shareRate, 3)}</span>
              <span className="rate-summary-label">Share Rate</span>
            </div>
            <div className="rate-summary-item">
              <span className="rate-summary-value">{renderRate(derivedData.summary.commentRate, 3)}</span>
              <span className="rate-summary-label">Comment Rate</span>
            </div>
            <div className="rate-summary-item">
              <span className="rate-summary-value">{renderRate(derivedData.summary.likeRate)}</span>
              <span className="rate-summary-label">Like Rate</span>
            </div>
          </div>
        </div>
      )}

      {/* Stories Insights */}
      {instagramConnected && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Stories Insights</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={syncStories}
              disabled={syncingStories}
            >
              {syncingStories ? 'Syncing...' : 'Sync Stories'}
            </button>
          </div>
          {loadingStories ? (
            <div className="loading-spinner" />
          ) : !storyData || storyData.stories?.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No story data yet. Sync your current stories to start tracking.
            </p>
          ) : (
            <>
              <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="stat-card">
                  <span className="stat-value">{storyData.summary.totalStories}</span>
                  <span className="stat-label">Stories Tracked</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{formatNumber(storyData.summary.avgReach)}</span>
                  <span className="stat-label">Avg Reach</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {storyData.summary.avgCompletionRate > 0
                      ? `${(storyData.summary.avgCompletionRate * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                  <span className="stat-label">Completion Rate</span>
                </div>
              </div>

              {/* Recent stories list - show last 10 */}
              <div style={{ fontSize: '0.85rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Recent Stories
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {storyData.stories.slice(0, 10).map(story => {
                    const completionRate = story.impressions > 0 && story.exits !== null
                      ? ((1 - story.exits / story.impressions) * 100).toFixed(1)
                      : null;
                    return (
                      <div key={story.instagram_media_id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                      }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {story.posted_at ? new Date(story.posted_at).toLocaleDateString() : '—'}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {story.media_type === 'VIDEO' ? 'Video' : 'Image'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <span>Reach: {story.reach ?? '—'}</span>
                          <span>Replies: {story.replies ?? '—'}</span>
                          <span style={{
                            color: completionRate && parseFloat(completionRate) > 70 ? '#22c55e' :
                                   completionRate && parseFloat(completionRate) < 40 ? '#ef4444' : 'var(--text-secondary)'
                          }}>
                            {completionRate ? `${completionRate}% complete` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Content Type Performance */}
      {derivedData?.contentTypeBreakdown && derivedData.contentTypeBreakdown.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
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

      {/* Best Posts */}
      {derivedData?.posts && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
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
            <p>No published posts with metrics yet.<br/>
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

      {/* Recommended Hashtag Sets */}
      {hashtagData?.recommendedSets?.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
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

      {/* Hashtag Analytics */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title"># Hashtag Analytics</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadHashtagData}
            disabled={loadingHashtags}
          >
            {loadingHashtags ? '🔄' : '🔄 Refresh'}
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
                        {w.type === 'consecutive_reuse' ? '🔁' : '⚠️'} {w.message}
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

            {/* Trending Hashtags - show underlying counts */}
            {hashtagData.trending && hashtagData.trending.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  📈 Trending (Last 30 Days)
                </h3>
                <div className="hashtag-list">
                  {hashtagData.trending.slice(0, 5).map((tag) => (
                    <div key={tag.hashtag} className="hashtag-trend-item">
                      <span className="hashtag-name">{tag.hashtag}</span>
                      <span className="hashtag-usage">
                        {tag.previousCount} → {tag.recentCount}
                      </span>
                      <span className={`hashtag-growth ${tag.growth > 0 ? 'positive' : tag.growth < 0 ? 'negative' : ''}`}>
                        {tag.growth > 0 ? '↑' : tag.growth < 0 ? '↓' : '→'} {Math.abs(tag.growth)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Star Performers — hashtags in top 10 for BOTH engagement AND reach */}
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
                      Baseline ER: {hashtagData.correlations?.baselineMean ?? '—'}%
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
                        : '—'}
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
