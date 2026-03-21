'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function EngagementBadge() {
  const [count, setCount] = useState(0);
  const [animate, setAnimate] = useState(false);
  const prevCountRef = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const res = await fetch('/api/comments/counts');
        if (!res.ok) return;
        const data = await res.json();
        const total =
          (data.unrepliedComments || 0) + (data.unseenMentions || 0);

        if (!cancelled) {
          if (prevCountRef.current === 0 && total > 0) {
            setAnimate(true);
          }
          prevCountRef.current = total;
          setCount(total);
        }
      } catch {
        // silently ignore fetch errors
      }
    }

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setAnimate(false), 300);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (count === 0) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 5px',
        fontSize: '11px',
        fontWeight: 600,
        lineHeight: 1,
        color: '#fff',
        background: 'var(--error)',
        borderRadius: '50%',
        animation: animate ? 'badgeScaleIn 0.3s ease' : 'none',
      }}
    >
      {count > 99 ? '99+' : count}

      <style jsx>{`
        @keyframes badgeScaleIn {
          0% {
            transform: scale(0);
          }
          60% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </span>
  );
}
