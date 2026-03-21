'use client';

import { useState, useRef, useCallback } from 'react';

// Note: Styling hashtags within a textarea is not natively possible.
// A future enhancement could overlay a contentEditable div with highlighted
// hashtags on top of the textarea, or use a custom rich-text approach.

const MAX_CHARS = 2200;
const WARN_CHARS = 2000;

export default function CaptionEditor({ caption, onCaptionChange, onInsertHashtags, onLoadTemplate }) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  const charCount = caption?.length || 0;

  const getCounterColor = useCallback(() => {
    if (charCount >= MAX_CHARS) return 'var(--error)';
    if (charCount >= WARN_CHARS) return 'var(--warning)';
    return 'var(--text-muted)';
  }, [charCount]);

  const handleChange = (e) => {
    onCaptionChange(e.target.value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${isFocused ? 'var(--border-active)' : 'var(--border)'}`,
          transition: `border-color 0.2s var(--ease-out)`,
          background: 'var(--bg-input)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={caption || ''}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Write your caption..."
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '14px',
            lineHeight: '1.6',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onInsertHashtags}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '13px',
              cursor: 'pointer',
              transition: `all 0.2s var(--ease-out)`,
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
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>#</span>
            Insert Hashtags
          </button>

          <button
            onClick={onLoadTemplate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '13px',
              cursor: 'pointer',
              transition: `all 0.2s var(--ease-out)`,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Template
          </button>
        </div>

        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: getCounterColor(),
            fontWeight: charCount >= WARN_CHARS ? 600 : 400,
            transition: `color 0.2s var(--ease-out)`,
          }}
        >
          {charCount} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
