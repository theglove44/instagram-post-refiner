'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CalendarGrid from '../../components/CalendarGrid';
import PostCard from '../../components/PostCard';

function getMonthViewRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startDay = firstOfMonth.getDay();
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startDay);
  const endDay = lastOfMonth.getDay();
  const end = new Date(lastOfMonth);
  end.setDate(end.getDate() + (6 - endDay));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekViewRange(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [selectedDay, setSelectedDay] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async (date) => {
    setLoading(true);
    try {
      const { start, end } = view === 'month'
        ? getMonthViewRange(date)
        : getWeekViewRange(date);
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const res = await fetch(`/api/publish/calendar?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to fetch calendar posts:', err);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    fetchPosts(currentDate);
  }, [currentDate, fetchPosts]);

  function navigatePrev() {
    setCurrentDate(prev => {
      const next = new Date(prev);
      if (view === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setDate(next.getDate() - 7);
      }
      return next;
    });
  }

  function navigateNext() {
    setCurrentDate(prev => {
      const next = new Date(prev);
      if (view === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 7);
      }
      return next;
    });
  }

  function handleDayClick(date) {
    setSelectedDay(prev =>
      prev && isSameDay(prev, date) ? null : date
    );
  }

  function handleDateChange(date) {
    setCurrentDate(date);
    setSelectedDay(null);
  }

  async function handleCancelPost(postId) {
    try {
      await fetch(`/api/publish/draft?id=${postId}`, { method: 'DELETE' });
      fetchPosts(currentDate);
      if (selectedDay) {
        const remaining = posts.filter(p => p.id !== postId);
        setPosts(remaining);
      }
    } catch (err) {
      console.error('Failed to cancel post:', err);
    }
  }

  async function handlePublishNow(postId) {
    try {
      await fetch('/api/publish/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId }),
      });
      fetchPosts(currentDate);
    } catch (err) {
      console.error('Failed to publish post:', err);
    }
  }

  const selectedDayPosts = selectedDay
    ? posts.filter(p => {
        const postDate = new Date(p.scheduledAt || p.createdAt);
        return isSameDay(postDate, selectedDay);
      })
    : [];

  const hasAnyPosts = posts.length > 0;

  return (
    <div style={{ display: 'flex', gap: '24px', minHeight: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}>
            Content Calendar
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setView('month')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: view === 'month' ? 'var(--accent)' : 'transparent',
                  color: view === 'month' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Month
              </button>
              <button
                onClick={() => setView('week')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: view === 'week' ? 'var(--accent)' : 'transparent',
                  color: view === 'week' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Week
              </button>
            </div>

            <Link
              href="/compose"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
            >
              + New Post
            </Link>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <button
            onClick={navigatePrev}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            &larr;
          </button>
          <span style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            {formatMonthYear(currentDate)}
          </span>
          <button
            onClick={navigateNext}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            &rarr;
          </button>
        </div>

        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '60px 0',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}>
            Loading calendar...
          </div>
        ) : !hasAnyPosts ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              margin: '0 0 16px',
            }}>
              No content scheduled. Start composing!
            </p>
            <Link
              href="/compose"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Create Your First Post
            </Link>
          </div>
        ) : (
          <CalendarGrid
            currentDate={currentDate}
            view={view}
            posts={posts}
            selectedDay={selectedDay}
            onDayClick={handleDayClick}
            onDateChange={handleDateChange}
          />
        )}
      </div>

      {selectedDay && (
        <div
          style={{
            width: '360px',
            flexShrink: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            alignSelf: 'flex-start',
            position: 'sticky',
            top: '24px',
            animation: 'slideInRight 0.2s ease',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <h2 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}>
              {selectedDay.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </h2>
            <button
              onClick={() => setSelectedDay(null)}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>

          {selectedDayPosts.length === 0 ? (
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              textAlign: 'center',
              padding: '20px 0',
              margin: 0,
            }}>
              No posts scheduled for this day.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedDayPosts.map(post => (
                <div key={post.id}>
                  <PostCard post={post} showActions={false} />
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px',
                  }}>
                    <button
                      onClick={() => router.push(`/compose?id=${post.id}`)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleCancelPost(post.id)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'var(--error-soft)',
                        border: '1px solid var(--error)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--error)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'var(--success-soft)',
                        border: '1px solid var(--success)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--success)',
                        cursor: 'pointer',
                      }}
                    >
                      Publish Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (max-width: 1024px) {
          .calendar-page-wrapper {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
