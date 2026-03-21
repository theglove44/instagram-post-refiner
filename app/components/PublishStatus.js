'use client';

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    bg: 'rgba(150, 150, 150, 0.12)',
    color: 'var(--text-muted)',
    icon: null,
    pulse: false,
    strikethrough: false,
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    pulse: false,
    strikethrough: false,
  },
  publishing: {
    label: 'Publishing',
    bg: 'rgba(234, 179, 8, 0.15)',
    color: 'var(--warning)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    ),
    pulse: true,
    strikethrough: false,
  },
  published: {
    label: 'Published',
    bg: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--success)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    pulse: false,
    strikethrough: false,
  },
  failed: {
    label: 'Failed',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--error)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    pulse: false,
    strikethrough: false,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'rgba(150, 150, 150, 0.12)',
    color: 'var(--text-muted)',
    icon: null,
    pulse: false,
    strikethrough: true,
  },
};

export default function PublishStatus({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        background: config.bg,
        color: config.color,
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: "'Outfit', sans-serif",
        textDecoration: config.strikethrough ? 'line-through' : 'none',
        whiteSpace: 'nowrap',
        animation: config.pulse ? 'publish-pulse 2s ease-in-out infinite' : 'none',
      }}
    >
      {config.icon}
      {config.label}

      {config.pulse && (
        <style>{`
          @keyframes publish-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
          }
        `}</style>
      )}
    </span>
  );
}
