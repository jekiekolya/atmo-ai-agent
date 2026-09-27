---
description: "Task list for the authentication and user administration feature"
---

# Tasks: Authentication and User Administration

**Input**: Design documents from `/specs/003-auth-user-admin/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required, not optional. Constitution Principle IV makes test-first mandatory for services,
the data access layer, authorization rules, zod schemas, Config, and the bootstrap command (spec MC-012,
plan § Test regime per module), and names authentication as mandatory Playwright coverage (FR-064).
In every test-first pair, the test task comes first; run it, **confirm it fails**, and commit it
before the implementation task, so the commit order shows it.

**Organization**: Grouped by the six user stories of spec.md so each is independently implementable
and testable. User stories are ordered by priority: US1 and US2 are P1, then US3, US4, and US5 at P2,
then US6 at P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US6, mapping to the user stories in spec.md
- Every task names its exact file path

## Path Conventions

Single Next.js application. Application code in `src/`, the setup command in `scripts/`, e2e in `e2e/`,
tooling configs at the repository root. Import alias `@/*` → `./src/*`, `@generated/*` →
`./prisma/generated/*`. Unit tests are colocated `*.test.ts(x)`; database-backed tests are colocated
`*.integration.test.ts` and run in the Vitest `integration` project against `atmo_test`.

Rules that apply to every task:

- Nothing under `src/server/` imports `next`, `next/*`, `next-auth`, `react`, or `server-only` (plan
  § Structure Decision 1).
- No user-facing literal. Every new key goes into **both** `src/messages/en.json` and
  `src/messages/uk.json` in the same task that first renders it.
- Every `DateTime` field is `@db.Timestamptz(3)`. Instants come from `new Date()` in application code,
  never from the database's `now()` (research R6).
- No `process.env` outside `src/config/`, `scripts/bootstrap.ts`, and root tooling configs.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, toolchain, test databases, and UI primitives the rest of the work stands on

- [x] T001 Add `next-auth@5.0.0-beta.32` (exact version, no caret — beta line) and `bcryptjs@^3.0.3` to `dependencies`, and `tsx` to `devDependencies`, in `package.json`. Install them and add the script `"bootstrap": "tsx scripts/bootstrap.ts"` (research R19, R21)
- [x] T002 [P] Replace the stale `postgresql://user:password@localhost:5432/atmo_dev` with `postgresql://atmo:atmo@localhost:5432/atmo_dev` in `.env.example` and in the `unit` project env of `vitest.config.mts`, and point `playwright.config.ts`'s `webServer.env.DATABASE_URL` at `postgresql://atmo:atmo@localhost:5432/atmo_e2e` (research R20)
- [x] T003 Update `vitest.config.mts` (research R20):
  - extend the `unit` project's `include` to `src/{config,i18n,lib,services,server,auth}/**/*.test.ts`, exclude `**/*.integration.test.ts`, and add `AUTH_SECRET: "test-secret-at-least-32-characters-long"` to its env;
  - add an `integration` project (node) that includes `src/**/*.integration.test.ts` and `scripts/**/*.integration.test.ts`, with env `APP_ENV=development`, `DATABASE_URL=postgresql://atmo:atmo@localhost:5432/atmo_test`, and the same `AUTH_SECRET`; set `globalSetup: ["./vitest.integration.global-setup.ts"]`, `setupFiles: ["./vitest.integration.setup.ts"]`, `fileParallelism: false`, and `server: { deps: { inline: ["next-intl", "next-auth"] } }`. Route-handler tests load both through `@/auth/*`, and the unit project already needed the same inline for next-intl.
- [x] T004 Create `vitest.integration.global-setup.ts`, which runs `npx prisma migrate deploy` with the integration `DATABASE_URL` (the database is created on first run), and `vitest.integration.setup.ts`, which runs `TRUNCATE "invites", "users" RESTART IDENTITY CASCADE` in a `beforeEach` through the Prisma client, and disconnects in `afterAll`. Both are root tooling files and may read `process.env`. Depends on T003
- [x] T005 [P] Add a `no-restricted-imports` block to `eslint.config.mjs`. It covers `files: ["src/server/**/*.ts"]` and forbids `next`, `next/*`, `next-auth`, `next-auth/*`, `react`, `react-dom`, and `server-only`, with the message "src/server is the portable core; no framework imports (spec MC-008, plan Structure Decision 1)"
- [x] T006 [P] Add a `services.postgres` block (`image: postgres:18-alpine`, `POSTGRES_USER`/`POSTGRES_PASSWORD` `atmo`, port `5432:5432`, `pg_isready` health check) to the `unit` and `e2e` jobs in `.github/workflows/ci.yml` (research R20)
- [x] T007 Vendor the UI primitives (research R14–R16):
  - first run `npx shadcn add field input label alert card table badge dialog alert-dialog dropdown-menu separator toast --dry-run` and read what it would write;
  - then run it for real, **declining** the overwrite of `src/components/ui/button.tsx`;
  - in every new file under `src/components/ui/`, rewrite `import { cn } from "cn"` to `import { cn } from "@/lib/utils"`;
  - remove `cn` from `package.json` if the CLI added it, and run `npx prettier --write src/components/ui`;
  - confirm `git diff src/components/ui/button.tsx` is empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, schema, the portable core's shared pieces, request plumbing, and the session core.
Every user story needs all of it; none of it is user-visible on its own.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Config

- [x] T008 Write failing tests in `src/config/schema.test.ts`:
  - `AUTH_SECRET` missing fails, naming the variable, and so does one shorter than 32 characters;
  - `SESSION_MAX_AGE_SECONDS` defaults to 28800 and `SESSION_ABSOLUTE_LIFETIME_SECONDS` to 86400;
  - both coerce from strings and reject zero, negative, and non-integer values;
  - an absolute lifetime shorter than the max age fails with a message naming both variables (FR-073);
  - the frozen result exposes `authSecret`, `sessionMaxAgeSeconds`, and `sessionAbsoluteLifetimeSeconds`.
- [x] T009 Implement the three variables and the cross-field rule in `src/config/schema.ts` (research R9). Document them in `.env.example` with placeholders and one-line descriptions, and add a separate "Setup command only (npm run bootstrap) — not read by the application" block for `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_FIRST_NAME`, `BOOTSTRAP_SUPER_ADMIN_LAST_NAME`, and `BOOTSTRAP_SUPER_ADMIN_PASSWORD`. Add a comment that `AUTH_URL` and `NEXTAUTH_URL` must never be set. Depends on T008

### Data layer

