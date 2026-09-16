'use client';

import { useState, useEffect } from 'react';

const pct0 = (n) => (n == null ? '—' : Math.round(n * 100) + '%');
const int = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-GB'));
const f1 = (n) => (n == null ? '—' : n.toFixed(1));

const fontFraunces = { fontFamily: "'Fraunces', Georgia, serif" };
const fontCaveat = { fontFamily: "'Caveat', cursive" };

const sectionHead = {
  display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14,
};
const menuTitle = { ...fontFraunces, fontWeight: 500, fontSize: 19, color: '#F2EDE0' };
const menuTag = { fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8FA098' };
const ruleDashed = { border: 'none', borderTop: '1px dashed rgba(242,237,224,0.3)', margin: '22px 0' };

function Leader({ name, value, small, hot, faded }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 0' }}>
      <span style={{ fontSize: 14.5, whiteSpace: 'nowrap', color: '#F2EDE0' }}>{name}</span>
      <span style={{ flex: 1, borderBottom: '2px dotted rgba(242,237,224,0.35)', transform: 'translateY(-4px)' }} />
      <span style={{ ...fontFraunces, fontWeight: 700, fontSize: 19, whiteSpace: 'nowrap', color: hot ? '#E39A8B' : faded ? '#8FA098' : '#F2EDE0' }}>
        {value}{small && <span style={{ fontSize: 12, color: '#8FA098', fontWeight: 400 }}> {small}</span>}
      </span>
    </div>
  );
}

