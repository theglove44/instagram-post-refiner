'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import EngagementBadge from './EngagementBadge';

const NAV_SECTIONS = [
  {
    label: 'CONTENT',
    items: [
      { name: 'Edit Post', href: '/edit', icon: '\u270F\uFE0F' },
      { name: 'Post History', href: '/history', icon: '\uD83D\uDCDA' },
      { name: 'Gallery', href: '/gallery', icon: '\uD83D\uDDBC\uFE0F' },
    ],
  },
  {
    label: 'PUBLISH',
    items: [
      { name: 'Compose', href: '/compose', icon: '\uD83D\uDCDD' },
      { name: 'Calendar', href: '/calendar', icon: '\uD83D\uDCC5' },
      { name: 'Drafts', href: '/drafts', icon: '\uD83D\uDCC4' },
      { name: 'Queue', href: '/queue', icon: '\u23F3' },
    ],
  },
  {
    label: 'ENGAGEMENT',
    items: [
      { name: 'Inbox', href: '/engagement', icon: '\uD83D\uDCEC', badge: true },
      { name: 'Mentions', href: '/engagement/mentions', icon: '\uD83D\uDD14' },
    ],
  },
  {
    label: 'ANALYSIS',
    items: [
      { name: 'Voice Analysis', href: '/analysis', icon: '\uD83D\uDCCA' },
    ],
  },
  {
    label: 'PERFORMANCE',
    items: [
      { name: 'Dashboard', href: '/performance', icon: '\uD83D\uDCC8' },
      { name: 'Post Metrics', href: '/performance/posts', icon: '\uD83D\uDCCB' },
      { name: 'Timing & Cadence', href: '/performance/timing', icon: '\u23F0' },
      { name: 'Content Analysis', href: '/performance/content', icon: '\uD83D\uDD0D' },
      { name: 'Hashtags', href: '/performance/hashtags', icon: '#' },
      { name: 'Audience', href: '/performance/audience', icon: '\uD83D\uDC65' },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { name: 'Settings', href: '/settings', icon: '\u2699\uFE0F' },
    ],
  },
];

const STORAGE_KEY = 'sidebar-collapsed';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const toggleMobile = () => {
    setMobileOpen(!mobileOpen);
  };

  const isActive = (href) => {
    if (href === '/performance') {
      return pathname === '/performance';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        className="sidebar-mobile-toggle"
        onClick={toggleMobile}
        aria-label="Toggle navigation"
      >
        <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
          <span />
          <span />
          <span />
        </span>
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* App title */}
        <div className="sidebar-header">
          <Link href="/edit" className="sidebar-logo">
            <span className="sidebar-logo-icon">{'\uD83D\uDCF8'}</span>
            {!collapsed && <span className="sidebar-logo-text">Post Logger</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="sidebar-section">
              {!collapsed && (
                <div className="sidebar-section-label">{section.label}</div>
              )}
              {collapsed && <div className="sidebar-section-divider" />}
              <ul className="sidebar-menu">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link ${isActive(item.href) ? 'sidebar-link-active' : ''}`}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className="sidebar-link-icon">{item.icon}</span>
                      {!collapsed && (
                        <span className="sidebar-link-text">{item.name}</span>
                      )}
                      {item.badge && !collapsed && <EngagementBadge />}
                      {!collapsed && isActive(item.href) && (
                        <span className="sidebar-active-indicator" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button className="sidebar-collapse-btn" onClick={toggleCollapsed}>
          <span className={`sidebar-collapse-icon ${collapsed ? 'sidebar-collapse-icon-flipped' : ''}`}>
            {'\u00AB'}
          </span>
          {!collapsed && <span className="sidebar-collapse-text">Collapse</span>}
        </button>
      </aside>
    </>
  );
}
