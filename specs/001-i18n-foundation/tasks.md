---
description: "Task list for the i18n foundation feature"
---

# Tasks: i18n Foundation

**Input**: Design documents from `/specs/001-i18n-foundation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Required, not optional. Constitution Principle IV mandates test-first for domain logic
(`src/i18n/**`) and test-together for UI and e2e, and the spec pins three gates by name: types
(MC-004), a Vitest parity test (MC-005), and a Playwright e2e (MC-006).

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US4, mapping to the user stories in spec.md
- Every task names its exact file path

## Path Conventions

Single Next.js application. Application code in `src/`, e2e in `e2e/`, tooling configs at the
repository root. Import alias `@/*` → `./src/*`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring in the dependency and make the toolchain able to see the new code

- [ ] T001 Add `next-intl@^4.13.7` to `dependencies` in `package.json` and install it (peer range verified as `next: ^16.0.0`)
- [ ] T002 Wrap the exported config in `next.config.ts` with `createNextIntlPlugin("./src/i18n/request.ts")` from `next-intl/plugin`, preserving the existing `turbopack.root` pin
- [ ] T003 [P] Extend the `unit` project's `include` glob in `vitest.config.mts` from `src/{config,lib,services}/**/*.test.ts` to also cover `src/i18n` — without this every test in this feature silently never runs (research R9)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The locale constant, routing configuration, and typing that every user story needs. None of it is user-visible on its own.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Write failing tests in `src/i18n/locales.test.ts`: the default is a member of the supported set, `LOCALE_LABELS` is total over `Locale`, and the set contains no duplicates
- [ ] T005 Implement `src/i18n/locales.ts` exporting `SUPPORTED_LOCALES` (`["en","uk"] as const`), `DEFAULT_LOCALE` (`"en" satisfies Locale`), the `Locale` union type, and `LOCALE_LABELS` as endonyms (`English`, `Українська`) — per data-model.md §1. No value here may come from the environment (FR-002, FR-004)
- [ ] T006 [P] Create `src/messages/en.json` and `src/messages/uk.json` with the `common`, `home`, `switcher`, and `demo` namespaces, both holding identical key paths (FR-019)
- [ ] T007 Create `src/i18n/routing.ts` calling `defineRouting` with `localePrefix: "always"`, `localeDetection: true`, `alternateLinks` left at its default, and `localeCookie` set to the attributes in data-model.md §4 — including `secure: config.appEnv !== "development"` read from `@/config`, never `process.env` (Principle V). Depends on T005
- [ ] T008 [P] Create `src/i18n/navigation.ts` calling `createNavigation(routing)` and re-exporting `Link`, `useRouter`, `usePathname`, `redirect` and `getPathname` — the only sanctioned way to build an internal address (MC-001). Depends on T007
- [ ] T009 [P] Write failing tests in `src/i18n/request.test.ts`: a supported locale loads that locale's catalog; an unsupported or absent locale falls back to `DEFAULT_LOCALE` rather than throwing or serving an empty catalog; the returned config carries the locale it actually resolved. Test-first is mandatory here — this module narrows an untrusted URL segment and decides the fallback, which Principle IV names explicitly
- [ ] T010 [P] Create `src/i18n/request.ts` with `getRequestConfig`, resolving the requested locale, falling back to `DEFAULT_LOCALE` when it is not supported, and loading that locale's catalog from `src/messages/`. Depends on T005, T006, T009
- [ ] T011 Create `src/types/next-intl.d.ts` augmenting next-intl's `AppConfig` with `Locale` from `@/i18n/locales` and `Messages` as `typeof import("../messages/en.json")` — this is Gate 1 (MC-004). Depends on T005, T006

**Checkpoint**: `npm run typecheck` passes, locale rules are typed and testable, no routes have moved yet

---

## Phase 3: User Story 1 - A visitor is served the product in a language they can read (Priority: P1) 🎯 MVP

**Goal**: Every page lives at a locale-prefixed address, and a visitor with no stored preference is redirected to the language their browser asks for.

**Independent Test**: Request `/` and a deeper path with different `Accept-Language` values and no cookie; confirm the locale served, the address landed on, the redirect status and cache header, and the document language. No switcher needed.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [ ] T012 [P] [US1] Write failing tests in `src/i18n/proxy-handler.test.ts` covering the full response table in `contracts/routing.md`: resolution order URL → cookie → `Accept-Language` → default (FR-006), unsupported values falling through (FR-008), regional variants mapping to their base (FR-009), path and query preserved byte-for-byte (FR-007), **no `Set-Cookie` on any response** (FR-030), and `Cache-Control: no-store` on every 3xx (FR-031)

### Implementation for User Story 1

- [ ] T013 [US1] Implement `src/i18n/proxy-handler.ts`: delegate to next-intl's middleware, then strip every `Set-Cookie` entry naming `NEXT_LOCALE` and set `Cache-Control: no-store` on redirect responses. Add a comment stating _why_ the write is suppressed rather than disabled via `localeCookie: false` (research R2 — that flag also disables reading). Depends on T012
- [ ] T014 [US1] Create `src/proxy.ts` exporting `proxy` plus a `config.matcher` excluding `/api`, `/_next/static`, `/_next/image`, `favicon.ico`, `robots.txt`, `sitemap.xml` and any path with a file extension (FR-011). Keep it a thin delegate to T013. Note in a comment that the file is `proxy.ts` per Next 16 while the import stays `next-intl/middleware` (research R1)
- [ ] T015 [US1] Delete `src/app/layout.tsx` and `src/app/page.tsx`; create `src/app/[locale]/layout.tsx` as the **root layout**, rendering `<html lang={locale}>` (FR-010) and `<body>`, wrapping children in `NextIntlClientProvider`, calling `notFound()` for an unsupported locale segment, exporting `generateStaticParams` over `SUPPORTED_LOCALES`, and producing localized `metadata` from the catalog (research R7)
- [ ] T016 [P] [US1] Create `src/app/[locale]/page.tsx` — the localized shell replacing the scaffolding: welcome heading and supporting line, every string via `t()` (FR-027)
- [ ] T017 [P] [US1] Create `src/app/[locale]/not-found.tsx` rendering the localized 404
- [ ] T018 [US1] Add the `common`, `home` and metadata copy to both `src/messages/en.json` and `src/messages/uk.json`, with identical key paths. Depends on T016, T017
- [ ] T019 [US1] Update `e2e/smoke.spec.ts` for locale-prefixed addresses — the existing paths break the moment T015 lands
- [ ] T020 [US1] Add `e2e/locale-resolution.spec.ts`: root with a Ukrainian browser preference lands on `/uk`, root with an unsupported preference lands on `/en`, a prefixed address wins over a conflicting cookie, and the document language matches (FR-026)

**Checkpoint**: The product is fully usable in both languages by address alone. This is the MVP — deployable and demonstrable without the switcher.

---

## Phase 4: User Story 2 - A visitor changes language and the product remembers (Priority: P2)

**Goal**: A dropdown on every page switches language in place and the choice survives a reload and a later visit to the site root.

**Independent Test**: From a deep page with a dynamic segment and a query string, switch language and verify the address, the copy, a reload, and a subsequent root visit.

> **Ordering note**: T022 creates the demonstration route here rather than in User Story 4, because FR-013's acceptance ("`/uk/x/42` → `/en/x/42`") needs a nested parameterized route to switch against. User Story 4 later enriches that same route with formatted values. This is the one place where a P4 artifact is pulled forward, and it is why: the route serves two stories (FR-028).

### Implementation for User Story 2

- [ ] T021 [US2] Vendor the select primitive with `npx shadcn@latest add select` into `src/components/ui/select.tsx`; verify the CLI rewrote `@/registry/base-nova/lib/utils` to `@/lib/utils` and resolved the icon placeholders to `lucide`, and fix in place if it did not (MC-007, research R8)
- [ ] T022 [US2] Create `src/app/[locale]/demo/[id]/page.tsx` rendering the `id` segment and localized copy — the nested parameterized route FR-028 requires, minimal for now
- [ ] T023 [US2] Add the `switcher` and `demo` copy to both catalogs with identical key paths. Depends on T022
- [ ] T024 [US2] Implement `src/components/locale-switcher/locale-switcher.tsx` as a client component: options from `SUPPORTED_LOCALES` labelled with `LOCALE_LABELS`, active option marked, accessible name from `switcher.label`, navigation via `useRouter`/`usePathname` from `@/i18n/navigation` — never string-built addresses (FR-012, FR-013, MC-001). Depends on T021, T023
- [ ] T025 [US2] Render the switcher in the header of `src/app/[locale]/layout.tsx` so it appears on every page (FR-012). Depends on T024
- [ ] T026 [P] [US2] Add `src/components/locale-switcher/locale-switcher.test.tsx` (jsdom, test-together): renders every locale, marks the active one, labels are endonyms, choosing a locale calls the router with the expected target, and the trigger has an accessible name. **Plus the keyboard and assistive-technology contract in `contracts/switcher.md` — FR-016 and SC-010**: the list opens from the keyboard, focus moves between options, an option can be chosen without a pointer, the list can be dismissed without choosing, focus returns to the trigger on dismissal, and the control exposes itself as a list of choices with the current selection identified. Base UI supplies this behaviour; the test proves it survived vendoring and customization
- [ ] T027 [US2] Assert in the same test file (`locale-switcher.test.tsx`, so not parallel with T026) that the switch still navigates when writing the preference throws — stub the cookie write to reject, expect the router call to happen anyway and no error to surface to the visitor (FR-017). Depends on T026
- [ ] T028 [US2] Add `e2e/locale-switching.spec.ts` covering FR-025 end to end: switching keeps the visitor on the same page, the visible copy changes, and the choice survives both a reload and a later visit to the site root (MC-006)
- [ ] T029 [US2] Extend `e2e/locale-switching.spec.ts` with the shared-link case: after choosing English, visiting `/uk/` shows Ukrainian but a subsequent visit to `/` still resolves to English — the stored choice was not overwritten (FR-030, clarification 3)

**Checkpoint**: Stories 1 and 2 both work independently. A visitor can be served automatically _and_ override it.

---

## Phase 5: User Story 3 - A contributor cannot ship an untranslated or misspelled string (Priority: P3)

**Goal**: An incomplete or misspelled catalog cannot reach a customer — both gates fail loudly before merge.

**Independent Test**: Remove a key from the Ukrainian catalog and misspell a key at a call site, then run the gates and confirm each is rejected with a message naming the locale and key.

### Implementation for User Story 3

- [ ] T030 [P] [US3] Implement the parity test in `src/i18n/catalogs.test.ts` per `contracts/catalog.md`: flatten key paths per locale, compare each against `en.json`, treat an empty-string value as a gap, iterate `SUPPORTED_LOCALES` so a new locale is covered automatically, and fail listing **every** gap as `locale: key.path (missing|empty)` — never just the first (FR-021, MC-005)
- [ ] T031 [US3] Prove both gates bite, following `quickstart.md` Scenario 6: delete a `uk` key, empty a value, delete two keys at once, and misspell a key at a call site; confirm the expected failure each time and revert. A gate that has never been seen to fail is not a gate

**Checkpoint**: All three stories independently functional; the completeness guarantee is demonstrated rather than assumed.

---

## Phase 6: User Story 4 - Dates, numbers, and amounts read naturally in the active language (Priority: P4)

**Goal**: Locale-dependent values follow each language's conventions and are never assembled from strings.

**Independent Test**: Render the demonstration route in both languages and compare date order, separators, currency placement, and plural wording against each language's conventions.

### Implementation for User Story 4

- [ ] T032 [US4] Add ICU messages to both catalogs carrying a date placeholder, a number placeholder, a currency amount, and a count-dependent phrase — Ukrainian supplying `one`/`few`/`many`/`other` and English `one`/`other` (FR-024). Plural categories legitimately differ between locales; key paths must not
- [ ] T033 [US4] Render those values in `src/app/[locale]/demo/[id]/page.tsx` through next-intl's formatter (`format.dateTime`, `format.number`, currency style) — never concatenated or hand-formatted (FR-023). Depends on T032
- [ ] T034 [P] [US4] Add `src/app/[locale]/demo/[id]/page.test.tsx` (jsdom `ui` project — the existing `src/{components,app}/**/*.test.tsx` glob already matches it) asserting each locale's conventions for date order, decimal and grouping separators, and currency placement, and that Ukrainian plural forms are correct for counts taking `one`, `few`, and `many`
- [ ] T035 [US4] Extend `e2e/locale-switching.spec.ts` to switch from `/uk/demo/42?tab=notes` and assert the resulting address is `/en/demo/42?tab=notes` — dynamic segment and query string both preserved (FR-013). Depends on T028

**Checkpoint**: Every requirement in the spec has something exercising it.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Update the stack table in `CLAUDE.md`: next-intl is no longer "_not yet installed_"
- [ ] T037 [P] Confirm `.env.example` is unchanged and no new environment variable was introduced (FR-004), and that `process.env` appears nowhere outside `src/config/` and the exempt root tooling configs (Principle V)
- [ ] T038 [P] Audit the whole diff for hardcoded user-facing strings, page metadata and the vendored `src/components/ui/select.tsx` included (FR-018, Principle VII)
- [ ] T039 Run every scenario in `quickstart.md` against a running app, including the `curl` checks for redirect status, `Cache-Control: no-store`, and the absence of `Set-Cookie`
- [ ] T040 Run the full merge gate: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run e2e` — all green
- [ ] T041 [P] Run `npm run format` and confirm the commit history shows the failing test preceding the implementation for every `src/i18n/**` module (Principle IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: needs Setup — **blocks every user story**
- **US1 (Phase 3)**: needs Foundational
- **US2 (Phase 4)**: needs Foundational; T025 touches the layout US1 creates (T015)
- **US3 (Phase 5)**: needs Foundational only — genuinely independent, can run in parallel with US1/US2
- **US4 (Phase 6)**: needs Foundational; T033 extends the route created in T022, T035 extends the spec file created in T028
- **Polish (Phase 7)**: needs every story that is being shipped

### User Story Dependencies

- **US1 (P1)**: independent. Delivers a working bilingual product on its own
- **US2 (P2)**: independent to test, but its switcher renders in US1's layout — sequence US1 first unless two people are splitting the work
- **US3 (P3)**: fully independent of US1 and US2. The parity test only needs the catalogs from T006
- **US4 (P4)**: depends on the route pulled forward into T022, and its e2e extends US2's spec file

### Within Each User Story

- `src/i18n/**` tests are written and **fail** before their implementation (Principle IV, test-first)
- UI and e2e tests ship in the same commit as the change (Principle IV, test-together)
- Locale constant → routing config → navigation/request → proxy → routes → UI

### Parallel Opportunities

- T003 runs alongside T001–T002
- T004 and T006 in parallel; T009 (the request.ts test) alongside them; then T008 and T010 in parallel once T007 and T009 land
- T016 and T017 in parallel (different files)
- **US3 (T030) can run in parallel with all of US1 and US2** — it touches only `src/i18n/catalogs.test.ts`
- T036, T037, T038 and T041 in parallel at the end

---

## Parallel Example: Foundational Phase

```bash
# Independent files, no shared state:
Task: "Write failing tests in src/i18n/locales.test.ts"
Task: "Create src/messages/en.json and src/messages/uk.json"

# After src/i18n/routing.ts lands:
Task: "Create src/i18n/navigation.ts"
Task: "Create src/i18n/request.ts"   # only after its failing test (T009)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1
2. **STOP and VALIDATE**: run `quickstart.md` Scenarios 1, 2 and 7
3. At this point the product is fully bilingual by address, with negotiation, correct redirect
   semantics, and `<html lang>`. It is deployable without a switcher

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. - US1 → **MVP**: served in the visitor's language
3. - US2 → the visitor can override and the choice sticks
4. - US3 → the guarantee is enforced, not just intended
5. - US4 → locale-dependent values read naturally

### Parallel Team Strategy

After Foundational completes: one person takes US1 then US2 (they share the layout file), a second
takes US3 immediately (it touches nothing the others do), and US4 follows US2.

---

## Notes

- 41 tasks. `[P]` means a different file with no incomplete dependency
- The one genuinely subtle task is **T013** — read research R2 before writing it; the obvious
  implementation (`localeCookie: false`) breaks cookie-based detection and would pass a careless review
- **Three test-first pairs, in this order**: T004→T005 (locale constant), T009→T010 (request resolution
  and fallback), T012→T013 (proxy). Principle IV requires the failing test to land in an earlier commit
  than its implementation — T041 checks that the history shows it
- **T003 is easy to skip and expensive to skip**: without it the parity test and proxy tests never
  run, and CI stays green while covering nothing
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
