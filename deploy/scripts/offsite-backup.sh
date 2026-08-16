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
# The rclone/rclone image sets XDG_CONFIG_HOME=/config, so `rclone config` (run via
# `docker run -v .../backup-secrets:/config rclone/rclone config`, see README §4) writes
# to /config/rclone/rclone.conf — an extra `rclone/` subdirectory, not /config directly.
RCLONE_CONFIG="${SECRETS_DIR}/rclone/rclone.conf"
AGE_RECIPIENT="${AGE_RECIPIENT:?AGE_RECIPIENT not set in .env}"
RCLONE_REMOTE="${RCLONE_REMOTE:-b2}"
# B2 bucket names are globally unique across all B2 accounts, so the real bucket name
# may not be the literal "ledger-backups" suggested in README §4 — must match whatever
# was actually created, and whatever the Application Key is scoped to.
B2_BUCKET="${B2_BUCKET:?B2_BUCKET not set in .env — must match the real bucket name}"
RCLONE_PATH="${RCLONE_REMOTE}:${B2_BUCKET}"
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