- [x] T010 Write `prisma/schema.prisma` per [data-model.md](./data-model.md):
  - `previewFeatures = ["partialIndexes"]` on the generator;
  - enum `Role`; model `User` → `@@map("users")` with `firstName`, `lastName`, `passwordHash?`, `passwordChangedAt?`, `signedOutAt?`, `failedSignInCount`, `lockedUntil?`, `isActive`, `createdAt`, `updatedAt`; model `Invite` → `@@map("invites")`;
  - ids `@default(uuid(7)) @db.Uuid`, every `DateTime` `@db.Timestamptz(3)`, and both foreign keys `onDelete: Restrict`;
  - `@@unique([role], map: "users_one_super_admin", where: { role: "SUPER_ADMIN" })`, `@@unique([userId], map: "invites_one_outstanding_per_user", where: raw("\"consumedAt\" IS NULL AND \"revokedAt\" IS NULL"))`, and `@@index([userId])`.
- [x] T011 Generate the migration with `npx prisma migrate dev --name auth_users_invites` against `atmo_dev`. Read the generated `prisma/migrations/<timestamp>_auth_users_invites/migration.sql` and confirm it contains both `CREATE UNIQUE INDEX … WHERE` statements and only `TIMESTAMPTZ(3)` time columns. Commit it unedited (research R10). Depends on T010
- [x] T012 [P] Create `src/server/db.ts`, which exports one `PrismaClient` from `@generated/client` built with `new PrismaPg({ connectionString: config.databaseUrl })`. Cache it on `globalThis` when `config.nodeEnv !== "production"`. No `server-only` import (research R19). Depends on T011
- [x] T013 [P] Create `src/server/errors.ts` (contracts/http-api.md § Shared plumbing):
  - an `ERROR_CODES` `as const` array holding every code in contracts/http-api.md, with `ErrorCode` derived from it;
  - an abstract `DomainError` carrying `code` and an optional `detail`;
  - the subclasses `ValidationError` (with `fields`), `ForbiddenError`, `NotFoundError`, `ConflictError`, `GoneError`, and `LockedError`;
  - no HTTP statuses anywhere in the file.
- [x] T014 Write failing tests in `src/server/prisma-errors.integration.test.ts`. Insert rows that violate `users_email_key`, `users_one_super_admin`, and `invites_one_outstanding_per_user`, and assert `isUniqueViolation(error, name)` is true for the matching name only, and false for a non-Prisma error (research R11). Depends on T004, T012
- [x] T015 Implement `isUniqueViolation(error: unknown, constraint: string)` in `src/server/prisma-errors.ts`. It reads `error.meta.driverAdapterError.cause.constraint.index` from a `Prisma.PrismaClientKnownRequestError` with code `P2002`. Depends on T014
- [x] T016 Create `src/server/users/user-repository.ts` with `findById`, `findByEmail`, and a `toUserSummary(row)` mapper. The mapper returns `{ id, email, firstName, lastName, role, status, createdAt }`, derives `status` per data-model § Derived status, and never exposes `passwordHash`. Later tasks add to this file. Depends on T012

### Shared validation

- [x] T017 [P] Write failing tests in `src/lib/schemas/fields.test.ts`:
  - `email` trims, lowercases, and rejects malformed addresses and anything over 254 characters;
  - `password` rejects 11 code points and accepts 12, counts an emoji as one code point, accepts exactly 72 UTF-8 bytes and rejects 73 (including a Cyrillic string over 72 bytes but under 72 characters);
  - `firstName` and `lastName` trim and require 1–100 characters;
  - every failure message is a catalog key (`validation.*`), never English text (FR-040, FR-074).
- [x] T018 Implement `email`, `password`, `firstName`, and `lastName` in `src/lib/schemas/fields.ts`. Byte length comes from `new TextEncoder().encode(value).length`; character length from `Array.from(value).length` (research R13). Depends on T017

### Portable core: passwords and authorization

- [x] T019 [P] Write failing tests in `src/server/auth/password.test.ts`:
  - `hashPassword` then `verifyPassword` round-trips;
  - `verifyPassword` is false for a different password;
  - `DUMMY_HASH` is a valid cost-12 bcrypt hash that matches no plausible input;
  - the cost factor is 12.
- [x] T020 Implement `hashPassword`, `verifyPassword`, and `DUMMY_HASH` in `src/server/auth/password.ts` with `bcryptjs` at cost 12 (research R13). Depends on T019
- [x] T021 [P] Write failing tests in `src/server/auth/authorization.test.ts`:
  - `assertSuperAdmin(actor)` passes for `SUPER_ADMIN` and throws `ForbiddenError("forbidden")` for `ADMIN`;
  - `assertNotSelf(actor, targetId)` throws for the actor's own id.
- [x] T022 Implement `src/server/auth/authorization.ts`. Depends on T021

### Request plumbing (research R18, R22)

- [x] T023 [P] Write failing tests in `src/lib/http/same-origin.test.ts`:
  - a matching `Origin` host passes, against `host` and against `x-forwarded-host` when present;
  - a foreign `Origin` fails, and so does the literal `"null"`;
  - with no `Origin`, `Sec-Fetch-Site: same-origin` passes and `cross-site` fails;
  - with neither header, the request fails.
- [x] T024 Implement `isSameOrigin(request: Request)` in `src/lib/http/same-origin.ts`. Depends on T023
- [x] T025 [P] Write failing tests in `src/lib/http/route-response.test.ts`:
  - each `DomainError` subclass maps to its status in contracts/http-api.md, with body `{ error: { code, detail? } }`;
  - a `ValidationError` carries `fields`;
  - `fromZodError` builds `fields` from `z.flattenError(...).fieldErrors`;
  - `ok`, `created`, and `noContent` set 200, 201, and 204.
- [x] T026 Implement `src/lib/http/route-response.ts`. Depends on T013, T025
- [x] T027 Write failing tests in `src/lib/http/define-route.test.ts`, with `@/auth/dal` mocked:
  - steps run in the documented order: an origin failure (403) wins over a bad body, and a bad body (400) over no session (401);
  - unparseable JSON gives `400 validation_failed`;
  - `session: "none"` never calls `getSessionUser`;
  - the handler receives `body`, `actor`, and awaited `params`;
  - a thrown `ConflictError` becomes 409 with its code;
  - an unexpected `Error("secret detail")` becomes a bare 500 whose body contains neither the message nor a stack;
  - GET and HEAD skip the origin check.