function Note({ tag, children }) {
  return (
    <div style={{ marginTop: 16, border: '1px dashed rgba(233,196,106,0.5)', borderRadius: 4, padding: '14px 14px 12px', position: 'relative' }}>
      <span style={{ ...fontCaveat, position: 'absolute', top: -13, left: 12, background: '#1C2B26', padding: '0 8px', fontSize: 17, color: '#E9C46A', transform: 'rotate(-1.5deg)' }}>{tag}</span>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: '#F2EDE0', margin: 0 }}>{children}</p>
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
    return <div style={{ color: '#8FA098', padding: 40, textAlign: 'center', background: '#1C2B26', minHeight: '100vh' }}>Wiping down the board…</div>;
  }
  if (error) {
    return <div style={{ color: '#E39A8B', padding: 40, textAlign: 'center', background: '#1C2B26', minHeight: '100vh' }}>{error}</div>;
  }

  const latestSplit = data.viewsSplit?.[data.viewsSplit.length - 1] || null;
  const totalViews = latestSplit ? latestSplit.follower + latestSplit.nonFollower : null;
  const strangerPct = latestSplit && totalViews ? Math.round((latestSplit.nonFollower / totalViews) * 100) : null;
  const followerPct = strangerPct == null ? null : 100 - strangerPct;

  const league = data.formatLeague || [];
  const topTalk = [...league].sort((a, b) => b.talkPer1k - a.talkPer1k)[0];
  const topReach = [...league].sort((a, b) => b.avgReach - a.avgReach)[0];
  const form = data.weeklyForm || { weeks: [] };
  const thisWeek = form.thisWeek;
  const isSeasonBest = thisWeek && form.seasonBest != null && thisWeek.medianEr >= form.seasonBest;
  const signals = data.captionSignals;
  const longCap = signals?.length?.find((b) => b.name === 'long');
  const midCap = signals?.length?.find((b) => b.name === 'middle');
  const q = signals?.question;
  const nq = signals?.noQuestion;
  const bestSlot = data.bestSlots?.[0];
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ background: 'linear-gradient(180deg,#1C2B26,#16221E)', minHeight: '100vh', padding: '22px 14px 90px' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', border: '2px solid rgba(242,237,224,0.25)', outline: '1px solid rgba(242,237,224,0.08)', outlineOffset: 5, padding: '22px 18px', borderRadius: 4 }}>

        {/* head */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ ...fontCaveat, fontSize: 20, color: '#E9C46A', display: 'inline-block', transform: 'rotate(-2deg)' }}>tonight&apos;s board</span>
          <h1 style={{ ...fontFraunces, fontWeight: 700, fontSize: 30, margin: '2px 0 0', color: '#F2EDE0' }}>
            {data.account?.username ? '@' + data.account.username : 'Tuck In & Talk'}
          </h1>
          <p style={{ fontSize: 13, color: '#8FA098', margin: '6px 0 0' }}>
            {dateLine} · everything from your own books, nothing borrowed
          </p>
        </div>

        {/* yesterday, served */}
        <section>
          <div style={sectionHead}><h2 style={menuTitle}>Yesterday, served</h2><span style={menuTag}>all surfaces</span></div>
          {latestSplit ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ ...fontFraunces, fontWeight: 700, fontSize: 52, lineHeight: 1, color: '#E9C46A' }}>{int(totalViews)}</span>
                <span style={{ color: '#8FA098', fontSize: 15 }}>views</span>
              </div>
              <Leader name="Regulars" value={int(latestSplit.follower)} />
              <Leader name="First-timers" value={int(latestSplit.nonFollower)} hot />
              <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 14, border: '1px dashed rgba(242,237,224,0.35)' }}>
                <div style={{ background: '#E9C46A', width: `${followerPct}%` }} />
                <div style={{ background: '#E39A8B', width: `${strangerPct}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#8FA098', marginTop: 7 }}>
                <span>◆ {followerPct}% already follow you</span>
                <span>◆ {strangerPct}% just found you</span>
              </div>
            </>
          ) : (
            <p style={{ color: '#8FA098', fontSize: 14 }}>First sweep lands tonight — the board fills itself.</p>
          )}
        </section>

        <hr style={ruleDashed} />

        {/* stories */}
        <section>
          <div style={sectionHead}><h2 style={menuTitle}>Stories this week</h2><span style={{ ...menuTag, maxWidth: 120, textAlign: 'right' }}>gone in 24h — we kept them</span></div>
          <div style={{ display: 'flex', border: '1px dashed rgba(242,237,224,0.35)', borderRadius: 6 }}>
            {[
              [data.storyTotals?.count, 'posted'],
              [data.storyTotals?.views, 'views'],
              [data.storyTotals?.replies, 'replies'],
            ].map(([val, label], i) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '14px 4px', borderLeft: i ? '1px dashed rgba(242,237,224,0.35)' : 'none' }}>
                <b style={{ ...fontFraunces, fontSize: 26, display: 'block', color: '#E9C46A' }}>{int(val)}</b>
                <i style={{ fontStyle: 'normal', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8FA098' }}>{label}</i>
              </div>
            ))}
          </div>
          {latestSplit?.byProduct?.STORY && (
            <Note tag="kitchen note">
              Stories pulled <b>{int(latestSplit.byProduct.STORY.follower + latestSplit.byProduct.STORY.nonFollower)} views</b> yesterday
              {latestSplit.byProduct.STORY.nonFollower + latestSplit.byProduct.STORY.follower > 0 && (
                <> — <b>{Math.round((latestSplit.byProduct.STORY.nonFollower / (latestSplit.byProduct.STORY.follower + latestSplit.byProduct.STORY.nonFollower)) * 100)}% of them strangers</b>. Your quietest recruitment channel, now on the record.</>
              )}
            </Note>
          )}
        </section>

        <hr style={ruleDashed} />

        {/* league */}
        <section>
          <div style={sectionHead}><h2 style={menuTitle}>Today&apos;s league</h2><span style={menuTag}>per 1,000 reached · this year</span></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                {['Format', 'Reach', 'Loves', 'Chat', 'Keeps'].map((h, i) => (
                  <th key={h} style={{ fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8FA098', fontWeight: 500, textAlign: i ? 'right' : 'left', padding: '6px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {league.map((row) => (
                <tr key={row.format}>
                  <td style={{ padding: '9px 0', borderBottom: '1px dashed rgba(242,237,224,0.18)', fontWeight: 700, color: '#F2EDE0' }}>{row.format}</td>
                  <td style={{ padding: '9px 0', borderBottom: '1px dashed rgba(242,237,224,0.18)', textAlign: 'right', color: '#F2EDE0' }}>{int(row.avgReach)}</td>
                  <td style={{ padding: '9px 0', borderBottom: '1px dashed rgba(242,237,224,0.18)', textAlign: 'right', color: '#F2EDE0' }}>{pct0(row.medianEr)}</td>
                  <td style={{ padding: '9px 0', borderBottom: '1px dashed rgba(242,237,224,0.18)', textAlign: 'right', color: topTalk && row.format === topTalk.format ? '#E9C46A' : '#F2EDE0' }}>{f1(row.talkPer1k)}</td>
                  <td style={{ padding: '9px 0', borderBottom: '1px dashed rgba(242,237,224,0.18)', textAlign: 'right', color: '#F2EDE0' }}>{f1(row.savesPer1k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {topReach && topTalk && topReach.format !== topTalk.format && (
            <Note tag="the trade">
              <b>{topReach.format} recruit, {topTalk.format.toLowerCase()} keep.</b> {topReach.format} reached {Math.round(topReach.avgReach / Math.max(...league.filter((l) => l.format !== topReach.format).map((l) => l.avgReach)))}× more people; {topTalk.format.toLowerCase()} make people talk at {Math.round(topTalk.talkPer1k / Math.max(...league.filter((l) => l.format !== topTalk.format).map((l) => l.talkPer1k)))}× the rate. One of each, most weeks.
            </Note>
          )}
        </section>

        <hr style={ruleDashed} />

        {/* form */}
        <section>
          <div style={sectionHead}><h2 style={menuTitle}>Form</h2><span style={menuTag}>median engagement, by week</span></div>
          {thisWeek && (
            <>
              <Leader name="This week" value={pct0(thisWeek.medianEr)} small={isSeasonBest ? '▲ season best' : `over ${thisWeek.posts} posts`} hot={isSeasonBest} />
              {form.prevWeek && <Leader name="Last week" value={pct0(form.prevWeek.medianEr)} />}
            </>
          )}
          {form.weeks?.length > 2 && (() => {
            const worst = [...form.weeks].sort((a, b) => a.medianEr - b.medianEr)[0];
            return <Leader name={`Worst dip (${worst.week.slice(5).replace('-', '/')})`} value={pct0(worst.medianEr)} faded />;
          })()}
        </section>

        <hr style={ruleDashed} />

        {/* house rules */}
        <section>
          <div style={sectionHead}><h2 style={menuTitle}>House rules</h2><span style={menuTag}>what the numbers keep saying</span></div>
          {longCap && midCap && longCap.posts > 3 && (
            <Leader name="Long captions beat the middle" value={pct0(longCap.medianEr)} small={`vs ${pct0(midCap.medianEr)}`} />
          )}
          {q && nq && q.posts > 3 && (
            <Leader name="End on a question" value={pct0(q.medianEr)} small={`vs ${pct0(nq.medianEr)}`} />
          )}
          {bestSlot && (
            <Leader name={`Weekday evenings lead`} value={pct0(bestSlot.avgEr)} small={`${bestSlot.slot} · ${bestSlot.posts} posts`} />
          )}
        </section>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#8FA098', marginTop: 22, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          next edition at 7am · tuck in and talk
        </p>
      </div>
    </div>
  );
}
