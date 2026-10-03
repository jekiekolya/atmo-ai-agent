# Implementation Plan: Atmo AI Brand Look

**Branch**: `005-atmo-brand` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-atmo-brand/spec.md`

## Summary

The theme blocks in `src/app/globals.css` are rewritten in opaque hex:

- **Light**: the reference's measured grays.
- **Dark**: the same scale, mirrored.
- **Brand red**: a new `--brand-mark` token, used only by the logo and the loader (R2).
- **Radius**: 8px.

Destructive keeps its hue and is darkened to red-700 in the light theme. The tints behind destructive
text are held to 15% in the button, badge and dropdown-menu primitives, so every state meets AA (R3).
A Vitest test reads the theme file and asserts every contrast pair in both themes (R4).

Roboto replaces Geist through `next/font/google`: variable, Latin and Cyrillic, `display: "optional"`,
which guarantees no shift (R5).

**Logo.** "atmo AI" is one SVG asset: the reference wordmark plus a hand-drawn "AI" in the reference's
letter geometry (R7). Its colours are theme hooks: `var(--brand-mark)`, `currentColor` and
`var(--background)`. `BrandLogo` draws it through `<use>` of Next's static import, so the asset follows
the product's theme and sets its own aspect ratio (R6, verified in Chromium). It appears in two places:

- in a new `logo` slot at the start of the signed-in header, as a link to the dashboard;
- centred above the sign-in and invite cards (R8).

**Product name.** Page titles take "— Atmo AI" from one localized title template (R9).

**Icons.** `icon.svg` is the "a" mark on an opaque light tile. `favicon.ico` and `apple-icon.png` are
generated from it once by a script and committed (R10).

**Loader.** `PageLoader` is a client component: a `role="status"` region that fills with the
self-drawing mark and a localized label after 300ms, and holds still under reduced motion (R12).
`loading.tsx` files render it:

- one beside every signed-in page, below the layout's session check — the installed router shows a
  loading state only for a segment with its own (R11, corrected in implementation);
- one under `(public)/invite/[token]`.

Sign-in gets none, so its redirect stays a real 307 (R11, planning clarification).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node ≥ 22.12

**Primary Dependencies**: All already present.

- Next.js 16.3.0: `next/font/google`, the metadata file conventions, `loading.js`, static image import.
- Tailwind CSS 4.3.3: `@theme` animations, the `motion-reduce` variant.
- next-intl 4.13.7.
- `@playwright/test` 1.62.1 and `tsx`, as dev tools for icon rasterization.

No new dependency (R14).

**Storage**: N/A — no schema or migration.

**Testing**:

- Vitest `unit`: the theme contrast test.
- Vitest `ui`: `BrandLogo`, `PageLoader`, `AppShell`. It gains an inline SVG static-import shim (R6).
- Playwright: `e2e/brand.spec.ts`.

**Target Platform**: Evergreen browsers. Chromium is automated. WebKit is checked by hand for the
`<use>` logo (R6, quickstart step 7).

**Project Type**: Next.js App Router web application, single project.

**Performance Goals**:

- Fonts: one variable font file per subset, preloaded.
- Logo: one cached, hashed SVG, shared by every placement.
- Fast navigations never paint the loader.

**Constraints**:

- WCAG AA in both themes for text, at rest, on hover and on focus.
- 3:1 for focus indicators and the loader mark.
- No font shift.
- No full-screen overlay.
- No Suspense boundary above any check that can redirect.
- en/uk parity.
- Brand red only in brand marks.

**Scale/Scope**: About 25 files touched:

- 1 theme file;
- 3 primitives;
- 2 layouts and 2 pages;
- 2 new components and 4 `loading.tsx` files;
- 3 icon files and 1 logo asset;
- 1 script;
- 2 catalogs;
- tests.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Status | How                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Type-Safe by Default**       | PASS   | Next types `*.svg` imports as `any`. The import is narrowed once to `StaticImageData`, with a one-line reason (R6). `PageLoader` and `BrandLogo` have typed props.                                                                                                                                                                                                        |
| **II. Simple, Modular, Readable** | PASS   | Two small components, each with one job and at least two callers. Primitives are edited in place, three classes each, as the constitution prescribes for customization. No wrapper and no shared auth layout (R8). The contrast helper stays in its only caller.                                                                                                          |
| **III. Spec-First Delivery**      | PASS   | Spec 005 is clarified. Planning findings were amended into it before this plan: FR-006, FR-010, FR-013 and FR-030, with a planning clarification session. Spec 002's FR-022 gets a pointer (R15).                                                                                                                                                                         |
| **IV. Tested Business Logic**     | PASS   | No domain, config or validation module is touched, so everything is test-together (table below). The contrast test turns FR-006 into a merge gate.                                                                                                                                                                                                                        |
| **V. Centralized Config**         | PASS   | No configuration. The Vitest shim and `scripts/brand-icons.ts` are tooling and read no `process.env`.                                                                                                                                                                                                                                                                     |
| **VI. Accountable AI Agents**     | N/A    | No agent code.                                                                                                                                                                                                                                                                                                                                                            |
| **VII. Localized by Default**     | PASS   | New keys `common.titleTemplate` and `loader.label` exist in en and uk. The logo name reuses `common.appName`. No hardcoded copy.                                                                                                                                                                                                                                          |
| **Technology Constraints**        | PASS   | No new dependency. The brand red is a theme token. Its literals live only in the icon files, which the browser draws outside the page (FR-010 as amended), and as `var()` fallbacks inside the logo asset. Each library was checked against the installed version — two logo mechanisms were tried and rejected by measurement (R6). No patch, no undocumented internals. |

Post-design re-check: unchanged, all PASS.

### Test regime per module (Principle IV)

| Module                                                                                          | Regime        | Covered by                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/globals.css` theme values                                                              | Test-together | `src/lib/theme-contrast.test.ts`: every pair in data-model, both themes, light/dark token parity (R4)                                                             |
| Brand-red placement (FR-011, FR-012)                                                            | Test-together | `src/lib/brand-mark-usage.test.ts`: `brand-mark` / `#c02444` appear only in the four allowed files                                                                |
| `ui/button.tsx`, `ui/badge.tsx`, `ui/dropdown-menu.tsx` tints                                   | Test-together | `theme-contrast.test.ts` asserts the `/10`/`/15` pairs and scans the three files so every `bg-destructive/NN` is ≤ 15; the existing `button.test.tsx` stays green |
| `brand-logo/` (new)                                                                             | Test-together | `brand-logo.test.tsx`: `role="img"`, the localized name, `viewBox` from the asset, `use` href                                                                     |
| `app-shell/` (`logo` slot)                                                                      | Test-together | `app-shell.test.tsx`: the logo is the header's first child when given and absent otherwise                                                                        |
| `page-loader/` (new)                                                                            | Test-together | `page-loader.test.tsx`, with fake timers: empty status before 300ms, mark and label after, timer cleared on unmount                                               |
| `[locale]/layout.tsx`, `(private)/layout.tsx`, sign-in, invite, `loading.tsx` ×4, icons, titles | Test-together | `e2e/brand.spec.ts` (R13), plus the existing `auth.spec.ts` and `session.spec.ts` unchanged                                                                       |
| Catalogs                                                                                        | Test-together | existing parity check in `src/i18n/catalogs.test.ts`, plus a new case: "Atmo" only as "Atmo AI", the name only in the title template (SC-005)                     |
| `scripts/brand-icons.ts`                                                                        | —             | Tooling, run once. Its outputs are checked by the e2e icon test and by eye (quickstart)                                                                           |

