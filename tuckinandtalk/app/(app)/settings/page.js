'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDate, daysUntil } from '../../../lib/utils.js';

export default function SettingsPage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);

  // Read URL params for auth feedback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth_success')) {
        setMessage({ type: 'success', text: 'Instagram account connected successfully.' });
        window.history.replaceState({}, '', '/settings');
      }
      if (params.get('auth_error')) {
        setMessage({ type: 'error', text: params.get('auth_error') });
        window.history.replaceState({}, '', '/settings');
      }
    }
  }, []);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account');
      const data = await res.json();
      if (data.success) setAccount(data.account);
      else setAccount(null);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Instagram account? This will delete the stored access token.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAccount(null);
        setMessage({ type: 'success', text: 'Account disconnected.' });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/token/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Token refreshed. New expiry: ${formatDate(data.tokenExpiresAt)}` });
        fetchAccount();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRefreshing(false);
    }
  };

  const tokenDot = !account
    ? null
    : account.tokenStatus === 'valid'
    ? 'valid'
    : account.tokenStatus === 'expiring_soon'
    ? 'expiring'
    : account.tokenStatus === 'expired'
    ? 'expired'
    : 'unknown';

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Connect your Instagram account and configure data collection</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 24 }}>
          {message.text}
        </div>
      )}

      {/* Instagram Connection */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontWeight: 400 }}>Instagram Connection</h3>

        {loading ? (
          <div className="loading-state" style={{ padding: '24px 0' }}>
            <div className="spinner" />
            <span>Loading account status…</span>
          </div>
        ) : account ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', color: 'var(--accent-terra)', marginBottom: 4 }}>
                  @{account.username || 'unknown'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  IG User ID: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{account.instagramUserId}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', color: 'var(--text-number)' }}>
                  {account.followersCount?.toLocaleString() ?? '—'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>followers</div>
              </div>
            </div>

            {/* Token status */}
            <div style={{ padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Access Token
                </div>
                <div className="token-status">
                  <div className={`token-dot ${tokenDot}`} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {account.tokenStatus === 'valid' && `Valid — expires ${formatDate(account.tokenExpiresAt)} (${account.daysRemaining} days)`}
                    {account.tokenStatus === 'expiring_soon' && `Expiring soon — ${account.daysRemaining} days left`}
                    {account.tokenStatus === 'expired' && 'Token expired — reconnect your account'}
                    {account.tokenStatus === 'unknown' && 'Unknown expiry'}
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRefreshToken}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing…' : 'Refresh Token'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/api/auth" className="btn btn-primary">Reconnect Account</a>
              <button className="btn btn-danger" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Connect your @tuckinandtalk Instagram Business Account to start tracking
              performance metrics. You&apos;ll need to authorize via Facebook Login for Business.
            </p>
            <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Permissions Requested
              </div>
              {[
                'instagram_basic — read your account',
                'instagram_manage_insights — access post and account metrics',
                'read_insights — account-level insights',
                'pages_show_list — list your Facebook Pages',
                'pages_read_engagement — page engagement metrics',
                'business_management — Business Discovery API for competitor data',
              ].map((perm) => (
                <div key={perm} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '2px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--status-green)', marginTop: 2 }}>✓</span>
                  <span>{perm}</span>
                </div>
              ))}
            </div>
            <a href="/api/auth" className="btn btn-primary">
              Connect with Facebook Login
            </a>
          </div>
        )}
      </div>

      {/* Data collection schedule */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontWeight: 400 }}>Data Collection</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              name: 'Weekly Heartbeat',
              freq: 'Every Monday',
              desc: 'Account-level reach, views, saves, shares broken down by format and follow type.',
              endpoint: '/api/insights/weekly',
            },
            {
              name: 'Post Insights',
              freq: 'On demand / daily cron',
              desc: 'Fetches metrics for all posts published 48h+ ago without existing metrics.',
              endpoint: '/api/insights/posts',
            },
            {
              name: 'Hashtag Audit',
              freq: 'Monthly (manual)',
              desc: 'Checks top_media for each configured hashtag. Limited to 30 per 7-day window.',
              endpoint: '/api/hashtags/audit',
            },
            {
              name: 'Competitor Snapshot',
              freq: 'Monthly (manual)',
              desc: 'Business Discovery for each tracked account — followers, post count, engagement rate.',
              endpoint: '/api/competitors/snapshot',
            },
          ].map((job) => (
            <div key={job.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{job.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{job.desc}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-mustard)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 2 }}>{job.freq}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{job.endpoint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cron setup */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontWeight: 400 }}>Automated Cron</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          To run post insights automatically, set a cron job to call the endpoint below
          with the <code style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--bg-base)', padding: '1px 4px', borderRadius: 3 }}>x-cron-secret</code> header.
        </p>
        <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', overflowX: 'auto' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}># Daily at 5am</div>
          <div>0 5 * * * curl -s -H &quot;x-cron-secret: $TAT_CRON_SECRET&quot; \</div>
          <div>&nbsp;&nbsp;http://localhost:3001/api/insights/posts</div>
        </div>
        <div style={{ marginTop: 12, background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', overflowX: 'auto' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}># Every Monday 9am for weekly snapshot</div>
          <div>0 9 * * 1 curl -s -H &quot;x-cron-secret: $TAT_CRON_SECRET&quot; \</div>
          <div>&nbsp;&nbsp;http://localhost:3001/api/insights/weekly</div>
        </div>
      </div>
    </div>
  );
}