- [x] T028 Implement `defineRoute({ schema?, session, handler })` in `src/lib/http/define-route.ts` per contracts/http-api.md § Shared plumbing. It imports `getSessionUser` from `@/auth/dal`; the real DAL arrives in T046, so that module is mocked in its test. Depends on T024, T026, T027
- [x] T029 [P] Write failing tests in `src/lib/http/api-client.test.ts` (jsdom-free — mock `fetch` and `window.location.assign`):
  - a 2xx resolves `{ ok: true, data }`, and a 204 resolves `data: undefined`;
  - a 4xx resolves `{ ok: false, code, detail, fields }`;
  - a 401 calls `location.assign` with `/{l}/sign-in?callbackUrl=<current path+query>` and never resolves;
  - a rejected `fetch` resolves `{ ok: false, code: "network" }`;
  - a 5xx resolves `{ ok: false, code: "unexpected" }`.
- [x] T030 Implement `apiRequest(method, path, body?)` in `src/lib/http/api-client.ts`. Depends on T029
- [x] T031 [P] Write failing tests in `src/lib/http/form-errors.test.ts`:
  - `toFormErrors(fields, t)` translates the first key per field;
  - it returns a **new** object on every call, even for equal input (research R14);
  - `errorMessageKey(code, detail)` returns `errors.codes.<code>`, or the `detail`-specific key when one exists;
  - the client-only codes `network` and `unexpected` (T029), which are not in `ERROR_CODES`, map to `errors.unexpected`, never to a missing `errors.codes.*` key.
- [x] T032 Implement `src/lib/http/form-errors.ts`. Depends on T031
- [x] T033 [P] Write failing tests in `src/lib/http/callback-url.test.ts`:
  - `/uk/dashboard/users?x=1` is kept;
  - `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)`, the empty string, and `null` all become `/{l}/dashboard` (contracts/routing-and-session.md § callbackUrl acceptance).
- [x] T034 Implement `safeCallbackUrl(value, locale)` in `src/lib/http/callback-url.ts`. Depends on T033

### Catalog groundwork

- [x] T035 Write a failing test in `src/lib/http/error-codes.test.ts`: every member of `ERROR_CODES` has a non-empty key `errors.codes.<code>` in `src/messages/en.json`. 001's `src/i18n/catalogs.test.ts` extends that to `uk.json`. Depends on T013
- [x] T036 Add to both `src/messages/en.json` and `src/messages/uk.json`:
  - `errors.codes.*` for every error code, `errors.unexpected`, `errors.notPermitted`;
  - every `validation.*` key the schemas in T018 emit;
  - `common.fullName` as `"{firstName} {lastName}"` (FR-074).

  Run T035 and `catalogs.test.ts` green. Depends on T018, T035

### Session core

- [x] T037 [P] Write failing tests in `src/server/auth/session-policy.test.ts` with a fixed clock. `evaluateSession(claims, user, now, policy)`:
  - rejects a missing user and an inactive user;
  - rejects `passwordChangedAt > authTime` and `signedOutAt > authTime`, each by one millisecond, and **accepts** both when equal (same instant);
  - rejects `now − authTime` one millisecond past the absolute lifetime and accepts it exactly at it;
  - on acceptance returns `{ role, firstName, lastName, email }` from the **user**, not the claims (FR-022, FR-024, FR-025, FR-066, FR-073).
- [x] T038 Implement `src/server/auth/session-policy.ts`, a pure function with no I/O (research R6, contracts/routing-and-session.md). Depends on T037
- [x] T039 Write failing tests in `src/server/auth/authenticate.integration.test.ts`:
  - it returns the user for the correct password;
  - it returns `null` for an unknown email, a wrong password, an account with no password, and a deactivated account;
  - with `verifyPassword` spied, it is called **exactly once** in every one of those cases, against `DUMMY_HASH` when there is no stored hash (FR-015, research R7);
  - the email lookup is case- and whitespace-insensitive.

  Lockout arrives in US5. Depends on T016, T020

- [x] T040 Implement `authenticate(email, password)` in `src/server/auth/authenticate.ts` (always compare once, then decide). Depends on T039
- [x] T041 [P] Create `src/auth/cookie-policy.ts` exporting `useSecureCookies(config)` (`config.appEnv !== "development"`), the single definition shared by the next-auth config and the proxy guard (research R9). Also create `src/types/next-auth.d.ts`, augmenting `next-auth`'s `Session["user"]` and `User` with `id`, `role`, `firstName`, `lastName`, and `next-auth/jwt`'s `JWT` with `authTime: number`, `role`, `firstName`, `lastName`
- [x] T042 Write failing tests in `src/auth/jwt-callback.test.ts`, with `@/server/users/user-repository` mocked and a fixed clock:
  - on `trigger: "signIn"` it sets `sub` and `authTime = now` in milliseconds;
  - on a later call it reloads the user, returns `null` when `evaluateSession` rejects, and otherwise copies the **current** role and names into the token, so a role changed in storage shows up on the next call (FR-024).
- [x] T043 Implement `jwtCallback(params, deps)` in `src/auth/jwt-callback.ts`: reload the user through the repository, then call `evaluateSession`. Depends on T038, T042
- [x] T044 Create `src/auth/auth.ts` calling `NextAuth({...})` and exporting `handlers`, `auth`, `signIn`, and `signOut`. Settings:
  - `secret: config.authSecret`, `trustHost: true`, `basePath: "/api/auth"`, `useSecureCookies: useSecureCookies(config)`;
  - `session: { strategy: "jwt", maxAge: config.sessionMaxAgeSeconds }`;
  - one Credentials provider whose `authorize` parses the body with a minimal `email` + non-empty `password` zod schema (replaced by the shared `signIn` schema in T056) and returns `authenticate(...)` or `null`;
  - callbacks: `jwt` → `jwtCallback`, `session` maps the token onto `session.user`.

  Depends on T040, T041, T043

- [x] T045 Create `src/app/api/auth/[...nextauth]/route.ts` re-exporting `handlers.GET` and `handlers.POST`, with a one-line comment marking it as the Known Boundary. Depends on T044
- [x] T046 Write failing tests in `src/auth/dal.test.ts`, mocking `@/auth/auth` and `next-intl`'s `redirect`:
  - `getSessionUser()` returns the session user or `null` and is memoized per request;
  - `verifySession()` redirects to `/{l}/sign-in?callbackUrl=<current path>` when there is no user;
  - `requireSuperAdmin()` returns `{ user, permitted: false }` for an admin, **without** redirecting.
- [x] T047 Implement `src/auth/dal.ts` with React `cache()`, taking the locale from `next/root-params` and redirecting through `redirect` from `src/i18n/navigation.ts` (research R17). Depends on T044, T046

