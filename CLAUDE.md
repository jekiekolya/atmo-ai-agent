@AGENTS.md

# Atmo AI Agent

A customer-support platform. We operate it to support the end customers of partner
companies in the solar-energy field, with an AI chat agent as the primary support channel.
The people it serves are not our own users — that constraint drives most rules below.

## Read the constitution first

`.specify/memory/constitution.md` is authoritative and supersedes tool defaults, habit, and
anything in this file. Re-read it when planning a feature. The rules that bite most often:

- **Spec-first.** Features go specify → plan → tasks → implement via the `/speckit-*` skills.
  No feature branch introduces user-visible behavior without a spec. Bug fixes and mechanical
  chores (dependency bumps, renames, formatting) are exempt.
- **No `process.env` outside the Config module** (`src/config/index.ts`). It validates and
  coerces at startup and exports one typed frozen object; everything else imports that.
  Every variable it reads gets an `.env.example` entry. Missing required variables fail fast.
- **No hardcoded user-facing strings.** All copy resolves through next-intl. A key missing
  from any supported locale is a build failure, not a fallback.
- **Tests are required for changed behavior.** Test-first for domain services, business rules,
  agent tools, Config, and validation helpers — the failing Vitest test comes first and the
  commit order shows it. Test-together for UI and e2e flows.
- **Tenant scoping lives in the data layer**, never in a prompt instruction. Agent tools are
  typed, least-privilege, and single-tenant.
- **UI is composed from `src/components/ui`** (shadcn/ui, vendored via its CLI). Customize
  those primitives in place; preserve their Radix accessibility semantics. No second
  component library.
- **`any` needs an inline reason** and stays at the boundary. Same for any suppression.

## Stack

Fixed by the constitution — changing this layer is an amendment, not a feature decision.

|           |                                                                        |
| --------- | ---------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript `strict`      |
| Styling   | Tailwind CSS v4                                                        |
| UI        | shadcn/ui — _not yet installed_                                        |
| Database  | PostgreSQL via Prisma, committed migrations only — _not yet installed_ |
| AI        | OpenAI Agents SDK — _not yet installed_                                |
| i18n      | next-intl — _not yet installed_                                        |
| Testing   | Vitest (unit/integration), Playwright (e2e) — _not yet installed_      |

Adding any other runtime dependency requires a stated reason in the feature plan: what it
does, why the existing stack cannot, what it costs. Pulling a shadcn/ui component through its
CLI is exempt.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build (runs the TypeScript check)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Layout

```
src/app/            App Router routes and layouts
src/components/ui/  shadcn/ui primitives (owned code — edit in place)
src/config/         the single Config module
.specify/           constitution, spec templates, spec-kit scripts
```

Import alias: `@/*` → `./src/*`.

## Merge gates

All required to pass: TypeScript clean, lint clean, Vitest green, Playwright green for
affected flows, message catalogs complete for every locale, Prisma migrations present and
applying, `.env.example` updated when configuration changed.

Feature work happens on a branch — never directly on `main` or `dev`.
