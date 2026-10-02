---
description: "Task list for Dates and Times in the Reader's Time Zone"
---

# Tasks: Dates and Times in the Reader's Time Zone

**Input**: Design documents from `/specs/004-reader-time-zone/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/format-instant.md](./contracts/format-instant.md),
[quickstart.md](./quickstart.md)

**Tests**: Required. The spec asks for them (FR-016, FR-020, FR-021), and so does the constitution
(Principle IV). The regime for each module is in plan.md § Test regime. For the test-first modules —
the hook, the lint rule, and the catalog check — the failing test is written and seen to fail before
the implementation, and when the work is committed, the test lands first.

**Organization**: Tasks are grouped by user story. The hook is foundational because every story
renders through it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Update the `ui` project in `vitest.config.mts` (research R8):
  - add `"src/i18n/**/*.test.tsx"` to `include`, beside `"src/{components,app}/**/*.test.tsx"`;
  - add `env: { TZ: "Europe/Kyiv" }`.

  Run `npm run test:run` and confirm every existing `ui` test still passes under the new zone.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared mechanism, `useFormatInstant` ([contract § 1](./contracts/format-instant.md)).
Every story depends on it.

- [x] T002 Write failing tests in `src/i18n/use-format-instant.test.tsx`. Each test renders a probe
      component inside `NextIntlClientProvider` with real `en` / `uk` messages and `timeZone="UTC"`. Use
      `2026-03-14T09:30:00Z` for `dateTime` and `2026-03-14T23:30:00Z` for `date`. Cover:
  - **precondition**: `Intl.DateTimeFormat().resolvedOptions().timeZone` resolves to Kyiv (`Europe/Kyiv`
    or `Europe/Kiev`), so a runner that ignores `TZ` fails here instead of passing vacuously;
  - **zone unknown**: `renderToString` (`react-dom/server`) gives `Mar 14, 2026, 09:30 AM UTC` and
    `Mar 14, 2026, UTC` in `en`, and `14 бер. 2026 р., 09:30 UTC` and `14 бер. 2026 р., UTC` in `uk`.
    Match the meaningful parts with regex, because ICU spacing varies (research R5, R9);
  - **zone known**: a client `render` gives `11:30` and `Mar 15, 2026` in `en`, and `15 бер. 2026 р.` in
    `uk`, with no `UTC` anywhere in the output;
  - **hydration**: `hydrateRoot` over the `renderToString` output, inside `act`, with an
    `onRecoverableError` spy and a `console.error` spy. Afterwards the text is the local value, and
    neither spy was called (FR-006);
  - **reader's own zone is UTC**: mock `resolvedOptions` to return `timeZone: "UTC"`, then
    `vi.resetModules()` and import the hook fresh. The value is in UTC and unlabelled (FR-009);
  - **daylight saving**: the same mocking with `"America/New_York"`, whose clocks change on
    8 March 2026. `2026-03-07T14:30:00Z` (UTC−5) and `2026-03-09T13:30:00Z` (UTC−4) both show `09:30`,
    each on its own day and unlabelled, so each instant uses the offset in effect at that instant (FR-013,
    US1 scenario 8). Kyiv is not used here because its daylight-saving rules may change;
  - **unusable zone**: the same mocking with `"Etc/Unknown"`, and again with `undefined`. The value
    stays labelled UTC after mount (FR-004);
  - **one zone per page**: two probes on the same page format the same instant identically, and
    `resolvedOptions` is read once across them (FR-017).

  Run it and confirm it fails because the module does not exist.

- [x] T003 Implement `src/i18n/use-format-instant.ts` per the contract (`"use client"`) to make T002
      pass. Depends on T002.
  - Formats: `DATE = { year: "numeric", month: "short", day: "numeric" }` and `DATE_TIME = { ...DATE,
hour: "2-digit", minute: "2-digit" }` (research R5).
  - The zone comes from `useSyncExternalStore(subscribe, readZone, () => null)`. `subscribe` returns a
    no-op unsubscribe.
  - `readZone` computes the zone once and caches it in a module variable. It returns `null` for an
    empty value, `"Etc/Unknown"`, or a value that throws when passed to `new Intl.DateTimeFormat(…, {
timeZone })` (research R6).
  - The returned function calls `useFormatter().dateTime(value, { ...FORMATS[format], timeZone: zone })`
    when the zone is known. Otherwise it passes `{ ...FORMATS[format], timeZone: "UTC", timeZoneName:
"short" }`. The zone is always passed explicitly (research R1).
  - Keep the comment that `dateStyle` cannot combine with `timeZoneName`, carried over from
    `src/lib/date-formats.ts`. Add one line on why the server snapshot is `null` (the hydration match,
    R2). Nothing else.

**Checkpoint**: `npm run test:run` is green with T002 included.

---

## Phase 3: User Story 1 — A reader sees every date and time on their own clock (Priority: P1) 🎯 MVP

**Goal**: The four displays show the reader's zone, with no label (FR-001 – FR-003, FR-007, FR-011 –
FR-014).

**Independent Test**: Under `Europe/Kyiv`, the users table, the invite dialog, and the demo page each
show the local equivalent of a known UTC instant, unlabelled (quickstart rows 1–3, 6–8).

- [x] T004 [P] [US1] Switch `src/components/user-table/user-table.tsx` to the hook:
  - remove `useFormatter` and the `ZONED_DATE_TIME` import;
  - `const formatInstant = useFormatInstant()`;
  - the created date uses `formatInstant(user.createdAt, "date")`, and the pending expiry uses
    `formatInstant(user.pendingInvite.expiresAt, "dateTime")`;
  - delete the comment `// A time of day always carries its zone (UTC, from 001).`.

  In `src/components/user-table/user-table.test.tsx`, drop `useFormatter` from the `next-intl` mock, mock
  `@/i18n/use-format-instant` with `(value, format) => \`${value.toISOString()}|${format}\``, and rewrite
