# Implementation Plan: Authentication and User Administration

**Branch**: `003-auth-user-admin` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-auth-user-admin/spec.md`

## Summary

Add email-and-password sign-in for two roles: a single super admin, created by an idempotent
`npm run bootstrap`, and admins who join through one-time invite links the super admin passes on out of
band. The super admin lists, creates, deactivates, reactivates, and re-invites users. Everyone can
change their own password. Sessions are next-auth v5 encrypted JWT cookies, but nothing trusts the
cookie alone: on every resolution the `jwt` callback reloads the user and rejects the session if the
user is gone or deactivated, if the password changed or a sign-out happened after sign-in, or if 24
hours have passed since sign-in.

The technical spine is three protection layers:

1. An optimistic `getToken()` check composed after 001's locale handler in the single `src/proxy.ts`.
2. A `(private)` route group whose layout and pages call a `cache()`-memoized `verifySession()`.
3. Services under `src/server/` that authorize every operation themselves and import nothing from
   Next.

All writes go through thin REST route handlers: zod → session → service. They are called by four forms
built from Base UI `Form` and a customized shadcn `field`. This is the first feature with Prisma models,
so it also sets the data layer's conventions: `timestamptz` everywhere, UUIDv7 ids, and invariants as
schema-declared (partial) unique indexes.

Research overturned three assumptions the request recorded as verified: server rendering neither renews
nor clears the session cookie (R3), next-auth's sign-out hook swallows errors (R5), and bcrypt cannot
fingerprint lookup tokens (R12). The spec's constraints were amended before this plan, and the
resulting design choices are in Complexity Tracking.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node ≥ 22.12 (local 22.23)

**Primary Dependencies**:

- Already present: Next.js 16.3 (App Router, proxy on Node.js), React 19.2, next-intl 4.13.7, Prisma
  7.10 with `@prisma/adapter-pg`, zod 4, `@base-ui/react` 1.7.
- **New**: `next-auth@5.0.0-beta.32` (pinned exactly — beta line), `bcryptjs@^3.0.3`, and `tsx` (dev
  only). Justified in [research.md R21](./research.md#r21-dependency-justifications-constitution-technology-constraints).
- shadcn `base-nova` primitives via the CLI: `field`, `input`, `label`, `alert`, `card`, `table`,
  `badge`, `dialog`, `alert-dialog`, `dropdown-menu`, `separator`, `toast`.

**Storage**: PostgreSQL 18 through Prisma. Two tables (`users`, `invites`), one enum, and one
committed migration. Preview feature `partialIndexes` is enabled. See [data-model.md](./data-model.md).

**Testing**:

- Vitest 4 — `unit` (node), `ui` (jsdom), and a **new** `integration` project against a real
  Postgres (`atmo_test`).
- Playwright 1.62 against `atmo_e2e`.
- CI gains a Postgres service.

**Target Platform**: A server-rendered web app behind a reverse proxy that overwrites
`X-Forwarded-Host`. The proxy runs on Node.js.

**Project Type**: A single Next.js application.

**Performance Goals**:

- The proxy stays free of I/O: the added work is one in-memory JWE decrypt, and only for
  `/{l}/dashboard…` requests.
- Each protected render or API call costs one primary-key user lookup. `cache()` collapses repeats
  within a request.
- A sign-in costs one bcrypt compare at cost 12 (target < 400 ms, R13) plus at most two small writes.

**Constraints**:

- No database access in the proxy (FR-032).
- Uniform sign-in failure, including timing (FR-015).
- No `process.env` outside `src/config` except the bootstrap script and tooling configs.
- Nothing under `src/server/` imports `next`, `next/*`, `next-auth`, or `react` (MC-008, lint-enforced).
- 001's proxy handler and tests stay untouched (FR-065).
- Every exit from the protected area is a full-document navigation (R8).

**Scale/Scope**:

- Tens of staff accounts.
- 7 new pages or views: sign-in, invite, dashboard home, users, account, not-permitted, and the link
  dialog.
- 7 of our own endpoints, plus next-auth's.
- 4 forms, 2 models, about 45 new catalog keys per locale.

## Constitution Check

_GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design. Both passes recorded._

| Principle                               | Verdict                          | How this plan satisfies it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Type-Safe by Default**             | PASS                             | All new code is TypeScript. next-auth's `Session`, `User`, and `JWT` are augmented in `src/types/next-auth.d.ts` (checked to compile under `strict` in the research scratch install). Prisma-derived types are mapped to explicit DTOs at the service boundary (`UserSummary`), so the list page never receives `passwordHash`. Request bodies are `unknown` until zod narrows them. No `any` is planned.                                                                                                                       |
| **II. Simple, Modular, Readable**       | PASS with tracked deviations     | Layers: pages render; handlers adapt HTTP; services hold rules; repositories hold Prisma. Two shared helpers exist because their callers already do: `defineRoute` (seven handlers) and `toFormErrors`/`apiRequest` (three forms). There is no form component or form hook (four forms, four schemas, differing success paths) and no navigation config (out of scope). Six deviations from the simplest path are recorded in Complexity Tracking, each forced by a research finding.                                           |
| **III. Spec-First Delivery**            | PASS                             | Spec written, clarified in 3 sessions, and **amended before this plan** where research overturned its constraints (MC-001, -002, -003, -005, -010, -011, -013, and Known Boundaries). Each amendment is marked in the spec and argued in research.md.                                                                                                                                                                                                                                                                           |
| **IV. Tested Business Logic**           | PASS                             | Every module is assigned a regime below. Authentication is mandatory Playwright coverage, provided by FR-064's three specs.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **V. Centralized Config, Zero Secrets** | PASS with one recorded exception | Three new variables go through `src/config` with fail-fast validation, including a cross-field rule (R9). `.env.example` is updated, and the stale `user:password` URL is fixed there. **Exception**: next-auth reads `AUTH_URL` / `NEXTAUTH_URL` itself; the plan forbids setting them rather than reading them (R9). The bootstrap variables are read by the script under the tooling exemption and deliberately kept out of Config (spec MC-002, amended). Test secrets appear only in test configs as obvious placeholders. |
| **VI. Accountable AI Agents**           | N/A                              | No agent surface. Deactivation-not-deletion keeps future attribution possible, which is the part of the accountability principle this feature can serve.                                                                                                                                                                                                                                                                                                                                                                        |
| **VII. Localized by Default**           | PASS                             | Every string is in both catalogs, enforced by 001's parity test. Zod messages and API error codes are catalog keys, translated where they render. Hardcoded English labels inside the vendored `toast` and `dialog` are replaced with translated props. Dates go through next-intl's formatter in 001's UTC zone. Bootstrap output is operator log text, not product copy (spec Assumptions).                                                                                                                                   |
| **Technology Constraints**              | PASS                             | Postgres through Prisma with a committed migration, and the partial indexes declared in the schema rather than hand-edited SQL (R10). No second component library; Base UI Toast is used instead of adding `sonner` (R15). The `cn` npm package the registry now requests is refused (R16). Three new packages, each justified (R21). Library fidelity: every next-auth, Prisma, and Base UI claim was read from the installed version.                                                                                         |

### Test regime per module (Principle IV)

| Module                                                                                                                                                                                     | Regime                                                                                | Where                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------- |
| `src/config/schema.ts` additions (secret length, defaults, absolute ≥ rolling)                                                                                                             | **Test-first**                                                                        | `schema.test.ts` (unit)       |
| `src/lib/schemas/*` (email normalization, password 12 characters / 72 bytes, confirm match, role not assignable)                                                                           | **Test-first**                                                                        | colocated `*.test.ts` (unit)  |
| `src/server/auth/session-policy.ts` (`evaluateSession`, all 5 rejection rules, same-millisecond edge)                                                                                      | **Test-first**                                                                        | unit, fake clock              |
| `src/server/auth/authorization.ts` (`assertSuperAdmin`, self-targeting rules)                                                                                                              | **Test-first**                                                                        | unit                          |
| `src/server/auth/authenticate.ts` (uniform `null`, lockout arithmetic, dummy compare)                                                                                                      | **Test-first**                                                                        | integration                   |
| `src/server/invites/invite-token.ts` (entropy, hash, malformed input)                                                                                                                      | **Test-first**                                                                        | unit                          |
| `src/server/users/user-service.ts`, `src/server/invites/invite-service.ts` (every transition, the authorization matrix, concurrency of consume, issue, and super-admin creation)           | **Test-first**                                                                        | integration                   |
| `src/server/prisma-errors.ts` (`isUniqueViolation` for each constraint)                                                                                                                    | **Test-first**                                                                        | integration                   |
| `scripts/bootstrap.ts` idempotency ([contracts/bootstrap.md](./contracts/bootstrap.md))                                                                                                    | **Test-first**                                                                        | integration                   |
| `src/auth/dal.ts` (`getSessionUser`, `verifySession` redirect targets, `requireSuperAdmin`)                                                                                                | **Test-first**                                                                        | unit, next-auth `auth` mocked |
| `src/auth/proxy-guard.ts` (decision table in routing contract; no `Set-Cookie`; `no-store`)                                                                                                | **Test-first**                                                                        | unit                          |
| `src/lib/http/*` (same-origin check, `defineRoute` step order and error mapping, `toFormErrors`, callbackUrl sanitizer, `apiRequest` 401 handling); `ErrorCode` ↔ catalog-key completeness | **Test-first**                                                                        | unit                          |
| Route handlers (thin adapters over `defineRoute`; their authorization rules are test-first in the services, their plumbing test-first in `defineRoute`)                                    | Test-together — the authorization-matrix test ships in the same story as the handlers | integration                   |
| Forms, user table, dialogs, not-permitted view, keep-alive                                                                                                                                 | Test-together                                                                         | `ui` (jsdom)                  |
| Auth, invite, users flows                                                                                                                                                                  | Test-together                                                                         | Playwright (FR-064)           |

The commit order shows each failing test before its implementation, as 001 did.

**Post-design re-check (after Phase 1)**: still PASS. The design added no layer, dependency, or
abstraction beyond the Complexity Tracking rows. One finding came out of design itself: the API
returns catalog keys, never text, so no route handler needs next-intl (R17). That removes the one
place a handler might have been tempted to read the locale.

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-user-admin/
├── plan.md                   # This file
├── research.md               # Phase 0 — 22 decisions with evidence
├── data-model.md             # Phase 1 — users, invites, invariants, transitions, claims
├── quickstart.md             # Phase 1 — run and verify
├── contracts/
│   ├── http-api.md           # Endpoints, error envelope, authorization matrix
│   ├── routing-and-session.md# Addresses, three layers, proxy table, session lifecycle
│   ├── bootstrap.md          # npm run bootstrap behaviour and tests
│   └── ui.md                 # Primitives, forms, where each message appears
├── checklists/requirements.md
└── tasks.md                  # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                         # UPDATED — previewFeatures partialIndexes; Role, User, Invite
└── migrations/<ts>_auth_users_invites/   # NEW — generated, committed

scripts/
├── bootstrap.ts                          # NEW — thin: parse BOOTSTRAP_* (zod) → bootstrapSuperAdmin()
└── bootstrap.integration.test.ts         # NEW — test-first

src/
├── proxy.ts                              # UPDATED — async; handleLocaleRequest then proxyGuard
├── config/
│   ├── schema.ts                         # UPDATED — AUTH_SECRET, SESSION_MAX_AGE_SECONDS, SESSION_ABSOLUTE_LIFETIME_SECONDS
│   └── schema.test.ts                    # UPDATED — test-first
├── auth/                                 # NEW — the Next/next-auth adapter layer
│   ├── auth.ts                           #   NextAuth(): Credentials → authenticate(); jwt → evaluateSession(); options from Config
│   ├── cookie-policy.ts                  #   useSecureCookies — one definition shared by auth.ts and proxy-guard
│   ├── dal.ts / dal.test.ts              #   getSessionUser (cache), verifySession, requireSuperAdmin
│   └── proxy-guard.ts / .test.ts         #   optimistic getToken() check for /{l}/dashboard
├── server/                               # NEW — no next/*, next-auth, or react imports (lint rule)
│   ├── db.ts                             #   PrismaClient + PrismaPg from config.databaseUrl; globalThis cache outside production
│   ├── errors.ts                         #   DomainError subclasses
│   ├── prisma-errors.ts / .integration.test.ts
│   ├── auth/
│   │   ├── password.ts                   #   hash, verify, DUMMY_HASH (cost 12)
│   │   ├── authenticate.ts / .integration.test.ts
│   │   ├── session-policy.ts / .test.ts
│   │   └── authorization.ts / .test.ts
│   ├── users/
│   │   ├── user-repository.ts
│   │   └── user-service.ts / .integration.test.ts
│   └── invites/
│       ├── invite-token.ts / .test.ts
│       ├── invite-repository.ts
│       └── invite-service.ts / .integration.test.ts
├── lib/
│   ├── schemas/                          # NEW — one per form; shared by client and endpoint
│   │   ├── fields.ts / .test.ts          #   email, password, firstName, lastName
│   │   ├── sign-in.ts, create-user.ts, accept-invite.ts, change-password.ts (+ tests)
│   └── http/                             # NEW
│       ├── same-origin.ts / .test.ts
│       ├── define-route.ts / .test.ts    #   origin → body (zod) → session → handler → error mapping
│       ├── route-response.ts / .test.ts  #   DomainError → status + envelope; zod → fields
│       ├── form-errors.ts / .test.ts     #   toFormErrors(fields, t), errorMessageKey(code, detail)
│       ├── callback-url.ts / .test.ts
│       └── api-client.ts / .test.ts      #   apiRequest: result union; 401 → sign-in; network → code "network"
├── types/next-auth.d.ts                  # NEW — Session/User/JWT augmentation
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NEW — next-auth handlers (Known Boundary)
│   │   ├── session/sign-out/route.ts     # NEW
│   │   ├── users/route.ts                # NEW — POST
│   │   ├── users/[id]/deactivate/route.ts
│   │   ├── users/[id]/reactivate/route.ts
│   │   ├── users/[id]/invite/route.ts    #   POST issue, DELETE revoke
│   │   ├── invites/accept/route.ts
│   │   └── account/password/route.ts     #   PUT
│   └── [locale]/
│       ├── (public)/
│       │   ├── sign-in/page.tsx          #   real session check → redirect if signed in (R4)
│       │   └── invite/[token]/page.tsx   #   outcome → message or form; referrer no-referrer
│       └── (private)/
│           ├── layout.tsx                #   verifySession; SessionProvider; keep-alive; minimal bar; Toaster
│           └── dashboard/
│               ├── page.tsx              #   protected home
│               ├── users/page.tsx        #   requireSuperAdmin → list | NotPermitted
│               └── account/page.tsx
├── components/                           # one folder per component, test beside it
│   ├── sign-in-form/  set-password-form/  create-user-form/  change-password-form/
│   ├── user-table/  user-row-actions/  invite-link-dialog/
│   ├── not-permitted/  app-shell/  account-menu/  session-keep-alive/
│   └── ui/                               # NEW via shadcn CLI: field (customized), input, label, alert,
│                                         #   card, table, badge, dialog, alert-dialog, dropdown-menu,
│                                         #   separator, toast
└── messages/en.json, uk.json             # UPDATED — auth, invite, users, account, validation, errors

e2e/
├── global-setup.ts                       # NEW — migrate atmo_e2e, truncate, bootstrap
├── support/db.ts                         # NEW — Prisma client for setup only
├── auth.spec.ts  invite.spec.ts  users.spec.ts   # NEW
└── (001/002 specs unchanged)

eslint.config.mjs                         # UPDATED — no-restricted-imports for src/server/**
vitest.config.mts                         # UPDATED — unit includes src/{server,auth,lib}; new integration project; corrected URL
playwright.config.ts                      # UPDATED — globalSetup, atmo_e2e URL, AUTH_SECRET
.github/workflows/ci.yml                  # UPDATED — postgres:18-alpine service on unit and e2e
.env.example                              # UPDATED — 3 Config vars, 3 bootstrap vars, corrected URL
package.json                              # UPDATED — next-auth, bcryptjs, tsx; "bootstrap" script
README.md                                 # UPDATED — "First super admin" under Database; Scripts row
```

**Structure Decision**: A single Next.js application. Four structural decisions follow from the research:

1. **`src/server/` is the portable core.** Services, repositories, rules, and the Prisma client live
   there, and nothing there imports `next`, `next/*`, `next-auth`, or `react`. An ESLint
   `no-restricted-imports` rule scoped to `src/server/**` enforces it, so the portability guarantee is
   checked mechanically rather than by review. Moving to another backend means rewriting `src/app/api/`
   and `src/auth/`, and nothing else.
2. **`src/auth/` is the adapter** between next-auth and Next on one side and the services on the other:
   the next-auth configuration, the DAL, and the proxy guard. It is the only code that imports
   next-auth on the server, which keeps the Known Boundary in one folder.
3. **Schemas live in `src/lib/schemas/`, not in `src/server/`.** Client forms import them, and a client
   import from `src/server/` would drag server modules toward the browser bundle.
4. **Route groups are used as the request asked**, `(public)` and `(private)`. The protected prefix is
   a real segment, `dashboard`, inside `(private)`, because layer 1 matches on the URL and a route group
   has no URL of its own.

## Complexity Tracking

| Deviation                                                                                                     | Why needed                                                                                                                                                 | Simpler alternative rejected because                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A client keep-alive (`SessionProvider` refetch on focus + `getSession()` on navigation) drives cookie renewal | Server Component `auth()` discards `Set-Cookie`, so server rendering never renews the rolling window; active users would be cut off 8 h after sign-in (R3) | Relying on built-in renewal: it does not happen on this path. `refetchInterval` polling: an open tab renews forever and defeats the idle timeout. Re-encoding in the proxy: skips revocation and re-implements cookie chunking |
| Our own `POST /api/session/sign-out` instead of next-auth's endpoint                                          | FR-066 needs the `signedOutAt` write to succeed or visibly fail; `events.signOut` swallows errors (R5)                                                     | Writing in `events.signOut`: a failed write would silently leave other devices signed in                                                                                                                                       |
| The sign-in page, not the proxy, redirects signed-in visitors (FR-031)                                        | The proxy cannot see revocation and would loop with the private layout (R4)                                                                                | The guide's proxy example redirects both ways; with a revoked cookie that is an infinite redirect                                                                                                                              |
| The shadcn `field` primitive is customized to wrap Base UI `Field`                                            | The `base-nova` `field` renders plain elements and its own error prop; Base UI `Form`'s server-error plumbing only reaches Base UI `Field` (R14)           | Using Base UI parts directly in feature code bypasses `src/components/ui`. Using `field` as shipped needs a second error path                                                                                                  |
| Prisma preview feature `partialIndexes`                                                                       | FR-002 must be a database invariant; hand-edited partial indexes are detected as drift and dropped by the next `migrate dev` (R10)                         | Raw SQL in the migration: dropped on the next migration. A service check: raceable, which the spec forbids                                                                                                                     |
| A post-pull step for every `shadcn add`: `cn` import rewritten, `button.tsx` overwrite declined               | The registry now emits `import { cn } from "cn"` and lists an unrequested npm package (R16)                                                                | Accepting `cn`: a new runtime dependency duplicating `@/lib/utils`, published four days ago                                                                                                                                    |

## Amendments Made During Implementation

Recorded here because Principle III forbids the code being the only record of intended behaviour.

| #   | Planned                                                          | Built                                                                                                                                                                                                                                 | Why the plan could not stand                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Migration generated with `prisma migrate dev` against `atmo_dev` | Generated with `prisma migrate diff --from-empty --to-schema`, then applied to `atmo_test` and diffed back to empty                                                                                                                   | `atmo_dev` holds a table from earlier Prisma experiments; `migrate dev` would have offered to reset it. The generated SQL is identical and unedited; no drift (`migrate diff` from the applied database to the schema is empty)                                                                                                                                          |
| A2  | Bootstrap reuses Config for the database                         | Same, plus `NODE_ENV` defaults to `production` inside the script before the database module loads                                                                                                                                     | Config requires `NODE_ENV`; Next sets it for the app, npm does not set it for a script. Found by running the script, not by a test                                                                                                                                                                                                                                       |
| A3  | No test-only dependencies beyond R21                             | `pg` (8.23.0, already in the tree via `@prisma/adapter-pg`) and `@types/pg` as **dev** dependencies for the e2e fixtures                                                                                                              | The generated Prisma client uses `import.meta` and cannot load under Playwright's CommonJS transform. Spawning `tsx` per fixture call was the alternative; slower and more moving parts                                                                                                                                                                                  |
| A4  | `verifySession()` redirects with `callbackUrl`                   | Redirects to `/{l}/sign-in` without one                                                                                                                                                                                               | A Server Component layout cannot read its own path. Anonymous visitors still get `callbackUrl` from the proxy (FR-028); client-detected rejections get it from `apiRequest` and the keep-alive (FR-071). Only a page render of a revoked session loses the return address                                                                                                |
| A5  | e2e for "a role change takes effect without re-login"            | Covered by the `jwt` callback unit test (role re-read on every call)                                                                                                                                                                  | The only second role is the single super admin; demoting it mid-run breaks the parallel specs that sign in as it                                                                                                                                                                                                                                                         |
| A6  | Error classes as listed in the contract                          | Plus `InvalidInviteError` (`invite_invalid` → 404) and `userIdFrom(params)` (malformed id → 404)                                                                                                                                      | A malformed UUID reached Postgres's parser and would have surfaced as a 500                                                                                                                                                                                                                                                                                              |
| A7  | Toaster inside the private layout                                | In the root `[locale]` layout                                                                                                                                                                                                         | The public set-password form also reports unexpected failures as a notification (FR-070)                                                                                                                                                                                                                                                                                 |
| A8  | Vendored primitives used as pulled                               | `toast` and `dialog` take their close/region labels as props                                                                                                                                                                          | Both hardcoded English (`"Close toast"`, `"Notifications"`, `"Close"`)                                                                                                                                                                                                                                                                                                   |
| A9  | Email inputs `type="email"`                                      | `type="text" inputMode="email"`                                                                                                                                                                                                       | Base UI runs native constraint validation first, whose message is in the browser's language, not the catalog's                                                                                                                                                                                                                                                           |
| A10 | `dateStyle` + `timeZoneName` for zoned times                     | `ZONED_DATE_TIME` with explicit parts (`src/lib/date-formats.ts`)                                                                                                                                                                     | Intl rejects `dateStyle` combined with `timeZoneName`; found in the e2e server log                                                                                                                                                                                                                                                                                       |
| A11 | Pending state on form buttons only, shown as text                | Every request-sending control, row actions included, is disabled in flight and shows the vendored shadcn `spinner` beside its text, as shadcn's Button + Spinner example does (`data-icon="inline-start"`); `button.tsx` is untouched | FR-059 amended during review: row actions had no pending state and could send twice. The pulled `spinner` hardcoded `aria-label="Loading"`; it now takes its label from the caller, and inside a button it is `aria-hidden` because the button's text already says what is happening                                                                                     |
| A12 | `E2E_PORT` runs the suite against your dev server on `atmo_dev`  | `E2E_PORT` reuses only a production server on `atmo_e2e`; global setup signs in once as the e2e super admin and stops the run with the cause when it cannot                                                                           | Global setup and the fixtures only ever write `atmo_e2e`, so against a dev server on `atmo_dev` every sign-in spec failed; the quickstart claimed the setup would wipe `atmo_dev` instead, which R20 forbids. A dev server on `atmo_e2e` was tried and dropped: its `Cache-Control` lacks `no-store`, so Chrome restores the dashboard on Back and the FR-067 test fails |

**Dependencies added beyond the plan**: `pg` and `@types/pg`, dev only (A3).

## Phase Status

- [x] Phase 0 — research complete → [research.md](./research.md)
- [x] Phase 1 — design complete → [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)
- [x] Constitution check re-evaluated after design — still PASS, no new deviations
- [ ] Phase 2 — `/speckit-tasks` (not this command)
