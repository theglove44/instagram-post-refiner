'use client';

/**
 * MilestoneMarkers — displays achieved follower milestones and progress
 * toward the next one. Self-contained component with inline styles
 * matching the app's dark theme via CSS variables.
 *
 * Props:
 *   milestones  — Array of { threshold, date, followersOnDate }
 *   nextMilestone — { threshold, remaining } or null
 */
export default function MilestoneMarkers({ milestones = [], nextMilestone = null }) {
  const hasMilestones = milestones.length > 0;
  const hasNext = nextMilestone !== null;

  if (!hasMilestones && !hasNext) {
    return (
      <section style={styles.section}>
        <h3 style={styles.heading}>Milestones</h3>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6-6 6 6" />
              <path d="M12 3v14" />
              <path d="M4 21h16" />
            </svg>
          </span>
          <p style={styles.emptyText}>Keep posting! Your first milestone awaits.</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <h3 style={styles.heading}>Milestones</h3>

      {hasMilestones && (
        <div style={styles.grid}>
          {milestones.map((m) => (
            <div key={m.threshold} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={styles.trophy}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                  </svg>
                </span>
                <span style={styles.threshold}>{formatNumber(m.threshold)}</span>
              </div>
              <p style={styles.date}>{formatDate(m.date)}</p>
              <p style={styles.actual}>
                {formatNumber(m.followersOnDate)} followers
              </p>
            </div>
          ))}
        </div>
      )}

      {hasNext && (
        <div style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>Next milestone</span>
            <span style={styles.progressTarget}>{formatNumber(nextMilestone.threshold)}</span>
          </div>
          <div style={styles.progressBarTrack}>
            <div
              style={{
                ...styles.progressBarFill,
                width: `${getProgress(nextMilestone)}%`,
              }}
            />
          </div>
          <p style={styles.progressRemaining}>
            {formatNumber(nextMilestone.remaining)} followers to go
          </p>
        </div>
      )}
    </section>
  );
}

function formatNumber(n) {
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return n.toLocaleString();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getProgress(next) {
  if (!next) return 0;
  const current = next.threshold - next.remaining;
  // Find the previous milestone to measure progress from
  const milestoneValues = [0, 100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
  const prevThreshold = milestoneValues.filter((m) => m < next.threshold).pop() || 0;
  const range = next.threshold - prevThreshold;
  if (range <= 0) return 0;
  return Math.min(100, Math.max(0, ((current - prevThreshold) / range) * 100));
}

const styles = {
  section: {
    marginTop: '24px',
  },
  heading: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 12px)',
    padding: '16px',
    transition: 'border-color 0.2s',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  trophy: {
    display: 'flex',
    alignItems: 'center',
  },
  threshold: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  date: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '0 0 2px 0',
  },
  actual: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: 0,
  },
  progressCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 12px)',
    padding: '16px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  progressLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  progressTarget: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  progressBarTrack: {
    width: '100%',
    height: '6px',
    background: 'var(--bg-elevated, #1e1e24)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), var(--ig-purple, #833ab4))',
    borderRadius: '3px',
    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  progressRemaining: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 12px)',
  },
  emptyIcon: {
    marginBottom: '12px',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    margin: 0,
  },
};
