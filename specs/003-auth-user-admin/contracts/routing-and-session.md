# Contract: Routing, Protection Layers, and Session Lifecycle

**Feature**: [spec.md](../spec.md) | **Research**: R1–R8, R17 in [research.md](../research.md)

## Addresses

| Address                     | Group       | Access                                                                                     |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `/{l}` · unmatched `/{l}/…` | existing    | public, unchanged (FR-038, FR-065)                                                         |
| `/{l}/sign-in`              | `(public)`  | public; signed-in visitors are redirected to `/{l}/dashboard` **by the page** (FR-031, R4) |
| `/{l}/invite/{token}`       | `(public)`  | public; `referrer: no-referrer` metadata (FR-043)                                          |
| `/{l}/dashboard`            | `(private)` | any signed-in user — protected home                                                        |
| `/{l}/dashboard/account`    | `(private)` | any signed-in user — change password                                                       |
| `/{l}/dashboard/users`      | `(private)` | super admin; an admin gets the localized `NotPermitted` view (FR-037)                      |

An invite link is issued without a language segment (`/invite/{token}`). 001's proxy redirects it to
the invitee's resolved language, with the token path intact (FR-043).

## Three layers

| Layer         | Where                                              | Decides from                                                                               | Does                                                                                          | Never                                                              |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Optimistic | `src/proxy.ts` → `src/auth/proxy-guard.ts`         | `getToken()`: cookie signature and expiry, in memory                                       | anonymous visitor under `/{l}/dashboard` → 307 to sign-in                                     | queries the DB; redirects anyone away from sign-in; sets a cookie  |
| 2. Page       | `(private)/layout.tsx` **and every page under it** | `verifySession()` → `auth()` → `jwt` callback → DB                                         | rejected session → redirect to `/{l}/sign-in` (a layout cannot see its own path; see plan A4) | relies on the layout alone (layouts don't re-render on navigation) |
| 3. Data       | every route handler and service entry              | `getSessionUser()` in handlers; `actor` argument checked by `assertSuperAdmin` in services | 401 / 403; domain `ForbiddenError`                                                            | trusts the client or layer 1                                       |

The client holds no session state: `SessionKeepAlive` only asks the session endpoint, and the name in the
header is rendered on the server. Nothing on the client grants anything (FR-036).

## Proxy decision table

The order is fixed: language handling first, then auth (R2).

| Request                                            | Step 1: `handleLocaleRequest`    | Step 2: auth         | Response                                                                                                      |
| -------------------------------------------------- | -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/`                                                | redirect → `/uk`                 | skipped              | 307 `/uk`, `no-store`, no cookie (001 unchanged)                                                              |
| `/dashboard/users` (anonymous)                     | redirect → `/uk/dashboard/users` | skipped              | 307, `no-store` — hop 1                                                                                       |
| `/uk/dashboard/users` (anonymous)                  | `next()`                         | no valid cookie      | 307 `/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers`, `no-store`, no cookie — hop 2                        |
| `/uk/dashboard/users` (valid cookie)               | `next()`                         | pass                 | page renders; layer 2 decides                                                                                 |
| `/uk/dashboard/users` (cookie revoked server-side) | `next()`                         | pass (optimistic)    | layer 2 redirects to sign-in; the sign-in page's real check fails and the form renders — **no loop** (FR-027) |
| `/uk/sign-in` (any cookie)                         | `next()`                         | not a protected path | page decides (R4)                                                                                             |
| `/uk/whatever`                                     | `next()`                         | not protected        | localized 404 (001 unchanged)                                                                                 |

Case-variant prefixes (`/UK/dashboard`) are normalized by step 1 before step 2 runs.

## `callbackUrl` acceptance

Used by the sign-in page after success (FR-016) and by the keep-alive:

- Accepted only when it is a path: it starts with exactly one `/`, not `//` or `/\`, and parses with a
  dummy origin to that same origin.
- Anything else, and an absent value, becomes `/{l}/dashboard`.
- The locale in a valid path is kept as given. It is always one of ours, because it came from our own
  redirect.

## Session lifecycle

```text
sign-in ──► cookie { sub, authTime(ms), role, firstName, lastName, email, iat, exp = now + maxAge }
   │
   ├─ each page render ─► auth() ─► jwt callback ─► evaluateSession ─► ok │ reject → redirect to sign-in
   │                      (cookie NOT rewritten here — R3)
   │
   ├─ client navigation / window focus ─► GET /api/auth/session ─► jwt callback
   │                      ok → cookie re-set with exp = now + maxAge (rolling, FR-026)
   │                      reject → cookie cleared; client does a full navigation to sign-in (FR-071)
   │
   ├─ POST /api/session/sign-out ─► signedOutAt = now; cookie cleared (FR-066)
   ├─ password changed / invite accepted ─► passwordChangedAt = now (FR-025)
   └─ deactivated ─► isActive = false (FR-023)
```

`evaluateSession(claims, user, now, policy)` rejects when any of these hold:

1. `user` is missing.
2. `!user.isActive`.
3. `user.passwordChangedAt > claims.authTime`.
4. `user.signedOutAt > claims.authTime`.
5. `now − claims.authTime > policy.absoluteLifetimeMs` (FR-073).

Expiry of the rolling window itself (`exp`) is enforced by the library's decode, before the callback
runs.

**Every exit is a full-document navigation** (`window.location.assign`): sign-out, a client-detected
rejection, and a password change. Then the Back button cannot restore a cached protected page (FR-067,
R8).

## What must stay true for 001

- `handleLocaleRequest` and its 13 unit tests are unchanged. The auth step wraps it and never runs
  inside it.
- No response from the proxy carries `Set-Cookie`. The auth redirect adds none, and the language
  cookie stays stripped (001 FR-030).
- Every redirect the proxy emits is `no-store` (001 FR-031 and this feature's FR-030).
- 001's e2e addresses (`/`, `/{l}`, `/{l}/whatever`, and since the demo route's removal on 2026-10-03
  `/{l}/invite/abc` and `/invite/abc?tab=notes`) never meet the auth step's redirect.