**Checkpoint**: `npm run typecheck`, `npm run lint`, and `npm run test:run` are green (with `npm run services:up`). The schema and migration are in place, and a session can be created and evaluated. No page has changed yet.

---

## Phase 3: User Story 1 - The super admin exists from the first deploy and can sign in (Priority: P1) 🎯 MVP

**Goal**: One setup command creates the super admin. They sign in, see the protected home with their name, and sign out on every device. Anonymous visitors are sent to sign-in and back afterwards.

**Independent Test**: On an empty database, run `npm run bootstrap`, sign in with the configured credentials, confirm arrival at `/{l}/dashboard`, sign out, and confirm protected addresses send you back to sign-in.

### Setup command

- [x] T048 [US1] Write failing tests in `scripts/bootstrap.integration.test.ts`, covering the 7 cases in [contracts/bootstrap.md](./contracts/bootstrap.md) § Tests. They exercise `bootstrapSuperAdmin(input)` from `src/server/users/user-service.ts` and the script's input parser `parseBootstrapEnv(env)` exported from `scripts/bootstrap.ts`. Concurrency: fire two calls with `Promise.all` and assert exactly one `SUPER_ADMIN` row
- [x] T049 [US1] Implement `bootstrapSuperAdmin({ email, firstName, lastName, password })` in `src/server/users/user-service.ts`, with an `insertSuperAdmin` method in `src/server/users/user-repository.ts`. Behaviour:
  - when a super admin exists, return `{ outcome: "exists", email }` without reading the password;
  - otherwise insert it with `passwordChangedAt = new Date()`;
  - map `users_one_super_admin` to `exists` and `users_email_key` to `email_taken` via `isUniqueViolation`.

  Depends on T015, T020, T048

- [x] T050 [US1] Implement `scripts/bootstrap.ts`:
  - `parseBootstrapEnv(process.env)` uses a zod schema built from `src/lib/schemas/fields.ts`;
  - print exactly the messages in contracts/bootstrap.md;
  - set `process.exitCode` and disconnect the Prisma client.

  Depends on T049

- [x] T051 [P] [US1] Add a "First super admin" subsection under `## Database` in `README.md`. It covers:
  - run `npm run bootstrap` after `prisma migrate deploy` on every deploy;
  - it needs development dependencies installed (research R19);
  - it never rewrites an existing super admin, and passwords are rotated from the account page;
  - never set `AUTH_URL` or `NEXTAUTH_URL`.

  Add a `bootstrap` row to the `## Scripts` table.

### First protection layer

- [x] T052 [US1] Write failing tests in `src/auth/proxy-guard.test.ts` for every row of the proxy decision table in [contracts/routing-and-session.md](./contracts/routing-and-session.md), with `getToken` mocked:
  - an anonymous `/uk/dashboard/users?x=1` gets a 307 to `/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1` with `cache-control: no-store` and an empty `getSetCookie()`;
  - `/uk/dashboard` with a token passes through;
  - `/uk/sign-in`, `/uk`, `/uk/demo/42`, and `/uk/whatever` pass through whatever the cookie;
  - `/uk/dashboards` is not treated as protected.
- [x] T053 [US1] Implement `proxyGuard(request, intlResponse)` in `src/auth/proxy-guard.ts`. It calls `getToken({ req, secret: config.authSecret, secureCookie: useSecureCookies(config) })` only for `/{l}/dashboard` and below, and never queries the database (research R2). Depends on T041, T052
- [x] T054 [US1] Update `src/proxy.ts` so `proxy` is `async`: `const res = handleLocaleRequest(request)`; return it if it is a redirect; otherwise `return proxyGuard(request, res)`. Keep the matcher unchanged. Confirm `git diff src/i18n/proxy-handler.ts src/i18n/proxy-handler.test.ts` is empty and the 13 tests pass (FR-065). Depends on T053

### Sign-in

- [x] T055 [P] [US1] Write failing tests in `src/lib/schemas/sign-in.test.ts`: the email is normalized; the password only needs to be non-empty (password rules are never revealed at sign-in)
- [x] T056 [US1] Implement `src/lib/schemas/sign-in.ts` and switch `authorize` in `src/auth/auth.ts` to it. Depends on T055
- [x] T057 [US1] Add the `auth.*` keys to both catalogs: sign-in title, field labels, submit and pending labels, `auth.signIn.failed`, `auth.notice.passwordSet`, `auth.notice.passwordChanged`. Also add the `shell.*` keys (signed-in-as, sign out, Home, Account, Users) and `dashboard.*` (home heading and intro)
- [x] T058 [US1] Create `src/components/sign-in-form/sign-in-form.tsx`, a client component. It uses Base UI `Form` with the customized `field` and `input`; each `Field.Root validate` runs the `signIn` schema. It calls `signIn("credentials", { redirect: false, email, password })` and checks `result.error`, **not** `result.ok` (research R7). Any error shows `auth.signIn.failed` in the `alert` and clears the password. The button is pending and disabled in flight. On success it runs `window.location.assign(callbackUrl)`. Depends on T007, T056, T057
- [x] T059 [P] [US1] Write `src/components/sign-in-form/sign-in-form.test.tsx`:
  - the same message appears for an error result regardless of `code`;
  - an `ok: true` result carrying an `error` counts as a failure;
  - there is no double submit while pending;
  - success navigates to the given callback URL;
  - the form can be completed by keyboard.
- [x] T060 [US1] Create `src/app/[locale]/(public)/sign-in/page.tsx`:
  - call `getSessionUser()`, and if it returns a user, `redirect` to `/{l}/dashboard` (FR-031, research R4);
  - otherwise render the form inside `card`, with `safeCallbackUrl(searchParams.callbackUrl, locale)`;
  - show the notice for `?notice=password-set|password-changed` (FR-069);
  - add localized page metadata.

  Depends on T034, T047, T058

### Protected area

- [x] T061 [US1] Create `src/app/[locale]/(private)/layout.tsx`:
  - call `verifySession()`;
  - render the minimal bar: the full name via `t("common.fullName", …)`, links to Home and Account, Users only when `role === "SUPER_ADMIN"`, and `SignOutButton` (later replaced by `AccountMenu`, see T066);
  - wrap children in next-auth's `SessionProvider` (seeded with the server session, `refetchOnWindowFocus`, no `refetchInterval`) and the vendored `toast` provider and viewport, with translated labels.

  Add **no** `loading.tsx` and no Suspense boundary in this group (research R8). Depends on T047, T057

