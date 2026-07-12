# ledger

Shared household finance tracker — built for two people to see and manage the same budget.

Phase 1 (this version): manual account/bucket/transaction entry against the real long-term
data model (transactions, tagging, categorization rules, audit log, and the investing tables
are all in the schema from day one — see `prisma/schema.prisma`), so later phases don't require
a rewrite. Planned next: CSV bank-transaction import + rule-based auto-tagging, spend analytics,
then investment/net-worth tracking.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- PostgreSQL + Prisma 7 (via `@prisma/adapter-pg`, no native query-engine binary)
- Auth.js (next-auth v5) — Google OAuth, restricted to an explicit household email allowlist
- Tailwind CSS, Vitest

## Local development

Requires Node 22+ and a local Postgres (a `docker-compose.yml` is provided for this — needs
Docker installed locally; it was not available on the machine this was first scaffolded on).

```bash
cp .env.example .env      # fill in AUTH_SECRET / Google OAuth client / allowlist
docker compose up -d      # starts local Postgres on :5432
npx prisma migrate dev    # applies the schema
npm run dev
```

Generate `AUTH_SECRET` with `npx auth secret`. Create a Google OAuth client at
https://console.cloud.google.com/apis/credentials with redirect URI
`http://localhost:3000/api/auth/callback/google`.

## Testing

```bash
npm run test    # vitest — currently covers the cents-based money math in src/lib/money.ts
npm run lint
npx tsc --noEmit
```

## Deployment

Deployed to a home NAS via Docker Compose, fronted by an existing nginx-proxy-manager
instance — see `deploy/README.md` for the NAS-specific compose file and setup notes. Images are
built by GitHub Actions (`.github/workflows/ci.yml`) and pushed to GHCR; the NAS only ever pulls,
never builds, to avoid competing with everything else already running on its CPU.

## Project structure notes

- `prisma/schema.prisma` — full data model, including tables unused until later phases
  (`CategorizationRule`, `Holding`, `AccountBalanceSnapshot`) so the schema doesn't need to
  change shape when those phases are built.
- `src/lib/session.ts` — the actual auth/authorization boundary. `src/proxy.ts` only does an
  optimistic redirect; every Server Action re-verifies the session itself.
- `src/lib/money.ts` — all amounts are integer cents; never use floats for money here.
