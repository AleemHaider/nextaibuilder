#!/bin/bash
# nextaibuilder EC2 initial setup script
# FIR-80
#
# Run on a fresh Ubuntu 24.04 LTS EC2 instance as root:
#   sudo bash infra/ec2-setup.sh
#
# Idempotent: safe to re-run on an already-provisioned instance.
set -e

echo "==> [1/8] Updating system packages..."
apt-get update -y && apt-get upgrade -y

echo "==> [2/8] Installing Node.js 20 via NodeSource..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
npm -v

echo "==> [3/8] Installing PM2 globally..."
npm install -g pm2
pm2 -v

echo "==> [4/8] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

echo "==> [5/8] Installing Certbot (Let's Encrypt)..."
apt-get install -y certbot python3-certbot-nginx

echo "==> [6/8] Installing Git and other utilities..."
apt-get install -y git curl unzip

echo "==> [7/8] Creating app user 'nab'..."
# 'true' prevents failure if user already exists (idempotent)
useradd -m -s /bin/bash nab || true

echo "==> [8/8] Creating application directories..."
mkdir -p /var/www/nextaibuilder
mkdir -p /opt/nab
mkdir -p /var/log/pm2
chown nab:nab /var/www/nextaibuilder
chown nab:nab /opt/nab
chown nab:nab /var/log/pm2

echo ""
echo "EC2 setup complete. Next steps:"
echo "1. Clone the repo:      git clone <repo-url> /var/www/nextaibuilder"
echo "2. Configure Nginx:     sudo bash /var/www/nextaibuilder/infra/nginx-setup.sh"
echo "3. Issue SSL cert:      sudo bash /var/www/nextaibuilder/infra/certbot-setup.sh nextaibuilder.com admin@nextaibuilder.com"
echo "4. Populate secrets:    cp /var/www/nextaibuilder/infra/.env.production.template /opt/nab/.env && nano /opt/nab/.env"
echo "5. Start app:           pm2 start /var/www/nextaibuilder/ecosystem.config.cjs && pm2 save && pm2 startup"
