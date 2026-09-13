# Implementation Plan: Theme Switching

**Branch**: `002-theme-switching` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-theme-switching/spec.md`

## Summary

Give the visitor a light/dark appearance that follows their operating system by default and a
single header button that pins the other one, remembered per browser and applied before the
browser's first paint.

The mechanism is `next-themes`, configured to drive the `.dark` class that `src/app/globals.css`
already defines. Its provider is mounted as the outermost element inside `<body>` in
`src/app/[locale]/layout.tsx`, which places its inline script ahead of every painted node; `<html>`
carries `suppressHydrationWarning` because that script mutates the element's `class` and
`style.colorScheme` before React hydrates. The control is a `Button` at `size="icon-sm"` rendering
both a sun and a moon, with the `dark:` variant choosing which one is visible — so the correct icon
is in the server HTML and no JavaScript is needed to make it right. No colour token changes, no
`process.env`, no server involvement, no change to the locale proxy.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), React 19.2.8, Next.js 16.3.0 (App Router, Turbopack)

**Primary Dependencies**: `next-themes@^0.4.6` (new), `lucide-react@^1.31.0` (existing),
`next-intl@^4.13.7` (existing), `@base-ui/react` via `src/components/ui/button.tsx` (existing)

**Storage**: Browser `localStorage`, one key. No database, no cookie, no server state.

**Testing**: Vitest (`ui` project, jsdom) for the component; Playwright (chromium) for end-to-end

**Target Platform**: Evergreen browsers, desktop and mobile

**Project Type**: Web application (Next.js App Router, single package)

**Performance Goals**: Correct appearance in the first painted frame; zero layout shift from the
control; appearance change applied within one frame of the click, with no reload

**Constraints**: No route may lose static prerendering. The preference never reaches the server.
The locale proxy (`src/proxy.ts`) and its `NEXT_LOCALE` handling are untouched. No colour token is
added or edited. No new `src/components/ui` primitive is vendored.

**Scale/Scope**: One new component folder, one new shared constants module, one layout edit, one
message key in two catalogs, one e2e spec. Roughly 150 lines of application code.

## Constitution Check

_GATE: evaluated before Phase 0 and re-evaluated after Phase 1. Constitution v1.3.0._

| Principle                           | Verdict                     | How this feature satisfies it                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Type-Safe by Default             | **PASS**                    | All new files are TypeScript. `next-themes` ships its own declarations (`dist/index.d.ts`), so no ambient shim and no `any` is needed. `src/lib/theme.ts` declares the stored vocabulary as a union and checks the default against it with `satisfies`, which validates without widening the literal. The control writes one of two string literals and its test pins that. No suppression is planned. |
| II. Simple, Modular, Readable       | **PASS**                    | One new component, composed from the existing `Button` primitive. `next-themes`' `ThemeProvider` is mounted directly in the layout with props — no wrapper component, no adapter layer, no context of our own. The control holds no business logic. The one deviation (a new runtime dependency) is recorded under Complexity Tracking.                                                                |
| III. Spec-First Delivery            | **PASS**                    | `spec.md` is written and clarified; this plan precedes implementation.                                                                                                                                                                                                                                                                                                                                 |
| IV. Tested Business Logic           | **PASS**                    | Test-together regime, with the per-module assignment below. No domain service, business rule, agent tool, Config code, or validation helper is touched, so nothing falls into the test-first regime.                                                                                                                                                                                                   |
| V. Centralized Config, Zero Secrets | **PASS**                    | No `process.env` read anywhere in this feature. The storage key and default preference are application constants in `src/lib/theme.ts`. `src/config/` and `.env.example` are unchanged — confirming FR-025. No secret is involved.                                                                                                                                                                     |
| VI. Accountable AI Agents           | **N/A**                     | No agent surface exists yet and none is added.                                                                                                                                                                                                                                                                                                                                                         |
| VII. Localized by Default           | **PASS**                    | The control's only string is a next-intl key shipped in `en` and `uk`. Types derive from the `en` catalog (`src/types/next-intl.d.ts`), so a missing key fails `npm run typecheck`; `src/i18n/catalogs.test.ts` fails on a gap in any other locale. No string is hardcoded, and none is theme-dependent.                                                                                               |
| Technology Constraints              | **PASS with justification** | `next-themes` is a new runtime dependency. Its justification is recorded under Complexity Tracking and evidenced in [research.md](./research.md). No second component library, no parallel styling system, no stack replacement.                                                                                                                                                                       |

### Test regime assignment (required by Principle IV)

| Module                                         | Regime              | Coverage                                                                                                                                                                        |
| ---------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/theme-toggle/theme-toggle.tsx` | Test-together (UI)  | `theme-toggle.test.tsx`, shipped in the same PR                                                                                                                                 |
| `src/app/[locale]/layout.tsx` (provider mount) | Test-together (e2e) | `e2e/theme-switching.spec.ts`                                                                                                                                                   |
| `src/lib/theme.ts`                             | Test-together       | Constants with no branching logic; exercised by both the component test and the e2e spec. No dedicated unit test — a type and two string constants have no behaviour to assert. |
| `src/messages/{en,uk}.json`                    | Existing gate       | `src/i18n/catalogs.test.ts` plus `npm run typecheck`                                                                                                                            |

