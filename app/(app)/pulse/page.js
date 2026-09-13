'use client';

import { useState, useEffect } from 'react';

const pct = (n) => (n == null ? '—' : (n * 100).toFixed(0) + '%');
const int = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-GB'));

const card = {
  background: '#141414',
  borderRadius: 12,
  padding: '20px',
  marginBottom: 16,
};

const cardTitle = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: '#888',
  marginBottom: 14,
};

const bigNumber = {
  fontSize: 34,
  fontWeight: 700,
  color: '#fafafa',
  lineHeight: 1.1,
};

const subLabel = {
  fontSize: 13,
  color: '#888',
  marginTop: 4,
};

function Sparkline({ values }) {
  if (!values || values.length < 2) return null;
  const width = 300;
  const height = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - 4 - ((v - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 60, display: 'block' }}
      role="img"
      aria-label="Follower trend, last 30 days"
    >
      <polyline points={points} fill="none" stroke="#e1306c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SplitBar({ follower, nonFollower }) {
  const total = (follower || 0) + (nonFollower || 0);
  if (!total) return null;
  const followerPct = Math.round((follower / total) * 100);
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
        <div style={{ width: `${followerPct}%`, background: '#e1306c' }} />
        <div style={{ width: `${100 - followerPct}%`, background: '#4a4a4a' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#888' }}>
        <span>♥ {followerPct}% followers</span>
        <span>{100 - followerPct}% new people</span>
      </div>
    </div>
  );
}

export default function PulsePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/insights/pulse')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json);
        else setError(json.error || 'Failed to load');
      })
      .catch(() => setError('Could not reach the server'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>Loading…</div>;
  }

  if (error) {
    return <div style={{ color: '#ef4444', padding: 40, textAlign: 'center' }}>{error}</div>;
  }

  const latestSplit = data.viewsSplit?.[data.viewsSplit.length - 1] || null;
  const totalViews = latestSplit ? latestSplit.follower + latestSplit.nonFollower : null;
  const followerValues = (data.growth || []).map((g) => g.followers);
  const followersNow = followerValues.length ? followerValues[followerValues.length - 1] : null;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fafafa', margin: '0 0 2px' }}>
        Pulse
      </h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
        {data.account?.username ? '@' + data.account.username : 'Tuck In and Talk'}
        {followersNow != null && <> · {int(followersNow)} followers</>}
      </p>

      {/* Views split */}
      <section style={card}>
        <h2 style={cardTitle}>Who saw us yesterday</h2>
        {latestSplit ? (
          <>
            <div style={bigNumber}>{int(totalViews)}</div>
            <div style={subLabel}>views across everything</div>
            <SplitBar follower={latestSplit.follower} nonFollower={latestSplit.nonFollower} />
          </>
        ) : (
          <p style={{ color: '#888', fontSize: 14 }}>No data yet — first sync tonight.</p>
        )}
      </section>

      {/* Stories */}
      <section style={card}>
        <h2 style={cardTitle}>Stories, last 7 days</h2>
        {data.storyTotals?.count ? (
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={bigNumber}>{int(data.storyTotals.views)}</div>
              <div style={subLabel}>views</div>
            </div>
            <div>
              <div style={{ ...bigNumber, fontSize: 24 }}>{data.storyTotals.count}</div>
              <div style={subLabel}>posted</div>
            </div>
            <div>
              <div style={{ ...bigNumber, fontSize: 24 }}>{data.storyTotals.replies}</div>
              <div style={subLabel}>replies</div>
            </div>
          </div>
        ) : (
          <p style={{ color: '#888', fontSize: 14 }}>No stories captured yet.</p>
        )}
      </section>

      {/* Growth */}
      <section style={card}>
        <h2 style={cardTitle}>Followers, last 30 days</h2>
        {followerValues.length >= 2 ? (
          <>
            <Sparkline values={followerValues} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginTop: 6 }}>
              <span>{int(followerValues[0])}</span>
              <span>{int(followerValues[followerValues.length - 1])}</span>
            </div>
          </>
        ) : (
          <p style={{ color: '#888', fontSize: 14 }}>Not enough snapshots yet.</p>
        )}
      </section>

      {/* Top posts */}
      <section style={card}>
        <h2 style={cardTitle}>Top posts, last 30 days</h2>
        {data.rankedPosts?.length ? (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.rankedPosts.slice(0, 5).map((post, i) => (
              <li
                key={i}
                style={{
                  padding: '12px 0',
                  borderBottom: i < 4 ? '1px solid #2a2a2a' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: '#e1306c', fontWeight: 600 }}>
                    {post.type} · {post.publishedAt?.slice(5, 10)}
                  </span>
                  <span style={{ fontSize: 14, color: '#fafafa', fontWeight: 700 }}>{pct(post.er)} ER</span>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  {int(post.reach)} reach · {int(post.interactions)} interactions
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ color: '#888', fontSize: 14 }}>No posts with metrics yet.</p>
        )}
      </section>

      {/* Best slots */}
      <section style={card}>
        <h2 style={cardTitle}>Best times to post</h2>
        {data.bestSlots?.length ? (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.bestSlots.map((slot, i) => (
              <li
                key={slot.slot}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < data.bestSlots.length - 1 ? '1px solid #2a2a2a' : 'none',
                  fontSize: 15,
                }}
              >
                <span style={{ color: '#fafafa' }}>{i === 0 ? '⭐ ' : ''}{slot.slot} UK</span>
                <span style={{ color: '#888' }}>
                  {pct(slot.avgEr)} · {slot.posts} posts
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ color: '#888', fontSize: 14 }}>Not enough history yet.</p>
        )}
      </section>
    </div>
  );
}
