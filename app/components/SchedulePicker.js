'use client';

import { useState, useMemo, useCallback } from 'react';

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getNextOccurrence(dayName, hourLabel) {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .indexOf(dayName);
  if (dayIndex === -1) return null;

  // Parse hourLabel like "6pm", "10am", "12pm"
  const match = hourLabel?.match(/^(\d{1,2})(am|pm)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const isPM = match[2].toLowerCase() === 'pm';
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;

  const now = new Date();
  const result = new Date(now);
  result.setHours(hour, 0, 0, 0);

  // Find the next occurrence of that day
  const currentDay = now.getDay();
  let daysAhead = dayIndex - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  if (daysAhead === 0 && result <= now) daysAhead = 7;
  result.setDate(result.getDate() + daysAhead);

  return result;
}

function toLocalDatetimeString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function SchedulePicker({ onSchedule, onPublishNow, onSaveDraft, isPublishing, bestTimes }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Unknown';
    }
  }, []);

  const handleBestTimeClick = useCallback((bt) => {
    const date = getNextOccurrence(bt.dayName, bt.hourLabel);
    if (date) {
      setScheduledAt(toLocalDatetimeString(date));
    }
  }, []);

  const handleScheduleConfirm = useCallback(() => {
    if (!scheduledAt) return;
    onSchedule({
      scheduledAt: new Date(scheduledAt).toISOString(),
      timezone,
    });
    setScheduleOpen(false);
    setScheduledAt('');
  }, [scheduledAt, timezone, onSchedule]);

  return (
    <div style={styles.container}>
      {/* Three main action buttons */}
      <div style={styles.actions}>
        <button
          style={{
            ...styles.publishBtn,
            opacity: isPublishing ? 0.7 : 1,
            cursor: isPublishing ? 'not-allowed' : 'pointer',
          }}
          onClick={onPublishNow}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <span style={styles.spinner} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
          {isPublishing ? 'Publishing...' : 'Publish Now'}
        </button>

        <button
          style={{
            ...styles.scheduleBtn,
            ...(scheduleOpen ? styles.scheduleBtnActive : {}),
          }}
          onClick={() => setScheduleOpen(!scheduleOpen)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Schedule
        </button>

        <button style={styles.draftBtn} onClick={onSaveDraft}>
          Save Draft
        </button>
      </div>

      {/* Schedule picker panel */}
      {scheduleOpen && (
        <div style={styles.schedulePanel}>
          <div style={styles.dateRow}>
            <input
              type="datetime-local"
              style={styles.datetimeInput}
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={toLocalDatetimeString(new Date())}
            />
            <span style={styles.timezone}>{timezone}</span>
          </div>

          {/* Best times */}
          {bestTimes && bestTimes.length > 0 && (
            <div style={styles.bestTimesSection}>
              <span style={styles.bestTimesLabel}>Best times</span>
              <div style={styles.bestTimesRow}>
                {bestTimes.map((bt, i) => {
                  const dayAbbr = bt.dayName ? bt.dayName.slice(0, 3) : '';
                  const engagement = bt.avgEngagement != null
                    ? `${bt.avgEngagement.toFixed(1)}%`
                    : '';
                  return (
                    <button
                      key={i}
                      style={styles.bestTimeChip}
                      onClick={() => handleBestTimeClick(bt)}
                      title={`${bt.postCount || 0} posts`}
                    >
                      <span style={styles.bestTimeDay}>{dayAbbr}</span>
                      <span style={styles.bestTimeHour}>{bt.hourLabel}</span>
                      {engagement && (
                        <span style={styles.bestTimeRate}>{engagement}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            style={{
              ...styles.confirmScheduleBtn,
              opacity: scheduledAt ? 1 : 0.5,
              cursor: scheduledAt ? 'pointer' : 'not-allowed',
            }}
            onClick={handleScheduleConfirm}
            disabled={!scheduledAt}
          >
            Schedule Post
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  actions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  publishBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--ig-pink), var(--accent-hover))',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.15s var(--ease-out)',
    minWidth: 140,
  },
  spinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    marginRight: 8,
  },
  scheduleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all 0.15s var(--ease-out)',
  },
  scheduleBtnActive: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  draftBtn: {
    background: 'none',
    border: 'none',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'color 0.15s var(--ease-out)',
  },
  schedulePanel: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  datetimeInput: {
    flex: 1,
    minWidth: 200,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text)',
    colorScheme: 'dark',
    outline: 'none',
    transition: 'border-color 0.15s var(--ease-out)',
  },
  timezone: {
    fontSize: 12,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  bestTimesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bestTimesLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  bestTimesRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  bestTimeChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--text)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s var(--ease-out)',
    flexShrink: 0,
  },
  bestTimeDay: {
    fontWeight: 600,
    color: 'var(--text)',
  },
  bestTimeHour: {
    color: 'var(--text-secondary)',
  },
  bestTimeRate: {
    color: 'var(--success)',
    fontWeight: 500,
    fontSize: 11,
  },
  confirmScheduleBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.15s var(--ease-out)',
    alignSelf: 'flex-start',
  },
};
