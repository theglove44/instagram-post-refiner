import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Spinner } from '@/components/ui/spinner.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Button } from '@/components/ui/button.jsx';

/**
 * DataState — one wrapper to handle the four states every async view has:
 * loading, error, empty, and ready. Stops every page from re-implementing the
 * same if-ladder.
 *
 *   <DataState
 *     loading={loading}
 *     error={error}
 *     empty={posts.length === 0}
 *     onRetry={refetch}
 *     skeleton={<PostsSkeleton />}              // optional custom loader
 *     emptyState={{ title: 'No posts yet', description: '…', action: <Button/> }}
 *   >
 *     <PostsGrid posts={posts} />
 *   </DataState>
 *
 * Precedence: loading → error → empty → children.
 */
function DataState({
  loading,
  error,
  empty,
  children,
  skeleton,
  loadingLabel = 'Loading…',
  onRetry,
  emptyState,
  className,
}) {
  if (loading) {
    if (skeleton) return skeleton;
    return (
      <div className={cn('flex items-center justify-center gap-3 px-8 py-16 text-fg-muted', className)}>
        <Spinner />
        <span className="text-sm">{loadingLabel}</span>
      </div>
    );
  }

  if (error) {
    const message = typeof error === 'string' ? error : error?.message || 'Something went wrong.';
    return (
      <EmptyState
        className={className}
        icon={<AlertTriangle className="text-danger" />}
        title="Couldn’t load this"
        description={message}
        action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
      />
    );
  }

  if (empty) {
    return (
      <EmptyState
        className={className}
        title={emptyState?.title || 'Nothing here yet'}
        description={emptyState?.description}
        icon={emptyState?.icon}
        action={emptyState?.action}
      />
    );
  }

  return children;
}

export { DataState };
