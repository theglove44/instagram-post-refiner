'use client';

import { useEffect, useCallback } from 'react';

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  confirmStyle = 'primary',
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const confirmBg =
    confirmStyle === 'danger' ? 'var(--error)' : 'var(--accent)';
  const confirmHoverBg =
    confirmStyle === 'danger' ? '#dc2626' : 'var(--accent-hover)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'confirmOverlayIn 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border)',
          animation: 'confirmModalIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
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
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: confirmBg,
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = confirmHoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = confirmBg;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes confirmOverlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes confirmModalIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