- [x] T062 [US1] Create `src/app/[locale]/(private)/dashboard/page.tsx`, the protected home. It calls `verifySession()` again, because layouts do not re-render on navigation (research R17), and renders the `dashboard.*` copy. Depends on T061

### Sign-out on every device

- [x] T063 [US1] Write failing tests in `src/server/users/user-service.integration.test.ts`: `recordSignOut(actor)` sets `signedOutAt` to the service clock, and `evaluateSession` then rejects claims with an earlier `authTime` (FR-066)
- [x] T064 [US1] Implement `recordSignOut` in `src/server/users/user-service.ts` and `setSignedOutAt` in `src/server/users/user-repository.ts`. Depends on T063
- [x] T065 [US1] Create `src/app/api/session/sign-out/route.ts`: `POST = defineRoute({ session: "required", handler })`. The handler awaits `recordSignOut(actor)`, then `signOut({ redirect: false })` from `@/auth/auth`, and returns `noContent()` (research R5). Depends on T028, T064
- [x] T066 [US1] Create `src/components/sign-out-button/sign-out-button.tsx`. It calls `apiRequest("POST", "/api/session/sign-out")`; on success, or on `unauthenticated`, it runs `window.location.assign("/{l}/sign-in")`, never `router.push` (FR-067); any other failure shows the `errors.unexpected` toast. Write `src/components/sign-out-button/sign-out-button.test.tsx` with it. Depends on T030, T065. _Superseded during review:_ `src/components/account-menu/` took over sign-out and this button was removed; its `unauthenticated` branch was dead, because `apiRequest` redirects on 401 itself

### End-to-end

- [x] T067 [US1] Create `e2e/support/db.ts` (a Prisma client on the `E2E_DATABASE_URL` constant, also imported by `playwright.config.ts`) and `e2e/global-setup.ts` (runs `prisma migrate deploy`, truncates both tables, runs `npm run bootstrap` with `BOOTSTRAP_*` test values). Update `playwright.config.ts`: `globalSetup`, `webServer.env.AUTH_SECRET` (placeholder of at least 32 characters), and the `atmo_e2e` URL (research R20). Depends on T050
- [x] T068 [US1] Write `e2e/auth.spec.ts` (FR-064):
  - a successful sign-in reaches `/{l}/dashboard` and shows the full name;
  - a wrong password and an unknown email show the identical message;
  - an anonymous visitor at `/uk/dashboard` is redirected to `/uk/sign-in`, then back to `/uk/dashboard` after signing in;
  - an anonymous visitor at `/dashboard` with `accept-language: uk` gets two hops, both `no-store`, no `NEXT_LOCALE` cookie, and ends at `/uk/dashboard`;
  - a signed-in visitor at `/uk/sign-in` lands on the dashboard;
  - signing out in context A ends context B's session on its next navigation;
  - a cookie copied before sign-out and replayed afterwards is refused;
  - Back after sign-out shows the sign-in page.

  Depends on T054, T060, T062, T066, T067

**Checkpoint**: US1 is shippable on its own. `e2e/auth.spec.ts` and all 001/002 specs are green.

---

## Phase 4: User Story 2 - Access ends the moment it should (Priority: P1)

**Goal**: Deactivation, password changes, role changes, and the absolute lifetime take effect on the next request. Active users are renewed and idle ones expire. A revoked cookie never loops.

**Independent Test**: Sign a user in, change their state directly in the database (deactivate, bump `passwordChangedAt`, change role), and confirm the very next request reflects it.

- [x] T069 [US2] Write `src/components/session-keep-alive/session-keep-alive.test.tsx`, with `next-auth/react` mocked:
  - `getSession()` is called on every pathname change and not on mount;
  - when it resolves `null`, `window.location.assign` is called with `/{l}/sign-in?callbackUrl=<current path+query>` (FR-071);
  - no timer is ever scheduled.
- [x] T070 [US2] Create `src/components/session-keep-alive/session-keep-alive.tsx`, a client component that watches `usePathname()`, and render it inside the `SessionProvider` in `src/app/[locale]/(private)/layout.tsx` (research R3). Depends on T061, T069
- [x] T071 [US2] Write `e2e/session.spec.ts`, using `e2e/support/db.ts` to change state behind a signed-in admin (create the admin with a password via the helper):
  - after `isActive = false`, the next navigation lands on sign-in;
  - after `passwordChangedAt = now`, the next navigation lands on sign-in in both of two signed-in contexts;
  - after changing `role` to `SUPER_ADMIN`, with the bootstrap super admin temporarily demoted to `ADMIN` in the same transaction to respect the unique index, the Users link appears on the next navigation without signing in again, and the change is reverted afterwards;
  - after deleting the row inside a transaction that also removes its invites, the next navigation lands on sign-in;
  - a revoked session opening `/uk/sign-in` sees the form, with no redirect loop (FR-027);
  - after a client navigation, the session cookie's `expires` has moved later (FR-026).

  Depends on T068, T070

- [x] T072 [P] [US2] Run `npm run build` and confirm every `/[locale]/dashboard…` route is listed as `ƒ` (dynamic). Record the result in the PR description (research R8)

**Checkpoint**: US1 and US2 are complete. The rolling, absolute, and revocation rules are all proven.

---

## Phase 5: User Story 3 - The super admin invites someone and they let themselves in (Priority: P2)

**Goal**: Creating a user issues a one-time link shown once. The invitee sets a password on a public page and signs in.

**Independent Test**: As the super admin, create a user and copy the link; in a fresh browser, open it, set a password, and sign in with it.

- [x] T073 [P] [US3] Write failing tests in `src/server/invites/invite-token.test.ts`: `generateInviteToken()` returns 43 base64url characters (32 bytes) that differ across calls; `hashInviteToken(t)` is 64 hex characters and deterministic; `isWellFormedToken` rejects the wrong length or alphabet
- [x] T074 [US3] Implement `src/server/invites/invite-token.ts` with `node:crypto` (`randomBytes`, `createHash("sha256")`) (research R12). Depends on T073
- [x] T075 [P] [US3] Write failing tests in `src/lib/schemas/create-user.test.ts` and `src/lib/schemas/accept-invite.test.ts`:
  - `role: "SUPER_ADMIN"` is a field error `validation.role.notAssignable` on `role`;
  - a missing first or last name is a field error;
  - a mismatched `confirmPassword` is an error on `confirmPassword`;
  - the password rules are inherited from `fields.ts`.
