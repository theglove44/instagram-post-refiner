'use client';

import { useState, useEffect, useRef } from 'react';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unreplied', label: 'Unreplied' },
  { key: 'replied', label: 'Replied' },
  { key: 'hidden', label: 'Hidden' },
];

export default function CommentFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  total,
  counts,
}) {
  const [localSearch, setLocalSearch] = useState(search || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalSearch(search || '');
  }, [search]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalSearch(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '16px',
      }}
    >
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {TABS.map((tab) => {
          const isActive = filter === tab.key;
          const count = counts?.[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              style={{
                padding: '6px 14px',
                fontSize: '0.83rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {tab.label}
              {count != null && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive
                      ? 'var(--accent-soft)'
                      : 'var(--bg-elevated)',
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right side: search + total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
          }}
        >
          {total != null ? `${total} comments` : ''}
        </span>
        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder="Search comments..."
            style={{
              padding: '7px 12px 7px 30px',
              fontSize: '0.83rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              outline: 'none',
              width: '200px',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-active)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          />
        </div>
      </div>
    </div>
  );
}
