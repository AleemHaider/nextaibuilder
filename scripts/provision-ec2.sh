#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NAB EC2 Provisioning Script — DEV environment
# Ubuntu 24.04 LTS
#
# Run once on a fresh EC2 instance:
#   bash provision-ec2.sh
#
# Installs: nvm, Node.js 20 LTS, npm, pm2, nginx, MongoDB 8.0
# Creates:  /var/www/nab  (frontend static files)
#           /opt/nab/api  (API runtime)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "========================================"
echo " NAB EC2 Provisioner — DEV"
echo " $(date)"
echo "========================================"

# ── 1. System update ──────────────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl wget gnupg2 ca-certificates lsb-release \
  software-properties-common apt-transport-https unzip git rsync

# ── 2. Node.js 20 via nvm ─────────────────────────────────────────────────────
echo "[2/8] Installing nvm + Node.js 20 LTS..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load nvm into current shell
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

nvm install 20
nvm alias default 20
nvm use 20

echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

# Make node/npm available system-wide for nginx/pm2/SSH non-interactive shells
NODE_BIN_DIR="$(nvm which current | xargs dirname)"
sudo ln -sf "${NODE_BIN_DIR}/node" /usr/local/bin/node
sudo ln -sf "${NODE_BIN_DIR}/npm"  /usr/local/bin/npm
sudo ln -sf "${NODE_BIN_DIR}/npx"  /usr/local/bin/npx

# ── 3. pm2 ────────────────────────────────────────────────────────────────────
echo "[3/8] Installing pm2..."
npm install -g pm2
sudo ln -sf "$(which pm2)" /usr/local/bin/pm2

# Set pm2 to start on system boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash || true

# ── 4. nginx ──────────────────────────────────────────────────────────────────
echo "[4/8] Installing nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ── 5. MongoDB 8.0 ────────────────────────────────────────────────────────────
echo "[5/8] Installing MongoDB 8.0..."

# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg

# Add MongoDB apt source
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

sudo apt-get update -y
sudo apt-get install -y mongodb-org

sudo systemctl enable mongod
sudo systemctl start mongod

echo "MongoDB status: $(sudo systemctl is-active mongod)"

# ── 6. Directory structure ────────────────────────────────────────────────────
echo "[6/8] Creating application directories..."

# Frontend: nginx will serve from here
sudo mkdir -p /var/www/nab
sudo chown -R ubuntu:ubuntu /var/www/nab

# API runtime
sudo mkdir -p /opt/nab/api
sudo chown -R ubuntu:ubuntu /opt/nab

# Logs
sudo mkdir -p /var/log/nab
sudo chown -R ubuntu:ubuntu /var/log/nab

# ── 7. nginx config ───────────────────────────────────────────────────────────
echo "[7/8] Configuring nginx..."

sudo tee /etc/nginx/sites-available/nab << 'NGINX'
# ─────────────────────────────────────────────────────────
# NAB nginx config — DEV
# Frontend: served from /var/www/nab (React SPA)
# API:      reverse-proxied from /api → localhost:4000
# ─────────────────────────────────────────────────────────

server {
    listen 83;
    server_name _;  # accepts any hostname / IP in dev

    # ── Frontend (React SPA) ────────────────────────────
    root /var/www/nab;
    index index.html;

    # Serve static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ── API reverse proxy ───────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # ── SPA fallback — all unmatched routes → index.html ─
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Security headers ────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Gzip ────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml;
    gzip_min_length 1024;
}
NGINX

# Enable site, disable default
sudo ln -sf /etc/nginx/sites-available/nab /etc/nginx/sites-enabled/nab
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t
sudo systemctl reload nginx

# ── 8. API environment file placeholder ───────────────────────────────────────
echo "[8/8] Creating API .env placeholder..."

if [ ! -f /opt/nab/api/.env ]; then
  cat > /opt/nab/api/.env << 'ENVFILE'
# ─────────────────────────────────────────────────────────
# NAB API — DEV environment variables
# Fill in values. This file is NOT in version control.
# ─────────────────────────────────────────────────────────

NODE_ENV=production
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info

# Frontend URL (for CORS — use EC2 public IP or domain)
FRONTEND_URL=http://ec2-98-80-75-197.compute-1.amazonaws.com:83

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/pba_dev

# JWT
JWT_SECRET=<replace-with-64-char-random-hex>
COOKIE_SECRET=<replace-with-64-char-random-hex>

# AWS S3 (for screenshot uploads)
AWS_ACCESS_KEY_ID=<set-when-ready>
AWS_SECRET_ACCESS_KEY=<set-when-ready>
AWS_REGION=eu-west-2
S3_BUCKET_NAME=nab-screenshots

# Email (SendGrid)
SENDGRID_API_KEY=<set-when-ready>
EMAIL_FROM=noreply@productbuilderacademy.com

# Anthropic (Claude Vision)
ANTHROPIC_API_KEY=<set-when-ready>
ENVFILE
  echo "Created /opt/nab/api/.env — fill in secrets before starting API."
else
  echo "/opt/nab/api/.env already exists — skipping."
fi

echo ""
echo "========================================"
echo " Provisioning complete!"
echo ""
echo " Versions:"
echo "   Node.js : $(node --version)"
echo "   npm     : $(npm --version)"
echo "   pm2     : $(pm2 --version)"
echo "   nginx   : $(nginx -v 2>&1)"
echo "   mongod  : $(mongod --version | head -1)"
echo ""
echo " Next steps:"
echo "   1. Edit /opt/nab/api/.env with real secrets"
echo "   2. Push code to GitHub main branch"
echo "   3. GitHub Actions will deploy automatically"
echo "========================================"
