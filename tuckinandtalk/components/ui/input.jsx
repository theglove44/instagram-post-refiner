import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Input — text field styled to the .form-input baseline.
 * Set `invalid` (or aria-invalid) to surface the danger ring for validation.
 * Forwards ref + all native <input> props (type, value, onChange, placeholder…).
 */
const Input = React.forwardRef(function Input(
  { className, type = 'text', invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(
        'flex h-9 w-full rounded-[var(--radius-sm)] border border-border bg-field px-3 py-2 text-sm text-fg',
        'placeholder:text-fg-muted',
        'transition-colors duration-150 outline-none',
        'focus-visible:border-terra focus-visible:ring-2 focus-visible:ring-terra/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg-secondary',
        className
      )}
      {...props}
    />
  );
});

export { Input };
