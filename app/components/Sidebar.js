'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_SECTIONS = [
  {
    label: 'VOICE',
    items: [
      { name: 'Workshop', href: '/edit', icon: '\u270F\uFE0F' },
      { name: 'History', href: '/history', icon: '\uD83D\uDCDA' },
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
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={toggleMobile}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        aria-controls="primary-navigation"
      >
        <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
          <span />
          <span />
          <span />
        </span>
      </button>

      {mobileOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside id="primary-navigation" className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/edit" className="sidebar-logo" aria-label="Voice Workshop">
            <span className="sidebar-logo-icon" aria-hidden="true">{'\uD83D\uDCDD'}</span>
            {!collapsed && <span className="sidebar-logo-text">Voice Workshop</span>}
          </Link>
        </div>

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
                      <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                      {!collapsed && (
                        <span className="sidebar-link-text">{item.name}</span>
                      )}
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

        <Link
          href="/settings"
          className={`sidebar-link sidebar-utility-link ${isActive('/settings') ? 'sidebar-link-active' : ''}`}
          aria-label={collapsed ? 'Settings' : undefined}
          title={collapsed ? 'Settings' : undefined}
        >
          <span className="sidebar-link-icon" aria-hidden="true">{'\u2699\uFE0F'}</span>
          {!collapsed && <span className="sidebar-link-text">Settings</span>}
        </Link>

        <form action="/auth/logout" method="post" className="sidebar-logout-form">
          <button
            type="submit"
            className="sidebar-link sidebar-utility-link sidebar-logout-button"
            aria-label={collapsed ? 'Sign out' : undefined}
            title={collapsed ? 'Sign out' : undefined}
          >
            <span className="sidebar-link-icon" aria-hidden="true">↪</span>
            {!collapsed && <span className="sidebar-link-text">Sign out</span>}
          </button>
        </form>

        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
        >
          <span className={`sidebar-collapse-icon ${collapsed ? 'sidebar-collapse-icon-flipped' : ''}`}>
            {'\u00AB'}
          </span>
          {!collapsed && <span className="sidebar-collapse-text">Collapse</span>}
        </button>
      </aside>
    </>
  );
}
