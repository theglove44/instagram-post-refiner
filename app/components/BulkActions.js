'use client';

export default function BulkActions({
  selectedCount,
  onHideAll,
  onMarkRead,
  onClearSelection,
}) {
  if (selectedCount <= 0) return null;

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'bulkSlideUp 0.2s ease',
      }}
    >
      <span
        style={{
          fontSize: '0.85rem',
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        {selectedCount} selected
      </span>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onHideAll}
          style={{
            padding: '7px 16px',
            fontSize: '0.82rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--warning)',
            background: 'var(--warning-soft)',
            color: 'var(--warning)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--warning)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--warning-soft)';
            e.currentTarget.style.color = 'var(--warning)';
          }}
        >
          Hide All
        </button>
        <button
          onClick={onMarkRead}
          style={{
            padding: '7px 16px',
            fontSize: '0.82rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--success)',
            background: 'var(--success-soft)',
            color: 'var(--success)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--success)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--success-soft)';
            e.currentTarget.style.color = 'var(--success)';
          }}
        >
          Mark as Read
        </button>
        <button
          onClick={onClearSelection}
          style={{
            padding: '7px 16px',
            fontSize: '0.82rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
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
          Clear
        </button>
      </div>

      <style jsx>{`
        @keyframes bulkSlideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
