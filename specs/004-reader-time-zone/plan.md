# Implementation Plan: Dates and Times in the Reader's Time Zone

**Branch**: `004-reader-time-zone` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-reader-time-zone/spec.md`

## Summary

Every on-screen date goes through one client hook, `useFormatInstant(value, "date" | "dateTime")`. The
hook reads the browser's zone through `useSyncExternalStore`:

- **During server rendering and hydration** the server snapshot is `null`, so the hook formats in UTC
  with Intl's zone label.
- **After hydration** React re-renders with the browser's zone, and the hook formats in that zone with
  no label.

Hydration matches by construction, so no error is raised. A component that mounts later gets the local
value directly (R2). next-intl does the formatting, with the zone passed explicitly on every call (R1),
and the zone label comes from Intl in both locales, so the catalogs gain no strings (R5).

The four current displays move onto the hook:

- the created date and the pending-invite expiry in the users table;
- the expiry in the invite link dialog;
- the opened-at date on the demo page, which moves into a small client component.

`src/lib/date-formats.ts` is folded into the hook and deleted.

An ESLint `no-restricted-syntax` block reports any other date formatting in screen code. A catalog
test rejects ICU `date`/`time` arguments. A Vitest test runs ESLint on known violations to prove the
rule fires (R7). A new Playwright spec runs under `Europe/Kyiv` and `America/New_York` against instants
fixed through SQL (R9).

The installed Next.js guide offers an inline-script alternative that avoids showing UTC first. It is
recorded and rejected in R3, because spec decision 2 settles the post-hydration replacement.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node ≥ 22.12 (local 22.23, ICU 78.2)

**Primary Dependencies**: All already present: next-intl / use-intl 4.13.7 (formatting), React 19.2.8
(`useSyncExternalStore`), Next.js 16.3.0, ESLint 9 flat config (`no-restricted-syntax`). No new
dependency (R11).

**Storage**: N/A. Instants stay `Timestamptz(3)` UTC with no migration (FR-018, data-model).

**Testing**: Vitest — `unit` (node), and `ui` (jsdom, now with `TZ=Europe/Kyiv` and `src/i18n/**/*.test.tsx`
included, R8). Playwright with `timezoneId` (R9).

**Target Platform**: Browsers that report `Intl.DateTimeFormat().resolvedOptions().timeZone`, which is
every supported browser. Others stay in the labelled fallback (R6).

**Project Type**: Next.js App Router web application, single project.

**Performance Goals**: The zone is read once per page load and cached. Formatting reuses next-intl's
cached `Intl.DateTimeFormat` instances, which matters for dense chat timestamps later (FR-017).

**Constraints**: No hydration mismatch (FR-006). No empty date position at any moment (FR-005). No
new copy, and en/uk parity holds unchanged (FR-010).

**Scale/Scope**: Four displays, two client components changed, one new client component (the demo
opened-at), one hook, one lint block, one e2e spec.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Status | How                                                                                                                                                                                                                                                                         |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Type-Safe by Default**       | PASS   | The hook's signature is the contract: `Date` in, a closed `"date" \| "dateTime"` union. No `any`. The one suppression path is the documented escape, which requires a reason.                                                                                               |
| **II. Simple, Modular, Readable** | PASS   | A single hook beside `useTranslateKey`. There are four real callers, so the abstraction is earned. `date-formats.ts` is removed, not kept beside it. The demo page's long month is dropped rather than kept as a third format (R5). No provider, no component wrapper (R4). |
| **III. Spec-First Delivery**      | PASS   | Spec 004 is clarified. The documents it supersedes (001, 003) get pointer lines in this feature (R10).                                                                                                                                                                      |
| **IV. Tested Business Logic**     | PASS   | Regime per module below. The hook and the lint rule are test-first.                                                                                                                                                                                                         |
| **V. Centralized Config**         | PASS   | Nothing reads configuration. `TZ` for UI tests is set in `vitest.config.mts` (tooling exemption), never in a test. The new lint block keeps Principle V's selector (R7 trap).                                                                                               |
| **VI. Accountable AI Agents**     | N/A    | No agent code.                                                                                                                                                                                                                                                              |
| **VII. Localized by Default**     | PASS   | Formatting is next-intl's, in the active locale. The zone label is Intl's own text in each locale. No new keys, and parity is unchanged. The catalog test now also rejects ICU date arguments.                                                                              |
| **Technology Constraints**        | PASS   | No new dependency. Library behavior was verified in `node_modules` (R1, R2, R3, R9). No patch, no undocumented internals.                                                                                                                                                   |

Post-design re-check: unchanged, all PASS.

### Test regime per module (Principle IV)

| Module                                  | Regime        | Covered by                                                                                                                              |
| --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/use-format-instant.ts`        | Test-first    | `use-format-instant.test.tsx`: unknown, known, hydration with no recoverable error, unusable zone, `UTC` as own zone, both locales (R8) |
| Lint block in `eslint.config.mjs`       | Test-first    | `src/i18n/format-instant-rule.test.ts`: reports violations, spares exempt paths, keeps `process.env` (R7)                               |
| Catalog check (ICU date/time arguments) | Test-first    | `src/i18n/catalogs.test.ts`                                                                                                             |
| `user-table`, `invite-link-dialog`      | Test-together | Existing tests, with the `useFormatter` mock replaced by a stub of the hook that asserts which format each value uses                   |
| `demo-opened-at` (new), demo page       | Test-together | `demo-opened-at.test.tsx`; `page.test.tsx`'s date probe renders the new component                                                       |
| End-to-end                              | Test-together | `e2e/time-zone.spec.ts` (R9)                                                                                                            |

