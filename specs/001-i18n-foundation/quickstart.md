# Quickstart: Verifying the i18n Foundation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

How to run and prove this feature works. Scenarios map to requirements; details of _what_ is being
enforced live in [contracts/](./contracts/), not here.

## Prerequisites

```bash
npm install                 # brings in next-intl@^4.13.7
cp .env.example .env        # APP_ENV is required and has no default
```

No new environment variable is introduced by this feature (FR-004); `.env.example` is unchanged.

## Run

```bash
npm run dev                 # http://localhost:3000 — redirects to /en or /uk
```

## Gate commands

```bash
npm run typecheck   # Gate 1: message keys typed from the English catalog (MC-004)
npm run test:run    # Gate 2: catalog parity + proxy resolution units (MC-005)
npm run lint
npm run e2e         # locale switching end-to-end (MC-006); builds and serves itself
```

`E2E_PORT=3000 npm run e2e` points the suite at an already-running dev server instead of building
one — Next allows only one dev server per directory.

## Scenario 1 — First visit negotiates a locale (US1, FR-006, FR-007)

```bash
curl -sI localhost:3000/ -H 'Accept-Language: uk-UA,uk;q=0.9'   # → 307, Location: /uk
curl -sI localhost:3000/ -H 'Accept-Language: de'               # → 307, Location: /en
curl -sI localhost:3000/ -H 'Accept-Language: en'  --cookie 'NEXT_LOCALE=uk'  # → 307, /uk (cookie wins)
curl -sI localhost:3000/uk/ --cookie 'NEXT_LOCALE=en'           # → 200 (URL wins over cookie)
```

**Expected**: every redirect is `307`, carries `Cache-Control: no-store` (FR-031), and carries **no**
`Set-Cookie` (FR-030). The last request proves the URL outranks the cookie without overwriting it —
the shared-link case.

Verify the language is declared on the document (FR-010):

```bash
curl -s localhost:3000/uk | grep -o '<html[^>]*lang="[^"]*"'    # → lang="uk"
```

## Scenario 2 — Path and query survive a redirect (FR-007)

```bash
curl -sI 'localhost:3000/demo/42?tab=notes' -H 'Accept-Language: uk'
# → Location: /uk/demo/42?tab=notes
```

## Scenario 3 — Switching keeps the visitor in place (US2, FR-013, FR-015)

In the browser:

1. Open `/uk/demo/42?tab=notes`.
2. Choose **English** in the switcher.
3. **Expect**: address is `/en/demo/42?tab=notes` — only the locale segment changed. Copy is English.
4. Reload. **Expect**: still English.
5. Open `/`. **Expect**: redirected to `/en`, not to `/uk`.

This is the flow FR-025 requires as an automated Playwright test; the manual walk-through exists to
debug it when it fails.

## Scenario 4 — A shared link does not steal the recipient's choice (FR-030)

1. Choose **English** in the switcher (cookie is now `en`).
2. Open `/uk/` — a "shared link". **Expect**: Ukrainian copy.
3. Open `/`. **Expect**: `/en`. The shared link did not rewrite the preference.

This is the behaviour next-intl does _not_ give by default (research R2), so it is worth checking by
hand at least once.

## Scenario 5 — Locale-aware values (US4, FR-023, FR-024)

Open `/en/demo/42` and `/uk/demo/42` side by side. **Expect** the date order, decimal and grouping
separators, currency placement, and the count-dependent phrase to follow each language's conventions,
with identical underlying values. Ukrainian plural forms must be correct for counts taking `one`,
`few`, and `many`.

Superseded 2026-10-03: the demo route is removed (spec FR-028), and no real screen shows these values
yet.

## Scenario 6 — The gates actually bite (US3, FR-020, FR-021)

Deliberately break each gate and confirm the failure, then revert:

| Break                                    | Command             | Expected                                            |
| ---------------------------------------- | ------------------- | --------------------------------------------------- |
| Delete a key from `src/messages/uk.json` | `npm run test:run`  | fails, naming `uk: <key> (missing)`                 |
| Empty a value in `src/messages/uk.json`  | `npm run test:run`  | fails, naming it `(empty)`                          |
| Delete two keys                          | `npm run test:run`  | fails listing **both**, not just the first (FR-021) |
| Misspell a key at a call site            | `npm run typecheck` | fails at that reference (MC-004)                    |

A gate that cannot be made to fail on demand is not a gate. Do this once before opening the PR.

## Scenario 7 — Non-page addresses are untouched (FR-011)

```bash
curl -sI localhost:3000/favicon.ico     # → 200, no redirect
curl -sI localhost:3000/robots.txt      # → 200 or 404, never a locale redirect
```

## Merge checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run e2e` all green
- [ ] Both catalogs complete — parity test green (constitution merge gate)
- [ ] `.env.example` unchanged and no new environment variable (FR-004)
- [ ] No `process.env` outside `src/config/` and the exempt tooling configs
- [ ] Test-first order visible in the commits for `src/i18n/**` (Principle IV)
- [ ] No hardcoded user-facing string anywhere in the diff, page metadata included
