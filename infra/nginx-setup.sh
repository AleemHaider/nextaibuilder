#!/bin/bash
# Deploy host-level Nginx configuration for nextaibuilder
# FIR-81
#
# Run after ec2-setup.sh and after the repo has been cloned:
#   sudo bash /var/www/nextaibuilder/infra/nginx-setup.sh
set -e

CONF_SRC="/var/www/nextaibuilder/infra/nginx.conf"
CONF_DEST="/etc/nginx/sites-available/nextaibuilder"
CONF_LINK="/etc/nginx/sites-enabled/nextaibuilder"

echo "==> Copying Nginx config..."
cp "$CONF_SRC" "$CONF_DEST"

echo "==> Enabling site..."
ln -sf "$CONF_DEST" "$CONF_LINK"

echo "==> Removing default site (prevents port 80 conflict)..."
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing Nginx config syntax..."
nginx -t

echo "==> Reloading Nginx..."
systemctl reload nginx

echo "Nginx configured successfully."
echo "Note: SSL certificates must be issued before HTTPS works."
echo "Run: sudo bash /var/www/nextaibuilder/infra/certbot-setup.sh <domain> <email>"
