import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * EmptyState — centered "nothing here yet" panel with optional icon + action.
 *
 *   <EmptyState
 *     icon={<Inbox />}
 *     title="No post metrics yet"
 *     description="Fetch insights to pull reach, saves and skip rate."
 *     action={<Button onClick={sync}>Fetch insights</Button>}
 *   />
 */
function EmptyState({ icon, title, description, action, className, ...props }) {
  return (
    <div
      className={cn('flex flex-col items-center text-center px-8 py-16', className)}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-card text-fg-muted [&_svg]:size-6">
          {icon}
        </div>
      )}
      {title && <h3 className="font-serif text-xl font-light text-fg-secondary mb-2">{title}</h3>}
      {description && (
        <p className="max-w-sm text-sm text-fg-muted leading-relaxed mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

export { EmptyState };
