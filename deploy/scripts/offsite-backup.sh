#!/bin/sh
# Runs inside the `offsite-backup` compose profile (rclone/rclone, Alpine-based).
# Finds the newest local dump already produced by backup.sh, encrypts it with age
# (asymmetric — only the private key on the NAS's backup-secrets can decrypt), and
# ships the ciphertext to a Backblaze B2 remote configured via rclone.
#
# Dump filenames are ledger-<UTC timestamp>.sql.gz (backup.sh), so a plain lexical sort
# is also a chronological sort — no need for `find -printf`, which busybox find lacks.
set -eu
set -o pipefail

BACKUP_DIR="/backups"
SECRETS_DIR="/secrets"
RCLONE_CONFIG="${SECRETS_DIR}/rclone.conf"
AGE_RECIPIENT="${AGE_RECIPIENT:?AGE_RECIPIENT not set in .env}"
RCLONE_REMOTE="${RCLONE_REMOTE:-b2}"
RCLONE_PATH="${RCLONE_REMOTE}:ledger-backups"
NTFY_TOPIC="${OFFSITE_NTFY_TOPIC:-nas-homelab-ledger-offsite-backup}"

notify() {
  wget -q -O /dev/null --post-data="$2" "$1" || true
}

fail() {
  echo "$1" >&2
  notify "https://ntfy.sh/${NTFY_TOPIC}" "ledger offsite backup failed: $1"
  exit 1
}

[ -f "${RCLONE_CONFIG}" ] || fail "rclone config missing at ${RCLONE_CONFIG} — run rclone config on the NAS first"

apk add --no-cache age >/dev/null 2>&1 || fail "apk add age failed"

LATEST="$(ls -1 "${BACKUP_DIR}"/ledger-*.sql.gz 2>/dev/null | sort | tail -n 1)"
[ -n "${LATEST}" ] || fail "no local dump found in ${BACKUP_DIR} — does backup.sh run before this?"

ENC="/tmp/$(basename "${LATEST}").age"
age -r "${AGE_RECIPIENT}" -o "${ENC}" "${LATEST}" || fail "age encryption failed"

rclone --config "${RCLONE_CONFIG}" copy "${ENC}" "${RCLONE_PATH}/" || fail "rclone copy failed"

rm -f "${ENC}"
notify "https://ntfy.sh/${NTFY_TOPIC}" "ledger offsite backup OK: $(basename "${LATEST}")"
echo "Offsite backup OK: $(basename "${LATEST}")"
