#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Instagram Post Logger — Update Script
# Pull latest, rebuild, and restart the service
# ─────────────────────────────────────────────────────────────

APP_DIR="$HOME/instagram-post-refiner"
SERVICE_NAME="instagram-logger"

echo "▸ Updating Instagram Post Logger..."

cd "$APP_DIR"

echo "  Pulling latest from GitHub..."
git pull

echo "  Installing dependencies..."
npm install

echo "  Building production app..."
npm run build

echo "  Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "  Update complete! Checking status..."
sudo systemctl status "$SERVICE_NAME" --no-pager -l
