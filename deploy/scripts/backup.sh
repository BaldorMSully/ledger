#!/bin/sh
# Runs inside the `backup` compose profile (postgres:16-alpine, has pg_dump built in).
# Dumps the ledger DB, verifies the dump completed, rotates old dumps (keeping
# first-of-month dumps), and reports both success and failure so a cron that silently
# never fires is detectable.
#
# IMPORTANT: bind-mount ./backups on the NAS from a DIFFERENT pool than wherever
# /volume1/docker/ledger/data lives — pool1 is known to be single-disk with no
# redundancy (see project_nas_homelab.md). A backup on the same disk as the live DB
# defeats the point.
set -eu
# Without pipefail, `pg_dump | gzip` reports gzip's exit code — a failed pg_dump gzips
# an empty stream into a valid ~20-byte file that passes a size check. busybox ash
# (this image's /bin/sh) supports pipefail.
set -o pipefail

BACKUP_DIR="/backups"
RETENTION_DAYS="${RETENTION_DAYS:-21}"
NTFY_TOPIC="${NTFY_TOPIC:-nas-homelab-ledger-backup}"
# Optional healthchecks.io-style dead-man's-switch: pinged on success, <url>/fail on
# failure. Unlike a failure alert, a missed ping also catches the cron never running.
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR}/ledger-${STAMP}.sql.gz"

notify() {
  # busybox wget (present on alpine by default, unlike curl).
  wget -q -O /dev/null --post-data="$2" "$1" || true
}

fail() {
  echo "$1" >&2
  notify "https://ntfy.sh/${NTFY_TOPIC}" "ledger backup failed: $1"
  if [ -n "${HEALTHCHECK_URL}" ]; then
    notify "${HEALTHCHECK_URL}/fail" "$1"
  fi
  exit 1
}

pg_dump -h db -U ledger -d ledger | gzip > "${DEST}" \
  || fail "pg_dump/gzip failed"

# A plain-format dump ends with this marker; its absence means pg_dump was cut short.
# (No grep -q: -q exits at first match, and the resulting SIGPIPE upstream would itself
# trip pipefail on a healthy dump.)
gunzip -c "${DEST}" | tail -c 1000 | grep "PostgreSQL database dump complete" > /dev/null \
  || fail "dump verification failed: ${DEST} missing completion marker"

# Rotate, but never delete a first-of-month dump (ledger-YYYYMM01T*) — a problem noticed
# later than the retention window shouldn't have aged out every good backup.
find "${BACKUP_DIR}" -name 'ledger-*.sql.gz' ! -name 'ledger-??????01T*' \
  -mtime "+${RETENTION_DAYS}" -delete

if [ -n "${HEALTHCHECK_URL}" ]; then
  notify "${HEALTHCHECK_URL}" "OK ${DEST}"
else
  # No dead-man's-switch configured — post success to ntfy so there is at least SOME
  # positive signal that the cron is alive.
  notify "https://ntfy.sh/${NTFY_TOPIC}" "ledger backup OK: ${DEST}"
fi

echo "Backup OK: ${DEST}"
