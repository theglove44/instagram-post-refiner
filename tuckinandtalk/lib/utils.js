/**
 * Shared utility helpers for the Tuckin and Talk analytics app.
 */

/**
 * Pause execution for the given number of milliseconds.
 * Use between Instagram API calls to respect rate limits.
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a Date (or ISO string) as a human-readable date string.
 * e.g. "24 May 2026"
 */
export function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format a number with commas for readability. e.g. 12345 → "12,345"
 */
export function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-GB');
}

/**
 * Format a percentage to one decimal place.  e.g. 0.347 → "34.7%"
 */
export function formatPercent(n, alreadyPercent = false) {
  if (n === null || n === undefined) return '—';
  const pct = alreadyPercent ? Number(n) : Number(n) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Compute the non-follower reach ratio.
 * Returns a number 0-1 representing what fraction of reach came from non-followers.
 */
export function computeNonFollowerRatio(reachNonFollower, reachFollower) {
  const total = (reachNonFollower || 0) + (reachFollower || 0);
  if (total === 0) return null;
  return (reachNonFollower || 0) / total;
}

/**
 * Compute the median of an array of numbers.
 * Returns null for empty arrays.
 */
export function median(values) {
  const nums = values.filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Classify a hashtag tier based on median likes.
 */
export function classifyHashtagTier(medianLikes) {
  if (medianLikes === null || medianLikes === undefined) return 'UNKNOWN';
  if (medianLikes >= 5000) return 'COMPETITIVE';
  if (medianLikes >= 1000) return 'REACHABLE';
  return 'LOCAL';
}

/**
 * Return the ISO date string (YYYY-MM-DD) for the most recent Monday on or
 * before the given date (defaults to today).
 */
export function getMostRecentMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday …
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

/**
 * Return a Unix timestamp (seconds) for N days ago.
 */
export function unixDaysAgo(days) {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

/**
 * Return a Unix timestamp (seconds) for the current moment.
 */
export function unixNow() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Return the number of days between a future Date and now (negative if past).
 */
export function daysUntil(date) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
