/**
 * Follower milestone detection utilities.
 * Pure functions — no external dependencies, just array processing.
 */

export const MILESTONES = [100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

/**
 * Detect milestone crossings from an array of snapshots (sorted by date ASC).
 * A milestone is crossed when snapshot[i].followers_count < threshold
 * and snapshot[i+1].followers_count >= threshold.
 *
 * @param {Array<{snapshot_date: string, followers_count: number}>} snapshots
 * @returns {Array<{threshold: number, date: string, followersOnDate: number}>}
 */
export function detectMilestones(snapshots) {
  if (!snapshots || snapshots.length < 2) {
    return [];
  }

  const crossed = [];

  for (let i = 0; i < snapshots.length - 1; i++) {
    const prev = snapshots[i].followers_count;
    const curr = snapshots[i + 1].followers_count;

    // Skip if either value is null/undefined
    if (prev == null || curr == null) continue;

    for (const threshold of MILESTONES) {
      if (prev < threshold && curr >= threshold) {
        crossed.push({
          threshold,
          date: snapshots[i + 1].snapshot_date,
          followersOnDate: curr,
        });
      }
    }
  }

  // Sort by threshold ascending (natural order)
  crossed.sort((a, b) => a.threshold - b.threshold);

  return crossed;
}

/**
 * Get the next upcoming milestone based on current follower count.
 *
 * @param {number} currentFollowers
 * @returns {{threshold: number, remaining: number} | null}
 */
export function getNextMilestone(currentFollowers) {
  if (currentFollowers == null || currentFollowers < 0) {
    return null;
  }

  for (const threshold of MILESTONES) {
    if (currentFollowers < threshold) {
      return {
        threshold,
        remaining: threshold - currentFollowers,
      };
    }
  }

  // Above all defined milestones
  return null;
}