- [x] T076 [US3] Implement `src/lib/schemas/create-user.ts` and `src/lib/schemas/accept-invite.ts`. Depends on T018, T075
- [x] T077 [US3] Create `src/server/invites/invite-repository.ts` with:
  - `insert`;
  - `findByTokenHash`, including the user;
  - `revokeOutstandingForUser(userId, at)`;
  - `consume(id, at)` as a guarded `updateMany` where `consumedAt` and `revokedAt` are null and `expiresAt > at`, returning the count (research R11).

  Depends on T012

- [x] T078 [US3] Write failing tests in `src/server/invites/invite-service.integration.test.ts`:
  - `inspectInvite(token)` returns `invalid` for a malformed token, an unknown token, a revoked invite, a superseded invite, and a deactivated user; `used` for a consumed invite; `expired` past `expiresAt`; otherwise `valid` with the email. Revoked is checked **before** used and expired (data-model § Invite outcome).
  - `acceptInvite({ token, password })` sets the hash and `passwordChangedAt`, clears the lock and counter, consumes the invite, and leaves an invited account active.
  - Two concurrent accepts of one token produce exactly one success, and the other throws `ConflictError("invite_used")` with its password not applied (FR-044, FR-045).
  - Depends on T074, T077.
- [x] T079 [US3] Write failing tests in `src/server/users/user-service.integration.test.ts`:
  - `createUser(actor, input)` creates an invited user plus an invite expiring in 72 hours, issued by the actor, and returns the plain token exactly once;
  - an email held by an active account throws `ConflictError("email_in_use")`, and by a deactivated account the same code with `detail: "deactivated"`, compared case-insensitively;
  - an admin actor throws `ForbiddenError` (FR-048, FR-049).
- [x] T080 [US3] Implement `inspectInvite`, `acceptInvite`, and an internal `issueInviteFor(userId, issuedBy, tx)` in `src/server/invites/invite-service.ts`, using `$transaction`. Depends on T078
- [x] T081 [US3] Implement `createUser` in `src/server/users/user-service.ts`, calling `assertSuperAdmin` and creating the user and invite in one `$transaction`; add `insertUser` to `src/server/users/user-repository.ts`. Depends on T022, T079, T080
- [x] T082 [US3] Create `src/app/api/users/route.ts` (`POST`, `createUserSchema`, `session: "required"`) returning `created({ user, invite: { path: "/invite/<token>", expiresAt } })`, and `src/app/api/invites/accept/route.ts` (`POST`, `acceptInviteSchema`, `session: "none"`) returning `noContent()`, both through `defineRoute`. Depends on T028, T076, T080, T081
- [x] T083 [US3] Add the `invite.*` keys (page title, "account for {email}", `expired`, `used`, `invalid`, field labels, submit) and the `users.create.*` and `users.invite.*` keys (form labels, role option, `emailInUse`, `emailInUseDeactivated`, `shownOnce`, `copy`, `copied`) to both catalogs. Also add `users.*` page title and the `errors.notPermitted` page copy
- [x] T084 [US3] Create `src/components/set-password-form/set-password-form.tsx`:
  - post the password with a hidden token through `apiRequest`, and map `400` via `toFormErrors`;
  - show `invite_used`, `invite_expired`, and `invite_invalid` in the form `alert` (FR-045 submit-time outcomes);
  - on success, `window.location.assign("/{l}/sign-in?notice=password-set")`.

  Write `src/components/set-password-form/set-password-form.test.tsx`. Depends on T030, T032, T082, T083

- [x] T085 [US3] Create `src/app/[locale]/(public)/invite/[token]/page.tsx`. It calls `inspectInvite`, renders the message with no form for `expired`, `used` (with a link to sign-in), and `invalid`, and otherwise renders the account email and the form. Its metadata sets `referrer: "no-referrer"` (FR-043). Depends on T080, T084
- [x] T086 [US3] Create `src/components/not-permitted/not-permitted.tsx`, a server-renderable localized view, and `src/app/[locale]/(private)/dashboard/users/page.tsx`. The page calls `requireSuperAdmin()` and renders `NotPermitted` for an admin; for the super admin it renders a heading and a "Create user" trigger (the list arrives in US4). Depends on T047, T083
- [x] T087 [US3] Create `src/components/create-user-form/create-user-form.tsx`, which sits inside a `dialog`:
  - fields `email`, `firstName`, `lastName`, and a `role` select with only admin, preselected;
  - `409 email_in_use` goes to the form `alert`, with the reactivation hint for `detail: "deactivated"`;
  - on success, close and open the invite link dialog, then `router.refresh()`.

  Also create `src/components/invite-link-dialog/invite-link-dialog.tsx`: a read-only full URL (`location.origin + path`), a copy button with the `users.invite.copied` toast, and the shown-once notice. The URL is held only in state, dropped on close (FR-042). Write both components' `*.test.tsx`. Depends on T030, T032, T082, T083, T086

- [x] T088 [US3] Write `e2e/invite.spec.ts`:
  - the super admin creates a user, and the link dialog shows a URL without a language segment;
  - a fresh context opens it, lands on the resolved-language invite page showing the email, sets a password, lands on sign-in with the notice, and signs in;
  - reopening the link shows "already used" and no form;
  - the dialog, once closed, cannot be reopened with the same link.

  Depends on T085, T087

**Checkpoint**: US3 is independently demonstrable. Accounts can be created and claimed.

---

## Phase 6: User Story 4 - The super admin manages who has access (Priority: P2)

**Goal**: A user list with status and pending invites, plus deactivate, reactivate, re-issue, and revoke, all refused for admins.

**Independent Test**: As the super admin, deactivate an admin and confirm they cannot sign in; reactivate them and confirm they can; re-issue and revoke links and confirm which ones work.

- [x] T089 [US4] Write failing tests in `src/server/users/user-service.integration.test.ts`:
  - `listUsers(actor)` returns newest first, never `passwordHash`, derives `status`, and carries `pendingInvite: { expiresAt } | null`.
  - `deactivateUser`:
    - sets `isActive = false` and revokes the outstanding invite;
    - is idempotent;
    - throws `ConflictError("cannot_deactivate_super_admin")` for the super admin;
    - throws `NotFoundError` for an unknown id.
  - `reactivateUser` returns `active` or `invited` depending on the password and is idempotent.
  - Every one of these throws `ForbiddenError` for an admin actor (FR-047, FR-053, FR-054, FR-003).
