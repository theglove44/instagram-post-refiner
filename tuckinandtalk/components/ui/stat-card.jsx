import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';

/**
 * StatCard — KPI tile (the token-driven successor to the legacy MetricCard).
 *
 *   <StatCard label="Followers" value="12,840" accent="terra"
 *             trend={4.2} trendLabel="vs last week" />
 *   <StatCard label="Reach" loading />            // shows skeleton
 *
 * Props:
 *   label      string   — small uppercase caption
 *   value      node     — main figure (rendered mono); falls back to "—"
 *   sub        node     — optional sub-line under the value
 *   accent     'terra'|'mustard'|null — value colour
 *   trend      number|null — signed % change; renders a coloured pill+arrow
 *   trendLabel string   — context after the trend ("vs prev week")
 *   icon       node     — optional icon, top-right
 *   loading    bool     — render a skeleton placeholder
 */
const accentText = { terra: 'text-terra', mustard: 'text-mustard' };

function StatCard({
  label,
  value,
  sub,
  accent,
  trend,
  trendLabel = 'vs prev',
  icon,
  loading = false,
  className,
  children,
  ...props
}) {
  if (loading) {
    return (
      <div className={cn('rounded-[var(--radius-md)] border border-border bg-card p-5 flex flex-col gap-3', className)}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  const hasTrend = trend !== null && trend !== undefined && !Number.isNaN(Number(trend));
  const dir = hasTrend ? Math.sign(Number(trend)) : 0;
  const TrendIcon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  const trendCls =
    dir > 0 ? 'text-success' : dir < 0 ? 'text-danger' : 'text-fg-muted';

  return (
    <div className={cn('rounded-[var(--radius-md)] border border-border bg-card p-5', className)} {...props}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.06em] text-fg-muted">{label}</span>
        {icon && <span className="text-fg-muted [&_svg]:size-4">{icon}</span>}
      </div>
      <div
        className={cn(
          'mt-2 font-mono text-[1.75rem] font-semibold leading-none tabular-nums text-fg-number',
          accent && accentText[accent]
        )}
      >
        {value ?? '—'}
      </div>
      {sub && <div className="mt-1 text-xs text-fg-secondary">{sub}</div>}
      {hasTrend && (
        <div className={cn('mt-2 inline-flex items-center gap-1 text-xs', trendCls)}>
          <TrendIcon className="size-3.5" aria-hidden="true" />
          <span className="font-mono tabular-nums">
            {dir > 0 ? '+' : ''}
            {Number(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-fg-muted">{trendLabel}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export { StatCard };
