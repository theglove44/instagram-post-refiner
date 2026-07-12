/**
 * MetricCard — Reusable stat display card.
 *
 * Props:
 *   label       {string}  — Short label (uppercase, displayed small)
 *   value       {string|number} — Main display value
 *   sub         {string}  — Optional sub-label beneath value
 *   accent      {'terra'|'mustard'|null} — Accent colour for value
 *   trend       {number|null} — Optional trend % (positive = up, negative = down)
 *   children    {ReactNode} — Optional custom content below value
 */
export default function MetricCard({ label, value, sub, accent, trend, children }) {
  const valueClass = `metric-card-value${accent === 'terra' ? ' accent' : accent === 'mustard' ? ' mustard' : ''}`;

  const trendColor = trend === null || trend === undefined
    ? 'var(--text-muted)'
    : trend > 0
    ? 'var(--status-green)'
    : trend < 0
    ? 'var(--status-red)'
    : 'var(--text-muted)';

  return (
    <div className="metric-card">
      <div className="metric-card-label">{label}</div>
      <div className={valueClass}>{value ?? '—'}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
      {trend !== null && trend !== undefined && (
        <div style={{ marginTop: 4, fontSize: '0.75rem', color: trendColor }}>
          {trend > 0 ? '+' : ''}{Number(trend).toFixed(1)}% vs prev week
        </div>
      )}
      {children}
    </div>
  );
}