- [x] T090 [US4] Write failing tests in `src/server/invites/invite-service.integration.test.ts`:
  - `issueInvite(actor, userId)` revokes the previous invite so the old token becomes `invalid`, returns a new token, and leaves an active user's `passwordHash` unchanged;
  - it throws `ConflictError("invite_not_allowed")` with `detail` `super_admin` or `deactivated`;
  - accepting a re-issued invite for an active user replaces the password and makes `evaluateSession` reject older claims;
  - `revokeInvite` sets `revokedAt` and throws `ConflictError("no_outstanding_invite")` when there is none;
  - an admin actor throws `ForbiddenError` (FR-050 – FR-052, FR-055).
- [x] T091 [US4] Implement `listUsers`, `deactivateUser`, and `reactivateUser` in `src/server/users/user-service.ts` (with repository methods in `src/server/users/user-repository.ts`). Depends on T089
- [x] T092 [US4] Implement `issueInvite` and `revokeInvite` in `src/server/invites/invite-service.ts`. Depends on T080, T090
- [x] T093 [US4] Create `src/app/api/users/[id]/deactivate/route.ts`, `src/app/api/users/[id]/reactivate/route.ts`, and `src/app/api/users/[id]/invite/route.ts` (`POST` issue → `created({ invite })`, `DELETE` revoke → `noContent()`), all through `defineRoute` with `session: "required"`. Depends on T028, T091, T092
- [x] T094 [US4] Write `src/app/api/authorization-matrix.integration.test.ts`. With `@/auth/dal`'s `getSessionUser` mocked to return anonymous, an admin, and the super admin, and `@/auth/auth` mocked so `signOut` is a no-op spy (the sign-out and password handlers import it directly), it calls every handler in the contracts/http-api.md authorization matrix with a same-origin request and asserts each cell: status, and that no row changed on a refusal (SC-009). Depends on T065, T082, T093
- [x] T095 [US4] Add the `users.list.*` keys (column headers, status labels, "pending until {expiresAt}", empty state), the `users.actions.*` keys (deactivate, reactivate, issue link, revoke link, and their confirmation texts), and the `users.notify.*` keys to both catalogs
- [x] T096 [US4] Create `src/components/user-table/user-table.tsx` using `table`, with the name via `common.fullName`, a status `badge`, and dates via `format.dateTime` with the zone shown for times (UTC, FR-063). Also create `src/components/user-row-actions/user-row-actions.tsx` using `dropdown-menu`:
  - offer only the valid actions per contracts/ui.md § User list, and nothing on the super admin's row;
  - `alert-dialog` confirms deactivate and revoke;
  - show the result toasts;
  - issuing a link opens `invite-link-dialog`;
  - `router.refresh()` after each change.

  Write both components' `*.test.tsx`. Depends on T087, T093, T095

- [x] T097 [US4] Render `UserTable` from `listUsers(actor)` in `src/app/[locale]/(private)/dashboard/users/page.tsx` for the super admin. Depends on T091, T096
- [x] T098 [US4] Write `e2e/users.spec.ts`:
  - with an admin signed in in context B, the super admin deactivates them in context A, and B's very next navigation lands on sign-in (FR-064);
  - the deactivated admin cannot sign in, and after reactivation can;
  - an admin opening `/{l}/dashboard/users` sees the "not permitted" view;
  - a revoked link shows "not valid".

  Depends on T097

**Checkpoint**: The full administration loop works through the interface.

---

## Phase 7: User Story 5 - Repeated guessing locks the account (Priority: P2)

**Goal**: 5 consecutive failures lock an account for 15 minutes, uniformly.

**Independent Test**: Submit five wrong passwords for one account, then the correct one, and confirm refusal; move the lock into the past and confirm the correct password works.

- [x] T099 [US5] Extend `src/server/auth/authenticate.integration.test.ts` with failing cases (FR-018 – FR-020):
  - failures 1–4 increment the counter;
  - the 5th sets `lockedUntil = now + 15 min` and resets the counter to 0;
  - while locked, the correct password returns `null`, still with exactly one `verifyPassword` call, and does not change the counter;
  - after `lockedUntil` passes, the correct password succeeds and a wrong one counts as 1;
  - a success below the threshold resets to 0;
  - five concurrent wrong attempts leave the account locked;
  - attempts on an unknown email write nothing.
- [x] T100 [US5] Implement the counter in `src/server/auth/authenticate.ts`, following data-model § Sign-in failure counter, with `recordFailure` (atomic `{ increment: 1 }`), `lock`, and `resetFailures` in `src/server/users/user-repository.ts`. Depends on T099
- [x] T101 [US5] Add a case to `e2e/auth.spec.ts`: 5 wrong passwords then the correct one all show the identical message; then, after `lockedUntil` is set to the past through `e2e/support/db.ts`, the correct password signs in. Depends on T100

**Checkpoint**: Sign-in is throttled. US1's uniformity still holds.

---

## Phase 8: User Story 6 - Anyone signed in can change their own password (Priority: P3)

**Goal**: A signed-in user changes their password with the current one and is signed out everywhere.

**Independent Test**: Sign in, change the password, and confirm the old password fails and the new one succeeds.

- [x] T102 [P] [US6] Write failing tests in `src/lib/schemas/change-password.test.ts`: the new password follows the rules; a mismatched confirmation is an error on `confirmPassword`; a new password equal to the current one is an error on `newPassword`
- [x] T103 [US6] Implement `src/lib/schemas/change-password.ts`. Depends on T018, T102
- [x] T104 [US6] Write failing tests in `src/server/users/user-service.integration.test.ts`: `changeOwnPassword(actor, input)`
  - on success replaces the hash, sets `passwordChangedAt`, resets failures, and makes `evaluateSession` reject the earlier claims;
  - on a wrong current password throws `ValidationError` with `fields.currentPassword: ["account.currentPasswordWrong"]` **and** increments the failure counter, locking on the 5th (FR-021);
  - while locked throws `LockedError("account_locked")` without comparing.
- [x] T105 [US6] Implement `changeOwnPassword` in `src/server/users/user-service.ts`, sharing the counter logic from `src/server/auth/authenticate.ts` rather than duplicating it. Depends on T100, T104
- [x] T106 [US6] Create `src/app/api/account/password/route.ts`: `PUT = defineRoute({ schema: changePasswordSchema, session: "required", handler })`. The handler calls `changeOwnPassword`, then `signOut({ redirect: false })`, and returns `noContent()`. Depends on T028, T103, T105
- [x] T107 [US6] Add the `account.*` keys (page title, field labels, submit, `currentPasswordWrong`, `locked`) to both catalogs
- [x] T108 [US6] Create `src/components/change-password-form/change-password-form.tsx`:
  - `400` goes through `toFormErrors`, `423` to the form `alert`;
  - password fields are cleared on failure;
  - on success, `window.location.assign("/{l}/sign-in?notice=password-changed")`.

  Write `src/components/change-password-form/change-password-form.test.tsx`. Also create `src/app/[locale]/(private)/dashboard/account/page.tsx`, which calls `verifySession()`. Depends on T030, T032, T106, T107

