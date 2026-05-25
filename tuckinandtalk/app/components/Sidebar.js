'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="6" height="6" rx="1" />
        <rect x="10" y="2" width="6" height="6" rx="1" />
        <rect x="2" y="10" width="6" height="6" rx="1" />
        <rect x="10" y="10" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Posts',
    href: '/posts',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="14" height="12" rx="1.5" />
        <line x1="5" y1="7" x2="13" y2="7" />
        <line x1="5" y1="10" x2="10" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Hashtags',
    href: '/hashtags',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="6" y1="2" x2="5" y2="16" />
        <line x1="12" y1="2" x2="11" y2="16" />
        <line x1="2" y1="6.5" x2="16" y2="6.5" />
        <line x1="2" y1="11.5" x2="16" y2="11.5" />
      </svg>
    ),
  },
  {
    label: 'Competitors',
    href: '/competitors',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="6" cy="6" r="3" />
        <circle cx="12" cy="6" r="3" />
        <path d="M2 15c0-2.2 1.8-4 4-4h6c2.2 0 4 1.8 4 4" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M3.9 3.9l1.1 1.1M13 13l1.1 1.1M3.9 14.1l1.1-1.1M13 5l1.1-1.1" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">T</div>
        {!collapsed && (
          <div className="sidebar-brand">
            <strong>Tuckin &amp; Talk</strong>
            Analytics
          </div>
        )}
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </div>

      <div className="sidebar-toggle">
        <button onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 4l4 4-4 4" />
            </svg>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4L6 8l4 4" />
              </svg>
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
