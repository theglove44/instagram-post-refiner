#!/usr/bin/env bash
set -euo pipefail
# Pull latest, install deps, build, restart the tuckinandtalk service.
cd /opt/tuckinandtalk
git pull --ff-only
npm ci
npm run build
sudo systemctl restart tuckinandtalk
