# Contract: HTTP API

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

All endpoints live under `src/app/api/`. Each handler does exactly three things, in this order
(MC-008): validate the body with the endpoint's zod schema, resolve the session, call one service — which
authorizes the resolved user itself (MC-007). Non-GET handlers first run the same-origin check (R18). All of that plumbing lives once, in
`defineRoute` (below); a handler file declares its schema, its session requirement, and one service
call. Handlers never redirect and never
translate: they return codes, and the client localizes them (R17).

Reads are not endpoints. Pages are Server Components that call services directly after `verifySession()`,
and after a mutation the client calls `router.refresh()` (FR-059).

## Common rules

**Request**: JSON body, `Content-Type: application/json`. The session is the next-auth cookie.

**Success**: `2xx`, a JSON body only where stated.

**Error body** — always this shape:

```json
{
  "error": {
    "code": "<code>",
    "fields": { "<fieldName>": ["<catalog key>", "..."] }
  }
}
```

`fields` is present only for `400 validation_failed`. Its keys match the form's `Field` names, and
its values are catalog keys (zod messages), so the client passes
`{ fieldName: t(key) }` straight into Base UI `Form`'s `errors` prop (R14).

| Status | `code`              | When                                             | Client behaviour                                       |
| ------ | ------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| 400    | `validation_failed` | body fails the zod schema                        | errors under each field (FR-068)                       |
| 401    | `unauthenticated`   | no session, or the session was rejected (FR-022) | full navigation to sign-in with `callbackUrl` (FR-071) |
| 403    | `forbidden_origin`  | same-origin check failed (FR-060)                | unexpected-failure notification                        |
| 403    | `forbidden`         | signed in but not permitted (FR-037)             | form-level "not permitted" message (FR-068)            |
| 404    | `not_found`         | target user does not exist                       | form-level message                                     |
| 409    | see each endpoint   | a business rule refused the request              | form-level message, or row-action notification         |
| 5xx    | —                   | anything else                                    | unexpected-failure notification; input kept (FR-070)   |

Domain errors are classes in `src/server/errors.ts`. A single mapper in `src/lib/http/` turns them
into the table above. Services throw them; they never build responses.

## Shared plumbing (R22)

### Error codes are a closed, typed set

`src/server/errors.ts` exports `ErrorCode`, a string-literal union of every `code` in this contract,
and the classes that carry one: `ValidationError` (400), `ForbiddenError` (403), `NotFoundError` (404),
`ConflictError` (409), `GoneError` (410), and `LockedError` (423). Each takes a `code` from its
allowed subset and an optional `detail`. Nothing in these classes knows about HTTP. The status belongs
to the mapper, so the classes travel with the services if the transport layer is ever replaced.

Every `ErrorCode` has a catalog key `errors.codes.<code>`. A unit test fails when a code has no key in
`en.json`, and 001's parity test carries that to `uk.json`. So a new code cannot ship untranslated.

### `defineRoute` — `src/lib/http/define-route.ts`

```ts
export const POST = defineRoute({
  schema: createUserSchema, // omitted for bodiless endpoints
  session: "required", // "required" | "none"
  handler: async ({ body, actor, params }) =>
    created(await createUser(actor, body)),
});
```

In order, for every call:

1. **Same-origin check** for any method other than GET or HEAD (R18). On failure: `403 forbidden_origin`.
2. **Body**: parses JSON, then the schema. Unparseable JSON and schema failures both give
   `400 validation_failed` with `fields` built from `z.flattenError(...).fieldErrors`.
3. **Session**: with `session: "required"`, calls `getSessionUser()`. No user gives
   `401 unauthenticated`. The handler receives the user as `actor`.
4. **Handler**: awaits the service call. The response helpers are `ok(body)`, `created(body)`, and
   `noContent()`.