- [x] T109 [US6] Add a case to `e2e/auth.spec.ts`: change the password on the account page, land on sign-in with the notice, confirm the old password shows the uniform failure and the new one signs in, and confirm a second, earlier context is signed out. Depends on T108

**Checkpoint**: All six stories are complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Gates, consistency checks, and documentation across stories

- [x] T110 [P] Grep `src/`, `scripts/`, and `e2e/` for hardcoded user-facing strings in new components (including `aria-label`s left in vendored primitives, such as "Close", "Notifications", and "Close toast") and route every one through next-intl
- [x] T111 [P] Confirm `package.json` contains no `cn` dependency and no packages beyond the three in research R21, and that `git diff dev -- src/components/ui/button.tsx src/i18n/proxy-handler.ts src/i18n/proxy-handler.test.ts e2e/locale-resolution.spec.ts e2e/locale-switching.spec.ts` is empty (FR-065)
- [x] T112 [P] Confirm `grep -rn "process.env" src scripts` finds only `src/config/index.ts` and `scripts/bootstrap.ts`, and that `npm run lint` rejects a deliberate `import "next/server"` placed temporarily in `src/server/` (then remove it)
- [x] T113 Run every merge gate:
  - `npm run format:check`, `npm run lint`, `npm run typecheck`;
  - `npm run test:run`, with Postgres up;
  - `npm run e2e`;
  - confirm `prisma migrate status` against a fresh database reports no drift.
- [ ] T114 Walk through [quickstart.md](./quickstart.md) § Check by hand, rows 1–11, against `npm run dev`, and note any deviation in the PR description
- [x] T115 [P] In `CLAUDE.md`'s Stack table, change the Database row from "_not yet installed_" to installed. Record in the PR description the plan's amendments to the spec (MC-001, -002, -003, -005, -010, -011, -013, Known Boundaries) so reviewers see them
- [x] T116 Vendor `spinner` with `npx shadcn add spinner`, repeating T007's post-pull steps. Remove its hardcoded `aria-label="Loading"` so the caller supplies the label (plan A11). Confirm `git diff src/components/ui/button.tsx` is still empty
- [x] T117 Show the spinner (`data-icon="inline-start"`, `aria-hidden`) beside the existing pending text on the submit buttons of the sign-in, set-password, change-password, and create-user forms and on the sign-out button. Extend each component's test: while the request is in flight the button is disabled and shows the spinner (FR-059). Depends on T116
- [x] T118 In `src/components/user-row-actions/user-row-actions.tsx`, hold one pending state per row while an action's request is in flight: disable the actions trigger and the dialog's confirm button, and show the spinner on whichever one started the request. Test together in `user-row-actions.test.tsx`: a double click on a confirm sends one request, and the trigger is disabled until an issue-link request settles (FR-059). Depends on T116

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T004 depends on T003.
- **Foundational (Phase 2)**: depends on Setup, and blocks every user story.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on US1. It extends the private layout (T061) and reuses the e2e harness (T067).
- **US3 (Phase 5)**: depends on Foundational. It needs the private layout from US1 (T061) to host the users page, and a signed-in super admin to test.
- **US4 (Phase 6)**: depends on US3 (the users page, invite service, and dialogs).
- **US5 (Phase 7)**: depends on Foundational (T040). It can run in parallel with US3 and US4 after US1.
- **US6 (Phase 8)**: depends on US5 (it shares the counter, T100) and US1 (private layout).
- **Polish (Phase 9)**: depends on all stories.

### User Story Dependencies

```text
Foundational ──► US1 ──┬──► US2
                       ├──► US3 ──► US4
                       └──► US5 ──► US6
```

The spec requires lockout (US5) to ship with sign-in. US1 is demonstrable without it, but a release
contains at least US1 + US2 + US5.

### Within Each User Story

- The failing test task runs before its implementation task, and is committed first.
- Schemas before services, services before route handlers, route handlers before components, and
  components before e2e.
- Catalog keys land in the same task that first renders them, or in the story's catalog task before
  the components.

### Parallel Opportunities

- **Setup**: T002, T005, and T006 run in parallel with each other and with T003.
- **Foundational**: the failing-test tasks T017, T019, T021, T023, T025, T029, T031, T033, and T037 touch disjoint files and can be written in parallel. T012 and T013 run in parallel after T011.
- **After US1**: US3 and US5 can proceed in parallel, as can US2.
- **Within US3**: T073 and T075 run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Write the independent failing tests together:
Task: "Write failing tests in src/lib/schemas/fields.test.ts"
Task: "Write failing tests in src/server/auth/password.test.ts"
Task: "Write failing tests in src/server/auth/authorization.test.ts"
Task: "Write failing tests in src/lib/http/same-origin.test.ts"
Task: "Write failing tests in src/lib/http/callback-url.test.ts"
Task: "Write failing tests in src/server/auth/session-policy.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Write failing tests in src/server/invites/invite-token.test.ts"
Task: "Write failing tests in src/lib/schemas/create-user.test.ts and accept-invite.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup.
2. Phase 2: Foundational. This blocks everything else.
3. Phase 3: US1.
4. **Stop and validate**: `e2e/auth.spec.ts` is green, and 001/002 specs still are.
5. The MVP is demonstrable but **not releasable**: US2 (renewal) and US5 (lockout) complete the release
   minimum.

### Incremental Delivery

1. Setup + Foundational → US1 → demo.
2. US2 → rolling renewal and revocation proven → **release minimum reached once US5 lands**.
3. US5 → lockout.
4. US3 → invitations.
5. US4 → administration.
6. US6 → self-service password.

Each step keeps every earlier e2e spec green.

### Parallel Team Strategy

After Foundational and US1: developer A takes US2, then US6 (after US5); developer B takes US3, then
US4; developer C takes US5.

---

## Notes

- `[P]` means a different file with no dependency on incomplete work. Story labels map to spec.md.
- Tests are required by the constitution. Test-first tasks must fail before their implementation lands,
  and the commit order shows it.
- After every `shadcn add`, repeat T007's post-pull steps (research R16).
- If research turns out wrong during implementation, amend the spec and the plan first (Principle III),
  as 001 did in its "Amendments Made During Implementation" table.
