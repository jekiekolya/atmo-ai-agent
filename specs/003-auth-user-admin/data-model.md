# Data Model: Authentication and User Administration

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

The first Prisma models in the repository. Two tables, one enum, three partial or plain unique
indexes that carry business invariants. There is no session table: sessions are encrypted cookies,
which is why every request re-reads the user (FR-022).

## Conventions set here for every later model

- **Every instant is `DateTime @db.Timestamptz(3)`**, `@updatedAt` included. A bare `DateTime` becomes
  `TIMESTAMP(3)` without a time zone (R10). Instants are written from the application's clock, never
  the database's `now()`, so comparisons with session claims share one clock (R6). Calendar dates, when
  they appear, will use `@db.Date`.
- **Ids are UUIDv7** — `String @id @default(uuid(7)) @db.Uuid`. They are time-ordered, so index-friendly,
  and not guessable in URLs the way sequential integers are.
- **Tables are plural snake_case** via `@@map`; field names stay camelCase, as Prisma generates them.
- **Invariants the business depends on are database constraints**, declared in the schema, never
  checks in a service alone and never hand-edited into a migration (R10).
- **Nothing is deleted.** Foreign keys use `onDelete: Restrict`.

## Enum `Role`

| Value         | Meaning                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `SUPER_ADMIN` | The single owner of the installation. At most one row, ever (FR-002).                            |
| `ADMIN`       | Everyone the super admin lets in. Sign in, see the protected area, change own password (FR-004). |

## `User` → table `users`

| Field               | Type           | Null    | Default      | Rules                                                                                                                                                            |
| ------------------- | -------------- | ------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID           | no      | `uuid(7)`    |                                                                                                                                                                  |
| `email`             | text           | no      | —            | **unique** (`users_email_key`). Stored as `trim().toLowerCase()`; every write path goes through the shared email schema (FR-005). Never changed, never released. |
| `firstName`         | text           | no      | —            | 1–100 characters after trimming. Not editable in this feature (FR-074).                                                                                          |
| `lastName`          | text           | no      | —            | 1–100 characters after trimming. Not editable in this feature (FR-074).                                                                                          |
| `role`              | `Role`         | no      | —            | Set at creation. The create endpoint accepts only `ADMIN` (FR-048).                                                                                              |
| `isActive`          | boolean        | no      | `true`       | `false` = deactivated. The super admin row can never be `false` (FR-003).                                                                                        |
| `passwordHash`      | text           | **yes** | —            | bcrypt, cost 12. `null` until an invite is accepted (FR-039); the bootstrap sets it directly (FR-013).                                                           |
| `passwordChangedAt` | timestamptz(3) | yes     | —            | Set whenever `passwordHash` is set. A session with `authTime` earlier than this is rejected (FR-025).                                                            |
| `signedOutAt`       | timestamptz(3) | yes     | —            | Set on every sign-out. A session with `authTime` earlier than this is rejected (FR-066).                                                                         |
| `failedSignInCount` | int            | no      | `0`          | Consecutive failures since the last success or lock (FR-018).                                                                                                    |
| `lockedUntil`       | timestamptz(3) | yes     | —            | While in the future, every sign-in and password change fails uniformly (FR-019, FR-021).                                                                         |
| `createdAt`         | timestamptz(3) | no      | `now()`      | Shown in the user list (FR-047).                                                                                                                                 |
| `updatedAt`         | timestamptz(3) | no      | `@updatedAt` |                                                                                                                                                                  |

**Indexes**

| Name                    | Definition                                 | Enforces                      |
| ----------------------- | ------------------------------------------ | ----------------------------- |
| `users_email_key`       | `UNIQUE (email)`                           | FR-005                        |
| `users_one_super_admin` | `UNIQUE (role) WHERE role = 'SUPER_ADMIN'` | FR-002, under any concurrency |

**Derived status (FR-007)** — computed, never stored:

```text
isActive = false                          → deactivated
isActive = true  and passwordHash = null  → invited
isActive = true  and passwordHash ≠ null  → active
```

## `Invite` → table `invites`

| Field        | Type              | Null | Default   | Rules                                                                                         |
| ------------ | ----------------- | ---- | --------- | --------------------------------------------------------------------------------------------- |
| `id`         | UUID              | no   | `uuid(7)` |                                                                                               |
| `userId`     | UUID → `users.id` | no   | —         | The account this invite sets a password for. `onDelete: Restrict`.                            |
| `tokenHash`  | text              | no   | —         | **unique**. `sha256(token)` hex. The token itself is never stored (FR-041, R12).              |
| `expiresAt`  | timestamptz(3)    | no   | —         | Issue time + 72 hours (FR-039).                                                               |
| `consumedAt` | timestamptz(3)    | yes  | —         | Set once, when a password is accepted through it.                                             |
| `revokedAt`  | timestamptz(3)    | yes  | —         | Set on explicit revocation, on supersession by a new invite, and on deactivation of the user. |
| `issuedById` | UUID → `users.id` | no   | —         | Who issued it (FR-055). `onDelete: Restrict`.                                                 |
| `createdAt`  | timestamptz(3)    | no   | `now()`   |                                                                                               |

**Indexes**

