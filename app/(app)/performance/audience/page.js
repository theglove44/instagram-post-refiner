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

const SUB_NAV_ITEMS = [
  { label: 'Dashboard', href: '/performance' },
  { label: 'Post Metrics', href: '/performance/posts' },
  { label: 'Timing', href: '/performance/timing' },
  { label: 'Content', href: '/performance/content' },
  { label: 'Hashtags', href: '/performance/hashtags' },
  { label: 'Audience', href: '/performance/audience' },
];

function PerformanceSubNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      gap: '0.25rem',
      marginBottom: '1.5rem',
      overflowX: 'auto',
      paddingBottom: '0.25rem',
    }}>
      {SUB_NAV_ITEMS.map(item => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'var(--text-muted, #888)',
              background: isActive ? 'var(--accent-color, #e1306c)' : 'transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AudiencePage() {
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [accountInsights, setAccountInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [storyData, setStoryData] = useState(null);
  const [loadingStories, setLoadingStories] = useState(false);
  const [syncingStories, setSyncingStories] = useState(false);

  useEffect(() => {
    checkInstagramConnection();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await safeJson(res);

      if (data.connected) {
        setInstagramConnected(true);
        loadAccountInsights();
        loadStoryData();
      } else {
        setInstagramConnected(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  // --- Loading state ---
  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>📈 Performance</h1>
            <p>Audience and Stories</p>
          </div>
        </header>
        <PerformanceSubNav />
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // --- Not connected state ---
  if (!instagramConnected) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>📈 Performance</h1>
            <p>Audience and Stories</p>
          </div>
        </header>
        <PerformanceSubNav />
        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📸</div>
          <h2 style={{ marginBottom: '1rem' }}>Connect Instagram to Track Performance</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Link your Instagram Business account to see audience demographics,<br />
            account insights, and story performance.
          </p>
          <Link href="/settings" className="btn btn-primary">
            Go to Settings →
          </Link>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>📈 Performance</h1>
            <p>Audience and Stories</p>
          </div>
        </header>
        <PerformanceSubNav />
        <div className="card" style={{ marginTop: '1.5rem', padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--error-color, #ef4444)' }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => { setError(null); setLoading(true); checkInstagramConnection(); }} style={{ marginTop: '1rem' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // --- Main content ---
  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>📈 Performance</h1>
          <p>Audience and Stories</p>
        </div>
      </header>

      <PerformanceSubNav />

      {/* Account Overview */}
      {loadingInsights ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
          <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading account insights...</p>
        </div>
      ) : accountInsights ? (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">👤 Account Overview</h2>
          </div>
          <div className="account-overview-grid">
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.account?.followers)}</span>
              <span className="account-stat-label">Followers</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.account?.following)}</span>
              <span className="account-stat-label">Following</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{formatNumber(accountInsights.account?.posts)}</span>
              <span className="account-stat-label">Posts</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{renderMetric(accountInsights.insights?.reach)}</span>
              <span className="account-stat-label">Reach (28d)</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{renderMetric(accountInsights.insights?.accountsEngaged)}</span>
              <span className="account-stat-label">Engaged (28d)</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{renderMetric(accountInsights.insights?.profileViews)}</span>
              <span className="account-stat-label">Profile Views</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{renderMetric(accountInsights.insights?.websiteClicks)}</span>
              <span className="account-stat-label">Website Clicks</span>
            </div>
          </div>

          {/* Engagement Rate */}
          {accountInsights.insights?.reach > 0 && accountInsights.insights?.accountsEngaged > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(225, 48, 108, 0.08)', borderRadius: '8px', display: 'inline-block' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Engagement Rate (28d): </span>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-color, #e1306c)' }}>
                {((accountInsights.insights.accountsEngaged / accountInsights.insights.reach) * 100).toFixed(2)}%
              </span>
            </div>
          )}

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
                    {accountInsights.demographics.topCountries.slice(0, 5).map((c, i) => (
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
                    {accountInsights.demographics.topCities.slice(0, 5).map((c, i) => (
                      <div key={i} className="demo-item">
                        <span>{c.city}</span>
                        <span>{formatNumber(c.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {accountInsights.demographics.ageGender && accountInsights.demographics.ageGender.length > 0 && (
                  <div className="demo-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="demo-title">Age / Gender Breakdown</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {accountInsights.demographics.ageGender.slice(0, 8).map((ag, i) => {
                        const maxCount = Math.max(...accountInsights.demographics.ageGender.map(a => a.count));
                        const pct = maxCount > 0 ? (ag.count / maxCount) * 100 : 0;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                            <span style={{ width: '80px', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                              {ag.age_range || ag.ageRange || ag.label}
                            </span>
                            <div style={{ flex: 1, height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: ag.gender === 'M' || ag.gender === 'male' ? '#3b82f6' :
                                  ag.gender === 'F' || ag.gender === 'female' ? '#e1306c' : '#8b5cf6',
                                borderRadius: '4px',
                                transition: 'width 0.3s',
                              }} />
                            </div>
                            <span style={{ width: '50px', color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                              {formatNumber(ag.count)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No account insights available yet.
          </p>
        </div>
      )}

      {/* Stories Insights */}
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
    </div>
  );
}
