# Tuckin and Talk — Deployment

Standalone analytics app for @tuckinandtalk. Runs on **port 3001** on the same VM
as the parent `instagram-logger` (port 3000), behind the same Cloudflare Tunnel.

`tuckinandtalk/` is a **subdirectory of the parent repo**, so its code arrives on
the VM whenever the parent is `git pull`ed. Only the build + its own systemd units
are separate.

VM facts: user `christof21`, repo at `~/instagram-post-refiner`, app dir
`~/instagram-post-refiner/tuckinandtalk`, public hostname `tat.mjoln1r.com`.

## Files

| File | Purpose |
|------|---------|
| `tuckinandtalk.service` | The Next.js app (systemd, port 3001) |
| `tuckinandtalk-nightly.service` / `.timer` | Nightly sync at 03:30 — post + weekly insights, token refresh |
| `tuckinandtalk-monthly.service` / `.timer` | Monthly benchmark on the 1st at 04:00 — competitor snapshots, hashtag audits |
| `update.sh` | Pull / install / build / restart |

## Cron endpoints

Both cron routes are gated by the `x-cron-secret` header (`TAT_CRON_SECRET`, read
from `.env.local` via `EnvironmentFile`) and fan out to the sync endpoints:

- `GET /api/cron/nightly` → `/api/insights/posts`, `/api/insights/weekly`, `/api/token/refresh`
- `GET /api/cron/monthly` → `/api/competitors/snapshot`, `/api/hashtags/audit`

Monthly tasks INSERT/upsert dated rows, so they run monthly. Nightly tasks are
idempotent (upsert by week_start / media id).

## First-time deploy

The parent repo is already cloned at `~/instagram-post-refiner`. From the VM:

```bash
cd ~/instagram-post-refiner && git pull --ff-only

# 1. Env file — copy the parent's shared values, add the TAT_ ones.
#    TAT_INSTAGRAM_REDIRECT_URI must point at the public hostname.
cd tuckinandtalk
cat > .env.local <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://ucpkeymrxbgmkkmmcgha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as parent>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
INSTAGRAM_APP_ID=893528393148102
INSTAGRAM_APP_SECRET=<same as parent>
TAT_INSTAGRAM_REDIRECT_URI=https://tat.mjoln1r.com/api/auth/callback
TAT_ADMIN_USER=<choose>
TAT_ADMIN_PASS=<choose>
TAT_CRON_SECRET=<choose a long random string>
ENV
chmod 600 .env.local

# 2. Build
npm install && npm run build

# 3. Install systemd units (app + both timers)
sudo cp deploy/tuckinandtalk.service deploy/tuckinandtalk-nightly.service \
        deploy/tuckinandtalk-monthly.service deploy/tuckinandtalk-nightly.timer \
        deploy/tuckinandtalk-monthly.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tuckinandtalk.service
sudo systemctl enable --now tuckinandtalk-nightly.timer
sudo systemctl enable --now tuckinandtalk-monthly.timer

# 4. Add the tunnel ingress rule for tat.mjoln1r.com → :3001
#    Edit /etc/cloudflared/config.yml so ingress has, before the http_status:404 line:
#      - hostname: tat.mjoln1r.com
#        service: http://localhost:3001
sudo nano /etc/cloudflared/config.yml
cloudflared tunnel route dns instagram-logger tat.mjoln1r.com
sudo systemctl restart cloudflared
```

## Routine deploy

```bash
~/instagram-post-refiner/tuckinandtalk/deploy/update.sh
```

## Manual sync trigger

```bash
set -a; source ~/instagram-post-refiner/tuckinandtalk/.env.local; set +a
curl -fsS -H "x-cron-secret: $TAT_CRON_SECRET" http://localhost:3001/api/cron/nightly
curl -fsS -H "x-cron-secret: $TAT_CRON_SECRET" http://localhost:3001/api/cron/monthly
```
