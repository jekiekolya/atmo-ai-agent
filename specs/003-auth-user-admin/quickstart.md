# Quickstart: Authentication and User Administration

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run the feature and check that it works. Behaviour is defined in the [contracts](./contracts/);
this page only says how to exercise it.

## Prerequisites

- Node ≥ 22.12, Docker.
- `.env` copied from `.env.example`, with:
  - `DATABASE_URL=postgresql://atmo:atmo@localhost:5432/atmo_dev`
  - `AUTH_SECRET` — generate with `openssl rand -base64 32`
  - `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_FIRST_NAME`, `BOOTSTRAP_SUPER_ADMIN_LAST_NAME`, `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
    (≥ 12 characters)
  - `SESSION_MAX_AGE_SECONDS` and `SESSION_ABSOLUTE_LIFETIME_SECONDS` may be left out (defaults 28 800 and
    86 400).
- `AUTH_URL` / `NEXTAUTH_URL` must **not** be set (research R9).

## Run it

```bash
npm install
npm run services:up        # Postgres 18 on :5432
npm run db:migrate         # applies the users/invites migration
npm run bootstrap          # → "Created super admin …"
npm run bootstrap          # → "A super admin already exists (…); left untouched."
npm run dev
```

## Check by hand

| #   | Do                                                                   | Expect                                                                                                            |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Open `http://localhost:3000/dashboard` in a private window           | Two redirects: `/uk/dashboard` or `/en/dashboard`, then `/{l}/sign-in?callbackUrl=…`. Neither sets `NEXT_LOCALE`. |
| 2   | Sign in with the bootstrap credentials                               | You land on `/{l}/dashboard` and your name is shown.                                                              |
| 3   | Sign out, then press Back                                            | The sign-in page, not the dashboard.                                                                              |
| 4   | Sign in with a wrong password 5 times, then the right one            | The same message all six times. After 15 minutes the right password works.                                        |
| 5   | **Users → Create user**, then copy the link                          | The dialog shows the link once. Closing it loses it for good.                                                     |
| 6   | Open the link in another browser and set a password                  | You land on sign-in with a confirmation, and the new password works.                                              |
| 7   | Open the same link again                                             | "Already used", no form.                                                                                          |
| 8   | Keep the admin signed in in browser B. In browser A, deactivate them | Browser B's next click lands on sign-in.                                                                          |
| 9   | As the admin, open `/{l}/dashboard/users`                            | The localized "not permitted" view.                                                                               |
| 10  | **Account → Change password**                                        | Signed out everywhere. Only the new password works.                                                               |
| 11  | Open `/uk`, `/en/demo/42`, `/uk/whatever` without signing in         | Exactly as before this feature (public page, demo, localized 404).                                                |

## Automated checks

```bash
npm run typecheck
npm run lint                       # includes the "no next/* under src/server" rule
npm run test:run                   # unit + ui + integration projects; integration needs Postgres up
npm run e2e                        # builds, uses the atmo_e2e database, bootstraps its own super admin
```

- **Integration** tests use `atmo_test` and **e2e** uses `atmo_e2e`. Both are created by
  `prisma migrate deploy` on first run, and neither touches `atmo_dev`.
- `E2E_PORT=<port> npm run e2e` reuses a running server only if it is a production server on
  `atmo_e2e`. Global setup stops the run when the e2e super admin cannot sign in there, and a dev
  server fails the Back-after-sign-out test on its cache headers (plan A12).
- `npm run build` must list every `/[locale]/dashboard…` route as `ƒ` (dynamic). A `○` there means a
  protected page could be cached (research R8).

## What the e2e suite proves (FR-064)

| Spec                       | Covers                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/auth.spec.ts`         | sign-in success; the uniform failure message; redirect from a protected address with and without a language prefix, then arrival at the original address; sign-out on one device ends the other; a copied cookie is refused after sign-out; Back after sign-out |
| `e2e/invite.spec.ts`       | create user → accept the invite → sign in with the new password; a used link shows "already used"                                                                                                                                                               |
| `e2e/users.spec.ts`        | deactivating a signed-in admin ends their access on their very next request; an admin sees "not permitted" on the users page                                                                                                                                    |
| existing 001 and 002 specs | unchanged and green (FR-065)                                                                                                                                                                                                                                    |