### Post-Phase 1 re-check

Re-evaluated after the design artifacts below were written: **no verdict changed**. The design
introduced no additional dependency, no new `ui` primitive, no `process.env` read, no server-side
state, and no untyped boundary. The one recorded deviation is unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/002-theme-switching/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── theme-contract.md  # Phase 1 output — DOM, storage, and component contracts
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css                      # UNCHANGED — .dark block and custom variant used as-is
│   └── [locale]/
│       └── layout.tsx                   # EDIT — suppressHydrationWarning on <html>;
│                                        #        ThemeProvider outermost inside <body>;
│                                        #        ThemeToggle beside LocaleSwitcher in <header>
├── components/
│   ├── theme-toggle/                    # NEW — one folder per component
│   │   ├── theme-toggle.tsx
│   │   └── theme-toggle.test.tsx
│   ├── locale-switcher/                 # UNCHANGED — reference for trigger height only
│   └── ui/button.tsx                    # UNCHANGED — composed, not edited
├── lib/
│   └── theme.ts                         # NEW — storage key, default preference, vocabulary
├── messages/
│   ├── en.json                          # EDIT — theme.label
│   └── uk.json                          # EDIT — theme.label
├── config/                              # UNCHANGED (FR-025)
└── proxy.ts                             # UNCHANGED (FR-023)

e2e/
└── theme-switching.spec.ts              # NEW

