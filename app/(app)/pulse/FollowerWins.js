'use client';

import { int, f1, sectionHead, menuTitle, menuTag, Leader, Note, fontFraunces } from './wall-ui';

const BUTTER = '#E9C46A';
const ROSE = '#E39A8B';
const CHALK = '#F2EDE0';
const SAGE = '#8FA098';
const dashed = '1px dashed rgba(242,237,224,0.35)';

const subHead = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '18px 0 4px' };
const subTitle = { ...fontFraunces, fontWeight: 500, fontSize: 15.5, color: CHALK };

export const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

// "between 6pm and 9pm" when the peak hours sit next to each other (a bar
// covers its whole hour, so the window ends when the last hour does);
// otherwise "around 7am, 1pm and 8pm" in clock order.
export const peakWindow = (peak) => {
  const hours = peak.map((p) => p.hour).sort((a, b) => a - b);
  const contiguous = hours.every((h, i) => i === 0 || h === hours[i - 1] + 1);
  if (contiguous) return `between ${hourLabel(hours[0])} and ${hourLabel((hours[hours.length - 1] + 1) % 24)}`;
  const labels = hours.map(hourLabel);
  return `around ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};
const shortDate = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
const clip = (text, max = 30) => {
  const clean = (text || '').replace(/\s+/g, ' ').trim() || 'Untitled post';
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
};
const signed = (n) => (n > 0 ? `+${int(n)}` : n < 0 ? `−${int(-n)}` : '0');

function FollowFlowChart({ flow }) {
  const max = Math.max(1, ...flow.days.flatMap((d) => [d.follows || 0, d.unfollows || 0]));
  const { follows, unfollows, net } = flow.totals;
  return (
    <>
      <div
        role="img"
        aria-label={`Last ${flow.days.length} days: ${follows} follows, ${unfollows} unfollows, net ${net}`}
        style={{ display: 'flex', alignItems: 'stretch', gap: 2, height: 110, marginTop: 10 }}
      >
        {flow.days.map((d) => (
          <div key={d.date} title={d.net == null ? `${d.date}: not settled yet` : `${d.date}: +${d.follows} / −${d.unfollows}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              {d.follows != null && <div style={{ width: '100%', height: `${(d.follows / max) * 100}%`, background: BUTTER, borderRadius: '2px 2px 0 0' }} />}
            </div>
            <div style={{ height: 1, background: d.net == null ? 'transparent' : 'rgba(242,237,224,0.45)', borderTop: d.net == null ? '1px dotted rgba(242,237,224,0.3)' : 'none' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
              {d.unfollows != null && <div style={{ width: '100%', height: `${(d.unfollows / max) * 100}%`, background: ROSE, borderRadius: '0 0 2px 2px' }} />}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SAGE, marginTop: 6 }}>
        <span>{shortDate(flow.days[0].date)}</span>
        <span>{shortDate(flow.days[flow.days.length - 1].date)}</span>
      </div>
      <Leader name="Followed you" value={`+${int(follows)}`} />
      <Leader name="Unfollowed" value={`−${int(unfollows)}`} hot />
      <Leader name="Net" value={signed(net)} small={`over ${flow.daysWithData} days`} />
    </>
  );
}

function OnlineHoursChart({ online }) {
  const max = Math.max(...online.hours.map((h) => h.followers || 0)) || 1;
  const peakHours = new Set(online.peak.map((p) => p.hour));
  return (
    <>
      <div
        role="img"
        aria-label={`Followers online: busiest around ${hourLabel(online.peak[0]?.hour ?? 0)}, ${online.peak.length ? peakWindow(online.peak) : ''} UK time`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, marginTop: 10, borderBottom: dashed }}
      >
        {online.hours.map((h) => (
          <div key={h.hour} title={`${hourLabel(h.hour)}: ${int(h.followers)} online`}
            style={{ flex: 1, height: `${((h.followers || 0) / max) * 100}%`, background: peakHours.has(h.hour) ? BUTTER : 'rgba(242,237,224,0.28)', borderRadius: '2px 2px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SAGE, marginTop: 6 }}>
        {[0, 6, 12, 18, 23].map((h) => <span key={h}>{hourLabel(h)}</span>)}
      </div>
      {online.peak[0] && (
        <Note tag="when to post">
          Your followers are most active <b>{peakWindow(online.peak)}</b> UK time, peaking around {hourLabel(online.peak[0].hour)} with about {int(online.peak[0].followers)} online.
          Post just before it so the first push lands on a full room.
        </Note>
      )}
    </>
  );
}

export default function FollowerWins({ wins, flow, online }) {
  const byFollows = wins?.byFollows || [];
  const byVisits = (wins?.byVisitsPer1k || []).slice(0, 3);
  const hasFlow = flow?.days?.length > 0;

  return (
    <section className="pulse-sec sec-followers">
      <div style={sectionHead}><h2 style={menuTitle}>What wins followers</h2><span style={menuTag}>posts, people, hours</span></div>
      <div className="pulse-followers-grid">
        <div>
          <div style={subHead}><span style={subTitle}>Posts that recruited</span><span style={menuTag}>follows · 90 days</span></div>
          {byFollows.length ? (
            byFollows.map((r) => (
              <Leader key={r.mediaId} name={clip(r.excerpt)} value={`+${int(r.follows)}`} small={r.profileVisits != null ? `${int(r.profileVisits)} visits` : r.format.toLowerCase()} />
            ))
          ) : (
            <p style={{ color: SAGE, fontSize: 14 }}>
              {wins?.postsWithSignals
                ? 'No follows credited to a single post yet.'
                : 'Follow counts start arriving with the next metrics sync. Meta only gives them for photo and carousel posts, not Reels.'}
            </p>
          )}

          <div style={subHead}><span style={subTitle}>Profile pull</span><span style={menuTag}>visits per 1,000 views</span></div>
          {byVisits.length ? (
            byVisits.map((r) => (
              <Leader key={r.mediaId} name={clip(r.excerpt)} value={f1(r.visitsPer1k)} small={`${int(r.views)} views`} />
            ))
          ) : (
            <p style={{ color: SAGE, fontSize: 14 }}>Needs a few posts with 300+ views and profile-visit data.</p>
          )}
        </div>

        <div>
          <div style={subHead}><span style={subTitle}>Follows vs unfollows</span><span style={menuTag}>daily · 4 weeks</span></div>
          {hasFlow ? <FollowFlowChart flow={flow} /> : (
            <p style={{ color: SAGE, fontSize: 14 }}>The evening sweep starts logging this tonight. Meta settles each day about two days late.</p>
          )}

          <div style={subHead}><span style={subTitle}>When they&apos;re online</span><span style={menuTag}>UK time</span></div>
          {online ? <OnlineHoursChart online={online} /> : (
            <p style={{ color: SAGE, fontSize: 14 }}>First reading lands after tonight&apos;s sweep.</p>
          )}
        </div>
      </div>
    </section>
  );
}
