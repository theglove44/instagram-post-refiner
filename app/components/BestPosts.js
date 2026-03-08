'use client';

/**
 * BestPosts — displays top 10 posts ranked by performanceScore (or engagementRate fallback).
 *
 * Props:
 *   posts — Array of post objects from the derived endpoint, each with:
 *     - id, topic, publishedAt, instagramPermalink
 *     - metrics: { reach, views, likes, comments, saves, shares }
 *     - rates: { engagementRate, saveRate, shareRate, commentRate, likeRate }
 *     - percentiles: { engagementRate, saveRate, shareRate, commentRate, likeRate }
 *     - performanceScore (optional, 0-100, from story #31)
 *     - caption (optional), mediaType (optional)
 */
export default function BestPosts({ posts = [] }) {
  // Filter to posts that have metrics, then rank
  const postsWithData = posts.filter(p => p.metrics && p.rates);

  if (postsWithData.length === 0) {
    return (
      <section className="best-posts-card" style={styles.section}>
        <h2 style={styles.heading}>Your Best Posts</h2>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15l-3-3h6l-3 3z" />
              <circle cx="12" cy="8" r="2" />
              <path d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16l-4-2-3 2-3-2-4 2z" />
            </svg>
          </span>
          <p style={styles.emptyText}>Not enough data yet. Keep posting and checking back!</p>
        </div>
      </section>
    );
  }

  const ranked = [...postsWithData]
    .sort((a, b) => getScore(b) - getScore(a))
    .slice(0, 10);

  return (
    <section className="best-posts-card" style={styles.section}>
      <h2 style={styles.heading}>Your Best Posts</h2>
      <p style={styles.subtitle}>
        Top {ranked.length} post{ranked.length !== 1 ? 's' : ''} by {ranked[0]?.performanceScore != null ? 'performance score' : 'engagement rate'}
      </p>
      <div style={styles.list}>
        {ranked.map((post, index) => (
          <BestPostItem key={post.id} post={post} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function getScore(post) {
  if (post.performanceScore != null) return post.performanceScore;
  return post.rates?.engagementRate ?? 0;
}

function getScoreDisplay(post) {
  if (post.performanceScore != null) {
    return { value: post.performanceScore, label: 'score', isPercentage: false };
  }
  return { value: post.rates?.engagementRate, label: 'ER', isPercentage: true };
}

function getScoreColor(score, isPerformanceScore) {
  if (isPerformanceScore) {
    if (score >= 70) return 'var(--success)';
    if (score >= 40) return 'var(--warning)';
    return 'var(--error)';
  }
  // For engagement rate, use relative thresholds
  if (score >= 8) return 'var(--success)';
  if (score >= 4) return 'var(--warning)';
  return 'var(--error)';
}

function getHighlights(post) {
  const highlights = [];
  const p = post.percentiles;
  if (!p) return highlights;

  if (p.saveRate != null && p.saveRate > 75) highlights.push('High save rate');
  if (p.shareRate != null && p.shareRate > 75) highlights.push('Strong shares');
  if (p.commentRate != null && p.commentRate > 75) highlights.push('Great comments');
  if (p.likeRate != null && p.likeRate > 75) highlights.push('Popular likes');
  if (p.engagementRate != null && p.engagementRate > 75) highlights.push('Top engagement');

  // Reach-based highlight (compare to median)
  if (post.metrics?.reach && post.percentiles?.engagementRate != null) {
    // If engagement percentile is high, reach is likely strong too
    // but we can also check raw reach vs a rough median
  }

  return highlights.slice(0, 3); // Cap at 3 highlights
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatNumber(n) {
  if (n == null) return '--';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function BestPostItem({ post, rank }) {
  const scoreDisplay = getScoreDisplay(post);
  const isPerformanceScore = post.performanceScore != null;
  const scoreColor = getScoreColor(scoreDisplay.value, isPerformanceScore);
  const highlights = getHighlights(post);

  return (
    <div className="best-post-item" style={styles.item}>
      {/* Rank badge */}
      <div style={{
        ...styles.rankBadge,
        ...(rank <= 3 ? styles.rankTop3 : {}),
      }}>
        {rank}
      </div>

      {/* Main content */}
      <div style={styles.itemContent}>
        <div style={styles.itemHeader}>
          <span style={styles.topic}>{post.topic || 'Untitled post'}</span>
          <div style={styles.scoreBadge}>
            <span style={{ ...styles.scoreValue, color: scoreColor }}>
              {scoreDisplay.value != null
                ? `${scoreDisplay.isPercentage ? '' : ''}${typeof scoreDisplay.value === 'number' ? scoreDisplay.value.toFixed(scoreDisplay.isPercentage ? 2 : 0) : scoreDisplay.value}${scoreDisplay.isPercentage ? '%' : ''}`
                : '--'}
            </span>
            <span style={styles.scoreLabel}>{scoreDisplay.label}</span>
          </div>
        </div>

        {/* Metric highlights */}
        {highlights.length > 0 && (
          <div style={styles.highlights}>
            {highlights.map(h => (
              <span key={h} style={styles.highlightPill}>{h}</span>
            ))}
          </div>
        )}

        {/* Caption preview */}
        {post.caption && (
          <p style={styles.captionPreview}>
            {post.caption.length > 80 ? post.caption.slice(0, 80) + '...' : post.caption}
          </p>
        )}

        {/* Footer row: meta info */}
        <div style={styles.itemFooter}>
          {post.mediaType && (
            <span style={styles.mediaTypeBadge}>{post.mediaType}</span>
          )}
          <span style={styles.metaText}>
            {formatNumber(post.metrics?.reach)} reach
          </span>
          <span style={styles.metaDot}> </span>
          <span style={styles.metaText}>
            {formatNumber(post.metrics?.saves)} saves
          </span>
          <span style={styles.metaDot}> </span>
          <span style={styles.metaText}>{formatDate(post.publishedAt)}</span>
          {post.instagramPermalink && (
            <a
              href={post.instagramPermalink}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.igLink}
            >
              View
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  section: {
    marginTop: '1.5rem',
  },
  heading: {
    fontSize: '1.35rem',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem 1rem',
    gap: '1rem',
  },
  emptyIcon: {
    opacity: 0.5,
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    textAlign: 'center',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    transition: 'border-color 0.2s, background 0.2s',
  },
  rankBadge: {
    minWidth: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
    marginTop: '2px',
  },
  rankTop3: {
    color: '#fff',
    background: 'linear-gradient(135deg, var(--ig-pink), var(--ig-purple))',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.35rem',
  },
  topic: {
    fontWeight: 500,
    fontSize: '0.95rem',
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  scoreBadge: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
    flexShrink: 0,
  },
  scoreValue: {
    fontWeight: 700,
    fontSize: '1rem',
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  },
  scoreLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  highlights: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
    marginBottom: '0.35rem',
  },
  highlightPill: {
    fontSize: '0.7rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 500,
  },
  captionPreview: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    marginBottom: '0.35rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  mediaTypeBadge: {
    fontSize: '0.65rem',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metaText: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  metaDot: {
    fontSize: '0.6rem',
    color: 'var(--text-dim)',
  },
  igLink: {
    fontSize: '0.78rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    marginLeft: 'auto',
    fontWeight: 500,
  },
};
