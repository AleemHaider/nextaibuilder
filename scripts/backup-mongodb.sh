#!/usr/bin/env bash
#
# Nightly MongoDB Atlas → S3 backup.
#
# Installed by infra/systemd/nab-backup.{service,timer} on the EC2 host.
# Triggered daily at 03:00 UTC (see infra/BACKUP-RUNBOOK.md).
#
# Reads MONGODB_URI + AWS creds + BACKUP_BUCKET from /opt/nab/.env so the
# secret never appears in the systemd unit. Exits non-zero on any failure so
# systemd records the failure and the optional Slack hook fires.

set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/nab/.env}
WORKDIR=${WORKDIR:-/var/lib/nab-backup}
RETENTION_LOCAL_DAYS=${RETENTION_LOCAL_DAYS:-2}

if [ ! -f "$ENV_FILE" ]; then
  echo "[backup] FATAL: $ENV_FILE not found." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

# Required vars
: "${MONGODB_URI:?MONGODB_URI must be set in $ENV_FILE}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET must be set in $ENV_FILE (S3 bucket for backups)}"
: "${AWS_REGION:?AWS_REGION must be set in $ENV_FILE}"

# Optional Slack alert
SLACK_HOOK=${SLACK_BACKUP_WEBHOOK_URL:-${SLACK_ERROR_WEBHOOK_URL:-}}

notify_slack() {
  local title="$1"
  local message="$2"
  local color="${3:-danger}"
  [ -n "$SLACK_HOOK" ] || return 0
  curl -fsS -X POST -H 'Content-type: application/json' \
    --data "$(printf '{"attachments":[{"color":"%s","title":"%s","text":"%s"}]}' "$color" "$title" "$message")" \
    "$SLACK_HOOK" >/dev/null || true
}

trap 'notify_slack "[NAB] MongoDB backup FAILED" "Host: $(hostname). See journalctl -u nab-backup.service for details."' ERR

mkdir -p "$WORKDIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DATE_DIR=$(date -u +"%Y-%m-%d")
LOCAL_ARCHIVE="$WORKDIR/nab-mongo-$TIMESTAMP.archive.gz"
S3_KEY="mongodb/$DATE_DIR/nab-mongo-$TIMESTAMP.archive.gz"

echo "[backup] $(date -u +%FT%TZ) — starting mongodump → $LOCAL_ARCHIVE"

# mongodump --archive --gzip writes a single compressed stream.
# --quiet keeps systemd journal clean; failures still surface via $? / set -e.
mongodump --uri="$MONGODB_URI" --archive="$LOCAL_ARCHIVE" --gzip --quiet

ARCHIVE_SIZE=$(stat -c '%s' "$LOCAL_ARCHIVE")
echo "[backup] dump complete — ${ARCHIVE_SIZE} bytes"

# Sanity-check: a healthy backup is at least 1 KiB. A truncated dump usually
# weighs in well under that (an empty archive header is ~40 bytes).
if [ "$ARCHIVE_SIZE" -lt 1024 ]; then
  echo "[backup] FATAL: archive is suspiciously small (${ARCHIVE_SIZE} bytes). Refusing to upload." >&2
  exit 2
fi

# Upload to S3. Use a 7-day "STANDARD_IA" storage class — backups are
# write-once and rarely read; lifecycle rules later transition older copies
# to Glacier (see infra/s3-lifecycle-backups.json).
echo "[backup] uploading to s3://$BACKUP_BUCKET/$S3_KEY"
aws s3 cp "$LOCAL_ARCHIVE" "s3://$BACKUP_BUCKET/$S3_KEY" \
  --region "$AWS_REGION" \
  --storage-class STANDARD_IA \
  --only-show-errors

echo "[backup] upload complete"

# Verify the object actually landed by HEADing it
aws s3api head-object --bucket "$BACKUP_BUCKET" --key "$S3_KEY" --region "$AWS_REGION" >/dev/null
echo "[backup] verified via head-object"

# Prune local copies older than RETENTION_LOCAL_DAYS — S3 is the source of
# truth, the on-host copy is only a fast-recovery convenience.
find "$WORKDIR" -name 'nab-mongo-*.archive.gz' -mtime "+$RETENTION_LOCAL_DAYS" -delete

notify_slack "[NAB] MongoDB backup OK" "Uploaded $(numfmt --to=iec --suffix=B "$ARCHIVE_SIZE") to s3://$BACKUP_BUCKET/$S3_KEY" "good"

echo "[backup] $(date -u +%FT%TZ) — done"
