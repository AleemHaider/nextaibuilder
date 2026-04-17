#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NAB Server Bootstrap Script
#
# Run ONCE on the EC2 instance to prepare it for Docker Compose deployments.
# Usage:
#   chmod +x scripts/bootstrap-server.sh
#   ./scripts/bootstrap-server.sh
#
# Or run remotely:
#   ssh -i key/CollegeChoice101_Test_Server_Key.pem ubuntu@ec2-18-222-21-166.us-east-2.compute.amazonaws.com \
#     "bash -s" < scripts/bootstrap-server.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "==> Creating /opt/nab directory..."
sudo mkdir -p /opt/nab
sudo chown ubuntu:ubuntu /opt/nab

echo "==> Creating /opt/nab/.env from template (if it does not exist)..."
if [ ! -f /opt/nab/.env ]; then
  cat > /opt/nab/.env << 'EOF'
# NAB API — Production Environment Variables
# Fill in ALL values before starting the stack.
# This file is NEVER committed to version control.

NODE_ENV=production
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info

# Frontend URL (for CORS) — the public address users will hit
FRONTEND_URL=http://ec2-18-222-21-166.us-east-2.compute.amazonaws.com:3000

# MongoDB Atlas connection string
MONGODB_URI=<set-this>

# JWT / Cookie secrets — generate with: openssl rand -hex 32
JWT_SECRET=<set-this>
COOKIE_SECRET=<set-this>

# Redis — set to a Redis URL (e.g. Redis Cloud free tier or same host)
REDIS_URL=<set-this>

# AWS S3 (for screenshot uploads)
AWS_ACCESS_KEY_ID=<set-this>
AWS_SECRET_ACCESS_KEY=<set-this>
AWS_REGION=us-east-2
S3_BUCKET_NAME=nab-screenshots

# Google OAuth
GOOGLE_CLIENT_ID=<set-this>

# Apple Sign-In
APPLE_CLIENT_ID=<set-this>

# Anthropic (Claude Vision)
ANTHROPIC_API_KEY=<set-this>
ML_CONFIDENCE_THRESHOLD=80
ML_WORKER_CONCURRENCY=3

# Email (SMTP)
SMTP_HOST=<set-this>
SMTP_PORT=587
SMTP_USER=<set-this>
SMTP_PASS=<set-this>
EMAIL_FROM=noreply@productbuilderacademy.com

# Slack error alerts (optional)
SLACK_ERROR_WEBHOOK_URL=<set-this-or-leave-blank>

# Support scheduling
SUPPORT_SCHEDULING_URL=https://calendly.com/your-link
EOF
  echo "    Created /opt/nab/.env — EDIT THIS FILE before deploying."
else
  echo "    /opt/nab/.env already exists — skipping."
fi

echo ""
echo "==> Bootstrap complete."
echo ""
echo "NEXT STEPS:"
echo "  1. Edit /opt/nab/.env and fill in all <set-this> values"
echo "  2. Set the GitHub Secrets listed in .github/workflows/ci-cd.yml"
echo "  3. Make the GHCR packages public OR ensure EC2_SSH_KEY secret is set"
echo "  4. Push to main — the GitHub Actions pipeline will build + deploy"
echo ""
echo "  Frontend will be available at: http://ec2-18-222-21-166.us-east-2.compute.amazonaws.com:3000"
echo "  API health check:              http://ec2-18-222-21-166.us-east-2.compute.amazonaws.com:4000/health"
