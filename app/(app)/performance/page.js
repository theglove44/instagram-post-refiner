'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MilestoneMarkers from '@/app/components/MilestoneMarkers';

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

// Render rate value with percentage
function renderRate(value, decimals = 2) {
  if (value === null || value === undefined) {
    return <span className="metric-na" title="Cannot calculate: reach unavailable">N/A</span>;
  }
  return `${value.toFixed(decimals)}%`;
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/performance' },
  { label: 'Post Metrics', href: '/performance/posts' },
  { label: 'Timing', href: '/performance/timing' },
  { label: 'Content', href: '/performance/content' },
  { label: 'Hashtags', href: '/performance/hashtags' },
  { label: 'Audience', href: '/performance/audience' },
];

function PerformanceNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
      marginBottom: '1.5rem',
    }}>
      {NAV_ITEMS.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'var(--text-muted, #888)',
              background: isActive ? 'rgba(225, 48, 108, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: isActive ? '1px solid rgba(225, 48, 108, 0.4)' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [dataHealth, setDataHealth] = useState(null);
  const [derivedData, setDerivedData] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [growthDays, setGrowthDays] = useState(30);
  const [refreshDays, setRefreshDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  useEffect(() => {
    checkInstagramConnection();
    loadDataHealth();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await safeJson(res);

      if (data.connected) {
        setInstagramConnected(true);
        // Load dashboard-specific data in parallel
        await Promise.all([
          loadDerivedMetrics(),
          loadGrowthData(),
        ]);
      } else {
        setInstagramConnected(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const loadMetrics = async () => {
    try {
      const res = await fetch('/api/instagram/metrics');
      const data = await safeJson(res);
      if (data.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
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

  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <h1>Performance Dashboard</h1>
        </header>
        <PerformanceNav />
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
            <h1>Performance Dashboard</h1>
            <p>Track how your posts perform on Instagram</p>
          </div>
        </header>
        <PerformanceNav />

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
          <h1>Performance Dashboard</h1>
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
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
        </div>
      </header>

      <PerformanceNav />

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
            <h2 className="card-title">Data Health</h2>
            <span className={`health-status ${dataHealth.lastSyncStatus}`}>
              {dataHealth.lastSyncStatus === 'success' ? 'Healthy' :
               dataHealth.lastSyncStatus === 'error' ? 'Issues' :
               'No sync yet'}
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

      {/* Rate Summary (28-day medians) */}
      {derivedData?.summary && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Rate Summary (Last 28 Days)</h2>
            {derivedData.delta && (
              <span className={`delta-badge ${derivedData.delta.delta >= 0 ? 'positive' : 'negative'}`}>
                {derivedData.delta.delta >= 0 ? '\u2191' : '\u2193'} {Math.abs(derivedData.delta.delta)}% vs prev
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            Median rates from {derivedData.summary.postCount} posts {'\u2022'} Baseline: {derivedData.baselineSize} posts
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

      {/* Follower Growth */}
      <div className="card growth-chart-card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Follower Growth</h2>
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
                {growthData.growth.daily30dAvg !== null && ` \u2014 30d avg: ${growthData.growth.daily30dAvg >= 0 ? '+' : ''}${growthData.growth.daily30dAvg}/day`}
              </div>
            )}
          </>
        )}
      </div>

      {/* Follower Milestones */}
      {growthData && (
        <MilestoneMarkers
          milestones={growthData.milestones || []}
          nextMilestone={growthData.nextMilestone || null}
        />
      )}
    </div>
  );
}
