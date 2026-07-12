import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils.js';

/**
 * Label — Radix Label (clicking focuses the associated control).
 * Styled to the uppercase .form-label convention.
 */
const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'text-xs font-medium uppercase tracking-[0.05em] text-fg-secondary',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

export { Label };
