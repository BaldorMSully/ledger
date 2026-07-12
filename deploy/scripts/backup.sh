#!/bin/sh
# Runs inside the `backup` compose profile (postgres:16-alpine, has pg_dump built in).
# Dumps the ledger DB, rotates old dumps, and posts an ntfy alert on failure.
#
# IMPORTANT: bind-mount ./backups on the NAS from a DIFFERENT pool than wherever
# /volume1/docker/ledger/data lives — pool1 is known to be single-disk with no
# redundancy (see project_nas_homelab.md). A backup on the same disk as the live DB
# defeats the point.
set -eu

BACKUP_DIR="/backups"
RETENTION_DAYS="${RETENTION_DAYS:-21}"
NTFY_TOPIC="${NTFY_TOPIC:-nas-homelab-ledger-backup}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR}/ledger-${STAMP}.sql.gz"

fail() {
  echo "$1" >&2
  # busybox wget (present on alpine by default, unlike curl) for the ntfy alert.
  wget -q -O /dev/null --post-data="ledger backup failed: $1" "https://ntfy.sh/${NTFY_TOPIC}" || true
  exit 1
}

pg_dump -h db -U ledger -d ledger | gzip > "${DEST}" \
  || fail "pg_dump/gzip failed"

if [ ! -s "${DEST}" ]; then
  fail "backup file is empty: ${DEST}"
fi

find "${BACKUP_DIR}" -name 'ledger-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "Backup OK: ${DEST}"
