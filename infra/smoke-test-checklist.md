# Go-Live Smoke Test Checklist

**FIR-88**

Run these checks immediately after every production deployment.
If any check fails, follow the Rollback procedure at the bottom.

---

## Pre-Deployment

- [ ] All environment variables populated in `/opt/nab/.env`
- [ ] MongoDB Atlas IP allowlist includes EC2 Elastic IP (see `infra/mongodb-atlas-setup.md`)
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set (see `infra/stripe-setup.md`)
- [ ] DNS A record for `nextaibuilder.com` points to EC2 Elastic IP
- [ ] SSL certificate issued and valid (`certbot certificates` shows no expired certs)
- [ ] All GitHub Secrets populated in the repository / `production` environment

---

## Smoke Tests (run after deployment)

### Infrastructure

- [ ] `https://nextaibuilder.com` loads (HTTPS, no certificate warning)
- [ ] `http://nextaibuilder.com` redirects to `https://` with 301
- [ ] `GET https://nextaibuilder.com/api/health` returns HTTP 200 with `{"status":"ok"}`
- [ ] PM2 / Docker shows no crash loops: `docker ps` or `pm2 status`

### Auth

- [ ] Student can sign in with Google OAuth → redirected to `/student/dashboard`
- [ ] Admin can log in at `/admin/login` with email + OTP
- [ ] Refresh token rotation works: token persists across page reload without re-login
- [ ] Logged-out user hitting a protected route is redirected to login

### Storefront

- [ ] `GET /api/v1/storefront/cohorts` returns active cohorts (HTTP 200)
- [ ] Course detail page loads at `/courses/:slug`
- [ ] Pricing section displays Stripe product prices correctly

### Checkout — Stripe

- [ ] Stripe `ONE_TIME` payment flow completes in test mode → enrollment record created in DB
- [ ] Stripe webhook received after test payment (check `docker logs nab-api` or `pm2 logs nab-api`)
- [ ] Enrollment confirmation email received

### Manual Payment

- [ ] Receipt upload works (file appears in AWS S3 bucket `nextaibuilder-receipts`)
- [ ] Admin can view pending manual payment at `/admin/manual-payments`
- [ ] Admin can approve/reject → student enrollment status updates accordingly

### Student LMS

- [ ] Enrolled student can access course modules at `/student/dashboard`
- [ ] Lesson progress marks as `COMPLETED` after viewing
- [ ] Certificate generated on 100% course completion and downloadable

### Admin Panel

- [ ] Admin can create and publish a cohort at `/admin/courses`
- [ ] Analytics dashboard shows enrolment data at `/admin/reporting`
- [ ] Sub-admin creation works and sub-admin can log in

### PWA

- [ ] Install prompt appears on Chrome (Android) or Safari (iOS) on mobile
- [ ] App installs to home screen and opens in standalone mode (no browser chrome)
- [ ] Offline page (`/offline`) is served when network is disconnected after first load

---

## Rollback Procedure

If any smoke test fails and the issue cannot be fixed with a hotfix commit:

### Docker deployment (current)

```bash
# SSH into EC2
ssh -i "<key>.pem" ubuntu@<EC2_HOST>

# Roll back to the previous image tag
cd /opt/nab
PREVIOUS_TAG=$(cat .previous_tag)
IMAGE_BASE=$(docker inspect nab-api --format='{{index .Config.Image}}' | awk -F: '{print $1}')
IMAGE_TAG=$PREVIOUS_TAG docker compose up -d --remove-orphans
docker ps   # verify containers are running

# Verify health
curl -s http://localhost:4000/health
```

### PM2 bare-metal deployment

```bash
# SSH into EC2
ssh -i "<key>.pem" ubuntu@<EC2_HOST>

# Stop the API
pm2 stop nab-api

# Revert to last good commit (identify with: git log --oneline)
cd /var/www/nextaibuilder
git reset --hard <last-good-sha>
npm run build --workspace=apps/api

# Restart
pm2 start ecosystem.config.cjs
pm2 save

# Verify
curl -s http://localhost:4000/health
```

After rollback, create a revert commit on `main` so the pipeline does not re-deploy the bad code automatically.
