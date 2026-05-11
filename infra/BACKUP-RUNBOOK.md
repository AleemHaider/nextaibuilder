# MongoDB Backup + Restore Runbook

Closes audit P0 #2 (no backup/DR strategy). Nightly `mongodump → S3` with a tested restore path.

Architecture:

```
03:00 UTC ─▶ systemd timer ─▶ nab-backup.service ─▶ scripts/backup-mongodb.sh
                                                       │
                                                       ├─ mongodump --archive --gzip
                                                       ├─ aws s3 cp (STANDARD_IA)
                                                       └─ Slack alert on success/failure

S3 lifecycle (infra/s3-lifecycle-backups.json):
   day 0   STANDARD_IA
   day 30  GLACIER_IR
   day 90  DEEP_ARCHIVE
   day 365 expire
```

## 1 — One-time S3 setup

```bash
# Pick a region matching your Mongo Atlas region to minimise egress.
# (See SECURITY.md — fix the eu-west-2 vs us-east-2 drift while you're here.)
AWS_REGION=us-east-2
BACKUP_BUCKET=nab-prod-backups-${AWS_REGION}

aws s3api create-bucket --bucket "$BACKUP_BUCKET" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

# Versioning lets you recover from a corrupt overwrite or accidental delete.
aws s3api put-bucket-versioning --bucket "$BACKUP_BUCKET" \
  --versioning-configuration Status=Enabled

# Block public access — backups must never be public.
aws s3api put-public-access-block --bucket "$BACKUP_BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Server-side encryption with SSE-S3 (free, automatic).
aws s3api put-bucket-encryption --bucket "$BACKUP_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Lifecycle: tiered retention (see infra/s3-lifecycle-backups.json).
aws s3api put-bucket-lifecycle-configuration --bucket "$BACKUP_BUCKET" \
  --lifecycle-configuration "file://infra/s3-lifecycle-backups.json"

# Append the bucket name to /opt/nab/.env on the EC2 host:
echo "BACKUP_BUCKET=$BACKUP_BUCKET" | sudo tee -a /opt/nab/.env
```

## 2 — Install on EC2

```bash
# Copy scripts to the canonical location
sudo install -m 0750 -o ubuntu -g ubuntu scripts/backup-mongodb.sh  /opt/nab/backup-mongodb.sh
sudo install -m 0750 -o ubuntu -g ubuntu scripts/restore-mongodb.sh /opt/nab/restore-mongodb.sh

# Working dir for staged archives (the script also creates it on first run)
sudo install -d -m 0755 -o ubuntu -g ubuntu /var/lib/nab-backup

# Install systemd units
sudo cp infra/systemd/nab-backup.service /etc/systemd/system/
sudo cp infra/systemd/nab-backup.timer   /etc/systemd/system/

# Required CLIs
which mongodump || sudo apt-get install -y mongodb-database-tools
which aws       || (cd /tmp && curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscli.zip && unzip -q awscli.zip && sudo ./aws/install)

sudo systemctl daemon-reload
sudo systemctl enable --now nab-backup.timer
```

## 3 — Verify install

```bash
# Confirm the timer is scheduled
systemctl list-timers nab-backup.timer
# Expected: NEXT row shows tonight 03:00 UTC (+ jitter)

# Trigger an on-demand run — should complete in <2 min on a small cluster
sudo systemctl start nab-backup.service
journalctl -u nab-backup.service -n 50 --no-pager

# Confirm the object landed
aws s3 ls "s3://$BACKUP_BUCKET/mongodb/" --recursive | tail
```

If the on-demand run fails, the failure trap in `backup-mongodb.sh` posts to `SLACK_BACKUP_WEBHOOK_URL` (falls back to `SLACK_ERROR_WEBHOOK_URL`). Inspect `journalctl -u nab-backup.service` for the full trace.

## 4 — Restore drill (run monthly)

**This is the most important step.** A backup that has never been restored is theoretical. Schedule a calendar reminder for the first of each month.

```bash
# Provision a sandbox MongoDB cluster (Atlas free-tier M0 works fine).
TARGET="mongodb+srv://<sandbox-user>:<pwd>@<sandbox-cluster>.mongodb.net/nab_test"

# Restore the LATEST backup into the sandbox — no prod touched.
TARGET_MONGODB_URI="$TARGET" /opt/nab/restore-mongodb.sh

# Or restore a specific point-in-time backup:
TARGET_MONGODB_URI="$TARGET" /opt/nab/restore-mongodb.sh mongodb/2026-05-10/nab-mongo-20260510T030003Z.archive.gz

# Spot-check the restore — counts should roughly match prod (allowing for ~24h drift).
mongosh "$TARGET" --eval "
  db.adminCommand('listDatabases').databases
    .forEach(d => print(d.name, '→', db.getSiblingDB(d.name).getCollectionNames().length, 'collections'));
"
```

Log the result of every drill in `infra/restore-drill-log.md` (date, backup tested, time-to-restore, anomalies). If you've never run a restore from your backups, **you do not have a backup**.

## 5 — Restore to production (emergency)

```bash
# 1. Stop the API to prevent writes during restore
sudo systemctl stop nab-api    # or: cd /opt/nab && docker compose stop api worker

# 2. Restore — the script forces you to type RESTORE TO PRODUCTION
/opt/nab/restore-mongodb.sh mongodb/2026-05-10/nab-mongo-20260510T030003Z.archive.gz

# 3. Verify counts match expectations
mongosh "$MONGODB_URI" --eval "
  db.cohorts.countDocuments();
  db.enrollments.countDocuments();
  db.users.countDocuments();
"

# 4. Start the API back up
sudo systemctl start nab-api   # or: docker compose start api worker
```

After a production restore, expect Stripe webhooks delivered between the dump time and the restore moment to be missing from Enrollment/StripePayment rows. The webhook receiver is idempotent (`ProcessedStripeEvent` table), so re-triggering missed events via the Stripe dashboard's "Resend" button safely re-syncs.

## 6 — Cost expectations

For a typical NAB cluster (~5 GB compressed dump, 1 nightly run, 1-year retention):

| Phase | Storage class | ~Size after 1yr | Monthly cost (us-east-2) |
|-------|---------------|-----------------|---------------------------|
| Day 0–29 | STANDARD_IA   | ~150 GB         | ~$1.88 |
| Day 30–89 | GLACIER_IR   | ~300 GB         | ~$1.20 |
| Day 90–364 | DEEP_ARCHIVE | ~1.4 TB        | ~$1.41 |
| **Total** | | | **~$4.50/month** |

The S3 PUT cost is negligible (~$0.005/night for 365 PUTs).

## 7 — Atlas Continuous Backups (complementary, not a replacement)

MongoDB Atlas offers its own Continuous Backups with point-in-time restore. Keep both:

- **Atlas backups**: in-platform, fast recovery, but bound to your Atlas account and region. Cost is bundled in the cluster tier.
- **S3 dumps (this script)**: independent of Atlas — survives an Atlas account compromise / billing lapse / region outage / accidental cluster delete. Required for true belt-and-braces DR.

Tracked in: `infra/mongodb-atlas-setup.md` § Continuous Backup.

## 8 — Rollback

If this whole backup pipeline misbehaves and needs to be torn down:

```bash
sudo systemctl disable --now nab-backup.timer
sudo rm /etc/systemd/system/nab-backup.{service,timer}
sudo rm /opt/nab/backup-mongodb.sh /opt/nab/restore-mongodb.sh
sudo systemctl daemon-reload
# Optional: delete the S3 bucket once you're sure nothing else depends on it
aws s3 rb "s3://$BACKUP_BUCKET" --force
```
