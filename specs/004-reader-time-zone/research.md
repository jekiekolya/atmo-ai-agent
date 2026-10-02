# Research: Dates and Times in the Reader's Time Zone

Every finding below was checked against the installed packages: next-intl / use-intl 4.13.7,
react-dom 19.2.8, Next.js 16.3.0, Playwright 1.62.1, Node 22.23 (ICU 78.2, tzdata 2026a).

## R1. next-intl: an explicit `timeZone` in the options wins; an absent one falls back to the provider's

**Decision**: The shared mechanism passes `timeZone` explicitly on every call — the reader's zone once
known, `"UTC"` before — and never relies on the provider's global zone.

**Rationale**: `createFormatter` in `use-intl/dist/esm/development/initializeConfig-*.js` applies the
global zone only `if (!options?.timeZone)`; an explicit option is used as given. With no global zone
and no option it reports `ENVIRONMENT_FALLBACK` through `onError` and lets Intl use the runtime's
zone. The request's reading of the types is therefore right, with one consequence: relying on the
fallback would log an error on every call, so the mechanism always names the zone.

The provider's global zone stays `"UTC"` in `src/i18n/request.ts`. Nothing on screen depends on it any
more, but it keeps any server-side formatting deterministic and silent. Its comment, which points at
001's Out of Scope, is updated to point here. `request.test.ts` keeps asserting it.

`IntlProvider` merges `timeZone || prevContext?.timeZone`, so a nested provider could swap the zone for
a subtree. This was rejected (R4).

**Alternatives considered**: Leaving `timeZone` out once the zone is known, letting Intl use the
browser's own zone. This is the same result, but it logs `ENVIRONMENT_FALLBACK` on every call.

## R2. React hydrates an external store from the server snapshot, then re-renders — no mismatch

