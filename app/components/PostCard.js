'use client';

import { useMemo } from 'react';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  scheduled: { label: 'Scheduled', color: 'var(--warning)', bg: 'var(--warning-soft)' },
  publishing: { label: 'Publishing', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  published: { label: 'Published', color: 'var(--success)', bg: 'var(--success-soft)' },
  failed: { label: 'Failed', color: 'var(--error)', bg: 'var(--error-soft)' },
};

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date - now;
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  const minutes = Math.floor(absDiffMs / 60000);
  const hours = Math.floor(absDiffMs / 3600000);
  const days = Math.floor(absDiffMs / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return isFuture ? `in ${minutes}m` : `${minutes}m ago`;
  if (hours < 24) return isFuture ? `in ${hours}h` : `${hours}h ago`;
  if (days < 30) return isFuture ? `in ${days}d` : `${days} day${days !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMediaType(mediaType, mediaCount) {
  const type = (mediaType || '').toUpperCase();
  if (type === 'CAROUSEL' || type === 'CAROUSEL_ALBUM') {
    return `CAROUSEL${mediaCount ? ` (${mediaCount})` : ''}`;
  }
  if (type === 'VIDEO' || type === 'REEL') return 'REEL';
  return 'IMAGE';
}

function IconButton({ icon, label, onClick, style: customStyle }) {
  return (
    <button
      style={{ ...styles.iconBtn, ...customStyle }}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

export default function PostCard({ post, onEdit, onDelete, onSchedule, onPublishNow, onCancel, showActions }) {
  const status = post.status || 'draft';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const dateStr = post.scheduledAt || post.publishedAt;
  const relativeDate = useMemo(() => formatRelativeDate(dateStr), [dateStr]);
  const mediaLabel = formatMediaType(post.mediaType, post.mediaCount);

  const isDraft = status === 'draft';
  const isScheduled = status === 'scheduled';
  const canPublish = isDraft || isScheduled;

  return (
    <div style={styles.card}>
      {/* Thumbnail */}
      <div style={styles.thumbnailWrap}>
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt=""
            style={styles.thumbnail}
            loading="lazy"
          />
        ) : (
          <div style={styles.thumbnailPlaceholder}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.topRow}>
          {/* Status badge */}
          <span style={{
            ...styles.statusBadge,
            color: statusCfg.color,
            background: statusCfg.bg,
          }}>
            {statusCfg.label}
          </span>

          {/* Media type badge */}
          <span style={styles.mediaTypeBadge}>{mediaLabel}</span>

          {/* Date */}
          {relativeDate && (
            <span style={styles.date}>{relativeDate}</span>
          )}
        </div>

        {/* Caption preview */}
        <p style={styles.caption}>
          {post.caption
            ? (post.caption.length > 100 ? post.caption.slice(0, 100) + '...' : post.caption)
            : 'No caption'}
        </p>

        {/* Actions */}
        {showActions && (
          <div style={styles.actionsRow}>
            {onEdit && (
              <IconButton
                label="Edit"
                onClick={() => onEdit(post)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                }
              />
            )}
            {onDelete && (
              <IconButton
                label="Delete"
                onClick={() => onDelete(post)}
                style={{ color: 'var(--error)' }}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                }
              />
            )}
            {onSchedule && isDraft && (
              <IconButton
                label="Schedule"
                onClick={() => onSchedule(post)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
              />
            )}
            {onPublishNow && canPublish && (
              <IconButton
                label="Publish Now"
                onClick={() => onPublishNow(post)}
                style={{ color: 'var(--ig-pink)' }}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                }
              />
            )}
            {onCancel && isScheduled && (
              <IconButton
                label="Cancel"
                onClick={() => onCancel(post)}
                style={{ color: 'var(--text-muted)' }}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    display: 'flex',
    gap: 14,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: 14,
    transition: 'border-color 0.15s var(--ease-out)',
    cursor: 'default',
  },
  thumbnailWrap: {
    flexShrink: 0,
    width: 120,
    height: 120,
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'var(--bg-deep)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  mediaTypeBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    padding: '3px 8px',
    borderRadius: 10,
  },
  date: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  caption: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  actionsRow: {
    display: 'flex',
    gap: 4,
    marginTop: 'auto',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s var(--ease-out)',
  },
};
