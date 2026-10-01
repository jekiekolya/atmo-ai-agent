# Atmo AI Agent

Customer-support platform for the end customers of solar-energy partner companies, with an AI
chat agent as the primary support channel.

## Getting started

Node 22 (see `.nvmrc`) and a running Docker Desktop.

```bash
npm ci
cp .env.example .env   # then set DATABASE_URL, see Database below
npm run services:up
npm run dev
```

Open http://localhost:3000.

Configuration comes from environment variables. Copy `.env.example` to `.env` and fill it in —
the app fails fast at startup on a missing or malformed required variable.

Before your first `npm run e2e`, install the browser Playwright drives:
`npx playwright install chromium`.

## Database

`compose.yaml` runs PostgreSQL for local development and nothing else. Its credentials are
deliberately trivial and belong to that container alone; they are never used anywhere a real
deployment can reach.

```bash
npm run services:up      # start, waiting until Postgres reports healthy
npm run services:down    # stop, keeping the data
docker compose down -v   # stop and wipe the volume
```

The connection string for that container, which is also what `.env` needs:

```
DATABASE_URL=postgresql://atmo:atmo@localhost:5432/atmo_dev?schema=public
```

Schema changes go through one command — edit `prisma/schema.prisma`, then:

```bash
npm run db:migrate
```

Prisma asks what to call the change, writes
`prisma/migrations/<timestamp>_<name>/migration.sql`, applies it, and regenerates the client.
Migrations are committed; `prisma db push` is not used.

### First super admin

Every environment has exactly one super admin, created by a deployment step that runs after the
schema is up to date:

```bash
npx prisma migrate deploy
npm run bootstrap
```

It reads `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_FIRST_NAME`,
`BOOTSTRAP_SUPER_ADMIN_LAST_NAME` and `BOOTSTRAP_SUPER_ADMIN_PASSWORD` (see `.env.example`), plus
the application's own `DATABASE_URL`, `APP_ENV` and `AUTH_SECRET`. Run it on every deploy: once a
super admin exists it changes nothing and says so, even if those variables have changed since. It
never rewrites the existing account — the super admin rotates their password from the account page,
not by editing deploy settings.

- It runs through `tsx`, a development dependency, so run it where development dependencies are
  installed — the same place `prisma migrate deploy` and `next build` run.
- Never set `AUTH_URL` or `NEXTAUTH_URL` in any environment: next-auth reads them itself and they
  would override the forwarded host it is configured to trust.
- Integration tests use their own `atmo_test` database and the e2e suite uses `atmo_e2e`; both are
  created on first run and neither touches `atmo_dev`.

## Scripts

| Command                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Dev server                                               |
| `npm run build`         | Production build (includes the TypeScript check)         |
| `npm run start`         | Serve the production build                               |
| `npm run typecheck`     | `tsc --noEmit`                                           |
| `npm run lint`          | ESLint                                                   |
| `npm run lint:fix`      | ESLint, fixing what it can                               |
| `npm run format`        | Prettier: rewrite files in place                         |
| `npm run format:check`  | Prettier: check only — what CI runs                      |
| `npm test`              | Vitest in watch mode                                     |
| `npm run test:run`      | Vitest once — what CI runs                               |
| `npm run e2e`           | Playwright; builds and serves the app itself             |
| `npm run e2e:ui`        | Playwright's UI mode — step through a failing e2e test   |
| `npm run services:up`   | Start the local Docker services                          |
| `npm run services:down` | Stop them, keeping the data                              |
| `npm run db:migrate`    | Create and apply a migration, then regenerate the client |
| `npm run db:status`     | Show which migrations are applied                        |
| `npm run db:reset`      | Wipe the database, reapply migrations — **erases data**  |
| `npm run db:studio`     | Prisma Studio: browse the data in a browser              |
| `npm run bootstrap`     | Create the super admin if none exists (deployment step)  |

`prepare` and `postinstall` run on their own during `npm install`: the first installs the husky
git hooks, the second generates the Prisma client.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · next-intl ·
Prisma + PostgreSQL

Tests run on Vitest (unit/integration, colocated with the code) and Playwright (end-to-end, in
`e2e/`). `npm run e2e` builds and serves the app itself, on the `atmo_e2e` database.
`E2E_PORT=<port> npm run e2e` reuses a server you already have running instead — it must be a
production server (`next start`) on the `atmo_e2e` database; the suite stops if it cannot sign in.

Planned per the project constitution: the OpenAI Agents SDK.

## How we work

`.specify/memory/constitution.md` governs this project — stack, testing regimes, localization,
config handling, and agent accountability. Read it before starting a feature.

Features follow specification → plan → tasks → implementation using the `/speckit-*` skills.
Work happens on a branch and lands through a reviewed pull request; the review checks
constitution compliance.

Agent-facing guidance lives in `CLAUDE.md`.