package.json                             # EDIT — next-themes dependency
.env.example                             # UNCHANGED (FR-025)
```

**Structure Decision**: The existing single-package Next.js App Router layout is kept unchanged.
The control follows the project's one-folder-per-component rule at
`src/components/theme-toggle/`, with its test colocated and imported by file path rather than
through a barrel. `src/lib/theme.ts` exists because two independent callers need the same storage
key and default — the layout that configures the provider and the e2e spec that seeds and asserts
storage — which satisfies the "abstraction on the second real caller" rule in Principle II rather
than anticipating one.

## Key Design Decisions

Full reasoning and the evidence behind each is in [research.md](./research.md); the resulting
contracts are in [contracts/theme-contract.md](./contracts/theme-contract.md).

1. **Provider placement is load-bearing, not cosmetic.** `next-themes@0.4.6` exports only
   `ThemeProvider` and `useTheme` — there is no separate script export that could be placed in
   `<head>`. The provider renders its inline script immediately before its children, so it must be
   the outermost element inside `<body>`, ahead of `NextIntlClientProvider` and the header. Moving
   it deeper would leave painted nodes before the script and reintroduce the flash FR-020 forbids.
2. **The control never reads the theme during render.** On the server `resolvedTheme` is
   `undefined`; on the client it is `"light"` or `"dark"`. Any render output derived from it would
   mismatch on hydration and flash. The component therefore renders both icons unconditionally with
   a static `aria-label`, and reads `resolvedTheme` only inside the click handler — which is what
   simultaneously delivers FR-011, FR-012 and FR-013.
3. **The icon swap is pure CSS.** `dark:hidden` on the sun and `hidden dark:block` on the moon, both
   at the same box size. The correct icon is in the server HTML the moment the inline script has set
   the class, so there is no mounted-check placeholder and no reflow.
4. **`enableColorScheme` stays at its default (`true`)**, which is what satisfies FR-021 — the
   library sets `documentElement.style.colorScheme` in both the inline script and the effect.
5. **`disableTransitionOnChange` stays `false`.** Suppressing transitions is explicitly out of scope
   and nothing currently transitions colour.

## Complexity Tracking

| Violation                                    | Why Needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New runtime dependency: `next-themes@^0.4.6` | Resolves a three-state preference against the OS setting before first paint, and keeps it correct afterwards: an inline pre-paint script, `localStorage` reads and writes each wrapped so a blocked store cannot throw, a `prefers-color-scheme` listener for live OS following, a `storage` listener for cross-tab convergence, `documentElement.style.colorScheme`, and re-application of the class after React's Strict Mode dev remount. Cost is bounded and measured: 33,783 bytes unpacked, **zero runtime dependencies**, React 19 in its peer range, its own TypeScript declarations. The exit path is one provider and one hook. | Hand-rolling the inline script per Next 16's own "Preventing Flash" guide. The guide documents the technique but stops at the parts that are cheap; every requirement in this spec beyond "read a key and set an attribute" is left to us — FR-005 (live OS following), FR-017 (cross-tab), FR-018 (blocked storage on read _and_ write), FR-021 (`color-scheme`), and the Strict Mode remount the guide itself calls out and then hands back with "one way to fix this is…". Building and testing those five behaviours ourselves costs materially more than 34 KB, and each is a place where a subtle bug shows up as a flash on a partner's customer's screen rather than as a failing test. |

## Risks and How They Are Handled

| Risk                                                                                                                                             | Handling                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-020 (no flash) and FR-023 (no lost prerendering) have no automated guard — the paint-timing assertion is out of scope by decision.            | **Manual gate, named here so it is not forgotten.** Reviewer runs `npm run build` and confirms every `/[locale]` route is still marked as prerendered static content in the build output, then loads a route with the OS set to dark, with and without a stored preference, and confirms no light frame. Recorded in [quickstart.md](./quickstart.md) as the review checklist. |
| Cross-tab convergence (FR-017) depends on the `storage` event firing between two pages of one Playwright context, which can be timing-sensitive. | Assert with `expect.poll` / web-first assertions rather than a bare read, so the test waits for convergence instead of racing it.                                                                                                                                                                                                                                              |
| `attribute="class"` makes the library add a `light` class as well as removing/adding `dark`.                                                     | Harmless — `globals.css` defines no `.light` rules. All assertions target the presence or absence of `dark` specifically, never an exact class list.                                                                                                                                                                                                                           |
| jsdom does not implement `window.matchMedia`, which `next-themes` calls on mount.                                                                | The component test mocks `next-themes`' `useTheme` — matching how `locale-switcher.test.tsx` already mocks `next-intl` and `@/i18n/navigation` — so no provider runs in jsdom and no stub is needed. Real provider behaviour is covered end-to-end instead.                                                                                                                    |

## Artifacts

- [research.md](./research.md) — Phase 0: dependency evidence and the six resolved unknowns
- [data-model.md](./data-model.md) — Phase 1: preference and resolved-appearance model, states, transitions
- [contracts/theme-contract.md](./contracts/theme-contract.md) — Phase 1: DOM, storage, component, and message contracts
- [quickstart.md](./quickstart.md) — Phase 1: how to run and validate the feature, including the manual review gate
