---
description: "Task list for Theme Switching"
---

# Tasks: Theme Switching

**Input**: Design documents from `/specs/002-theme-switching/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/theme-contract.md](./contracts/theme-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The spec puts this feature in the constitution's **test-together** regime, so
tests ship in the same pull request as the change but their _order of writing is not mandated_ —
unlike the test-first regime, there is no "write it failing first" rule here. Every test task below
is mandatory.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are given in every task

## Path Conventions

Single Next.js package. Application code under `src/`, end-to-end specs under `e2e/`, component
tests colocated beside their component. Import alias `@/*` → `./src/*`.

**A note on parallelism in this feature**: it is a small, single-surface change, and most of it
lands in three files (`src/components/theme-toggle/theme-toggle.tsx`,
`src/app/[locale]/layout.tsx`, `e2e/theme-switching.spec.ts`). Genuine `[P]` opportunities are
therefore few, and they are marked honestly rather than generously — two tasks touching the same
file are never marked `[P]`, even when they feel independent.

---

## Phase 1: Setup

**Purpose**: Get onto a branch and add the one dependency.

- [x] T001 Create and switch to the feature branch: `git checkout -b 002-theme-switching` from `dev`. The constitution forbids feature work on `main` or `dev`, and the repository is currently on `dev`.
- [x] T002 Add the dependency with `npm install next-themes@^0.4.6`, then confirm `package.json` and `package-lock.json` both record it and that no transitive runtime dependency came with it (`npm ls next-themes`). The justification is already recorded in [plan.md](./plan.md) under Complexity Tracking — do not re-litigate it, but do verify the measured claims still hold for the version actually installed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared constants every later phase reads.

**⚠️ CRITICAL**: T003 blocks all four user stories.

- [x] T003 Create `src/lib/theme.ts` exporting `ThemePreference` (`"light" | "dark" | "system"`), `THEME_STORAGE_KEY`, and `DEFAULT_THEME_PREFERENCE` (`"system" satisfies ThemePreference`). Constants and the one type that earns its place — a `ResolvedTheme` type was dropped during implementation as unused — no `process.env`, no side effects, no branching logic (FR-025). Shape is fixed by [contracts/theme-contract.md](./contracts/theme-contract.md#3-component-contract); no dedicated unit test, per the test-regime table in [plan.md](./plan.md).

**Checkpoint**: Constants exist. User story work can begin.

---

## Phase 3: User Story 1 - The product matches the visitor's device without being asked (Priority: P1) 🎯 MVP

**Goal**: Every route resolves to the appearance the operating system asks for, applied before the
first paint, and follows a live OS change. No control is shipped in this phase — and none is needed
for the story to deliver its value.

**Independent Test**: Load any route with the OS colour-scheme set to dark, then to light, with
nothing in storage, and confirm the appearance served in each case; then change the OS setting while
the page is open and confirm the page follows. No control, no persistence involved.

### Implementation for User Story 1

- [x] T004 [US1] Edit `src/app/[locale]/layout.tsx`: add `suppressHydrationWarning` to the `<html>` element, and mount `<ThemeProvider>` from `next-themes` as the **outermost element inside `<body>`**, wrapping `NextIntlClientProvider`, the header and `main`. Props: `attribute="class"`, `defaultTheme={DEFAULT_THEME_PREFERENCE}`, `storageKey={THEME_STORAGE_KEY}` — leave `enableSystem`, `enableColorScheme` and `disableTransitionOnChange` at their defaults. Mount order is load-bearing, not stylistic: the provider renders its pre-paint inline script immediately before its children, so anything mounted outside it paints before the script runs. See [research.md](./research.md#decision-2-where-the-provider-is-mounted).

### Tests for User Story 1

- [x] T005 [US1] Create `e2e/theme-switching.spec.ts` with the device-following cases: (a) `test.use({ colorScheme: "dark" })` with nothing stored → `<html>` carries `dark` (FR-003, FR-004); (b) the same with `"light"` → `<html>` does not carry `dark`; (c) `page.emulateMedia({ colorScheme })` mid-test → the appearance follows without a reload (FR-005); (d) `documentElement.style.colorScheme` matches the resolved appearance (FR-021). Assert the presence or absence of `dark` only — never an exact class list, because `attribute="class"` also adds an inert `light` class. Import the storage key from `@/lib/theme` rather than writing a string literal.

**Checkpoint**: US1 is complete and demonstrable on its own — the product now honours the device
setting everywhere, with no way yet to override it.

---

## Phase 4: User Story 2 - A visitor pins the appearance they want and the product remembers it (Priority: P2)

**Goal**: A header control that pins the opposite appearance, remembered per browser across reloads,
routes, sessions and tabs, overriding the OS.

**Independent Test**: From any route, activate the control and verify the appearance flips; then
verify it survives a reload, a navigation to another route, a second tab, and an OS setting that
disagrees with it.

### Implementation for User Story 2

- [x] T006 [P] [US2] Add the `theme` namespace with a `label` key to `src/messages/en.json`. The string is the control's accessible name in **both** appearances, so it must describe the control rather than a destination — "Switch between light and dark", never "Switch to dark mode" (FR-011, FR-024).
- [x] T007 [P] [US2] Add the matching `theme.label` key to `src/messages/uk.json`. A key present in one catalog and missing from another fails `src/i18n/catalogs.test.ts`; a misspelled key fails `npm run typecheck` via `src/types/next-intl.d.ts`.
- [x] T008 [US2] Create `src/components/theme-toggle/theme-toggle.tsx` — a client component exporting `ThemeToggle`, taking no props. Render one `Button` from `@/components/ui/button` with `variant="ghost"`, a static `aria-label` from `useTranslations("theme")("label")`, and a lucide-react icon. On click, read `resolvedTheme` from `useTheme()` **inside the handler** and call `setTheme(resolvedTheme === "dark" ? "light" : "dark")` (FR-008). **Never read a theme value during render**: on the server `resolvedTheme` is `undefined` and on the client it is `"light"` or `"dark"`, so any render-time branch on it is a hydration mismatch and a visible flash — see [research.md](./research.md#decision-3-how-the-control-avoids-a-hydration-mismatch). No `mounted` boolean, no placeholder.
- [x] T009 [US2] Render `<ThemeToggle />` in the header of `src/app/[locale]/layout.tsx`, beside the existing `<LocaleSwitcher />`. It must sit inside `NextIntlClientProvider` so its message lookup resolves.

### Tests for User Story 2

- [x] T010 [US2] Create `src/components/theme-toggle/theme-toggle.test.tsx`. Mock `next-themes`' `useTheme` and `next-intl`'s `useTranslations`, following the mock shape already used in `src/components/locale-switcher/locale-switcher.test.tsx`. Assert: activating the control calls `setTheme("dark")` when `resolvedTheme` is `"light"`, and `setTheme("light")` when it is `"dark"`. Do **not** render a real `ThemeProvider` — jsdom has no `window.matchMedia`, which the provider calls on mount. Also assert the two-state contract explicitly rather than leaving it implied: the component renders exactly one interactive element (FR-007), and `setTheme` is never called with `"system"` — the control offers no way back to following the OS, which is a deliberate decision recorded in the first Clarification, not an oversight to be helpfully fixed (FR-009).
- [x] T011 [US2] Append the persistence cases to `e2e/theme-switching.spec.ts`: clicking the control flips the appearance with no reload (FR-008); the choice survives `page.reload()` (FR-015); it survives a navigation to another route (FR-015); a stored choice seeded via `context.addInitScript` beats a conflicting `colorScheme` (FR-006); and two pages in one `BrowserContext` converge on the same preference, asserted with `expect.poll` rather than a single read, since the `storage` event is asynchronous across pages (FR-017). Finally, assert what the preference must _not_ do: after pinning a choice, `context.cookies()` holds no theme entry — only the existing `NEXT_LOCALE` — and the URL is byte-identical to what it was before the click (FR-016).
- [x] T012 [US2] Append the storage-resilience cases to `e2e/theme-switching.spec.ts`, both set up with `context.addInitScript` before the page loads: (a) with `window.localStorage` redefined to throw on access, every route still renders and stays usable, no error is surfaced to the visitor, and the appearance follows the device setting (FR-018, SC-007); (b) with a value outside the vocabulary seeded under `THEME_STORAGE_KEY` — e.g. `"lite"` — the page renders, the control works, and one press of it restores a recognised state that survives a reload (FR-019 — weakened during implementation; see the fifth Clarification in [spec.md](./spec.md) and Decision 7 in [research.md](./research.md)). The fourth Clarification put case (a) on the mandated e2e list by an explicit decision; neither case is optional hardening.

**Checkpoint**: US1 and US2 both work. The visitor can pin an appearance and the product remembers
it. The control is functional but not yet guaranteed correct in the first painted frame.

---

## Phase 5: User Story 3 - The control is usable and correctly announced by everyone (Priority: P3)

**Goal**: The control shows the right icon in the very first painted frame, never shifts the header,
is reachable by keyboard, and announces one name whatever the appearance.

> **Honest note on independence**: these are properties of the component built in US2, not a separate
> surface, so this phase deepens T008 rather than adding a parallel one. A developer implementing the
> whole feature in one pass will naturally fold T013 into T008 — that is fine and expected. The split
> exists so that US2 is shippable on its own and so US3's guarantees are checked rather than assumed.

**Independent Test**: With the keyboard alone, reach and activate the control and confirm the
appearance changes. Inspect the accessible name in both appearances and confirm it is identical.
Load a page and confirm the control renders in its final position with its final icon in the first
frame.

### Implementation for User Story 3

- [x] T013 [US3] Upgrade `src/components/theme-toggle/theme-toggle.tsx` to the full first-paint contract: render **both** lucide-react icons (sun and moon) unconditionally, with `className="dark:hidden"` on the sun and `className="hidden dark:block"` on the moon, so the CSS `dark` variant alone decides which is visible (FR-012, FR-013); mark both icons `aria-hidden` so the accessible name comes only from the label (FR-010); set `size="icon-sm"` on the `Button`, which resolves to `size-7` and matches the language switcher's `SelectTrigger size="sm"` at `h-7` (FR-014). No new primitive is vendored into `src/components/ui/`.

### Tests for User Story 3

- [x] T014 [US3] Extend `src/components/theme-toggle/theme-toggle.test.tsx`: exactly one `button` is rendered (FR-007); its accessible name is byte-identical whether the mocked `resolvedTheme` is `"light"` or `"dark"` (FR-011); both icons are present in the markup in both cases, so visibility is decided by CSS and not by a render-time branch (FR-012); and no placeholder or mounted-check element is ever rendered.
- [x] T015 [US3] Append the keyboard case to `e2e/theme-switching.spec.ts`: the control is reachable by `Tab`, shows visible focus, and is activated by keyboard alone, flipping the appearance (FR-010).

**Checkpoint**: The control is correct from the first frame and usable without a pointer.

---

## Phase 6: User Story 4 - Appearance and language are independent (Priority: P4)

**Goal**: The two header controls do not interfere. Changing one leaves the other, and the current
page, untouched.

**Independent Test**: From a deep page, change the language and confirm the appearance is unchanged;
change the appearance and confirm the language, the address and the visitor's place are unchanged.

### Tests for User Story 4

- [x] T016 [US4] Append the independence cases to `e2e/theme-switching.spec.ts`: with a pinned appearance, switching language leaves the `dark` class as it was (FR-027); with no stored preference, switching language leaves the appearance still following the device setting; and from a route with a dynamic segment and a query string (`/uk/demo/42?tab=notes`, the route the i18n feature already ships), changing the appearance leaves `html[lang]`, the URL and the heading unchanged (FR-026). Drive the language switcher through the existing `getByRole("combobox")` / `getByRole("option")` pattern from `e2e/locale-switching.spec.ts`.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T017 Run the full automated merge gates and fix anything red: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run e2e`. The catalog completeness test and the derived message types are what enforce FR-024; there is no separate task for them.
- [x] T018 Work through the **manual review gate** in [quickstart.md](./quickstart.md#manual-review-gate). Two requirements have no automated guard by decision, so this task is the only thing standing behind them: against a **production build** (`npm run build && npm run start`, not the dev server), confirm no frame of the wrong appearance on a hard load or repeated reloads — at normal speed and with the network throttled to Slow 3G — in both the stored-preference and no-preference cases (FR-020, FR-012, FR-013); and confirm from the `npm run build` output that every `/[locale]` route is still prerendered static content (FR-023).
- [x] T019 Confirm the blast radius is exactly what the spec promised: `git diff` shows no change to `src/app/globals.css` (FR-022), `src/proxy.ts` (FR-023), `src/config/` or `.env.example` (FR-025). Any diff in those four is a defect in this feature, not an incidental tidy-up.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: needs T002. Blocks every user story.
- **US1 (Phase 3)**: needs T003.
- **US2 (Phase 4)**: needs T003. In practice it also wants T004, since the control has no provider to talk to without it.
- **US3 (Phase 5)**: needs US2 — it deepens the same component.
- **US4 (Phase 6)**: needs US2 for the control to exist, and the locale switcher that already ships.
- **Polish (Phase 7)**: needs every story you intend to ship.

### The one cross-story coupling worth stating plainly

Unlike most feature plans, the stories here are **not** four independent slices staffed in parallel.
They are one small surface delivered in four increments:

```text
T003 ─→ US1 (provider)
         └─→ US2 (control + persistence)
                  ├─→ US3 (first-paint correctness, a11y)
                  └─→ US4 (independence from language)
```

US3 and US4 are genuinely independent **of each other** once US2 lands, and are the only pair that
could be worked simultaneously by two people.

### Same-file serialization

- `src/app/[locale]/layout.tsx` is edited by T004 (US1) and T009 (US2) — sequential.
- `src/components/theme-toggle/theme-toggle.tsx` is written by T008 and deepened by T013 — sequential.
- `src/components/theme-toggle/theme-toggle.test.tsx` is written by T010 and extended by T014 — sequential.
- `e2e/theme-switching.spec.ts` is created by T005 and appended by T011, T012, T015 and T016 — sequential. This single file is why so few tasks carry `[P]`.

### Parallel opportunities

- **T006 and T007** — the `en` and `uk` catalogs, different files, no shared state. The only true `[P]` pair in the feature.
- **T011 and T012** — both append to `e2e/theme-switching.spec.ts`, so they are sequential, not parallel, despite covering unrelated requirements.
- **T014 and T015** after T013 — a component test and an e2e spec, different files.
- **US3 and US4** after US2, if two people are available.

---

## Parallel Example: User Story 2

```bash
# The two catalogs, together:
Task: "Add theme.label to src/messages/en.json"
Task: "Add theme.label to src/messages/uk.json"

# Then, sequentially: T008 (component) → T009 (mount) → T010 (component test) → T011 (e2e)
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 (T001–T002) and Phase 2 (T003).
2. Phase 3 (T004–T005).
3. **Stop and validate**: with nothing stored, the product honours the OS setting on every route and
   follows a live change. That alone is the whole feature for most visitors, who will never press the
   control.

### Incremental delivery

1. Setup + Foundational → constants and dependency in place.
2. **US1** → the product matches the device. Demo-able. _(MVP)_
3. **US2** → the visitor can pin a choice and it is remembered. Demo-able.
4. **US3** → the control is correct in the first frame and usable by keyboard.
5. **US4** → proof that theme and language do not interfere.
6. Polish → gates green, manual review done, blast radius confirmed.

### Doing it in one pass

If you are not shipping the increments separately, fold T013 into T008 and T014 into T010, and write
`e2e/theme-switching.spec.ts` once with all the cases from T005, T011, T012, T015 and T016. The task IDs
still describe what must be true; they just stop describing separate commits.

---

## Notes

- `[P]` means different files and no dependency on incomplete work. It is used sparingly here because
  the feature concentrates in three files.
- Test-together regime: tests ship in the same pull request, but there is **no** requirement that they
  be written first or fail first. That rule belongs to the test-first regime, which nothing in this
  feature falls under.
- Assert the presence or absence of the `dark` class, never an exact class list — `attribute="class"`
  also writes an inert `light` class.
- Commit after each task or logical group. Stop at any checkpoint to validate a story on its own.
- Out of contract, and not to be added by any task: a theme value reaching the server, a new route, a
  cookie or header, a colour token change, or anything new in `src/components/ui/`.
