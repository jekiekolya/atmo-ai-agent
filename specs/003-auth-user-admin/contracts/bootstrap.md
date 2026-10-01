# Contract: `npm run bootstrap`

**Feature**: [spec.md](../spec.md) — FR-008 – FR-013, MC-003 | **Research**: R9, R19

A deployment step. It runs after `prisma migrate deploy` on every deploy, and anywhere development
dependencies are installed (it runs through `tsx`).

## Inputs

Environment variables, read by the script itself under the constitution's tooling exemption. They are
not part of the application's Config (R9) and are documented in `.env.example` under "setup command
only".

| Variable                                 | Rule                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `BOOTSTRAP_SUPER_ADMIN_EMAIL`            | valid email; normalized like every other email                                |
| `BOOTSTRAP_SUPER_ADMIN_FIRST_NAME`       | 1–100 characters                                                              |
| `BOOTSTRAP_SUPER_ADMIN_LAST_NAME`        | 1–100 characters                                                              |
| `BOOTSTRAP_SUPER_ADMIN_PASSWORD`         | the application's password rules (FR-040)                                     |
| `DATABASE_URL`, `APP_ENV`, `AUTH_SECRET` | through the application Config, because the script reuses the database module |

## Behaviour

| Situation                                            | Effect                                                                                       | stdout / stderr                                                          | Exit |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- |
| No super admin; inputs valid; email unused           | Creates an active super admin with the password set and `passwordChangedAt = now`            | `Created super admin <email>.`                                           | 0    |
| A super admin exists (any inputs, even changed ones) | Nothing                                                                                      | `A super admin already exists (<existing email>); left untouched.`       | 0    |
| No super admin; the email belongs to another account | Nothing                                                                                      | `Cannot create super admin: <email> already belongs to another account.` | 1    |
| A required variable is missing or invalid            | Nothing                                                                                      | `Invalid bootstrap settings:` followed by one line per variable          | 1    |
| Two runs race                                        | The partial unique index lets exactly one insert succeed; the loser reports "already exists" | as above                                                                 | 0    |

When a super admin exists, the command checks nothing else: it does not look at the password variable
at all, so a stale or rotated deploy secret is harmless (FR-009). Output is for the deployment log. It
is not product copy and is not localized.

## Tests (test-first, integration project)

1. On an empty database it creates the super admin, and the password verifies.
2. A second run with the same inputs changes nothing, and the row's `updatedAt` is unchanged.
3. A second run with a different email and password changes nothing and reports the existing email.
4. Ten sequential runs produce the same stored state as one (SC-002).
5. Two concurrent runs yield exactly one super admin (SC-003).
6. It refuses when an admin already holds the configured email.
7. It refuses a password that is too short, and one longer than 72 bytes, creating nothing.