the FR-063 test. Its new name is "formats each date through the shared mechanism: created as a date,
pending expiry as a date and time (FR-011)", and it asserts `2026-09-20T00:00:00.000Z|date`and`pending until 2026-09-23T00:00:00.000Z|dateTime`.

- [x] T005 [P] [US1] Switch `src/components/invite-link-dialog/invite-link-dialog.tsx` to the hook:
  - `expiresAt: formatInstant(new Date(invite.expiresAt), "dateTime")`;
  - remove `useFormatter` and `ZONED_DATE_TIME`.

  In `src/components/invite-link-dialog/invite-link-dialog.test.tsx`, replace the `useFormatter` mock
  with a mock of the hook shaped as in T004. Add a test that the description receives
  `2026-09-29T12:00:00.000Z|dateTime` as `expiresAt`, with the `useTranslations` mock echoing values for
  `users.invite.description`.

- [x] T006 [P] [US1] Create `src/components/demo-opened-at/demo-opened-at.tsx` (`"use client"`).
      `DemoOpenedAt({ openedAt }: { openedAt: Date })` renders `<p data-testid="opened-at">` with
      `t("demo.openedAt", { date: formatInstant(openedAt, "date") })`. Create
      `src/components/demo-opened-at/demo-opened-at.test.tsx`: inside a real `NextIntlClientProvider` with
      `2026-03-14T23:30:00Z`, `en` shows `Opened Mar 15, 2026` and `uk` matches `15\s+бер`. Neither contains
      `UTC`, because the `ui` project runs in Kyiv (T001).
- [x] T007 [US1] Update `src/app/[locale]/demo/[id]/page.tsx`:
  - replace the opened-at `<p>` with `<DemoOpenedAt openedAt={SAMPLE.openedAt} />`;
  - change `SAMPLE.openedAt` to `new Date("2026-03-14T23:30:00Z")` (research R9);
  - keep `getFormatter` for `format.number` only;
  - drop "a date" from the comment above the formatted values, so it still reads true.

  In `src/app/[locale]/demo/[id]/page.test.tsx`, replace the `OpenedAt` probe and its test with
  `<DemoOpenedAt openedAt={OPENED_AT} />`, with `OPENED_AT` set to `2026-03-14T23:30:00Z`. Assert `en`
  contains `Mar 15, 2026`, and `uk` matches `15\s+бер`, still ordered day-first. Depends on T006.

- [x] T008 [US1] Delete `src/lib/date-formats.ts`, and confirm `grep -rn "date-formats" src` returns
      nothing. Depends on T004, T005.
