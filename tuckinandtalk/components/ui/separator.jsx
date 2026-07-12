import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Separator — thin divider. `label` renders an inline section heading with a
 * trailing rule (the .section-title pattern). Otherwise a plain hairline.
 */
const Separator = React.forwardRef(function Separator(
  { className, orientation = 'horizontal', label, ...props },
  ref
) {
  if (label) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 font-serif font-light text-fg-secondary text-base my-6',
          className
        )}
        {...props}
      >
        <span className="whitespace-nowrap">{label}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
        className
      )}
      {...props}
    />
  );
});

export { Separator };
