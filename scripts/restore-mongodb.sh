#!/usr/bin/env bash
#
# Restore a MongoDB backup taken by scripts/backup-mongodb.sh.
#
# Usage:
#   ./scripts/restore-mongodb.sh                       # latest backup in s3://BACKUP_BUCKET/mongodb/
#   ./scripts/restore-mongodb.sh <S3_KEY>              # specific S3 key
#   ./scripts/restore-mongodb.sh --local <ARCHIVE>     # restore from a local file (already downloaded)
#
# By default restores to the MONGODB_URI defined in /opt/nab/.env. Pass
#   TARGET_MONGODB_URI=mongodb+srv://...  ./scripts/restore-mongodb.sh ...
# to restore into a sandbox cluster instead of overwriting production.
#
# Required: the restore drill is the most important DR muscle. Run this
# against a sandbox cluster at least monthly (infra/BACKUP-RUNBOOK.md § 4).

set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/nab/.env}
WORKDIR=${WORKDIR:-/var/lib/nab-backup}

if [ ! -f "$ENV_FILE" ]; then
  echo "[restore] FATAL: $ENV_FILE not found." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

: "${BACKUP_BUCKET:?BACKUP_BUCKET must be set in $ENV_FILE}"
: "${AWS_REGION:?AWS_REGION must be set in $ENV_FILE}"
: "${MONGODB_URI:?MONGODB_URI must be set in $ENV_FILE}"

TARGET=${TARGET_MONGODB_URI:-$MONGODB_URI}

mkdir -p "$WORKDIR"

LOCAL_ARCHIVE=""
S3_KEY=""

if [ "${1:-}" = "--local" ]; then
  LOCAL_ARCHIVE="${2:?--local requires an archive path}"
  if [ ! -f "$LOCAL_ARCHIVE" ]; then
    echo "[restore] FATAL: $LOCAL_ARCHIVE not found." >&2
    exit 1
  fi
elif [ -n "${1:-}" ]; then
  S3_KEY="$1"
else
  echo "[restore] no S3_KEY argument — discovering latest backup in s3://$BACKUP_BUCKET/mongodb/"
  S3_KEY=$(aws s3 ls "s3://$BACKUP_BUCKET/mongodb/" --recursive --region "$AWS_REGION" \
    | sort -k1,2 \
    | awk '$NF ~ /\.archive\.gz$/ { print $NF }' \
    | tail -1)
  if [ -z "$S3_KEY" ]; then
    echo "[restore] FATAL: no backups found under s3://$BACKUP_BUCKET/mongodb/" >&2
    exit 2
  fi
  echo "[restore] latest backup: $S3_KEY"
fi

if [ -z "$LOCAL_ARCHIVE" ]; then
  LOCAL_ARCHIVE="$WORKDIR/$(basename "$S3_KEY")"
  echo "[restore] downloading s3://$BACKUP_BUCKET/$S3_KEY → $LOCAL_ARCHIVE"
  aws s3 cp "s3://$BACKUP_BUCKET/$S3_KEY" "$LOCAL_ARCHIVE" \
    --region "$AWS_REGION" --only-show-errors
fi

# Refuse to silently overwrite production — make the operator type the word.
if [ "$TARGET" = "$MONGODB_URI" ]; then
  echo
  echo "============================================================"
  echo "  WARNING: about to restore into the PRODUCTION cluster."
  echo "  Set TARGET_MONGODB_URI=… to redirect into a sandbox first."
  echo "============================================================"
  read -r -p "Type 'RESTORE TO PRODUCTION' to continue: " confirm
  if [ "$confirm" != 'RESTORE TO PRODUCTION' ]; then
    echo "[restore] aborted by user."
    exit 1
  fi
fi

# --drop wipes each collection before importing — required for a clean
# restore. Without --drop, restored docs are upserted into the existing
# data which leaves orphan rows from anything created since the dump.
echo "[restore] running mongorestore → $TARGET"
mongorestore \
  --uri="$TARGET" \
  --archive="$LOCAL_ARCHIVE" \
  --gzip \
  --drop \
  --quiet

echo "[restore] $(date -u +%FT%TZ) — done"
