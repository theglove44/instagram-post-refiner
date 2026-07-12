import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Card — surface container with composable sub-parts. Mirrors the .card classes.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Weekly reach</CardTitle>
 *       <CardDescription>Last 7 days</CardDescription>
 *     </CardHeader>
 *     <CardContent>…</CardContent>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 *
 * `interactive` adds hover affordance for clickable cards.
 */
const Card = React.forwardRef(function Card(
  { className, interactive = false, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-md)] border border-border bg-card text-fg shadow-[var(--shadow-card)]',
        interactive &&
          'transition-colors duration-150 hover:bg-card-hover hover:border-border-light',
        className
      )}
      {...props}
    />
  );
});

const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
});

const CardTitle = React.forwardRef(function CardTitle({ className, as: Comp = 'h3', ...props }, ref) {
  return (
    <Comp
      ref={ref}
      className={cn('font-serif font-light tracking-[-0.01em] text-lg text-fg', className)}
      {...props}
    />
  );
});

const CardDescription = React.forwardRef(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-sm text-fg-secondary', className)} {...props} />;
});

const CardContent = React.forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />;
});

const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 p-5 pt-3 border-t border-border', className)}
      {...props}
    />
  );
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
