# Atmo AI Agent

Customer-support platform for the end customers of solar-energy partner companies, with an AI
chat agent as the primary support channel.

## Getting started

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

Configuration comes from environment variables. Copy `.env.example` to `.env` and fill it in —
the app fails fast at startup on a missing or malformed required variable.

## Scripts

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Dev server                                             |
| `npm run build`     | Production build (includes the TypeScript check)       |
| `npm run start`     | Serve the production build                             |
| `npm run typecheck` | `tsc --noEmit`                                         |
| `npm run lint`      | ESLint                                                 |
| `npm test`          | Vitest in watch mode                                   |
| `npm run test:run`  | Vitest once — what CI runs                             |
| `npm run e2e`       | Playwright; builds and serves the app itself           |
| `npm run e2e:ui`    | Playwright's UI mode — step through a failing e2e test |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4

Tests run on Vitest (unit/integration, colocated with the code) and Playwright (end-to-end, in
`e2e/`). `E2E_PORT=<port> npm run e2e` reuses a server you already have running — typically your
dev server — instead of building one.

Planned per the project constitution: Prisma + PostgreSQL, OpenAI Agents SDK, next-intl.

## How we work

`.specify/memory/constitution.md` governs this project — stack, testing regimes, localization,
config handling, and agent accountability. Read it before starting a feature.

Features follow specification → plan → tasks → implementation using the `/speckit-*` skills.
Work happens on a branch and lands through a reviewed pull request; the review checks
constitution compliance.

Agent-facing guidance lives in `CLAUDE.md`.