**Decision**: The reader's zone is read through `useSyncExternalStore(subscribe, getSnapshot,
getServerSnapshot)`. `getServerSnapshot` returns `null` (zone unknown). `getSnapshot` returns the
browser's zone. `subscribe` never fires, because a zone change mid-page is picked up on the next load
(spec Assumptions).

**Rationale**: `mountSyncExternalStore` in `react-dom-client.development.js` uses `getServerSnapshot()`
while hydrating, so the first client render matches the server HTML. Its passive effect
`updateStoreInstance` then runs `checkIfSnapshotChanged` and forces a re-render with `getSnapshot()`.
That is FR-003 – FR-006 exactly:

- **Hard load**: the server HTML shows labelled UTC, hydration matches it, and the value is replaced
  in place with no hydration error.
- **Mounted after hydration** (the invite dialog, a client-side navigation): React is not hydrating,
  so it reads `getSnapshot()` directly and the local value appears with no UTC interim.

Both snapshots must be stable. The zone is a string read once per page load and cached at module
level (FR-017), so `getSnapshot` returns the same value every call.

**Alternatives considered**: `useState(null)` and `useEffect(() => setZone(...))`. This behaves the
same, but needs an extra render on every client mount, so a dialog would flash UTC first. That
violates FR-003.

## R3. The installed Next.js guide's inline-script approach is not used

`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` shows a `LocalDate`
component. It renders the server's value, follows it with an inline `<script>` that rewrites the text
before first paint, and sets `suppressHydrationWarning` so React accepts the rewritten DOM.

**Decision**: Not adopted.

**Rationale**:

- **The spec settles the other way.** Decision 2 / FR-003 apply the zone after the page becomes
  interactive and accept that labelled UTC shows first. The guide exists to remove exactly that
  moment. CLAUDE.md says to apply a documented example as is unless a rule here forces otherwise, and
  the spec is that rule.
- **Values are embedded in translated sentences.** Strings like `Pending until {expiresAt}` and
  `It works once and expires {expiresAt}` take the date as a message argument. A per-value element
  with its own script cannot sit inside a string argument without restructuring both catalogs into
  rich text.
- **The guide formats with the browser's locale** (`toLocaleDateString(undefined, …)`), not the
  address's locale. That breaks FR-002, where a Ukrainian page stays Ukrainian in any zone.
- **One script per value doesn't scale.** Chat will show dense, repeated timestamps (FR-017), and each
  script needs `dangerouslySetInnerHTML`, a `suppressHydrationWarning` that silences real mismatches
  on that element, and a script exemption in any future Content-Security-Policy.

If the moment of labelled UTC later proves unacceptable on real pages, this guide is the documented
remedy, and adopting it would be a spec amendment to decision 2.

## R4. The mechanism is one client hook, `useFormatInstant`, returning strings

**Decision**: `src/i18n/use-format-instant.ts` exports `useFormatInstant(): (value: Date, format:
"date" | "dateTime") => string`. Contract: [contracts/format-instant.md](./contracts/format-instant.md).

**Rationale**:

- **It returns a string, so call sites stay as they are.** Every current date is a message argument
  (`t("users.list.pendingUntil", { expiresAt })`), so the call site only swaps `format.dateTime(value,
OPTIONS)` for `formatInstant(value, "dateTime")`.
- **It lives next to `useTranslateKey`** in `src/i18n/`, the existing home for client hooks that wrap
  next-intl. It is not a component, so the one-folder-per-component rule does not apply.
- **Two named formats carry today's two shapes** (FR-014). `ZONED_DATE_TIME` in `src/lib/date-formats.ts`
  moves into the hook, and that file is deleted because both of its importers move onto the hook.

**Alternatives considered**:

- A `<LocalTime>` component. It can't be a string message argument without rich-text catalogs.
- A nested `NextIntlClientProvider` that switches the zone after hydration. `useFormatter` would follow
  it, but nothing would say which values need the UTC label, every existing `format.dateTime` call
  would stay a separate path to police, and the provider's `onError` would fire for every call before
  the zone is known.

## R5. Formats: `dateStyle: "medium"` is replaced by its spelled-out parts

**Decision**: There are two formats:

- `date`: `{ year: "numeric", month: "short", day: "numeric" }`
- `dateTime`: `date` plus `{ hour: "2-digit", minute: "2-digit" }`

In the UTC fallback each one adds `timeZoneName: "short"`.

**Rationale**: Intl rejects `dateStyle` combined with `timeZoneName` (feature 003's A10). The UTC
fallback of a date-only value now needs a label (Clarification Q1), so the users table's
`dateStyle: "medium"` must be spelled out. Measured in Node 22.23, the spelled-out parts produce the
same text as `dateStyle: "medium"` in both locales, so the users table looks the same once the zone is
known:

| locale | zone known (Kyiv)        | fallback                     |
| ------ | ------------------------ | ---------------------------- |
| en     | `Mar 15, 2026`           | `Mar 14, 2026, UTC`          |
| en     | `Mar 14, 2026, 11:30 AM` | `Mar 14, 2026, 09:30 AM UTC` |
| uk     | `15 бер. 2026 р.`        | `14 бер. 2026 р., UTC`       |
| uk     | `14 бер. 2026 р., 11:30` | `14 бер. 2026 р., 09:30 UTC` |

The label comes from Intl in both locales, so **no catalog string is added** (FR-010 holds with nothing
to translate).

**Exception**: the demo case page used `month: "long"` ("March 14, 2026") and moves to `date` ("Mar 14,
2026"). The page is slated for removal (spec Assumptions), and a third format kept only for it would be
a speculative extension point (Principle II).

## R6. The reader's zone: `resolvedOptions().timeZone`, validated, cached once

**Decision**: Use `Intl.DateTimeFormat().resolvedOptions().timeZone`, computed on the first read and
cached for the page's lifetime. These count as unknown and leave the fallback in place: an empty value,
`"Etc/Unknown"` (ICU's placeholder for an unresolvable zone), or any value that throws when passed back
as `timeZone`. `"UTC"` and `"Etc/UTC"` are known zones and show unlabelled (FR-009).

**Rationale**: This is the platform's only source for the browser's zone (FR-001), and it costs
nothing at runtime. Caching it gives FR-017's "determined once per page" and the stable snapshot that
R2 requires.

ICU canonicalizes names: Node reports `Europe/Kyiv` as `Europe/Kiev`. The value is only passed back to
Intl, never shown or compared, so the spelling does not matter.

## R7. The automated check: `no-restricted-syntax` scoped to screen code, plus a catalog test

**Decision**:

1. **An ESLint block** applies `no-restricted-syntax` to `src/**/*.{ts,tsx}`. It ignores
   `src/server/**` (browser-less, Clarification Q2), `src/config/**`, test files, and the hook itself.
   It forbids:
   - member calls named `dateTime`, `dateTimeRange`, `relativeTime` (next-intl's `useFormatter` and
     `getFormatter`);
   - `toLocaleDateString`, `toLocaleTimeString`, `toLocaleString`;
   - `new Intl.DateTimeFormat` and `new Intl.RelativeTimeFormat`.

   The message names `useFormatInstant` and FR-015.

2. **A test in `src/i18n/catalogs.test.ts`** fails if any message uses an ICU `date` or `time` argument
   (`{x, date, …}`). Such an argument is formatted with the provider's global zone, unlabelled, and
   never passes through code, so no lint rule can see it. None exists today.
3. **A Vitest test** (`src/i18n/format-instant-rule.test.ts`) runs the repository's ESLint config
   through the `ESLint` Node API, with `lintText` and a `filePath`. It asserts that:
   - `format.dateTime(…)` and `toLocaleDateString()` in a component path are reported;
   - the same code in the hook's own file and under `src/server/` is not;
   - `process.env` in a component path is still reported (see the trap below).

   This satisfies FR-016's "shown to catch at least one violation".

**Trap — recorded because nothing else would catch it**: in flat config, a later block that sets
`no-restricted-syntax` _replaces_ an earlier block's setting for the files they share; it does not merge
with it. The existing Principle V block (`process.env`) covers the same files. The date block must
therefore repeat the `process.env` selector, held in one shared constant, or Principle V silently stops
applying to screen code. The third assertion in item 3 pins this.

**Rationale**: This is the same mechanism the repository already uses for Principle V, so it runs in
`npm run lint`, which is already a merge gate, and needs no dependency. Matching the property name
`dateTime` matches any object's method of that name, not only next-intl's. That is accepted: in screen
code a method called `dateTime` that formats something else is unlikely, and if one appears, an inline
suppression with a reason is the documented escape (CLAUDE.md).

**Alternatives considered**:

- A custom ESLint plugin that tracks `useFormatter` bindings. It would be more precise, but it means a
  new local plugin with its own tests for no practical gain.
- `no-restricted-imports` on `useFormatter` / `getFormatter`. This is too broad: `format.number` stays
  legitimate on the demo page and in future screens.

## R8. Component tests run in a fixed non-UTC zone

**Decision**: Set `env: { TZ: "Europe/Kyiv" }` for the `ui` Vitest project, and add `src/i18n/**/*.test.tsx`
to its `include`, so the hook's test runs under jsdom.

**Rationale**: A test that depends on the machine's zone passes on a UTC CI runner for the wrong
reason. Node re-reads `process.env.TZ` when it is set, and Vitest applies `test.env` before test files
load. The hook's test asserts the precondition (`resolvedOptions().timeZone` is Kyiv) so that a runner
which ignores `TZ` fails loudly instead of passing vacuously. Setting it in `vitest.config.mts` is
tooling and exempt from Principle V. Setting it inside a test would not be.

The hook's tests cover both states (FR-021):

- **Zone unknown**: `renderToString` uses `getServerSnapshot`, so the output is UTC and labelled.
- **Zone known**: a client `render` shows the local value, unlabelled.
- **Hydration**: `hydrateRoot` over the server string, with an `onRecoverableError` spy. After `act`,
  the text is local and the spy was never called (FR-006 at component level).
- **Unusable zone**: `resolvedOptions` is mocked to return `Etc/Unknown` before a fresh import, and the
  value stays labelled UTC.

## R9. End-to-end: `test.use({ timezoneId })`, instants fixed through SQL, console collected

**Decision**: Add a new spec, `e2e/time-zone.spec.ts`:

- `test.use({ timezoneId: "Europe/Kyiv" })` applies to contexts created through `browser.newContext()`
  as well. Playwright's `runBeforeCreateBrowserContext` merges `_combinedContextOptions` into them, the
  same way `baseURL` already reaches `signedInPage`.
- **Known instants**: create an invited user through the UI, then set
  `users."createdAt" = '2026-03-14T23:30:00Z'` and `invites."expiresAt" = '2026-03-14T09:30:00Z'` through
  `e2e/support/db.ts`. `listUsersWithPendingInvite` does not filter out expired invites, so a past
  expiry still shows. On reload the row reads `Mar 15, 2026` and `Mar 14, 2026, 11:30 AM` and contains
  no `UTC` (SC-001, scenario 3). That date is UTC+2 whether or not Ukraine keeps daylight saving.
- **Invite dialog**: the expiry is created at "now", so the test reads `invites."expiresAt"` back from
  the database, formats its Kyiv hour and minute in Node, and asserts the dialog shows them without
  `UTC`.
- **Demo page**: `SAMPLE.openedAt` moves from 09:30Z to `2026-03-14T23:30:00Z`, so Kyiv shows a
  different day from UTC and the test proves the conversion rather than only the missing label.
- **Second zone**: the users-row test repeats under `America/New_York` (SC-002, scenario 5).
- **Console**: the same collector as `e2e/smoke.spec.ts` (console `error` plus `pageerror`), asserted
  empty after `networkidle` on each page (FR-006, SC-005). Asserting no errors at all, rather than
  matching hydration text, survives React's minified production messages.

**Rationale**: Node and Chromium carry different ICU builds, so whole-string equality across them is
brittle (whitespace such as U+202F before `AM` has changed between ICU versions). The assertions
match the parts that prove the conversion: the hour and minute, the day, and the absence of `UTC`.

**Risk**: Chromium must accept `Europe/Kyiv` as a `timezoneId`. ICU has known it since 72 and the
installed Chromium is far newer. If it is ever refused, `Europe/Kiev` is the same zone.

## R10. Documents this feature supersedes

001's Out of Scope entry ("Times in the visitor's own time zone"), 003's assumption "Times are shown in
UTC", 003's `contracts/ui.md` sentence about the fixed UTC zone, and the comment in
`src/i18n/request.ts` each get a one-line pointer to this spec. 003's `data-model.md` already states
that every instant is `Timestamptz(3)`, matching the schema, so it needs no change.

## R11. No dependency, no migration, no Config change

Nothing in this feature reads configuration, stores data, or adds a package. `.env.example`, the Prisma
schema, and `package.json` dependencies are untouched.