5. **Errors**: a `DomainError` is mapped through `route-response.ts`. Anything else gives a bare `500`,
   with no message, stack, or Prisma detail in the body. It is written to the server's error output,
   which is ordinary crash logging, not the security-event logging the spec rules out.

`params` arrive already awaited, typed from the route (`RouteContext`).

**Deliberately not in `defineRoute`: roles.** It knows only whether a session is required. Whether the
actor may perform the operation is decided by the service (`assertSuperAdmin(actor)`), so every
authorization rule lives in exactly one place (FR-035), and a handler cannot be "fixed" into a second,
diverging copy of it.

The two handlers that clear the cookie afterwards (sign-out, password change) call next-auth's
`signOut({ redirect: false })` inside their `handler`, after the service succeeds.

### Client side — `src/lib/http/api-client.ts` and `src/lib/http/form-errors.ts`

- `apiRequest(method, path, body?)` resolves to `{ ok: true, data } | { ok: false, code, detail?, fields? }`.
  It never throws for an HTTP error. On `401` it performs the full navigation to sign-in (FR-071) and
  never resolves. A network failure resolves to `{ ok: false, code: "network" }`.
- `toFormErrors(fields, t)` turns `fields` (`{ name: ["catalog.key", …] }`) into Base UI `Form`'s
  `errors` prop (`{ name: "Translated message" }`, first message per field). It always returns a new
  object, because Base UI re-syncs server errors only when the prop's reference changes (R14).
- `errorMessageKey(code, detail?)` picks the catalog key for a form-level alert or a toast.

There is no shared form hook. Three forms call our API, and they differ in what happens on success.
A hook is extracted when a fourth form repeats the same success handling (Principle II).

---

## next-auth (not ours — Known Boundary)

`src/app/api/auth/[...nextauth]/route.ts` re-exports next-auth's `GET`/`POST` handlers. Used for:

| Path                                  | Used by                          | Notes                                                                                                   |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/csrf`                  | the client `signIn()`            | double-submit CSRF token                                                                                |
| `POST /api/auth/callback/credentials` | the client `signIn()`            | calls `authorize` → `authenticate()`. Failure = HTTP 200 with `error` set; check `error`, not `ok` (R7) |
| `GET /api/auth/session`               | `SessionKeepAlive`, `apiRequest` | runs the `jwt` callback (full re-check), renews or clears the cookie (R3)                               |

next-auth's own sign-out endpoint is not used (R5).

## `POST /api/session/sign-out`

Ends the session on every device (FR-066).

- Auth: session required. Same-origin: yes. Body: none.
- Service: `recordSignOut(actor)` sets `signedOutAt = now`. The handler then calls next-auth's server
  `signOut({ redirect: false })` to clear the cookie.
- `204` on success. The client then runs `window.location.assign("/{l}/sign-in")` (FR-067).
- `401` if there is already no session. The client still navigates to sign-in without an error (FR-066).

## `POST /api/users`

Creates an account and its first invite (FR-048, FR-039).

- Auth: super admin. Same-origin: yes.
- Body (`createUser`): `{ "email": string, "firstName": string, "lastName": string, "role": "ADMIN" }`.
- `201`:
  ```json
  {
    "user": {
      "id": "…",
      "email": "…",
      "firstName": "…",
      "lastName": "…",
      "role": "ADMIN",
      "status": "invited",
      "createdAt": "…"
    },
    "invite": { "path": "/invite/<token>", "expiresAt": "…" }
  }
  ```
  `path` has no language segment (FR-043). The client shows `location.origin + path` once (FR-042). The
  token never appears in any later response.
- `409 email_in_use` — `fields` absent; `detail: "deactivated"` is added when the holder is
  deactivated, so the message can point to reactivation (FR-049).
- `400 validation_failed` — including `role: ["validation.role.notAssignable"]` for `SUPER_ADMIN`.

## `POST /api/users/{id}/deactivate`

- Auth: super admin. Same-origin: yes. Body: none.
- Effects: `isActive = false`, outstanding invite revoked, in one transaction (FR-053).
- `200` `{ "user": { …, "status": "deactivated" } }`.
- `409 cannot_deactivate_super_admin` (FR-003). `404 not_found`.
- Idempotent: deactivating an already deactivated user returns `200` and changes nothing.

## `POST /api/users/{id}/reactivate`

- Auth: super admin. Same-origin: yes. Body: none.
- `200` `{ "user": { …, "status": "active" | "invited" } }` (FR-054). Idempotent. `404 not_found`.

## `POST /api/users/{id}/invite`

Issues a fresh invite and supersedes any outstanding one (FR-050).

- Auth: super admin. Same-origin: yes. Body: none.
- `201` `{ "invite": { "path": "/invite/<token>", "expiresAt": "…" } }`, shown once.
- `409 invite_not_allowed` with `detail: "super_admin" | "deactivated"` (FR-051). `404 not_found`.
- `409 invite_issued_concurrently` when a simultaneous request for the same account issued its
  invite first; that request's link stays the outstanding one.
- The account's current password is untouched (FR-050).

## `DELETE /api/users/{id}/invite`

Revokes the outstanding invite (FR-052).

- Auth: super admin. Same-origin: yes.
- `204`. `409 no_outstanding_invite`. `404 not_found`.

## `POST /api/invites/accept`

Public. Sets a password through an invite (FR-044).

- Auth: none (it is the path into an account). Same-origin: yes.
- Body (`acceptInvite`): `{ "token": string, "password": string, "confirmPassword": string }`.
- `204` on success. The client then runs `window.location.assign("/{l}/sign-in?notice=password-set")`
  (FR-046, FR-069).
- Outcome errors, evaluated in the order in the data model:
  - `404 invite_invalid` — revoked, superseded, forged, malformed, or user deactivated. One code for all (FR-045).
  - `409 invite_used`.
  - `410 invite_expired`.
- `400 validation_failed` for the password rules.
- Concurrency: the guarded consume makes exactly one of two simultaneous submissions succeed; the other
  gets `409 invite_used` and its password is not applied.

## `PUT /api/account/password`

Changes the signed-in user's own password (FR-056).

- Auth: any signed-in user. Same-origin: yes.
- Body (`changePassword`): `{ "currentPassword": string, "newPassword": string, "confirmPassword": string }`.
- `204`. Effects: new hash, `passwordChangedAt = now`, failures reset. The handler then clears the
  cookie with next-auth's server `signOut({ redirect: false })`, because every session has ended, this
  one included (FR-025, FR-057). The client runs
  `window.location.assign("/{l}/sign-in?notice=password-changed")`.
- `400 validation_failed` with `fields.currentPassword: ["account.currentPasswordWrong"]` for a
  wrong current password. The attempt counts toward the lock (FR-021).
- `423 account_locked` while locked (FR-021). This is a form-level message; the user is already
  identified, so nothing leaks.

## Authorization matrix

| Endpoint                          | anonymous | admin | super admin  |
| --------------------------------- | --------- | ----- | ------------ |
| `POST /api/session/sign-out`      | 401       | ✓     | ✓            |
| `POST /api/users`                 | 401       | 403   | ✓            |
| `POST /api/users/{id}/deactivate` | 401       | 403   | ✓ (not self) |
| `POST /api/users/{id}/reactivate` | 401       | 403   | ✓            |
| `POST /api/users/{id}/invite`     | 401       | 403   | ✓ (not self) |
| `DELETE /api/users/{id}/invite`   | 401       | 403   | ✓            |
| `POST /api/invites/accept`        | ✓         | ✓     | ✓            |
| `PUT /api/account/password`       | 401       | ✓     | ✓            |

Every cell is an integration or handler test (SC-009). The services enforce the matrix themselves via
`assertSuperAdmin(actor)` (FR-035), so a handler that forgets its check still cannot perform the
operation.
