'use client';

import { useState, useEffect, useCallback } from 'react';

export default function HashtagPicker({ isOpen, onClose, onInsert }) {
  const [hashtags, setHashtags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/hashtags/library')
      .then(res => res.json())
      .then(data => {
        const items = data.hashtags || data.data || [];
        setHashtags(items);
        const cats = [...new Set(items.map(h => h.category).filter(Boolean))];
        setCategories(cats);
      })
      .catch(() => setHashtags([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = activeCategory === 'All'
    ? hashtags
    : hashtags.filter(h => h.category === activeCategory);

  const handleCopyAll = useCallback(() => {
    const text = filtered.map(h => {
      const tag = h.hashtag || h.name || '';
      return tag.startsWith('#') ? tag : `#${tag}`;
    }).join(' ');
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  }, [filtered]);

  const handleInsert = useCallback((h) => {
    const tag = h.hashtag || h.name || '';
    onInsert(tag.startsWith('#') ? tag : `#${tag}`);
  }, [onInsert]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Insert Hashtags</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Category filters */}
        <div style={styles.filters}>
          {['All', ...categories].map(cat => (
            <button
              key={cat}
              style={{
                ...styles.filterPill,
                ...(activeCategory === cat ? styles.filterPillActive : {}),
              }}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Count */}
        <div style={styles.count}>{filtered.length} hashtag{filtered.length !== 1 ? 's' : ''}</div>

        {/* Content */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.emptyState}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={styles.emptyState}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="14" y2="21" />
              </svg>
              <p style={styles.emptyText}>No hashtags in your library yet. Add them in Settings.</p>
            </div>
          ) : (
            <div style={styles.chips}>
              {filtered.map((h, i) => {
                const tag = h.hashtag || h.name || '';
                const display = tag.startsWith('#') ? tag : `#${tag}`;
                return (
                  <button
                    key={h.id || i}
                    style={styles.chip}
                    onClick={() => handleInsert(h)}
                    title={h.notes || undefined}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={styles.footer}>
            <button style={styles.copyBtn} onClick={handleCopyAll}>
              {copyFeedback ? 'Copied!' : 'Copy All Visible'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxWidth: 520,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s var(--ease-out)',
  },
  filters: {
    display: 'flex',
    gap: 8,
    padding: '12px 20px',
    overflowX: 'auto',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  filterPill: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s var(--ease-out)',
  },
  filterPillActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  count: {
    padding: '8px 20px 0',
    fontSize: 12,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 20px',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 14,
    color: 'var(--accent)',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
    fontWeight: 500,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  copyBtn: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
  },
};