## Project Structure

### Documentation (this feature)

```text
specs/005-atmo-brand/
├── plan.md                   # this file
├── research.md               # R1–R15
├── data-model.md             # theme values, contrast pairs, assets, catalog keys
├── quickstart.md             # automated + by-hand validation
├── contracts/
│   ├── ui.md                 # BrandLogo, AppShell slot, PageLoader, head, HTTP invariants
│   └── brand-assets.md       # what a designer's replacement logo must be
├── checklists/requirements.md
└── tasks.md                  # /speckit-tasks
```

### Source Code (repository root)

```text
src/app/
├── globals.css                          # hex tokens, --brand-mark, radius, loader keyframes, outline-ring
├── favicon.ico                          # REPLACED — "a" mark, 16/32/48 (generated)
├── icon.svg                             # NEW — vector "a" mark on a light tile
├── apple-icon.png                       # NEW — 180×180, opaque (generated)
└── [locale]/
    ├── layout.tsx                       # Roboto replaces Geist; title template
    ├── (private)/layout.tsx             # passes the linked compact logo to AppShell
    ├── (private)/dashboard/loading.tsx  # NEW — <PageLoader/>, below the session check
    ├── (private)/dashboard/users/loading.tsx    # NEW — one per signed-in page (R11)
    ├── (private)/dashboard/account/loading.tsx  # NEW
    ├── (public)/sign-in/page.tsx        # logo above the card; no loading.tsx here
    ├── (public)/invite/[token]/page.tsx # logo above the card
    └── (public)/invite/[token]/loading.tsx  # NEW — <PageLoader/>

src/components/
├── brand-logo/                          # NEW
│   ├── atmo-ai-logo.svg                 # the one logo asset (contract: brand-assets.md)
│   ├── brand-logo.tsx
│   └── brand-logo.test.tsx
├── page-loader/                         # NEW
│   ├── page-loader.tsx
│   └── page-loader.test.tsx
├── app-shell/app-shell.tsx              # + logo slot
├── app-shell/app-shell.test.tsx
└── ui/button.tsx, ui/badge.tsx, ui/dropdown-menu.tsx   # destructive tints ≤ /15

src/lib/theme-contrast.test.ts           # NEW — FR-006/FR-007/FR-043
src/lib/brand-mark-usage.test.ts         # NEW — FR-011/FR-012
src/lib/loading-boundaries.test.ts       # NEW — FR-030/FR-036/FR-038 (R11)
src/messages/en.json, uk.json            # Atmo AI, title template, loader label
scripts/brand-icons.ts                   # NEW — rasterizes icon.svg into favicon.ico + apple-icon.png
vitest.config.mts                        # ui project: SVG static-import shim
e2e/brand.spec.ts                        # NEW
specs/002-theme-switching/spec.md        # FR-022 → pointer to 005
```

**Structure Decision**: The new components follow the one-folder-per-component rule. The logo asset
sits beside the only component that draws it, so the swap in FR-020 is a change to one file in one
folder. The icons live in `src/app/` because the metadata file conventions read them only from there.

## Complexity Tracking

No violations to justify.

## Phase Status

- [x] Phase 0 — research.md (no NEEDS CLARIFICATION left)
- [x] Phase 1 — data-model.md, contracts/ui.md, contracts/brand-assets.md, quickstart.md
- [ ] Phase 2 — tasks.md (`/speckit-tasks`)