| Name                               | Definition                                                       | Enforces                                                        |
| ---------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `invites_tokenHash_key`            | `UNIQUE (tokenHash)`                                             | Direct lookup of a presented token                              |
| `invites_one_outstanding_per_user` | `UNIQUE (userId) WHERE consumedAt IS NULL AND revokedAt IS NULL` | One live invite per user, even when two are issued concurrently |
| `invites_userId_idx`               | `(userId)`                                                       | Listing a user's invites                                        |

The partial index counts an expired, never-used invite as outstanding. That is intended: issuing a new
invite always revokes the previous one in the same transaction, so the index only ever rejects a
genuine race.

**Invite outcome when presented (FR-045)** — evaluated in this order:

```text
no row for sha256(token), or token malformed   → invalid
revokedAt ≠ null                               → invalid   (revoked or superseded; same message)
user.isActive = false                          → invalid   (deactivation revokes, belt and braces)
consumedAt ≠ null                              → used
expiresAt ≤ now                                → expired
otherwise                                      → valid
```

Revoked is checked before used and expired so that a revoked link never reveals more than a forged
one does.

## State transitions

### User

```text
                bootstrap (FR-008)
                      │
                      ▼
 create (FR-048) ──► invited ──accept invite──► active ◄──────────────┐
                      │  ▲                        │  ▲                 │
          deactivate  │  │ reactivate             │  │ reactivate      │ accept re-issued invite
                      ▼  │ (no password)          ▼  │ (password set)  │ (password replaced)
                    deactivated ◄──deactivate─────┘  │                 │
                                                     └─────────────────┘
```

The super admin is created **active** by the bootstrap and has no outgoing transition: it can never be
deactivated (FR-003) or sent an invite (FR-051).

| Transition          | Guard                                                           | Effects, in one transaction                                                                                                                                     |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create              | actor is super admin; role = `ADMIN`; email unused              | insert user (`isActive`, no password); insert invite                                                                                                            |
| accept invite       | outcome = valid; password passes FR-040                         | set `passwordHash`, `passwordChangedAt = now`; `failedSignInCount = 0`, `lockedUntil = null`; consume the invite with a guarded `updateMany` (`count = 1` wins) |
| deactivate          | actor is super admin; target is not super admin                 | `isActive = false`; revoke outstanding invite                                                                                                                   |
| reactivate          | actor is super admin; target deactivated                        | `isActive = true` (status follows `passwordHash`)                                                                                                               |
| issue invite        | actor is super admin; target active or invited, not super admin | revoke outstanding invite; insert new invite                                                                                                                    |
| revoke invite       | actor is super admin; an outstanding invite exists              | `revokedAt = now`                                                                                                                                               |
| change own password | current password correct; account not locked; new ≠ current     | `passwordHash`, `passwordChangedAt = now`; reset failures; all sessions end                                                                                     |
| sign out            | valid session                                                   | `signedOutAt = now`                                                                                                                                             |

### Sign-in failure counter (FR-018 – FR-020)

```text
lockedUntil > now              → reject (uniform), do not count
password correct               → failedSignInCount = 0, lockedUntil = null, accept
password wrong, count + 1 < 5  → failedSignInCount += 1 (atomic increment), reject
password wrong, count + 1 = 5  → lockedUntil = now + 15 min, failedSignInCount = 0, reject
```

Resetting the counter to zero when the lock is set is what makes the first failure after expiry count
as 1 (FR-020). Two concurrent failures at count 4 both lock the account, which is harmless.

## Session claims (not stored — carried in the encrypted cookie)

| Claim                                    | Set when                                        | Used for                                                                                      |
| ---------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `sub`                                    | sign-in                                         | user id to reload on every resolution                                                         |
| `authTime`                               | sign-in only; **milliseconds**                  | FR-025, FR-066 (compared with `passwordChangedAt`, `signedOutAt`), FR-073 (absolute lifetime) |
| `role`, `firstName`, `lastName`, `email` | every resolution, copied from the reloaded user | rendering; `role` is re-read, never trusted from the token (FR-024)                           |
| `iat`, `exp`                             | every encode, by the library                    | the rolling window only (FR-026); `iat` does **not** mean "signed in" (R6)                    |

## Validation rules shared by client and server (`src/lib/schemas/`)

| Schema           | Fields                                        | Rules                                                                             |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `email`          | —                                             | trimmed, lowercased, valid address, ≤ 254 characters                              |
| `password`       | —                                             | ≥ 12 code points; ≤ 72 bytes UTF-8 (FR-040)                                       |
| `signIn`         | email, password                               | email as above; password non-empty only (the rules are never revealed at sign-in) |
| `createUser`     | email, firstName, lastName, role              | role ∈ { `ADMIN` } — naming `SUPER_ADMIN` is a field error on `role` (FR-048)     |
| `acceptInvite`   | token, password, confirmPassword              | password rules; `confirmPassword` equals `password`                               |
| `changePassword` | currentPassword, newPassword, confirmPassword | new passes rules; confirm equals new; new ≠ current                               |

Messages are catalog keys (e.g. `validation.password.tooShort`), translated where they render, so one
schema serves both locales and both sides of the wire.
