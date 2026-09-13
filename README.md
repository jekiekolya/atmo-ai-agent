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

## Scripts

| Command                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Dev server                                               |
| `npm run build`         | Production build (includes the TypeScript check)         |
| `npm run start`         | Serve the production build                               |
| `npm run typecheck`     | `tsc --noEmit`                                           |
| `npm run lint`          | ESLint                                                   |
| `npm test`              | Vitest in watch mode                                     |
| `npm run test:run`      | Vitest once — what CI runs                               |
| `npm run e2e`           | Playwright; builds and serves the app itself             |
| `npm run e2e:ui`        | Playwright's UI mode — step through a failing e2e test   |
| `npm run services:up`   | Start the local Docker services                          |
| `npm run services:down` | Stop them, keeping the data                              |
| `npm run db:migrate`    | Create and apply a migration, then regenerate the client |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · next-intl ·
Prisma + PostgreSQL

Tests run on Vitest (unit/integration, colocated with the code) and Playwright (end-to-end, in
`e2e/`). `E2E_PORT=<port> npm run e2e` reuses a server you already have running — typically your
dev server — instead of building one.

Planned per the project constitution: the OpenAI Agents SDK.

## How we work

`.specify/memory/constitution.md` governs this project — stack, testing regimes, localization,
config handling, and agent accountability. Read it before starting a feature.

Features follow specification → plan → tasks → implementation using the `/speckit-*` skills.
Work happens on a branch and lands through a reviewed pull request; the review checks
constitution compliance.

Agent-facing guidance lives in `CLAUDE.md`.
