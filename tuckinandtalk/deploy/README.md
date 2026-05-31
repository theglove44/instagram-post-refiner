# Tuckin and Talk — Deployment

Standalone analytics app for @tuckinandtalk. Runs on **port 3001** alongside the
parent `instagram-logger` (port 3000) on the same VM, behind the same Cloudflare
Tunnel.

## Files

| File | Purpose |
|------|---------|
| `tuckinandtalk.service` | The Next.js app (systemd, port 3001) |
| `tuckinandtalk-nightly.service` / `.timer` | Nightly sync at 03:30 UTC — post + weekly insights, token refresh |
| `tuckinandtalk-monthly.service` / `.timer` | Monthly benchmark on the 1st at 04:00 UTC — competitor snapshots, hashtag audits |
| `update.sh` | Pull / install / build / restart |

## Cron endpoints

Both cron routes are gated by the `x-cron-secret` header (`TAT_CRON_SECRET`) and
fan out to the existing sync endpoints via internal fetch:

- `GET /api/cron/nightly` → `/api/insights/posts`, `/api/insights/weekly`, `/api/token/refresh`
- `GET /api/cron/monthly` → `/api/competitors/snapshot`, `/api/hashtags/audit`

The monthly tasks INSERT a dated row per active competitor / hashtag, so they run
monthly — not nightly — to avoid flooding the audit tables. The nightly tasks are
idempotent (upsert by week_start / media id).

## Initial setup

```bash
# 1. Clone / deploy to /opt/tuckinandtalk and build
cd /opt/tuckinandtalk && npm ci && npm run build

# 2. Env files
#    .env.local  — full app config (Supabase, Instagram, TAT_ADMIN_*, TAT_CRON_SECRET)
#    .env.cron   — just: TAT_CRON_SECRET=<same value as in .env.local>
sudo install -m 600 -o www-data -g www-data .env.local /opt/tuckinandtalk/.env.local
printf 'TAT_CRON_SECRET=%s\n' "$TAT_CRON_SECRET" | sudo tee /opt/tuckinandtalk/.env.cron >/dev/null
sudo chmod 600 /opt/tuckinandtalk/.env.cron && sudo chown www-data:www-data /opt/tuckinandtalk/.env.cron

# 3. Install systemd units
sudo cp deploy/tuckinandtalk*.service deploy/tuckinandtalk*.timer /etc/systemd/system/
sudo systemctl daemon-reload

# 4. Enable + start
sudo systemctl enable --now tuckinandtalk.service
sudo systemctl enable --now tuckinandtalk-nightly.timer
sudo systemctl enable --now tuckinandtalk-monthly.timer
```

## Routine deploy

```bash
cd /opt/tuckinandtalk && ./deploy/update.sh
```

## Manual sync trigger

```bash
source /opt/tuckinandtalk/.env.cron
curl -fsS -H "x-cron-secret: $TAT_CRON_SECRET" http://localhost:3001/api/cron/nightly
curl -fsS -H "x-cron-secret: $TAT_CRON_SECRET" http://localhost:3001/api/cron/monthly
```
