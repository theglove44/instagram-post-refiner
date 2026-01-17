'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

  useEffect(() => {
    checkInstagramConnection();
    loadHashtagData();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await res.json();
      
      if (data.connected) {
        setInstagramConnected(true);
        loadMetrics();
        loadRecentPosts();
        loadAccountInsights();
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
      const data = await res.json();
      
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
      const data = await res.json();
      
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
      const data = await res.json();
      
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
    try {
      const res = await fetch('/api/instagram/metrics', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        await loadMetrics();
      }
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
      const data = await res.json();
      if (data.success) {
        setHashtagData(data);
      }
    } catch (err) {
      console.error('Failed to load hashtag data:', err);
    } finally {
      setLoadingHashtags(false);
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

    const avgEngagement = (posts) => {
      if (posts.length === 0) return 0;
      return posts.reduce((sum, p) => sum + parseFloat(p.metrics?.engagementRate || 0), 0) / posts.length;
    };

    const avgReach = (posts) => {
      if (posts.length === 0) return 0;
      return posts.reduce((sum, p) => sum + (p.metrics?.reach || 0), 0) / posts.length;
    };

    setCorrelationData({
      lowEdits: {
        count: lowEdits.length,
        avgEngagement: avgEngagement(lowEdits).toFixed(2),
        avgReach: Math.round(avgReach(lowEdits)),
      },
      mediumEdits: {
        count: mediumEdits.length,
        avgEngagement: avgEngagement(mediumEdits).toFixed(2),
        avgReach: Math.round(avgReach(mediumEdits)),
      },
      highEdits: {
        count: highEdits.length,
        avgEngagement: avgEngagement(highEdits).toFixed(2),
        avgReach: Math.round(avgReach(highEdits)),
      },
      totalPosts: postsWithMetrics.length,
      overallAvgEngagement: avgEngagement(postsWithMetrics).toFixed(2),
    });
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
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

        <Link href="/" className="back-link">
          ← Back to Logger
        </Link>

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
        <button 
          className="btn btn-secondary"
          onClick={refreshMetrics}
          disabled={refreshing}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Metrics'}
        </button>
      </header>

      <Link href="/" className="back-link">
        ← Back to Logger
      </Link>

      {error && (
        <div className="card" style={{ marginTop: '1.5rem', background: 'var(--error-soft)', borderColor: 'var(--error)' }}>
          <p style={{ color: 'var(--error)' }}>Error: {error}</p>
        </div>
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

      {/* Best Times to Post */}
      {timeAnalysis && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">⏰ Best Times to Post</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Based on engagement rates from your recent posts
          </p>
          
          <div className="best-times-grid">
            <div className="best-time-card highlight">
              <div className="best-time-label">Best Day</div>
              <div className="best-time-value">{timeAnalysis.bestDay || 'N/A'}</div>
              <div className="best-time-engagement">{formatNumber(timeAnalysis.bestDayEngagement)} avg interactions</div>
            </div>
            <div className="best-time-card highlight">
              <div className="best-time-label">Best Hour</div>
              <div className="best-time-value">{timeAnalysis.bestHour || 'N/A'}</div>
              <div className="best-time-engagement">{formatNumber(timeAnalysis.bestHourEngagement)} avg interactions</div>
            </div>
          </div>
          
          {/* Daily breakdown */}
          {timeAnalysis.dailyBreakdown && timeAnalysis.dailyBreakdown.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Engagement by Day</h4>
              <div className="day-breakdown">
                {timeAnalysis.dailyBreakdown.map((day, i) => (
                  <div key={day.day} className="day-bar-container">
                    <div className="day-name">{day.day.slice(0, 3)}</div>
                    <div className="day-bar">
                      <div 
                        className="day-bar-fill"
                        style={{ 
                          height: `${(parseFloat(day.avgEngagement) / parseFloat(timeAnalysis.dailyBreakdown[0].avgEngagement)) * 100}%`,
                          opacity: i === 0 ? 1 : 0.5 + (0.5 * (1 - i / timeAnalysis.dailyBreakdown.length))
                        }}
                      />
                    </div>
                    <div className="day-engagement">{formatNumber(day.avgEngagement)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Top hours */}
          {timeAnalysis.hourlyBreakdown && timeAnalysis.hourlyBreakdown.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Top Posting Hours</h4>
              <div className="hours-list">
                {timeAnalysis.hourlyBreakdown.map((hour, i) => (
                  <div key={hour.hour} className="hour-item">
                    <span className="hour-rank">#{i + 1}</span>
                    <span className="hour-time">{hour.hour.toString().padStart(2, '0')}:00</span>
                    <span className="hour-engagement">{formatNumber(hour.avgEngagement)} avg interactions</span>
                    <span className="hour-posts">({hour.postCount} posts)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
              <div className="correlation-value">{correlationData.lowEdits.avgEngagement}%</div>
              <div className="correlation-sublabel">avg engagement</div>
              <div className="correlation-meta">
                {correlationData.lowEdits.count} posts • {formatNumber(correlationData.lowEdits.avgReach)} avg reach
              </div>
            </div>
            <div className="correlation-card">
              <div className="correlation-label">Medium Edits (4-7)</div>
              <div className="correlation-value">{correlationData.mediumEdits.avgEngagement}%</div>
              <div className="correlation-sublabel">avg engagement</div>
              <div className="correlation-meta">
                {correlationData.mediumEdits.count} posts • {formatNumber(correlationData.mediumEdits.avgReach)} avg reach
              </div>
            </div>
            <div className="correlation-card">
              <div className="correlation-label">High Edits (8+)</div>
              <div className="correlation-value">{correlationData.highEdits.avgEngagement}%</div>
              <div className="correlation-sublabel">avg engagement</div>
              <div className="correlation-meta">
                {correlationData.highEdits.count} posts • {formatNumber(correlationData.highEdits.avgReach)} avg reach
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <strong>Insight:</strong>{' '}
              {parseFloat(correlationData.highEdits.avgEngagement) > parseFloat(correlationData.lowEdits.avgEngagement)
                ? 'Posts with more edits tend to perform better! Your refinement process is paying off.'
                : parseFloat(correlationData.lowEdits.avgEngagement) > parseFloat(correlationData.highEdits.avgEngagement)
                ? 'Posts with fewer edits are performing well. Claude may be getting better at matching your voice.'
                : 'Edit count doesn\'t seem to significantly impact performance yet. Keep logging more posts for clearer patterns.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Published Posts with Metrics */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📊 Published Posts</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} tracked
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No published posts with metrics yet.<br/>
            Publish posts to Instagram to start tracking performance.</p>
          </div>
        ) : (
          <div className="performance-list">
            {posts.map((post) => (
              <div key={post.id} className="performance-item">
                <div className="performance-item-header">
                  <div>
                    <span className="performance-topic">{post.topic}</span>
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
                  <div className="metrics-grid">
                    <div className="metric-item">
                      <span className="metric-value">{formatNumber(post.metrics.reach)}</span>
                      <span className="metric-label">Reach</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-value">{formatNumber(post.metrics.impressions)}</span>
                      <span className="metric-label">Impressions</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-value">{formatNumber(post.metrics.likes)}</span>
                      <span className="metric-label">Likes</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-value">{formatNumber(post.metrics.comments)}</span>
                      <span className="metric-label">Comments</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-value">{formatNumber(post.metrics.saves)}</span>
                      <span className="metric-label">Saves</span>
                    </div>
                    <div className="metric-item highlight">
                      <span className="metric-value">{post.metrics.engagementRate}%</span>
                      <span className="metric-label">Engagement</span>
                    </div>
                  </div>
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
                  📈 Trending (Last 30 Days)
                </h3>
                <div className="hashtag-list">
                  {hashtagData.trending.slice(0, 5).map((tag) => (
                    <div key={tag.hashtag} className="hashtag-trend-item">
                      <span className="hashtag-name">{tag.hashtag}</span>
                      <span className="hashtag-usage">{tag.count} uses</span>
                      <span className={`hashtag-growth ${tag.growth > 0 ? 'positive' : tag.growth < 0 ? 'negative' : ''}`}>
                        {tag.growth > 0 ? '↑' : tag.growth < 0 ? '↓' : '→'} {Math.abs(tag.growth)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtag Performance Correlation */}
            {hashtagData.correlations && hashtagData.correlations.bestPerforming?.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  🏆 Best Performing Hashtags
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Based on {hashtagData.postsWithMetrics} linked posts with engagement data
                </p>
                <div className="hashtag-performance-list">
                  {hashtagData.correlations.bestPerforming.slice(0, 8).map((tag, i) => (
                    <div key={tag.hashtag} className="hashtag-performance-item">
                      <span className="hashtag-rank">#{i + 1}</span>
                      <span className="hashtag-name">{tag.hashtag}</span>
                      <div className="hashtag-metrics">
                        <span className="hashtag-engagement">{tag.avgEngagement}% eng</span>
                        <span className="hashtag-reach">{formatNumber(tag.avgReach)} reach</span>
                        <span className="hashtag-posts">{tag.postCount} post{tag.postCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Worst Performing (if enough data) */}
            {hashtagData.correlations && hashtagData.correlations.worstPerforming?.length > 3 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  ⚠️ Consider Replacing
                </h3>
                <div className="hashtag-performance-list">
                  {hashtagData.correlations.worstPerforming.slice(0, 5).map((tag) => (
                    <div key={tag.hashtag} className="hashtag-performance-item low-performing">
                      <span className="hashtag-name">{tag.hashtag}</span>
                      <div className="hashtag-metrics">
                        <span className="hashtag-engagement">{tag.avgEngagement}% eng</span>
                        <span className="hashtag-reach">{formatNumber(tag.avgReach)} reach</span>
                        <span className="hashtag-posts">{tag.postCount} post{tag.postCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
