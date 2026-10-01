# Phase 0 Research: Authentication and User Administration

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-26

Every decision below was checked against installed source, not recollection: Next.js 16.3.0 docs in
`node_modules/next/dist/docs/`, next-intl 4.13.7, Prisma 7.10, `@base-ui/react` 1.7.0, and — because
they are not installed yet — `next-auth@5.0.0-beta.32` (with `@auth/core` 0.41.3, `jose` 6.2.12) and
`bcryptjs` 3.0.3 installed into a scratch directory outside the repository. Paths below are relative to
each package's root.

Three findings contradict statements the request recorded as verified. They are R3 (cookie renewal
and clearing), R5 (sign-out), and R12 (hashing invitation tokens with bcrypt). The spec's
Mandated Implementation Constraints were amended accordingly, each marked _amended during planning_.

---

## R1. The protected area lives under `/{locale}/dashboard`

**Decision**: The protected area's one address prefix is `dashboard`. Home `/{l}/dashboard`, user
administration `/{l}/dashboard/users`, account `/{l}/dashboard/account`. Public:
`/{l}/sign-in`, `/{l}/invite/{token}`.

**Rationale**: FR-038 needs a single prefix the optimistic proxy check can match. 001's tests visit
`/`, `/{l}`, `/{l}/demo/...`, and `/{l}/whatever` anonymously and expect a page or the localized 404
(`e2e/locale-resolution.spec.ts`, `e2e/theme-switching.spec.ts`, `e2e/smoke.spec.ts`), so the prefix
must not collide with any of them. `dashboard` is also the term Next's authentication guide uses.

**Alternatives considered**: `app`, `admin`, `console`. `admin` misdescribes the area once later
features put non-administrative work there; the others are equally arbitrary.

## R2. Proxy composition: language first, then the auth check, two hops for unprefixed addresses

**Decision**: `src/proxy.ts` stays one exported `proxy` function:

1. `res = handleLocaleRequest(req)` — unchanged. It already strips `Set-Cookie` and marks
   redirects `no-store`.
2. If `res` is a redirect, return it (unprefixed or wrong-case address; hop 1).
3. Otherwise read the first path segment (exact now, because step 2 normalized case). If the path is
   `/{l}/dashboard` or below it and no valid session cookie is present, return a 307 to
   `/{l}/sign-in?callbackUrl=<path+query>` with `cache-control: no-store` and no `Set-Cookie`.
