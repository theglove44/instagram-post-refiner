import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

/**
 * Badge — small status pill. Variants map to the app's semantic colours and to
 * the existing .tier-badge / status conventions. `dot` prepends a coloured dot.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.06em] ' +
    'px-2 py-0.5 text-[0.7rem] leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-bg text-fg-muted border-border',
        terra: 'bg-terra/10 text-terra border-terra/30',
        mustard: 'bg-warning-bg text-mustard border-mustard/30',
        success: 'bg-success-bg text-success border-success/30',
        warning: 'bg-warning-bg text-warning border-warning/30',
        danger: 'bg-danger-bg text-danger border-danger/30',
        info: 'bg-info-bg text-info border-info/30',
        outline: 'bg-transparent text-fg-secondary border-border-light',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

const dotColor = {
  neutral: 'bg-fg-muted',
  terra: 'bg-terra',
  mustard: 'bg-mustard',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  outline: 'bg-fg-muted',
};

const Badge = React.forwardRef(function Badge(
  { className, variant = 'neutral', dot = false, asChild = false, children, ...props },
  ref
) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn('size-1.5 rounded-full', dotColor[variant])} aria-hidden="true" />}
      {children}
    </Comp>
  );
});

export { Badge, badgeVariants };
