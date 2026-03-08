#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Instagram Post Logger — VM Setup Script
# Run on Ubuntu VM: bash deploy/setup-vm.sh
# ─────────────────────────────────────────────────────────────

APP_DIR="$HOME/instagram-post-refiner"
REPO_URL="https://github.com/theglove44/instagram-post-refiner.git"
SERVICE_NAME="instagram-logger"
TUNNEL_NAME="instagram-logger"
HOSTNAME="insta.mjoln1r.com"

echo "══════════════════════════════════════════════════════════"
echo "  Instagram Post Logger — VM Setup"
echo "══════════════════════════════════════════════════════════"
echo ""

# ─── 1. System Dependencies ──────────────────────────────────

echo "▸ Installing system dependencies..."

# Node.js 20 LTS via NodeSource
if ! command -v node &>/dev/null; then
    echo "  Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "  Node.js already installed: $(node -v)"
fi

# cloudflared
if ! command -v cloudflared &>/dev/null; then
    echo "  Installing cloudflared..."
    curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i /tmp/cloudflared.deb
    rm /tmp/cloudflared.deb
else
    echo "  cloudflared already installed: $(cloudflared --version)"
fi

echo ""

# ─── 2. Clone & Install App ──────────────────────────────────

echo "▸ Setting up application..."

if [ -d "$APP_DIR" ]; then
    echo "  App directory exists, pulling latest..."
    cd "$APP_DIR"
    git pull
else
    echo "  Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

echo "  Installing npm dependencies..."
npm install

# ─── 3. Environment Variables ────────────────────────────────

echo "▸ Creating .env.local..."

if [ -f "$APP_DIR/.env.local" ]; then
    echo "  .env.local already exists, skipping (delete it to regenerate)"
else
    read -rp "  NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
    read -rp "  INSTAGRAM_APP_SECRET: " IG_APP_SECRET

    cat > "$APP_DIR/.env.local" << ENVEOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ucpkeymrxbgmkkmmcgha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Instagram Graph API Configuration
INSTAGRAM_APP_ID=893528393148102
INSTAGRAM_APP_SECRET=$IG_APP_SECRET
INSTAGRAM_REDIRECT_URI=https://insta.mjoln1r.com/api/instagram/callback
ENVEOF

    echo "  .env.local created"
fi

# ─── 4. Build ────────────────────────────────────────────────

echo "▸ Building production app..."
npm run build

echo ""

# ─── 5. Systemd Service for Next.js ──────────────────────────

echo "▸ Setting up systemd service..."

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=Instagram Post Logger (Next.js)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$(which npm) start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

echo "  Service started: sudo systemctl status $SERVICE_NAME"
echo ""

# ─── 6. Cloudflare Tunnel ────────────────────────────────────

echo "▸ Setting up Cloudflare Tunnel..."
echo ""

# Login to Cloudflare (opens browser)
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo "  A browser window will open — log in and authorize Cloudflare."
    echo "  If on a headless VM, copy the URL shown and open it in your browser."
    echo ""
    cloudflared tunnel login
fi

# Create tunnel
if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "  Creating tunnel: $TUNNEL_NAME"
    cloudflared tunnel create "$TUNNEL_NAME"
else
    echo "  Tunnel '$TUNNEL_NAME' already exists"
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "  Tunnel ID: $TUNNEL_ID"

# Write tunnel config to /etc/cloudflared (where the systemd service expects it)
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null << EOF
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $HOSTNAME
    service: http://localhost:3000
  - service: http_status:404
EOF

sudo cp "$HOME/.cloudflared/$TUNNEL_ID.json" /etc/cloudflared/
sudo cp "$HOME/.cloudflared/cert.pem" /etc/cloudflared/

echo "  Tunnel config written to /etc/cloudflared/config.yml"

# Create DNS route
echo "  Creating DNS route for $HOSTNAME..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" || echo "  DNS route may already exist (that's OK)"

# Install cloudflared as systemd service
sudo cloudflared service install || echo "  cloudflared service may already be installed (that's OK)"
sudo systemctl enable cloudflared
sudo systemctl start cloudflared || sudo systemctl restart cloudflared

echo ""

# ─── 7. Systemd Timer for Nightly Metrics Sync ───────────────

echo "▸ Setting up nightly metrics sync timer..."

sudo cp "$APP_DIR/deploy/instagram-metrics-sync.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/instagram-metrics-sync.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now instagram-metrics-sync.timer

echo "  Systemd timer installed: runs daily at 03:00 UTC (with up to 5min jitter)"
echo "  Check status: systemctl status instagram-metrics-sync.timer"
echo ""

# ─── 8. Systemd Timer for Nightly Account Snapshot ────────────

echo "▸ Setting up nightly account snapshot timer..."

sudo cp "$APP_DIR/deploy/instagram-snapshot.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/instagram-snapshot.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now instagram-snapshot.timer

echo "  Systemd timer installed: runs daily at 04:00 UTC (with up to 5min jitter)"
echo "  Check status: systemctl status instagram-snapshot.timer"
echo ""

# ─── Done ─────────────────────────────────────────────────────

echo "══════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  App service:     sudo systemctl status $SERVICE_NAME"
echo "  Tunnel service:  sudo systemctl status cloudflared"
echo "  Tunnel ID:       $TUNNEL_ID"
echo ""
echo "  Your app should be live at: https://$HOSTNAME"
echo ""
echo "  To update later: bash ~/instagram-post-refiner/deploy/update.sh"
echo "══════════════════════════════════════════════════════════"
