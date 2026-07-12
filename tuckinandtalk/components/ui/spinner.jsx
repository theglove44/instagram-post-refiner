import * as React from 'react';
import { cn } from '@/lib/utils.js';

const sizes = { sm: 'size-3.5 border', default: 'size-5 border-2', lg: 'size-8 border-2' };

/**
 * Spinner — accessible loading indicator. Renders a visually-hidden label for
 * screen readers (`label`, default "Loading"). For full-panel loading use
 * <DataState> instead.
 */
const Spinner = React.forwardRef(function Spinner(
  { className, size = 'default', label = 'Loading', ...props },
  ref
) {
  return (
    <span ref={ref} role="status" className={cn('inline-flex', className)} {...props}>
      <span
        className={cn(
          'inline-block rounded-full border-border border-t-terra animate-spin',
          sizes[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
});

export { Spinner };