- [x] T009 [US1] Create `e2e/time-zone.spec.ts` (research R9). In a `for (const zone of
["Europe/Kyiv", "America/New_York"])` loop, make one `test.describe` per zone with `test.use({
timezoneId: zone })`:
  - **users table**: as the super admin (`signedInPage`), create a user through the UI as in
    `users.spec.ts`. Then through `sql` from `e2e/support/db.ts`, set that user's `"createdAt"` to
    `2026-03-14T23:30:00Z` and the outstanding invite's `"expiresAt"` to `2026-03-14T09:30:00Z`. Reload
    `/en/dashboard/users`. Kyiv: the row contains `Mar 15, 2026` and `11:30`. New York: it contains
    `Mar 14, 2026` and `05:30`. In both zones the row does not contain `UTC` (SC-001, SC-002, US1
    scenarios 1, 3, 5);
  - **invite dialog** (Kyiv only): after creating a user, read `invites."expiresAt"` for that user.
    Take the `hour`, `minute`, and `dayPeriod` parts from `new Intl.DateTimeFormat("en", { timeZone:
"Europe/Kyiv", hour: "2-digit", minute: "2-digit" }).formatToParts(expiresAt)`. Assert the dialog
    matches ``new RegExp(`${hour}:${minute}\\s*${dayPeriod}`)`` and does not contain `UTC` (US1
    scenario 2). Compare parts, never the whole string: Node and Chromium carry different ICU builds,
    and the space before `AM`/`PM` (U+202F or U+0020) differs between them (research R9). `\s` matches
    both;
  - **demo page** (Kyiv only): `/en/demo/1` shows `Opened Mar 15, 2026` with no `UTC`.

  Depends on T004, T005, T007.

**Checkpoint**: US1 works on its own. Quickstart rows 1–3 and 6–8 pass by hand.

---

## Phase 4: User Story 2 — Before the zone is known, the reader still sees a correct, labelled time (Priority: P2)

**Goal**: Labelled UTC before hydration, replaced in place, never blank, with no hydration error
(FR-004 – FR-006, FR-008). The behavior itself comes from T003, and its component proof from T002. This
phase adds the end-to-end proof that no page reports an error.

**Independent Test**: Every page in `e2e/time-zone.spec.ts` loads with no console error, console warning, or
page error (SC-005). With JavaScript disabled by hand, every value ends in `UTC` (quickstart rows
4–5).

- [x] T010 [US2] Add the console collector from `e2e/smoke.spec.ts` to every test in
      `e2e/time-zone.spec.ts`, widened to warnings because FR-006 and SC-005 forbid both. Fill an `issues`
      array from `console` messages of type `error` **or `warning`** and from `pageerror`, with an
      `IGNORED_CONSOLE_MESSAGES` list that starts empty and needs a reason per entry. After
      `waitForLoadState("networkidle")`, and again after the dialog opens, assert `issues` equals `[]`
      (FR-006, FR-020, SC-005). `smoke.spec.ts` keeps ignoring warnings; this spec is stricter on purpose.
      Depends on T009.
- [x] T011 [US2] Walk rows 4, 5, 7, and 9 of `specs/004-reader-time-zone/quickstart.md` by hand against `npm run dev`, and record any
      deviation in this file before continuing. Depends on T004 – T007.

**Checkpoint**: US1 and US2 both hold.

---

## Phase 5: User Story 3 — Every date added later follows the same rules automatically (Priority: P3)

**Goal**: An automated check fails when screen code formats a date outside the hook (FR-015 – FR-017,
[contract § 2](./contracts/format-instant.md)).

**Independent Test**: Adding `format.dateTime(new Date(), { dateStyle: "short" })` to any component
makes `npm run lint` fail at that line. Removing it makes lint pass (quickstart § Proving the check).

- [x] T012 [P] [US3] Write failing tests in `src/i18n/format-instant-rule.test.ts` (unit project). Use
      `new ESLint({ cwd: <repo root> })` and `lintText(code, { filePath })`, and assert on messages with
      `ruleId === "no-restricted-syntax"`:
  - `format.dateTime(d, {})`, `d.toLocaleDateString()`, `d.toLocaleString()`, and `new
Intl.DateTimeFormat("en")` at `src/components/probe/probe.tsx` are each reported, and the message
    names `useFormatInstant`;
  - the same code at `src/i18n/use-format-instant.ts`, at `src/server/probe.ts`, and at
    `src/components/probe/probe.test.tsx` is not reported;
  - `process.env.X` at `src/components/probe/probe.tsx` is still reported with Principle V's message.
    This guards the flat-config replacement trap (research R7).

  Allow a generous per-test timeout, because loading `eslint-config-next` takes seconds. Confirm the
  first group fails before T013.

