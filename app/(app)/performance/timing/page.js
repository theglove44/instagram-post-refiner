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
      padding: '0.25rem',
      background: 'var(--bg-input, #1a1a1a)',
      borderRadius: 'var(--radius-sm, 8px)',
      marginBottom: '1.5rem',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {SUB_NAV_ITEMS.map(({ label, href }) => {
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
              color: isActive ? 'var(--text, #fff)' : 'var(--text-muted, #888)',
              background: isActive ? 'var(--bg-card, #141414)' : 'transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, color 0.15s',
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

export default function TimingCadencePage() {
  const [derivedData, setDerivedData] = useState(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkInstagramConnection();
  }, []);

  const checkInstagramConnection = async () => {
    try {
      const res = await fetch('/api/instagram/account');
      const data = await safeJson(res);

      if (data.connected) {
        setInstagramConnected(true);
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

  const loadDerivedMetrics = async () => {
    try {
      const res = await fetch('/api/instagram/derived');
      const data = await safeJson(res);
      if (data.success) {
        setDerivedData(data);
      }
    } catch (err) {
      console.error('Failed to load derived metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Best Times Heatmap rendering ---
  const renderHeatmap = () => {
    if (!derivedData?.timeAnalysis) {
      return (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Best Times to Post</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Not enough data for the engagement heatmap yet. Publish more posts to unlock time analysis.
          </p>
        </div>
      );
    }

    const ta = derivedData.timeAnalysis;
    const { heatmap, hourly, daily, bestHour, bestDay, bestSlot, totalPostsAnalyzed } = ta;

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

    // Max daily score for intensity scaling
    const maxDayScore = dailyMonFirst.length > 0
      ? Math.max(...dailyMonFirst.map(d => d.shrinkageScore || 0))
      : 0;

    return (
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Best Times to Post</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          Engagement heatmap from {totalPostsAnalyzed || 0} posts — shrinkage-adjusted scores
        </p>

        {/* Post Now? indicator */}
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

        {/* 7x24 Heatmap Grid */}
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
        {dailyMonFirst.length > 0 && (
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
        )}

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
  };

  // --- Posting Cadence rendering ---
  const renderCadence = () => {
    if (!derivedData?.frequencyAnalysis) return null;

    const freq = derivedData.frequencyAnalysis;
    const allEmpty = freq.buckets.every(b => b.count === 0);

    return (
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Posting Cadence</h2>
        </div>

        {allEmpty ? (
          <div className="empty-state">
            <p>No weekly posting data available yet.<br />
            Publish posts across multiple weeks to see frequency patterns.</p>
          </div>
        ) : (
          <>
            {/* Recommendation hero */}
            {freq.optimalBucket && (() => {
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
            {freq.currentWeekTarget !== null && (() => {
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
              {freq.buckets.map(bucket => {
                const maxEngagement = Math.max(
                  ...freq.buckets
                    .filter(b => b.medianEngagement !== null)
                    .map(b => b.medianEngagement),
                  1
                );
                const widthPct = bucket.medianEngagement !== null
                  ? Math.max((bucket.medianEngagement / maxEngagement) * 100, 4)
                  : 0;
                const isOptimal = bucket.label === freq.optimalBucket;

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
    );
  };

  // --- Main render ---
  if (loading) {
    return (
      <div className="container">
        <PerformanceSubNav />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <PerformanceSubNav />
        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>Failed to load data: {error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); checkInstagramConnection(); }}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.5rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!instagramConnected) {
    return (
      <div className="container">
        <PerformanceSubNav />
        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Instagram Not Connected</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Connect your Instagram account to see timing and cadence insights.
          </p>
          <Link
            href="/performance"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.5rem',
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <PerformanceSubNav />

      <div style={{ marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Timing &amp; Cadence
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
          When to post and how often for maximum engagement
        </p>
      </div>

      {renderHeatmap()}
      {renderCadence()}
    </div>
  );
}
