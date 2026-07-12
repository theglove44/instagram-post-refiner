import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Skeleton — shimmering placeholder for loading states.
 * Compose to mirror real content layout:
 *
 *   <Skeleton className="h-7 w-24" />        // a value
 *   <Skeleton className="h-4 w-full" />      // a line of text
 *
 * For common shapes use the SkeletonCard / SkeletonText helpers below.
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-[var(--radius-sm)] bg-border-light/50', className)}
      {...props}
    />
  );
}

/** SkeletonText — N shimmer lines, last one short, as a paragraph placeholder. */
function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** SkeletonCard — a card-shaped placeholder (label + value + sub). */
function SkeletonCard({ className }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-border bg-card p-5 flex flex-col gap-3',
        className
      )}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard };
