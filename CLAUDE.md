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
  Tooling configs at the repo root and build/CI scripts are exempt — they run outside the app.
- **No hardcoded user-facing strings.** All copy resolves through next-intl. A key missing
  from any supported locale is a build failure, not a fallback.
- **Tests are required for changed behavior.** Test-first for domain services, business rules,
  agent tools, Config, and validation helpers — the failing Vitest test comes first and the
  commit order shows it. Test-together for UI and e2e flows.
- **Tenant scoping lives in the data layer**, never in a prompt instruction. Agent tools are
  typed, least-privilege, and single-tenant.
- **UI is composed from `src/components/ui`** (shadcn/ui, vendored via its CLI). Customize
  those primitives in place; preserve their Base UI accessibility semantics. No second
  component library.
- **Check the installed library before writing against it.** Its types and source in
  `node_modules` are the truth; your memory is older than this repo's `package.json`. Apply a
  documented example as is, adapt only what a rule here forces, and complete what the example left
  out rather than redesigning what it showed.
- **`any` needs an inline reason** and stays at the boundary. Same for any suppression.
- **Comments are rare, and one line.** Write one only where the code would mislead without it —
  an ordering constraint nothing tests, a workaround, a trap someone will "fix". Never restate what
  the code says, never re-justify a decision the spec or plan already records, never explain a
  documented library idiom. Prose in the repo ages faster than the code it sits above, so a comment
  that duplicates a document is a future lie. If the reasoning needs a paragraph, it belongs in the
  spec or the commit message.

## Stack

Fixed by the constitution — changing this layer is an amendment, not a feature decision.

|           |                                                                   |
| --------- | ----------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript `strict` |
| Styling   | Tailwind CSS v4                                                   |
| UI        | shadcn/ui on Base UI, vendored via its CLI                        |
| Database  | PostgreSQL via Prisma, committed migrations only                  |
| AI        | OpenAI Agents SDK — _not yet installed_                           |
| i18n      | next-intl (locale-prefixed routing, catalogs in `src/messages/`)  |
| Testing   | Vitest (unit/integration), Playwright (e2e)                       |

Adding any other runtime dependency requires a stated reason in the feature plan: what it
does, what building it ourselves would cost, what the dependency costs. Pulling a shadcn/ui
component through its CLI is exempt.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build (runs the TypeScript check)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # Vitest, watch mode
npm run test:run   # Vitest, single run — what CI runs
npm run e2e        # Playwright; builds and serves the app itself
npm run e2e:ui     # Playwright UI mode — step through a failing e2e test
```

`E2E_PORT=<port> npm run e2e` points the suite at a server that is already running instead of
building one. That server must use the `atmo_e2e` database — the suite checks and stops if it cannot
sign in there — and must be a production server (`next start`): the dev server's cache headers fail
the Back-after-sign-out test.

## Layout

```
src/app/            App Router routes and layouts
src/components/     one folder per component (see below)
src/components/ui/  shadcn/ui primitives (owned code — edit in place)
src/config/         the single Config module
.specify/           constitution, spec templates, spec-kit scripts
```

Import alias: `@/*` → `./src/*`.

**One folder per component.** Every component we author lives in its own directory holding the
component and its colocated test, even when that is only two files — uniform structure beats a
per-component judgement call:

```
src/components/locale-switcher/
├── locale-switcher.tsx
└── locale-switcher.test.tsx
```

Name the file in full rather than `index.tsx`: it stays greppable and the editor does not fill with
identical tabs. Import from the file, not through a barrel — barrel re-exports cost compile time and
defeat tree-shaking. Group folders by domain (`chat/`, `tickets/`) once a directory gets crowded.

`src/components/ui/` is the one exception and stays flat: the shadcn CLI writes those paths, and
rearranging them after every `shadcn add` would cost more than the consistency is worth.

## Merge gates

All required to pass: TypeScript clean, lint clean, Vitest green, Playwright green for
affected flows, message catalogs complete for every locale, Prisma migrations present and
applying, `.env.example` updated when configuration changed.

Feature work happens on a branch — never directly on `main` or `dev`.