4. Otherwise return `res` untouched (keeps next-intl's `Link` header and request headers).

**Rationale**: next-intl's middleware returns `NextResponse.redirect` for an unprefixed path and
`NextResponse.next({ request: { headers } })` for a prefixed one
(`next-intl/dist/esm/development/middleware/middleware.js` l.38–53, 123–159). Doing auth after it
means the auth rule only ever sees prefixed paths, `handleLocaleRequest` and its 13 unit tests stay
untouched, and FR-029 falls out naturally: `/dashboard/users` → `/uk/dashboard/users` (hop 1, locale
resolved by 001's order, no cookie written) → `/uk/sign-in?callbackUrl=/uk/dashboard/users` (hop 2).
Both hops are `no-store`. The extra round trip only happens for hand-typed unprefixed addresses; the
product's own links are always prefixed.

A one-hop variant (parse the locale out of hop 1's `Location` and redirect straight to sign-in)
duplicates prefix parsing to save a request nobody makes. Rejected. Reading next-intl's
`X-NEXT-INTL-LOCALE` is not an option either: it is a request header forwarded upstream, visible on the
response only in Next's internal `x-middleware-request-*` form (`next/dist/server/web/spec-extension/response.js` l.36).

The "valid session cookie" test is `getToken()` from `next-auth/jwt` (`@auth/core/jwt.js` l.46–76):
signature and `exp` are checked in memory, no database. It must be called with the same
`secureCookie` value as the main configuration, because both the cookie name and the decryption salt
derive from it. `getToken` also accepts an `Authorization: Bearer` header when no cookie exists
(l.53–63); harmless for an optimistic check, noted so no one mistakes it for a security control.

**Alternatives considered**: auth before locale — would need its own prefix parsing and would break
the invariant that 001's handler sees every request first.

## R3. Rolling renewal is not automatic for server-rendered navigation — the client drives it

**Finding (contradicts the request)**: The `jwt` callback does run on every session resolution,
Server Component `auth()` included (`next-auth/lib/index.js` l.7–35 → `@auth/core/lib/actions/session.js`
l.21–63). But what happens to the re-encoded (renewed) or cleaned (rejected) cookie depends on the call
site:

| Call site                                                      | Renewed cookie written?                                                                | Rejected cookie cleared? |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------ |
| `auth()` with no arguments (Server Components, route handlers) | **No** — `parseSessionResponse` discards `Set-Cookie` (`next-auth/lib/index.js` l.106) | **No**                   |
| Wrapper form `auth((req) => …)`                                | Yes (l.181–184)                                                                        | Yes                      |
| `GET /api/auth/session`                                        | Yes                                                                                    | Yes                      |

So a user who only moves between server-rendered pages is never renewed, and after 8 hours from sign-in
their cookie expires even though they were active — violating FR-026 and SC-010. `session.updateAge`
does not help: it is read only by the database strategy (`session.js` l.77–92).

**Decision**: The client drives renewal by asking `GET /api/auth/session`, which runs the `jwt` callback
(full FR-022 re-check) and re-sets the cookie with a fresh expiry, or clears it. Two places ask, with a
plain `fetch`:

- `SessionKeepAlive`, a small client component in the protected layout, on every page load, every
  pathname change, and every return to the tab (`visibilitychange` to visible). It reads the answer
  itself: only a `200` with a `null` body is a refusal, and sends the user to sign-in with a
  full-document navigation (FR-071). No connection, a 5xx, or an unreadable body decides nothing; the
  next event asks again.
- `apiRequest`, after every response from our own API except a 401. A route handler's `auth()`
  discards `Set-Cookie` too, so without it work on one page would never renew the window.

No timer and no polling.

_Amended after implementation review:_ the first design wrapped the protected tree in next-auth's
`SessionProvider` (`refetchOnWindowFocus`) and called `getSession()` on pathname changes only. Actions
and reloads on one page never renewed; `getSession()` reports a failed request as `null`, so a dropped
connection read as a sign-out; and its default broadcast made `SessionProvider` answer every call with a
second request. Nothing reads `useSession` any more, so the provider was removed.

**Rationale**: Uses Auth.js's own session endpoint, no library internals, no DB access in the proxy.
Renewal is tied to real activity (loading, navigating, returning to the tab, acting), so the idle
timeout still means idle. One request per event.

**Alternatives considered**:

- `refetchInterval` polling — an open tab would renew itself forever and defeat the 8-hour idle
  timeout. Rejected.
- Re-encoding the token in the proxy near expiry (`encode` from `next-auth/jwt`) — no DB check, so it
  would extend revoked sessions, and it re-implements cookie chunking and options. Rejected.
- Using the wrapper form of `auth` in the private layout — layouts cannot set cookies in Server
  Component rendering (`next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` l.70–81).
- Using the wrapper form of `auth` in `defineRoute`, which renews in the same response with no extra
  request — it resolves the session before the handler runs and appends the renewed cookie after it, so
  on sign-out and password change it overwrites the cookie `signOut` clears. It would need a per-route
  opt-out. Rejected.
- `useSession({ required: true, onUnauthenticated })` to react to a refusal — after one failed
  refetch `SessionProvider` stays at "no session", so a later real refusal changes nothing and is never
  acted on. Rejected.

## R4. No redirect loop: the proxy never sends anyone away from sign-in

**Decision**: The proxy only turns anonymous visitors away from `/dashboard`. The sign-in page (a
Server Component) calls the real, non-redirecting session check; if it returns a user, the page
redirects to `/{l}/dashboard` (FR-031). A rejected session therefore renders the sign-in form; the
next successful sign-in overwrites the stale cookie.

**Rationale**: A cookie can carry a valid signature for a session the server has revoked, and a
Server Component cannot delete it (R3). If the proxy bounced "signed-in" visitors off sign-in while the
private layout sent rejected ones to it, the visitor would loop — the guide's own proxy example has
exactly this shape (`authentication.md` l.1035–1075). Moving the "already signed in" decision to the
layer that can see revocation removes the loop by construction.

**Alternatives considered**: a route handler that clears the cookie then redirects — a state-changing
GET open to cross-site triggering, and route handlers cannot read `next/root-params`, so the locale
would have to travel in the URL. A query-string marker — forgeable and easy to drop in a refactor.

## R5. Sign-out goes through our own route handler

**Finding (contradicts the request's layering assumption)**: `events.signOut({ token })` does receive
the decoded token and is awaited (`@auth/core/lib/actions/signout.js` l.15–18), but event errors are
caught and only logged (`@auth/core/lib/init.js` l.138–150). A failed `signedOutAt` write would
silently leave every other device signed in — FR-066 broken with no signal.

**Decision**: `POST /api/session/sign-out` (same-origin checked, session required): the user service
records `signedOutAt`, then the handler calls next-auth's server-side `signOut({ redirect: false })`,
which clears the cookie through `cookies()` (valid in route handlers). If the write fails the handler
returns 500, the client shows the unexpected-failure notification, and the user is not told they are
signed out when they are not. The client then performs a full-document navigation to sign-in, which also
satisfies FR-067's back-button rule (R8).

**Rationale**: Keeps the write where errors surface, and shrinks the next-auth boundary to sign-in,
its CSRF token, and session renewal. The spec's Known Boundaries entry was amended.

## R6. Revocation compares timestamps against a millisecond `authTime` claim

**Finding**: `iat` is rewritten on every encode (`@auth/core/jwt.js` l.19 → `jose` `setIssuedAt()`),
so it means "last renewed", not "signed in". Units are whole seconds.

**Decision**: At `trigger === "signIn"` the callback stores `authTime = Date.now()` (milliseconds) and
the user id in the token. On every resolution it reloads the user and rejects the session when any of
these hold: the user is missing; `isActive` is false; `passwordChangedAt > authTime`;
`signedOutAt > authTime`; `now − authTime > absolute lifetime` (FR-073). Otherwise it copies the
current `role`, `firstName`, `lastName`, and `email` into the token (FR-024). The decision is a pure function,
`evaluateSession(claims, user, now, policy)`, tested with a fake clock.

Both `authTime` and the stored moments are taken from the application's clock (`new Date()` in the
service, never the database's `now()`), so skew between the app and Postgres cannot reject a fresh
session. A sign-in in the same millisecond as a password change compares equal and is accepted — the
spec's "same instant" edge case.

**Alternatives considered**: an integer `sessionVersion` bumped on each revocation — avoids clock
reasoning entirely, but the spec's Key Entities describe _moments_, and the moments stay useful for
display and the future audit log. Recorded as the fallback if clock issues ever appear.

## R7. Sign-in uses next-auth's client `signIn` with a uniform `authorize`

**Decision**: The sign-in form calls `signIn("credentials", { email, password, redirect: false })`
from `next-auth/react`. It fetches next-auth's CSRF token and posts to `/api/auth/callback/credentials`
(`next-auth/react.js` l.126–186; double-submit cookie in `@auth/core/lib/actions/callback/oauth/csrf-token.js`
l.17–34). `authorize` validates the payload with the shared zod schema and delegates to
`authenticate(email, password)` in `src/server/auth`, returning `null` for every failure.

**Result shape trap**: a failure comes back as HTTP 200 with `{ error: "CredentialsSignin", code: "credentials" }`,
so `ok` is `true` on failure (`@auth/core/index.js` l.132–133). The form checks `error`, never `ok`.
On success it navigates with `window.location.assign(callbackUrl)` — a full document load, so the new
cookie is used from the first request.

**Uniformity (FR-015)**: `authenticate` always performs exactly one bcrypt comparison — against the
stored hash, or against a constant dummy hash when the account is missing or has no password — before
deciding anything, including for locked accounts. Unknown email, wrong password, no password,
deactivated, and locked all yield the same `null`, the same response, and comparable timing.

**Alternatives considered**: server-side `signIn()` in a server action (gets Next's built-in origin
check). Rejected by MC-008 (no server actions). Server-side `signIn()` inside our own route handler —
would bypass next-auth's CSRF and need our own; the client flow already has one.

## R8. Protected pages and the back button

**Finding**: dynamically rendered pages are sent with
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`
(`next/dist/server/lib/cache-control.js` l.14–15; `docs/01-app/02-guides/self-hosting.md` l.99).
The private layout reads cookies, so every page under it is dynamic. `cacheComponents` is not enabled.
The larger risk is Next's client router, which reuses pages on back/forward navigation
(`docs/01-app/04-glossary.md` l.47).

**Decision**: Every exit from the protected area — sign-out, a rejected session detected on the
client, a password change — ends in a full-document navigation (`window.location.assign`), never
`router.push`. The build output must show `ƒ` (dynamic) for every `/dashboard` route; an e2e test
signs out, presses Back, and expects the sign-in page. No `loading.tsx` or Suspense boundary sits above
the auth check in the private group: once streaming starts the status is locked and a redirect happens
in-stream (`docs/01-app/03-api-reference/03-file-conventions/loading.md` l.101–120).

## R9. Configuration: what goes into Config and what next-auth still reads

**Decision**: Config gains three variables:

| Variable                            | Rule                                                       | Default          |
| ----------------------------------- | ---------------------------------------------------------- | ---------------- |
| `AUTH_SECRET`                       | required, at least 32 characters                           | none — fail fast |
| `SESSION_MAX_AGE_SECONDS`           | positive integer                                           | 28 800           |
| `SESSION_ABSOLUTE_LIFETIME_SECONDS` | positive integer, ≥ max age (cross-field check names both) | 86 400           |

next-auth receives `secret`, `session.maxAge`, `trustHost: true`, `basePath: "/api/auth"`, and
`useSecureCookies: config.appEnv !== "development"` explicitly. All are read with `??=` against the
environment, so passed values win (`next-auth/lib/env.js` l.22–36; `@auth/core/lib/utils/env.js`
l.28–44).

What next-auth still reads itself, unavoidably: `AUTH_URL` / `NEXTAUTH_URL` (they rewrite the request
origin when set — `next-auth/lib/env.js` l.6; `@auth/core/lib/utils/env.js` l.68) and provider-specific
`AUTH_<PROVIDER>_*` variables that are inert for Credentials. The plan's rule: **neither URL variable
is set in any environment**; `trustHost: true` makes next-auth use the forwarded host instead. This is
recorded rather than enforced in code, because enforcing it would mean reading `process.env` outside
Config.

The bootstrap credentials (`BOOTSTRAP_SUPER_ADMIN_EMAIL`, `_NAME`, `_PASSWORD`) are **not** in Config:
Config fails fast on missing required variables, so adding them would make every running application
instance require credentials it never uses. They are documented in `.env.example` under a
"setup command only" heading and parsed by the script with a zod schema. Spec MC-002 was amended.

`secure` cookie in Playwright: the suite runs on `http://localhost` with `APP_ENV=development`, so the
cookie is the non-`__Secure-` `authjs.session-token`; staging and production get the `__Secure-`
name. The proxy's `getToken` call uses the same expression, defined once.

## R10. Prisma: partial unique indexes are native (preview), emails normalized, every instant `timestamptz`

**Decision**:

- Enable `previewFeatures = ["partialIndexes"]` and declare
  `@@unique([role], map: "users_one_super_admin", where: { role: "SUPER_ADMIN" })` in the schema.
  `prisma migrate diff` emits `CREATE UNIQUE INDEX … WHERE ("role" = 'SUPER_ADMIN')`. The same feature
  enforces "at most one outstanding invite per user" with a partial unique index on `userId` where
  `consumedAt` and `revokedAt` are null.
- Email: normalized with `trim().toLowerCase()` in one schema helper, stored normalized, plain
  `@unique`. "Never released" is enforced by never deleting, not by the index.
- Every `DateTime` carries `@db.Timestamptz(3)`, `@updatedAt` included. Without it Prisma emits
  `TIMESTAMP(3)`, which has no time zone.

**Rationale**: The schema engine reads index predicates back from the database
(`pg_get_expr(rawindex.indpred, …)` in `@prisma/engines/schema-engine-*`) and drops indexes the schema
does not declare. A partial index added by hand-editing the migration would be treated as drift and
dropped by the next `migrate dev`. Declaring it in the schema is both the supported path and the only
safe one. `citext` would need a second preview flag and an extension in every environment; an
expression index on `lower(email)` has no schema syntax and hits the same drift problem.

**Cost**: a preview flag — its syntax could change in a later Prisma minor. Tracked in Complexity
Tracking; the migration SQL itself is stable Postgres.

## R11. Prisma errors under the driver adapter

**Finding**: A unique violation is still `Prisma.PrismaClientKnownRequestError` with code `P2002`, but
under `@prisma/adapter-pg` there is **no `meta.target`**. The constraint name is at
`err.meta.driverAdapterError.cause.constraint.index` (`@prisma/adapter-pg/dist/index.mjs` l.436–455;
runtime mapping in `@prisma/client/runtime/client.js`).

**Decision**: One typed helper, `isUniqueViolation(error, constraintName)`, in `src/server/prisma-errors.ts`,
covered by integration tests that trigger each constraint (`users_email_key`,
`users_one_super_admin`, `invites_one_outstanding_per_user`).

**Concurrency primitives used** (all present in 7.10): interactive `$transaction`; `updateMany` with a
guarded `where` returning a count (single-use invite consumption: `count === 1` wins);
`{ increment: 1 }` for the failure counter.

## R12. Invitation tokens: SHA-256, not bcrypt

**Finding (contradicts MC-011 as first written)**: a bcrypt hash embeds a random salt, so the same token
hashes differently every time. When someone presents a token, the only way to find its invite would be
to fetch every invite and bcrypt-compare against each one.

**Decision**: tokens are 32 random bytes (`crypto.randomBytes`), encoded base64url; the stored
fingerprint is `sha256(token)` hex with a unique index, looked up directly. Node standard library, no
dependency.

**Rationale**: Slow hashes protect low-entropy secrets (passwords) against offline guessing. A 256-bit
random token cannot be guessed offline no matter how fast the hash is, and a stored SHA-256 cannot be
turned back into a usable link (FR-041).

## R13. bcryptjs for passwords

**Findings** (`bcryptjs` 3.0.3): ships its own types, ESM and CJS, zero dependencies, 140 KB installed.
`hash` and `compare` return Promises. Pure JavaScript, chunked with `nextTick`, so it yields but still
runs on the main thread. Default cost 10 (`index.js` l.515). **Inputs longer than 72 bytes are silently
truncated** — confirmed empirically: `compare("a".repeat(72) + "DIFFERENT", hash("a".repeat(72)))` is
`true`. The package exports `truncates(password)` (l.317–325).

**Decision**: cost 12. The shared password schema rejects any password whose UTF-8 encoding exceeds 72
bytes (FR-040) — computed with `TextEncoder`, not `.length`. Minimum 12 characters counted by code
point (`Array.from(pw).length`), so a password made of emoji is not undercounted or overcounted. If
cost 12 measures above ~400 ms per compare on the deployment hardware, drop to 11 and record it here.

## R14. Forms: Base UI `Form` + a customized shadcn `field`

**Findings** (`@base-ui/react` 1.7.0):

- `Form` takes `errors: Record<string, string | string[]>` keyed by each `Field.Root`'s `name`
  (`form/Form.d.ts`; `internals/form-context/FormContext.d.ts` l.4). A server error is cleared as soon
  as that field's value changes (`field/control/FieldControl.js` l.123). The prop is copied into state
  and re-synced only when its reference changes (`form/Form.js` l.71–74), so each response needs a new
  object. After server errors arrive, focus moves to the first invalid control (l.75–81).
- `Field.Root` accepts `validate(value, formValues) => string | string[] | null | Promise<…>` and
  `validationMode: "onSubmit" | "onBlur" | "onChange"` (default `onSubmit`, then re-validates on change).
- `onFormSubmit(values, details)` calls `preventDefault` and receives `name → value` for every
  registered field (`form/Form.js` l.110–118). Submission is blocked when sync validation fails.
- `Field.Error` has no `role="alert"` or live region, and a native constraint message would come from
  the browser in the browser's language. Our messages therefore come from zod through `validate`,
  translated by next-intl.
- There is no form-level error slot.

The shadcn `base-nova` registry has **no `form` item** (empty), and its `field` item renders plain
`div`/`fieldset`/`label` elements rather than Base UI's `Field`, with its own `errors` prop.

**Decision**: Pull `field` through the CLI and customize it in place so `Field`, `FieldLabel`,
`FieldDescription`, and `FieldError` wrap Base UI's `Field.Root`, `Field.Label`, `Field.Description`,
and `Field.Error`, keeping the registry's classes. Forms use Base UI `Form` directly — it renders a
single unstyled `<form>` with no visual design to vendor. Form-level errors (FR-068) render in the
vendored `alert` (`role="alert"`) inside the form and are cleared on the next submit. Each form owns
one zod schema, shared with its endpoint; the schema's messages are catalog keys, translated where
they render.

**Alternatives considered**: using Base UI `Field` parts directly in feature code — works, but bypasses
`src/components/ui` for a control a primitive covers (Principle II). Using shadcn `field` as shipped —
its `FieldError` does not read Base UI's `errors`, so server errors would need a second plumbing path.

## R15. Notifications: shadcn `toast` on Base UI Toast, not `sonner`

**Findings**: `base-nova` offers both. `sonner` pulls the `sonner` npm package (2.0.8, zero
dependencies, 174 KB). `toast` is built on `@base-ui/react/toast`, already installed: viewport
`role="region" aria-live="polite"` (`toast/viewport/ToastViewport.js` l.183–189), F6 moves focus
into the region, timers pause on hover and focus, default timeout 5 s, always renders a close button,
and `priority: "high"` renders as `role="alert"`. Both hardcode English labels ("Notifications",
"Close toast"), which must be passed in through next-intl.

**Decision**: `toast`. It meets FR-072 (announced without taking focus, dismissible, pauses so it can be
read) with no new dependency. Spec MC-013 was amended.

## R16. The shadcn registry now imports `cn` from an npm package

**Finding**: the live `base-nova` registry declares an npm dependency `cn` (v0.4.0, a clsx +
tailwind-merge replacement published 2026-09-22) and writes `import { cn } from "cn"`. The installed
CLI (4.18.0) does not rewrite it to the project alias. A dry run lists `+ cn` and offers to overwrite
`src/components/ui/button.tsx` with only that import changed.

**Decision**: Do not add `cn`. After each `shadcn add`: decline the `button.tsx` overwrite, rewrite
the new files' import to `@/lib/utils` (which already provides `cn` from `clsx` + `tailwind-merge`),
remove `cn` from `package.json` if the CLI added it, and run Prettier. Tasks carry this as an explicit
step; review checks `package.json`.

## R17. Pages: the private layout checks, every page checks again, 403 renders in place

**Findings**: "be cautious when doing checks in Layouts as these don't re-render on navigation"
(`authentication.md` l.1350). `forbidden()` / `unauthorized()` are still `experimental.authInterrupts`,
off by default (`next/dist/server/config-shared.js` l.252).

**Decision**: `(private)/layout.tsx` calls `verifySession()`, and so does every page and every route
handler (React `cache()` makes repeats free within one request). The users page calls
`requireSuperAdmin()`; for an admin it renders the localized `NotPermitted` component instead of the
list (status 200 — FR-037 asks for a "not permitted" page, not a status). Endpoints return 403. No
experimental flag is enabled.

`verifySession` redirects with next-intl's `redirect({ href, locale })`, taking the locale from
`next/root-params` (valid in any layout or page under `app/[locale]/layout.tsx`, route groups included —
`docs/01-app/03-api-reference/04-functions/next-root-params.md` l.16–18). Route handlers cannot read
root params (l.49); they never redirect and never translate — they return error codes the client
localizes.

## R18. Same-origin check for our route handlers

**Finding**: Next's Origin-vs-Host check exists only for Server Actions
(`docs/01-app/02-guides/data-security.md` l.544–552); route handlers get none.

**Decision**: `assertSameOrigin(request)` runs first in every non-GET handler:

- If `Origin` is present, its host must equal the request's host (`x-forwarded-host` when present,
  otherwise `host`), and it must not be the literal `"null"`.
- If `Origin` is absent, `Sec-Fetch-Site` must be `same-origin`.
- If both are absent, reject with 403.

No public-origin variable is needed. A cross-site page cannot forge its browser's `Origin`, and the
comparison uses the same forwarded host `trustHost` makes next-auth trust. Deployment note: the reverse
proxy must overwrite, not append, `X-Forwarded-Host`. Together with the `SameSite=Lax`, `HttpOnly`
session cookie (next-auth's default — `@auth/core/lib/utils/cookie.js` l.34–46), this is FR-060.

## R19. The bootstrap script runs through `tsx`

**Finding**: Node 22.23 strips types natively, but the Prisma client generated with this repo's
`moduleResolution: "bundler"` uses extension-less relative imports, which Node's ESM resolver rejects
(`ERR_MODULE_NOT_FOUND …/generated/enums`). The script also needs `src/config` (extension-less
imports) and the `@/` alias.

**Decision**: `"bootstrap": "tsx scripts/bootstrap.ts"`, with `tsx` as a **dev** dependency. `tsx`
honours `tsconfig.json` paths. The script is a thin wrapper: parse `BOOTSTRAP_*` with zod, call
`bootstrapSuperAdmin()` in the user service, print one line, set the exit code. Nothing under
`src/server` imports `server-only`, which throws outside a React Server Components build and would break
the script.

Deployment consequence: the bootstrap step must run where development dependencies are installed —
the same place `prisma migrate deploy` and `next build` already run. An image that ships only
`--omit=dev` packages cannot run it; the README says so.

**Alternatives considered**: generating the client with `importFileExtension = "ts"` — fixes only the
Prisma half. Compiling the script with `tsc` first — a second build output to manage for one file.

## R20. Test infrastructure: a real Postgres for integration and e2e

**Findings**:

- `playwright.config.ts`, `vitest.config.mts`, and `.env.example` use
  `postgresql://user:password@…/atmo_dev`, which does not match compose (`atmo`/`atmo`) or the README.
- `prisma migrate deploy` creates a missing database (P1003 → `createDatabase`), and the compose user
  is a superuser, so no init script is needed.
- `.github/workflows/ci.yml` has `checks`, `unit`, and `e2e` jobs; none has a Postgres service.

**Decision**:

- A Vitest `integration` project runs `src/**/*.integration.test.ts` and
  `scripts/**/*.integration.test.ts` against `postgresql://atmo:atmo@localhost:5432/atmo_test`. Its
  `globalSetup` runs `prisma migrate deploy` with that URL, a `beforeEach` truncates `invites` and
  `users`, and the project runs with `fileParallelism: false`. Repositories, services, the bootstrap
  command, and `isUniqueViolation` are tested there, concurrency cases included.
- Playwright uses a separate `atmo_e2e` database so a run never wipes `atmo_dev`. Its `globalSetup`
  migrates, truncates, and runs `npm run bootstrap` with test credentials. The `webServer` env gains
  `AUTH_SECRET` and the corrected URL. Specs mutate state through the UI when the UI is under test
  (deactivation) and through `e2e/support/db.ts` (a Prisma client on the same URL constant as the
  config) for setup only. _Amended during review (plan A12):_ a server reused through `E2E_PORT`
  must be a production server on `atmo_e2e`.
- CI: a `postgres:18-alpine` service (atmo/atmo, health-checked) on the `unit` and `e2e` jobs.
- The stale `user:password` URLs are corrected in all three files.

## R21. Dependency justifications (constitution, Technology Constraints)

| Package                   | Kind     | What it does                                                                                    | Cost of building it ourselves                                                                                                    | Cost of the dependency                                                                                                                                                                                                                                                        |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next-auth@5.0.0-beta.32` | runtime  | Session cookie encryption (JWE), CSRF double-submit, credentials callback, client session hooks | Encrypted session cookies, key derivation, CSRF, and a client session layer — security-critical code with no margin for mistakes | Beta release line (pin exactly); 6 transitive packages (`@auth/core`, `jose`, `oauth4webapi`, `@panva/hkdf`, `preact`, `preact-render-to-string`), ~8.4 MB installed, most unused by Credentials. Peer range `next: ^14 \|\| ^15 \|\| ^16` verified. Mandated by the request. |
| `bcryptjs@^3.0.3`         | runtime  | Adaptive password hashing                                                                       | Must not be hand-rolled. `node:crypto` offers `scrypt`, which is sound, but the request mandates bcrypt                          | Zero dependencies, 140 KB, own types. Silent truncation beyond 72 bytes — handled by FR-040's rejection (R13)                                                                                                                                                                 |
| `tsx`                     | dev only | Runs the TypeScript bootstrap script with path aliases                                          | A separate compile step and output directory for one script (R19)                                                                | Development tooling only; never reaches the application bundle                                                                                                                                                                                                                |

No other package is added. shadcn components arrive through the CLI (exempt); `cn` is refused (R16).

## R22. Shared route and form plumbing

**Decision**: One `defineRoute` wrapper for every route handler, one `apiRequest` client, and one
`toFormErrors` adapter, over a closed `ErrorCode` union whose every member must have a catalog key.
Contract: [http-api.md § Shared plumbing](./contracts/http-api.md#shared-plumbing-r22).

**Rationale**: Without it, each of the seven handlers repeats the same five steps — origin check, JSON
and zod parsing, session, service call, error mapping — and one forgotten step is a security or
correctness bug that only that handler has. Principle II allows an abstraction on the second real
caller; this one has seven on day one. The wrapper stops at "is there a session". Role decisions stay in
the services, so authorization is never written twice.

**Alternatives considered**: per-handler code with shared small functions — still leaves the order and
completeness of the steps to each author. A form hook (`useApiForm`) — rejected for now: three callers
whose success paths all differ, so the hook would be mostly options.
