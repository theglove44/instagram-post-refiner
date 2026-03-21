'use client';

import { useState, useMemo, useCallback } from 'react';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-based week: getDay() returns 0=Sun, we want 0=Mon
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, currentMonth: false });
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), currentMonth: true });
  }

  // Next month padding to fill 6 rows
  while (days.length < 42) {
    const nextDate = new Date(year, month + 1, days.length - lastDay.getDate() - startOffset + 1);
    days.push({ date: nextDate, currentMonth: false });
  }

  return days;
}

function getWeekDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  // Monday-based: shift so Monday = 0
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    return wd;
  });
}

function formatHour(h) {
  if (h === 0 || h === 24) return '12am';
  if (h === 12) return '12pm';
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatWeekRange(days) {
  const start = days[0];
  const end = days[6];
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

const STATUS_COLORS = {
  scheduled: 'var(--accent)',
  published: 'var(--success)',
  failed: 'var(--error)',
  draft: 'var(--text-muted)',
  publishing: 'var(--warning)',
};

function getPostDate(post) {
  return new Date(post.scheduledAt || post.publishedAt || post.createdAt);
}

export default function CalendarGrid({ posts = [], currentDate, onDateChange, onDayClick, view: viewProp }) {
  const [activeView, setActiveView] = useState(viewProp || 'month');
  const today = useMemo(() => new Date(), []);

  const view = viewProp || activeView;

  // Group posts by date key (YYYY-MM-DD)
  const postsByDate = useMemo(() => {
    const map = {};
    posts.forEach(post => {
      const d = getPostDate(post);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(post);
    });
    return map;
  }, [posts]);

  const getDateKey = useCallback((date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);

  const handlePrev = useCallback(() => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    onDateChange(d);
  }, [currentDate, view, onDateChange]);

  const handleNext = useCallback(() => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    onDateChange(d);
  }, [currentDate, view, onDateChange]);

  const handleToday = useCallback(() => {
    onDateChange(new Date());
  }, [onDateChange]);

  const monthDays = useMemo(() =>
    getMonthDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.navGroup}>
          <button style={styles.navBtn} onClick={handlePrev} aria-label="Previous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 style={styles.headerTitle}>
            {view === 'month'
              ? formatMonthYear(currentDate)
              : formatWeekRange(weekDays)}
          </h2>
          <button style={styles.navBtn} onClick={handleNext} aria-label="Next">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button style={styles.todayBtn} onClick={handleToday}>Today</button>
        </div>

        <div style={styles.viewToggle}>
          <button
            style={{
              ...styles.viewBtn,
              ...(view === 'month' ? styles.viewBtnActive : {}),
            }}
            onClick={() => setActiveView('month')}
          >
            Month
          </button>
          <button
            style={{
              ...styles.viewBtn,
              ...(view === 'week' ? styles.viewBtnActive : {}),
            }}
            onClick={() => setActiveView('week')}
          >
            Week
          </button>
        </div>
      </div>

      {/* Month View */}
      {view === 'month' && (
        <div style={styles.monthGrid}>
          {/* Day names header */}
          {DAY_NAMES.map(name => (
            <div key={name} style={styles.dayNameCell}>{name}</div>
          ))}

          {/* Day cells */}
          {monthDays.map(({ date, currentMonth }, i) => {
            const key = getDateKey(date);
            const dayPosts = postsByDate[key] || [];
            const isToday = isSameDay(date, today);
            const displayPosts = dayPosts.slice(0, 3);
            const extraCount = dayPosts.length - 3;

            return (
              <div
                key={i}
                style={{
                  ...styles.dayCell,
                  ...(isToday ? styles.dayCellToday : {}),
                }}
                onClick={() => onDayClick(date)}
              >
                <span style={{
                  ...styles.dayNumber,
                  color: currentMonth ? 'var(--text)' : 'var(--text-dim)',
                  ...(isToday ? styles.dayNumberToday : {}),
                }}>
                  {date.getDate()}
                </span>
                {displayPosts.length > 0 && (
                  <div style={styles.dotRow}>
                    {displayPosts.map((p, j) => (
                      <span
                        key={p.id || j}
                        style={{
                          ...styles.dot,
                          background: STATUS_COLORS[p.status] || STATUS_COLORS.draft,
                        }}
                      />
                    ))}
                  </div>
                )}
                {extraCount > 0 && (
                  <span style={styles.moreText}>+{extraCount} more</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div style={styles.weekContainer}>
          {/* Time labels column + 7 day columns */}
          <div style={styles.weekGrid}>
            {/* Time gutter */}
            <div style={styles.timeGutter}>
              {HOURS.map(h => (
                <div key={h} style={styles.timeLabel}>{formatHour(h)}</div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((date, di) => {
              const key = getDateKey(date);
              const dayPosts = postsByDate[key] || [];
              const isToday = isSameDay(date, today);

              return (
                <div key={di} style={styles.weekDayCol}>
                  <div style={{
                    ...styles.weekDayHeader,
                    ...(isToday ? styles.weekDayHeaderToday : {}),
                  }}>
                    <span style={styles.weekDayName}>{DAY_NAMES[di]}</span>
                    <span style={{
                      ...styles.weekDayNum,
                      ...(isToday ? styles.weekDayNumToday : {}),
                    }}>{date.getDate()}</span>
                  </div>
                  <div style={styles.weekDayBody}>
                    {HOURS.map(h => (
                      <div key={h} style={styles.hourSlot} />
                    ))}
                    {/* Position posts at their scheduled hour */}
                    {dayPosts.map((post, pi) => {
                      const postDate = getPostDate(post);
                      const hour = postDate.getHours();
                      const clampedHour = Math.max(6, Math.min(23, hour));
                      const topPx = (clampedHour - 6) * 48;

                      return (
                        <div
                          key={post.id || pi}
                          style={{
                            ...styles.weekPostCard,
                            top: topPx,
                            borderLeftColor: STATUS_COLORS[post.status] || STATUS_COLORS.draft,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDayClick(date);
                          }}
                        >
                          {post.thumbnailUrl && (
                            <img src={post.thumbnailUrl} alt="" style={styles.weekPostThumb} />
                          )}
                          <span style={styles.weekPostTime}>{formatHour(hour)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    gap: 10,
  },
  navGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
  },
  headerTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    minWidth: 160,
    textAlign: 'center',
  },
  todayBtn: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    marginLeft: 4,
    transition: 'all 0.15s var(--ease-out)',
  },
  viewToggle: {
    display: 'flex',
    background: 'var(--bg-deep)',
    borderRadius: 'var(--radius-sm)',
    padding: 2,
  },
  viewBtn: {
    background: 'none',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
  },
  viewBtnActive: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow-sm)',
  },

  // Month view
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
  },
  dayNameCell: {
    padding: '10px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
  },
  dayCell: {
    minHeight: 80,
    padding: 6,
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.15s var(--ease-out)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  dayCellToday: {
    background: 'var(--bg-elevated)',
    borderColor: 'var(--accent)',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1,
  },
  dayNumberToday: {
    color: 'var(--accent)',
    fontWeight: 700,
  },
  dotRow: {
    display: 'flex',
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  moreText: {
    fontSize: 10,
    color: 'var(--text-dim)',
    marginTop: 'auto',
  },

  // Week view
  weekContainer: {
    overflowX: 'auto',
  },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: '50px repeat(7, 1fr)',
    minWidth: 600,
  },
  timeGutter: {
    borderRight: '1px solid var(--border)',
  },
  timeLabel: {
    height: 48,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingRight: 8,
    paddingTop: 2,
    fontSize: 10,
    color: 'var(--text-dim)',
  },
  weekDayCol: {
    borderRight: '1px solid var(--border)',
    position: 'relative',
  },
  weekDayHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 4px',
    borderBottom: '1px solid var(--border)',
    gap: 2,
  },
  weekDayHeaderToday: {
    background: 'var(--bg-elevated)',
  },
  weekDayName: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  weekDayNum: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
  },
  weekDayNumToday: {
    color: 'var(--accent)',
  },
  weekDayBody: {
    position: 'relative',
  },
  hourSlot: {
    height: 48,
    borderBottom: '1px solid var(--border)',
  },
  weekPostCard: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 40,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 6px',
    cursor: 'pointer',
    overflow: 'hidden',
    zIndex: 1,
    transition: 'box-shadow 0.15s var(--ease-out)',
  },
  weekPostThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    objectFit: 'cover',
    flexShrink: 0,
  },
  weekPostTime: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
};
