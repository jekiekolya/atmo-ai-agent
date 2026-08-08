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

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Dev server                                       |
| `npm run build`     | Production build (includes the TypeScript check) |
| `npm run start`     | Serve the production build                       |
| `npm run typecheck` | `tsc --noEmit`                                   |
| `npm run lint`      | ESLint                                           |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4

Planned per the project constitution: Prisma + PostgreSQL, OpenAI Agents SDK, shadcn/ui,
next-intl, Vitest, Playwright.

## How we work

`.specify/memory/constitution.md` governs this project — stack, testing regimes, localization,
config handling, and agent accountability. Read it before starting a feature.

Features follow specification → plan → tasks → implementation using the `/speckit-*` skills.
Work happens on a branch and lands through a reviewed pull request; the review checks
constitution compliance.

Agent-facing guidance lives in `CLAUDE.md`.
