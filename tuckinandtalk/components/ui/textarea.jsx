import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Textarea — multiline field matching Input's styling.
 */
const Textarea = React.forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(
        'flex min-h-20 w-full rounded-[var(--radius-sm)] border border-border bg-field px-3 py-2 text-sm text-fg',
        'placeholder:text-fg-muted resize-y',
        'transition-colors duration-150 outline-none',
        'focus-visible:border-terra focus-visible:ring-2 focus-visible:ring-terra/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30',
        className
      )}
      {...props}
    />
  );
});

export { Textarea };
