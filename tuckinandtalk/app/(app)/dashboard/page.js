'use client';

import { useState, useEffect, useCallback } from 'react';
import MetricCard from '../../components/MetricCard.js';
import { formatNumber, formatPercent, computeNonFollowerRatio, formatDate } from '../../../lib/utils.js';

export default function DashboardPage() {
  const [account, setAccount] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountRes, snapshotsRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/dashboard/snapshots'),
      ]);

      const accountData = await accountRes.json();
      const snapshotsData = await snapshotsRes.json();

      if (accountData.success) setAccount(accountData.account);
      if (snapshotsData.success) setSnapshots(snapshotsData.snapshots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/insights/weekly');
      const data = await res.json();
      if (data.success) {
        setSyncMessage('Weekly snapshot updated.');
        fetchData();
      } else {
        setSyncMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const latest = snapshots[0] || null;
  const previous = snapshots[1] || null;

  const nonFollowerRatio = latest
    ? computeNonFollowerRatio(latest.reach_non_follower, latest.reach_follower)
    : null;

  const trendReach =
    latest?.reach_total && previous?.reach_total
      ? ((latest.reach_total - previous.reach_total) / previous.reach_total) * 100
      : null;

  // Build trend chart data (last 12 weeks)
  const chartData = [...snapshots].reverse().slice(0, 12);
  const maxReach = Math.max(...chartData.map((s) => s.reach_total || 0), 1);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <div className="connect-cta">
          <h2>Connect Instagram</h2>
          <p>
            Link your @tuckinandtalk Instagram Business Account to start tracking
            weekly reach, non-follower amplification, and content performance.
          </p>
          <a href="/api/auth" className="btn btn-primary">
            Connect with Facebook
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Weekly Heartbeat</h1>
          <p>Account-level reach and amplification — updated every Monday</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleSync}
          disabled={syncing}
          style={{ marginTop: 4 }}
        >
          {syncing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Syncing…</> : 'Sync Now'}
        </button>
      </div>

      {syncMessage && (
        <div className={`alert ${syncMessage.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>
          {syncMessage}
        </div>
      )}

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {/* Current week headline metrics */}
      {latest ? (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Total Reach"
              value={formatNumber(latest.reach_total)}
              sub={`Week of ${formatDate(latest.week_start)}`}
              trend={trendReach}
            />
            <MetricCard
              label="Non-Follower Reach"
              value={nonFollowerRatio !== null ? formatPercent(nonFollowerRatio) : '—'}
              sub={`${formatNumber(latest.reach_non_follower)} non-followers reached`}
              accent="terra"
            >
              {nonFollowerRatio !== null && (
                <div className="ratio-bar" style={{ marginTop: 8 }}>
                  <div
                    className="ratio-bar-fill"
                    style={{ width: `${Math.min(nonFollowerRatio * 100, 100).toFixed(1)}%` }}
                  />
                </div>
              )}
            </MetricCard>
            <MetricCard
              label="Follower Reach"
              value={formatNumber(latest.reach_follower)}
              sub="Existing audience"
            />
            <MetricCard
              label="Total Views"
              value={formatNumber(latest.views_total)}
              sub={`Feed: ${formatNumber(latest.views_feed)} · Reels: ${formatNumber(latest.views_reels)}`}
            />
            <MetricCard
              label="Saves"
              value={formatNumber(latest.saves)}
              sub="Bookmarks this week"
              accent="mustard"
            />
            <MetricCard
              label="Shares"
              value={formatNumber(latest.shares)}
              sub="Post shares this week"
            />
            <MetricCard
              label="Accounts Engaged"
              value={formatNumber(latest.accounts_engaged)}
              sub="Unique accounts who interacted"
            />
            <MetricCard
              label="Followers"
              value={formatNumber(latest.followers_count)}
              sub="Current follower count"
            />
          </div>

          {/* Views breakdown */}
          <div className="card" style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16, fontWeight: 400 }}>Views by Format</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: 'Feed / Posts', value: latest.views_feed, total: latest.views_total },
                { label: 'Reels', value: latest.views_reels, total: latest.views_total },
                { label: 'Stories', value: latest.views_story, total: latest.views_total },
              ].map((row) => {
                const pct = row.total ? (row.value / row.total) * 100 : 0;
                return (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-number)' }}>
                        {formatPercent(pct, true)}
                      </span>
                    </div>
                    <div className="ratio-bar">
                      <div
                        className="ratio-bar-fill"
                        style={{
                          width: `${pct.toFixed(1)}%`,
                          background: row.label === 'Reels' ? 'var(--accent-terra)' : 'var(--accent-mustard)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {formatNumber(row.value)} views
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 12-week trend chart */}
          {chartData.length > 1 && (
            <div className="card">
              <h3 style={{ marginBottom: 20, fontWeight: 400 }}>12-Week Reach Trend</h3>
              <div className="trend-chart" style={{ height: 80, gap: 6 }}>
                {chartData.map((snap, i) => {
                  const height = maxReach > 0 ? ((snap.reach_total || 0) / maxReach) * 100 : 0;
                  const isLatest = i === chartData.length - 1;
                  return (
                    <div key={snap.id || i} className="trend-bar-wrap">
                      <div
                        className="trend-bar"
                        style={{
                          height: `${height}%`,
                          opacity: isLatest ? 1 : 0.55,
                          background: isLatest ? 'var(--accent-terra)' : 'var(--accent-terra)',
                        }}
                        title={`${formatDate(snap.week_start)}: ${formatNumber(snap.reach_total)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span className="trend-label">{formatDate(chartData[0]?.week_start)}</span>
                <span className="trend-label">{formatDate(chartData[chartData.length - 1]?.week_start)}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h3>No snapshot data yet</h3>
          <p>
            Click &quot;Sync Now&quot; to pull your first weekly heartbeat from Instagram.
            The sync captures reach, views, saves, shares, and accounts engaged,
            broken down by format and follow type.
          </p>
        </div>
      )}
    </div>
  );
}
