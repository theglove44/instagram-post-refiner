'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/engagement', label: 'Inbox' },
  { href: '/engagement/mentions', label: 'Mentions & Tags' },
];

export default function EngagementSubNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '20px',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              textDecoration: 'none',
              borderBottom: isActive
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.15s ease',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
