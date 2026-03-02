#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Nightly metrics backfill — fetches metrics for older posts
# that have never been synced or haven't been updated recently.
#
# Intended to run via cron during off-hours, e.g.:
#   0 2 * * * /home/christof21/instagram-post-refiner/deploy/backfill-metrics.sh >> ~/instagram-backfill.log 2>&1
#
# Uses a 365-day window so it gradually catches up on older posts.
# The API skips posts that already have metrics unless they're
# within the lookback window.
# ─────────────────────────────────────────────────────────────

HOSTNAME="${BACKFILL_URL:-http://localhost:3000}"
DAYS=365

echo "[$(date -Iseconds)] Starting nightly metrics backfill (${DAYS} days)..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$HOSTNAME/api/instagram/metrics" \
  -H 'Content-Type: application/json' \
  -d "{\"days\": $DAYS}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  SYNC_ID=$(echo "$BODY" | grep -o '"syncId":[0-9]*' | cut -d: -f2 || true)
  echo "[$(date -Iseconds)] Backfill started (syncId: ${SYNC_ID:-unknown}, HTTP $HTTP_CODE)"
else
  echo "[$(date -Iseconds)] ERROR: Backfill failed (HTTP $HTTP_CODE): $BODY"
  exit 1
fi
