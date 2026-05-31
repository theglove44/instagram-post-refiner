#!/usr/bin/env bash
set -euo pipefail
# Pull latest, install deps, build, restart the tuckinandtalk service.
# The parent repo is shared; tuckinandtalk is a subdirectory of it.
cd "$HOME/instagram-post-refiner"
git pull --ff-only
cd tuckinandtalk
npm install
npm run build
sudo systemctl restart tuckinandtalk
echo "Restarted. Status:"
sudo systemctl status tuckinandtalk --no-pager -l | head -8
