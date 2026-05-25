/**
 * SkipRateBadge — Colour-coded pill showing a Reel's skip rate.
 *
 * Thresholds:
 *   < 20%  → green  (good retention)
 *   20–40% → amber  (acceptable)
 *   > 40%  → red    (high skip rate — watch this)
 *   null   → neutral (not a Reel / no data)
 *
 * Props:
 *   rate {number|null} — percentage value (e.g. 35.2 means 35.2%)
 */
export default function SkipRateBadge({ rate }) {
  if (rate === null || rate === undefined) {
    return <span className="skip-rate-badge neutral">—</span>;
  }

  const pct = Number(rate);
  const level = pct < 20 ? 'good' : pct < 40 ? 'warning' : 'danger';

  return (
    <span className={`skip-rate-badge ${level}`}>
      {level === 'good' && '▾'}
      {level === 'warning' && '●'}
      {level === 'danger' && '▴'}
      {pct.toFixed(1)}%
    </span>
  );
}
