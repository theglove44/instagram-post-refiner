'use client';

function relativeTime(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

function MediaPlaceholder() {
  return (
    <div
      style={{
        width: 80,
        height: 80,
        minWidth: 80,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-dim)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  );
}

export default function MentionCard({ mention, onMarkSeen, onReply }) {
  const isUnseen = mention.replyStatus === 'unseen';
  const statusColors = {
    unseen: { bg: 'var(--error-soft)', color: 'var(--error)', label: 'Unseen' },
    seen: {
      bg: 'var(--warning-soft)',
      color: 'var(--warning)',
      label: 'Seen',
    },
    replied: {
      bg: 'var(--success-soft)',
      color: 'var(--success)',
      label: 'Replied',
    },
  };
  const status = statusColors[mention.replyStatus] || statusColors.unseen;

  const typeBadge =
    mention.mentionType === 'tagged' ? 'Tagged' : '@Mentioned';

  const handleCardClick = () => {
    if (isUnseen) {
      onMarkSeen(mention.id);
    }
  };

  const captionPreview = mention.caption
    ? mention.caption.length > 100
      ? mention.caption.slice(0, 100) + '...'
      : mention.caption
    : null;

  return (
    <div
      onClick={handleCardClick}
      style={{
        display: 'flex',
        gap: '14px',
        padding: '14px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isUnseen ? 'var(--accent-soft)' : 'var(--border)'}`,
        cursor: isUnseen ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (isUnseen) e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isUnseen
          ? 'var(--accent-soft)'
          : 'var(--border)';
      }}
    >
      {/* Media thumbnail */}
      {mention.mediaUrl ? (
        <img
          src={mention.mediaUrl}
          alt=""
          style={{
            width: 80,
            height: 80,
            minWidth: 80,
            borderRadius: 'var(--radius-sm)',
            objectFit: 'cover',
          }}
        />
      ) : (
        <MediaPlaceholder />
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Badges row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            {typeBadge}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: status.bg,
              color: status.color,
            }}
          >
            {status.label}
          </span>
        </div>

        {/* Username */}
        <p
          style={{
            margin: '0 0 4px 0',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          @{mention.mentionedBy}
        </p>

        {/* Caption preview */}
        {captionPreview && (
          <p
            style={{
              margin: '0 0 4px 0',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            {captionPreview}
          </p>
        )}

        {/* Timestamp */}
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: '0.76rem',
            color: 'var(--text-dim)',
          }}
        >
          {relativeTime(mention.timestamp)}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {isUnseen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkSeen(mention.id);
              }}
              style={{
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 500,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-soft)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
            >
              Mark as Seen
            </button>
          )}
          {mention.permalink && (
            <a
              href={mention.permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 500,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              View on IG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
