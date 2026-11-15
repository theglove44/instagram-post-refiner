'use client';

import { int, pct0, sectionHead, menuTitle, menuTag, Leader, Note, fontFraunces, shortDate, clip } from './wall-ui';

const BUTTER = '#E9C46A';
const CHALK = '#F2EDE0';
const SAGE = '#8FA098';
const dashed = '1px dashed rgba(242,237,224,0.35)';

const subHead = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '18px 0 4px' };
const subTitle = { ...fontFraunces, fontWeight: 500, fontSize: 15.5, color: CHALK };
const empty = { color: SAGE, fontSize: 14 };
const signed = (n) => (n > 0 ? `+${int(n)}` : n < 0 ? `−${int(-n)}` : '±0');

/** One plain-English line on whether Facebook is worth attention. */
export function verdict(share) {
  if (share == null) return null;
  const pct = pct0(share);
  if (share < 0.1) return `Facebook adds about ${pct} on top of Instagram: a bonus, not a channel. Keep crossposting because it's free, but don't make anything just for it.`;
  if (share < 0.2) return `Facebook brings about ${pct} of the views on crossposted posts. A useful extra worth keeping switched on.`;
  return `Facebook brings ${pct} of the views on crossposted posts. That's a real audience, worth checking what lands there.`;
}

function PageTrend({ page }) {
  const { days, totals } = page;
  const max = Math.max(1, ...days.map((d) => d.views || 0));
  const busiest = [...days].filter((d) => d.views != null).sort((a, b) => b.views - a.views)[0];
  return (
    <>
      <div
        role="img"
        aria-label={`Facebook Page views, last ${days.length} days: ${int(totals.views)}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, marginTop: 10, borderBottom: dashed }}
      >
        {days.map((d) => (
          <div key={d.date} title={d.views == null ? `${d.date}: no data` : `${d.date}: ${int(d.views)} views, ${int(d.viewers)} people`}
            style={{ flex: 1, height: `${((d.views || 0) / max) * 100}%`, background: d === busiest ? BUTTER : 'rgba(242,237,224,0.28)', borderRadius: '2px 2px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SAGE, marginTop: 6 }}>
        <span>{shortDate(days[0].date)}</span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </div>
      <Leader name="Page views" value={int(totals.views)} small={`${totals.daysWithData} days`} />
      {busiest && <Leader name={`Busiest day (${shortDate(busiest.date)})`} value={int(busiest.views)} small={`${int(busiest.viewers)} people`} />}
      {totals.followers != null && (
        <Leader name="Page followers" value={int(totals.followers)} small={totals.followerChange != null ? `${signed(totals.followerChange)} over ${days.length} days` : null} />
      )}
      <Leader name="Follows / unfollows" value={`+${int(totals.follows)} / −${int(totals.unfollows)}`} faded />
    </>
  );
}

function Crossposts({ crosspost, top }) {
  if (!crosspost.checked) {
    return <p style={empty}>Crossposted views start arriving with tonight&apos;s sweep.</p>;
  }
  if (!crosspost.crossposted) {
    return <p style={empty}>None of the last {crosspost.checked} posts were shared to Facebook, so there&apos;s nothing to split yet.</p>;
  }
  const formats = Object.entries(crosspost.byFormat);
  return (
    <>
      <Leader name="Views from Facebook" value={pct0(crosspost.share)} small={`${int(crosspost.facebookViews)} of ${int(crosspost.totalViews)}`} hot />
      {formats.length > 1 && formats.map(([format, f]) => (
        <Leader key={format} name={format} value={pct0(f.share)} small={`${f.posts} ${f.posts === 1 ? 'post' : 'posts'}`} faded />
      ))}
      <p style={{ fontSize: 12, color: SAGE, margin: '4px 0 0' }}>
        {crosspost.crossposted} of the last {crosspost.checked} posts were shared to Facebook.
      </p>

      <div style={subHead}><span style={subTitle}>Best on Facebook</span><span style={menuTag}>facebook views</span></div>
      {top.length ? top.map((p) => (
        <Leader key={p.mediaId} name={clip(p.excerpt)} value={int(p.facebookViews)} small={`${pct0(p.share)} of its views`} />
      )) : (
        <p style={empty}>No crossposted post has picked up Facebook views yet.</p>
      )}
    </>
  );
}

export default function FacebookBlock({ facebook }) {
  const page = facebook?.page || { days: [], totals: null };
  const crosspost = facebook?.crosspost || { checked: 0, crossposted: 0, byFormat: {}, share: null };
  const top = facebook?.top || [];
  const line = crosspost.crossposted ? verdict(crosspost.share) : null;

  return (
    <section className="pulse-sec sec-facebook">
      <div style={sectionHead}><h2 style={menuTitle}>Facebook, on the side</h2><span style={menuTag}>page · crossposts · 4 weeks</span></div>
      <div className="pulse-facebook-grid">
        <div>
          <div style={subHead}><span style={subTitle}>The Page</span><span style={menuTag}>daily views</span></div>
          {page.days.length && page.totals ? <PageTrend page={page} /> : (
            <p style={empty}>First Facebook Page reading lands after tonight&apos;s sweep.</p>
          )}
        </div>
        <div>
          <div style={subHead}><span style={subTitle}>Crossposted from Instagram</span><span style={menuTag}>share of views</span></div>
          <Crossposts crosspost={crosspost} top={top} />
        </div>
      </div>
      {line && <Note tag="the verdict">{line}</Note>}
    </section>
  );
}