- [x] T013 [US3] Update `eslint.config.mjs` (research R7):
  - hoist Principle V's selector into `const PROCESS_ENV = { selector: …, message: … }` and use it in the
    existing block;
  - after that block, add a block with `files: ["src/**/*.{ts,tsx}"]` and `ignores: ["src/config/**",
"src/server/**", "src/**/*.test.{ts,tsx}", "src/i18n/use-format-instant.ts"]`;
  - in that block, set `"no-restricted-syntax": ["error", PROCESS_ENV, ...DATE_FORMATTING]`. The
    `DATE_FORMATTING` selectors cover `CallExpression[callee.property.name=/^(dateTime|dateTimeRange|relativeTime|toLocaleDateString|toLocaleTimeString|toLocaleString)$/]`
    and `NewExpression[callee.object.name='Intl'][callee.property.name=/^(DateTimeFormat|RelativeTimeFormat)$/]`,
    with the contract's message;
  - add one comment line saying the block repeats `PROCESS_ENV` because a later `no-restricted-syntax`
    replaces the earlier one.

  T012 must pass, and `npm run lint` must be clean over the tree. Depends on T012, and on T004, T005, and
  T007, or lint fails on the old call sites.

- [x] T014 [P] [US3] In `src/i18n/catalogs.test.ts`, write a failing test first. Extract a small helper
      `dateArguments(catalog)` that returns the key path of every string containing an ICU `date` or `time`
      argument (`/\{\s*\w+\s*,\s*(date|time)\b/`). The test asserts the helper finds the key in a fixture
      `{ a: { b: "On {when, date, short}" } }`, and that it returns `[]` for both `en` and `uk`, with a message
      pointing at `useFormatInstant`. Comment the test's purpose in one line: such an argument formats
      with the provider's zone, unlabelled, outside any lint rule (contract § 2).

**Checkpoint**: All three stories hold. `npm run lint` and `npm run test:run` are green.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T015 [P] Rewrite the comment above `timeZone: "UTC"` in `src/i18n/request.ts` as one line: the
      server has no reader zone, so formatting stays deterministic, and on-screen dates convert through
      `useFormatInstant`. `src/i18n/request.test.ts` stays as is (research R1).
- [x] T016 [P] Add the superseded-by pointers (research R10):
  - `specs/001-i18n-foundation/spec.md`, the Out of Scope bullet "Times in the visitor's own time zone":
    append "Specified in feature 004 (`specs/004-reader-time-zone/`).";
  - `specs/003-auth-user-admin/spec.md`, the Assumptions bullet "Times are shown in UTC.": append
    "Superseded by feature 004: times are shown in the reader's zone, and in labelled UTC until it is
    known.";
  - `specs/003-auth-user-admin/contracts/ui.md`, the sentence "Dates and times go through next-intl's
    `format.dateTime`, which uses 001's fixed UTC time zone, with the zone shown next to times of day":
    replace it with "Dates and times go through `useFormatInstant` (feature 004)."
- [x] T017 Run every merge gate: `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run
e2e`. The full Playwright suite runs, not only the new spec, because the demo page and users page are
      shared with 001 and 003 (FR-019). Report failures with their output. Depends on all tasks above.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002 → T003)** → user stories.
- **US1 (T004 – T009)** depends only on the Foundational phase.
- **US2 (T010 – T011)** depends on T009 (the spec file it extends) and on the US1 call sites.
- **US3**: T012 and T014 can start after the Foundational phase. T013 waits for T004, T005, and T007,
  because the rule would otherwise fail on the current call sites.
- **Polish**: T015 and T016 can go anytime after T003. T017 comes last.

### Within Each Story

- Test-first modules (T002 / T003, T012 / T013, T014): the test is written and seen to fail before the
  implementation.
- Component tasks (T004 – T007) change the component and its test together.

### Parallel Opportunities

- T004, T005, and T006 touch different folders.
- T012 and T014 touch different files and can run alongside US1.
- T015 and T016 are documentation and comments only.

## Parallel Example: User Story 1

```text
T004 user-table   ┐
T005 invite-dialog├─ in parallel, after T003
T006 demo-opened-at┘
T007 (needs T006) → T008 (needs T004, T005) → T009 (needs T004, T005, T007)
```

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + US1 (T001 – T009).** At that point every reader sees their own zone, and the
fallback already behaves correctly, because the hook carries both states. US2 adds the end-to-end
error check. US3 locks the mechanism in place before chat adds its timestamps. Ship US3 in the same
pull request as US1, because the spec's guarantee is only as strong as the check.