## Project Structure

### Documentation (this feature)

```text
specs/004-reader-time-zone/
├── plan.md                    # this file
├── research.md                # R1–R11
├── data-model.md              # displays, zone states; no schema change
├── quickstart.md              # automated + by-hand validation
├── contracts/
│   └── format-instant.md      # the hook and the lint rule
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
src/i18n/
├── use-format-instant.ts               # NEW — the shared mechanism
├── use-format-instant.test.tsx         # NEW — both states, hydration, unusable zone
├── format-instant-rule.test.ts         # NEW — ESLint proof (FR-016)
├── catalogs.test.ts                    # + no ICU date/time arguments
└── request.ts                          # comment repointed; timeZone stays "UTC" (R1)

src/components/
├── user-table/user-table.tsx           # useFormatter → useFormatInstant
├── user-table/user-table.test.tsx      # mock the hook, not next-intl's formatter
├── invite-link-dialog/invite-link-dialog.tsx
├── invite-link-dialog/invite-link-dialog.test.tsx
└── demo-opened-at/                     # NEW — client component for the demo page
    ├── demo-opened-at.tsx
    └── demo-opened-at.test.tsx

src/app/[locale]/demo/[id]/
├── page.tsx                            # renders <DemoOpenedAt>; SAMPLE.openedAt → 23:30Z (R9)
└── page.test.tsx                       # date probe uses the component

src/lib/date-formats.ts                 # DELETED — folded into the hook (R4)

eslint.config.mjs                       # + screen-code date block, shared process.env selector
vitest.config.mts                       # ui project: TZ=Europe/Kyiv, include src/i18n/**/*.test.tsx
e2e/time-zone.spec.ts                   # NEW

specs/001-i18n-foundation/spec.md       # Out of Scope entry → pointer to 004
specs/003-auth-user-admin/spec.md       # "Times are shown in UTC" → pointer to 004
specs/003-auth-user-admin/contracts/ui.md
```

**Structure Decision**: The hook lives in `src/i18n/` beside `useTranslateKey`, the existing home for
client hooks over next-intl. The demo page's client piece follows the one-folder-per-component rule,
and is deleted together with the page when the page goes.

## Complexity Tracking

No violations to justify.

## Phase Status

- [x] Phase 0 — research.md (no NEEDS CLARIFICATION left)
- [x] Phase 1 — data-model.md, contracts/format-instant.md, quickstart.md
- [ ] Phase 2 — tasks.md (`/speckit-tasks`)
