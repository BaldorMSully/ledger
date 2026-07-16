# NAS deployment (prepared for manual setup — not applied automatically)

Target: the UGreen NAS (`192.168.4.164` / `fourhorsemen`), following the same conventions as
the existing `arr-apps` stack (container-name networking, no published host ports, fronted by
the existing nginx-proxy-manager). This is a plan/artifact set for you to apply — nothing here
has been run against the NAS.

## 1. One-time setup on the NAS

```bash
mkdir -p /volume1/docker/ledger/{data/postgres,scripts}
mkdir -p /volume2/backups/ledger    # different pool than pool1, per the backup plan
```

Create the Docker network the app and NPM will share:
```bash
docker network create finance-net
```
Add `finance-net` to nginx-proxy-manager's compose file (alongside its existing networks) and
recreate the NPM container so it can reach `app` by container name.

Copy this repo's `deploy/docker-compose.yml` and `deploy/scripts/backup.sh` to
`/volume1/docker/ledger/` on the NAS, and copy `deploy/.env.nas.example` to
`/volume1/docker/ledger/.env`, filling in real values (generate `AUTH_SECRET` with
`npx auth secret` on any machine with Node, create the Google OAuth client, list both
household emails).

## 2. NPM configuration

- New subdomain, e.g. `ledger.mikesullivan.dev` (avoid an obvious name like `finance.` —
  cheap defense-in-depth on top of, not instead of, real auth).
- New Access List, **not** a reuse of the existing Dashy one — a credential leak on a
  media-server tool shouldn't be able to touch this subdomain's outer gate. Same LAN/24 +
  home-IP allowlist pattern is fine to reuse; just a distinct Basic Auth credential.
- Individual Let's Encrypt cert, same as the other subdomains.
- Forward to `app:3000` (container name, via `finance-net` — no host port needed).
- Remember: NPM's Basic Auth here is the *outer network gate* only. The app's own Google
  OAuth + allowlist is the real authentication — don't rely on NPM auth alone.

## 3. First run

```bash
cd /volume1/docker/ledger
docker compose pull
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

Then sign in at the new subdomain with each household email once, to confirm both
provision correctly into the same (single) household record.

## 4. Nightly backup cron

`PolarPumpkin` (the automation user) can't write its own crontab on this NAS — same
limitation as the `plaud-pipeline` setup. You'll need to add this yourself via
`sudo crontab -e`:

```cron
0 3 * * * flock -n /tmp/ledger-backup.lock docker compose -f /volume1/docker/ledger/docker-compose.yml --profile backup run --rm backup >> /volume1/docker/ledger/backup.log 2>&1
```

This runs `deploy/scripts/backup.sh` — dumps + gzips the DB into `./backups`, verifies the
dump actually completed (pipefail + the pg_dump completion marker, so a failed dump can't
masquerade as a tiny valid gzip), prunes dumps older than 21 days **except first-of-month
dumps** (kept indefinitely so an unnoticed problem can't age out every good backup), and
posts to `ntfy.sh/nas-homelab-ledger-backup` on failure (subscribe to that topic the same
way as the existing SMART-alert one; deliberately a new topic, not reused, so alert
sources stay distinguishable).

**Success signal:** set `HEALTHCHECK_URL` in `.env` to a healthchecks.io check URL — the
script pings it on success and `<url>/fail` on failure, and healthchecks alerts you when
the nightly ping *doesn't* arrive (which also catches the cron never firing at all — a
failure-only alert can't). If unset, the script posts successes to the ntfy topic instead
so there's still a positive signal.

**Off-box copy — not scripted here, needs your own credentials to wire up.** Once the
nightly local dump is working, add a second step (either inside `backup.sh` or a separate
cron line) that encrypts the newest dump and ships it off-box, e.g.:

```bash
age -r <your-age-public-key> -o ledger-latest.sql.gz.age ledger-<timestamp>.sql.gz
rclone copy ledger-latest.sql.gz.age remote:ledger-backups/   # Backblaze B2 or OneDrive remote
```

This needs an `age` keypair and an `rclone` remote configured on the NAS — left for you to
set up since it depends on which off-box target you actually want to use.

## 5. Restore test

Do this once, right after setup, per the plan — cheap insurance against discovering a
backup-format problem only when you actually need it:

```bash
gunzip -c backups/ledger-<timestamp>.sql.gz | docker compose exec -T db psql -U ledger -d ledger
```

(against a scratch DB/container, not the live one, if you want to be extra careful.)

## Explicit non-goals for v1

- No public/remote access — LAN-only, per the locked decision. No Tailscale, no public NPM
  exposure. Revisit if that need ever comes up.
- No MFA — not needed given LAN-only access. Add it first if remote/public access is ever
  added later.
