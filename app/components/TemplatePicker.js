'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function TemplatePicker({ isOpen, onClose, onSelect, currentCaption }) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchTemplates();
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const fetchTemplates = useCallback(() => {
    fetch('/api/publish/templates')
      .then(res => res.json())
      .then(data => {
        const items = data.templates || data.data || [];
        setTemplates(items);
        const cats = [...new Set(items.map(t => t.category).filter(Boolean))];
        setCategories(cats);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'All'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const handleSelect = useCallback((template) => {
    onSelect(template.caption);
    onClose();
  }, [onSelect, onClose]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim() || !currentCaption?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/publish/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          category: saveCategory.trim() || null,
          caption: currentCaption,
        }),
      });
      if (res.ok) {
        setSaveName('');
        setSaveCategory('');
        setShowSaveForm(false);
        fetchTemplates();
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [saveName, saveCategory, currentCaption, fetchTemplates]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Templates</span>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
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
      )}

      {/* Template list */}
      <div style={styles.body}>
        {loading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No saved templates yet</p>
          </div>
        ) : (
          filtered.map((template, i) => (
            <button
              key={template.id || i}
              style={styles.templateItem}
              onClick={() => handleSelect(template)}
            >
              <div style={styles.templateHeader}>
                <span style={styles.templateName}>{template.name}</span>
                {template.category && (
                  <span style={styles.categoryBadge}>{template.category}</span>
                )}
              </div>
              <p style={styles.templatePreview}>
                {(template.caption || '').slice(0, 80)}
                {(template.caption || '').length > 80 ? '...' : ''}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Save current as template */}
      {currentCaption?.trim() && (
        <div style={styles.footer}>
          {showSaveForm ? (
            <div style={styles.saveForm}>
              <input
                style={styles.input}
                type="text"
                placeholder="Template name"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                autoFocus
              />
              <select
                style={styles.select}
                value={saveCategory}
                onChange={e => setSaveCategory(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div style={styles.saveActions}>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowSaveForm(false)}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.saveBtn,
                    opacity: saveName.trim() ? 1 : 0.5,
                  }}
                  onClick={handleSave}
                  disabled={!saveName.trim() || saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <button
              style={styles.saveCurrentBtn}
              onClick={() => setShowSaveForm(true)}
            >
              Save Current as Template
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 8,
    zIndex: 100,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    width: 380,
    maxHeight: 440,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-sm)',
  },
  filters: {
    display: 'flex',
    gap: 6,
    padding: '8px 16px',
    overflowX: 'auto',
    borderBottom: '1px solid var(--border)',
  },
  filterPill: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '4px 10px',
    fontSize: 12,
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
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
  },
  templateItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
    color: 'var(--text)',
  },
  templateHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  templateName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    padding: '2px 8px',
    borderRadius: 10,
  },
  templatePreview: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    padding: '24px 16px',
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '10px 16px',
  },
  saveCurrentBtn: {
    width: '100%',
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
  },
  saveForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.15s var(--ease-out)',
  },
  select: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  },
  saveActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.15s var(--ease-out)',
  },
};
