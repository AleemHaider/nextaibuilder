#!/bin/bash
# Issue Let's Encrypt SSL certificate via Certbot for nextaibuilder
# FIR-82
#
# Prerequisites:
#   1. Nginx is configured and running (run nginx-setup.sh first)
#   2. DNS A record for $DOMAIN points to this server's public IP
#   3. Port 80 is open in the AWS Security Group (required for ACME HTTP-01 challenge)
#
# Usage:
#   sudo bash infra/certbot-setup.sh nextaibuilder.com admin@nextaibuilder.com
set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Error: domain and email are required."
    echo "Usage: sudo bash certbot-setup.sh <domain> <email>"
    echo "Example: sudo bash certbot-setup.sh nextaibuilder.com admin@nextaibuilder.com"
    exit 1
fi

echo "==> Issuing SSL certificate for $DOMAIN and www.$DOMAIN..."
certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m "$EMAIL"

echo "==> Enabling automatic certificate renewal timer..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo "==> Verifying renewal configuration..."
certbot renew --dry-run

echo "SSL certificate issued and auto-renewal configured for $DOMAIN"
echo "Certificate expires in 90 days. Certbot will auto-renew at 60 days."
