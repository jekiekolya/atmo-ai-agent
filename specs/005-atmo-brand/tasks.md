---
description: "Task list for Atmo AI Brand Look"
---

# Tasks: Atmo AI Brand Look

**Input**: Design documents from `/specs/005-atmo-brand/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui.md](./contracts/ui.md),
[contracts/brand-assets.md](./contracts/brand-assets.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The spec asks for them (FR-042, FR-043), and so does the constitution
(Principle IV). Every module here is test-together (plan.md § Test regime): a test ships in the same
change as what it covers. The contrast test (T004) is still written before the palette, because it
fails on today's values and so proves it can fail.

**Organization**: Tasks are grouped by the spec's user stories:

- US1 — palette and typeface (P1);
- US2 — logo and product name (P1);
- US3 — tab and touch icons (P2);
- US4 — page loader (P3).

The brand-red token is foundational: both the logo (US2) and the loader (US4) draw with it.

**Reference assets**: my.atmo.pro's chain fails `curl` verification, though its certificate is valid
(research R1). Fetch the public files with `curl -ksSL -A "Mozilla/5.0" <url>`:

- `https://my.atmo.pro/static/logos/dark-outline.svg` — the logo;
- `https://my.atmo.pro/login` — the inline preloader SVG, inside `<div id="app-preloader">`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 – US4)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Add an SVG static-import shim to the `ui` project in `vitest.config.mts` (research R6). It is
      an inline plugin object in that project's `plugins` array, beside `tsconfigPaths()` and `react()`:
  - `name: "next-static-svg"`, `enforce: "pre"`;
  - a `load(id)` hook that, for an `id` ending in `.svg` with the query stripped:
    - reads the file with `node:fs`;
    - takes `width` and `height` from the root `<svg>` attributes, falling back to the third and
      fourth `viewBox` numbers;
    - returns `export default ${JSON.stringify({ src: "/" + basename(id), width, height })}`.

  Mirror what Next returns. Add no dependency and read no `process.env`. Run `npm run test:run` and
  confirm the existing `ui` tests still pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add the brand-red token to `src/app/globals.css` (data-model § Theme values, FR-010):
  - `--brand-mark: #c02444;` in both `:root` and `.dark`;
  - `--color-brand-mark: var(--brand-mark);` in `@theme inline`.

  Change nothing else in `globals.css`. US1 rewrites the rest of the file.

  In the same task, write `src/lib/brand-mark-usage.test.ts` (FR-011, FR-012, SC-003). It walks `src/`
  for `.ts`, `.tsx`, `.css`, `.svg` and `.json` files, skipping `*.test.*`. It fails, naming the file,
  when `brand-mark` or `#c02444` (case-insensitive) appears outside these four:
  - `src/app/globals.css`;
  - `src/app/icon.svg`;
  - `src/components/brand-logo/atmo-ai-logo.svg`;
  - `src/components/page-loader/page-loader.tsx`.

  It passes now, because only `globals.css` uses them.

**Checkpoint**: `stroke-brand-mark` / `fill-brand-mark` utilities exist. Stories can start.

---

## Phase 3: User Story 1 — The product looks like it belongs with my.atmo.pro (Priority: P1) 🎯 MVP

**Goal**: The reference's gray scale in the light theme, its mirror in the dark theme, 8px radius,
Roboto in Latin and Cyrillic, AA contrast in every state.

**Independent Test**: `npm run test:run` passes `theme-contrast.test.ts`. In the browser, light shows
`#F9FAFB` page, white cards, `#111827` text and buttons; dark shows gray-950 / gray-900 / gray-50; the
typeface is Roboto in both locales; no text moves while it loads.

- [x] T003 [US1] Write `src/lib/theme-contrast.test.ts` (research R4, data-model § Contrast pairs). It
      picks up automatically, because the `unit` project includes `src/lib/**/*.test.ts`.
  - **Parsing**: read `src/app/globals.css` with `node:fs` from `process.cwd()`. Parse the `:root { … }`
    and `.dark { … }` blocks into `Record<string, string>` maps of the `--name: #rrggbb;` declarations.
    A colour token that is not a six-digit hex fails with its name.
  - **Helpers, in the test file**: WCAG 2.x relative luminance and contrast ratio, and
    `over(fg, alpha, bg)`, which composites per channel in sRGB.
  - **Assertions**: one `it` per data-model pair and theme, named after the pair, for example
    `"light: destructive on destructive/15 over popover ≥ 4.5"`. Each composites translucent surfaces
    over the named surface and asserts the minimum (4.5 for text, 3.0 for `ring` and `brand-mark`).
  - **Parity**: every token in `:root` exists in `.dark` and vice versa. `--radius` is the one
    exception: it lives in `:root` only.
  - **Excluded pair**: record it as a one-line comment with its reason — `muted-foreground` on solid
    `muted`, rendered nowhere today (research R2).
  - **Tints in the primitives** (FR-006, data-model § Destructive tints): read
    `src/components/ui/button.tsx`, `badge.tsx` and `dropdown-menu.tsx`. Collect every
    `bg-destructive/NN`, with whatever variant prefix it carries (`hover:`, `dark:`, `focus:`, `[a]:`,
    `data-[…]:`). Assert each NN ≤ 15, naming the file and the class. The pairs above are computed at
    `/10` and `/15`, so this is what ties them to the classes actually shipped.

  Run it and confirm it FAILS on the current code: today's theme values are `oklch(…)`, not hex, and
  fail the parse, and the primitives still use `/20` and `/30`. Keep it failing until T004 and T005.

- [x] T004 [US1] Rewrite the theme values in `src/app/globals.css` (data-model § Theme values,
      research R2):
  - **Values**: every `:root` and `.dark` value becomes the hex in the data-model table, including
    chart and sidebar; `--radius: 0.5rem`.
  - **Base layer**: `outline-ring/50` becomes `outline-ring`.
  - **Leave alone**: the `@theme inline` colour mappings and the radius scale.
  - **Fonts**: in `@theme inline`, set `--font-sans: var(--font-roboto);` and delete the `--font-mono`
    line (research R5).

  Run T003's test. Every colour pair now passes. The primitive-tint check still fails until T005.

- [x] T005 [US1] Lower the destructive tints in three primitives, edited in place (research R3,
      data-model § Destructive tints). Change only these classes:
  - `src/components/ui/button.tsx`, the `destructive` variant:
    - `hover:bg-destructive/20` → `hover:bg-destructive/15`;
    - `dark:bg-destructive/20` → `dark:bg-destructive/10`;
    - `dark:hover:bg-destructive/30` → `dark:hover:bg-destructive/15`;
    - `focus-visible:border-destructive/40` → `focus-visible:border-destructive` (FR-007, analysis
      clarification).
  - `src/components/ui/badge.tsx`, the `destructive` variant:
    - `dark:bg-destructive/20` → `dark:bg-destructive/10`;
    - `[a]:hover:bg-destructive/20` → `[a]:hover:bg-destructive/15`.
  - `src/components/ui/dropdown-menu.tsx`, the item:
    - `dark:data-[variant=destructive]:focus:bg-destructive/20` → `…/15`.

  The `ring-destructive/…` focus halos stay as they are. Menu and select items keep their `bg-accent`
  focus highlight (FR-007). Run `npm run test:run`: T003's test and
  `src/components/ui/button.test.tsx` both pass.

- [x] T006 [US1] Replace Geist with Roboto in `src/app/[locale]/layout.tsx` (research R5):
  - Import `Roboto` from `next/font/google` and remove both Geist imports and their instances.
  - Create `const roboto = Roboto({ subsets: ["latin", "cyrillic"], display: "optional", variable:
"--font-roboto" })`. Pass no `weight`: the variable font covers 400, 500 and 700.
  - Set `<html>`'s `className` to `` `${roboto.variable} h-full antialiased` ``.

  Check against `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` that the
  options are as written.

- [x] T007 [US1] Create `e2e/brand.spec.ts` with a `test.describe("theme and typeface (US1)")` block.
      Use page tests on `/en/sign-in`:
  - **Light** (`colorScheme: "light"`): the computed `background-color` of `body` is
    `rgb(249, 250, 251)`, and the card's (`[data-slot=card]`) is `rgb(255, 255, 255)`.
  - **Dark**: click the theme control (name "Switch between light and dark"). `body` becomes
    `rgb(3, 7, 18)` and the card `rgb(17, 24, 39)`.
  - **Typeface**: `getComputedStyle(document.body).fontFamily` contains `Roboto` (next/font names the
    family `Roboto` or `'Roboto'` plus a fallback). Check `/uk/sign-in` too.
  - **Self-hosted font (FR-016)**: while both pages load, record `page.on("request")`. Assert that no
    request goes to `fonts.googleapis.com` or `fonts.gstatic.com`.

  Run `npm run e2e -- e2e/brand.spec.ts`.

**Checkpoint**: US1 is shippable on its own: the palette, the typeface and AA are in place.

---

## Phase 4: User Story 2 — The product carries its own name and logo (Priority: P1)

**Goal**: The "atmo AI" asset, the compact linked logo in the signed-in header, the centred logo on
sign-in and invite, and "Atmo AI" in every title and self-reference.

**Independent Test**: Sign in and see the logo first in the header, linking to the dashboard, named
"Atmo AI". The public header has none. Sign-in and invite show it centred above the card. Every title
ends in "— Atmo AI" in en and uk. Pin dark: the pill turns light.

- [x] T008 [P] [US2] Draw `src/components/brand-logo/atmo-ai-logo.svg` (research R7,
      contracts/brand-assets.md).
  - **Start from the reference** `dark-outline.svg`, fetched as above. Keep the wordmark `<g>`, its
    mask, and the `clip0_…` clipPath byte for byte, except the wordmark path's `fill="#C02444"`,
    which becomes `style="fill: var(--brand-mark, #C02444)"`.
  - **Root**: `id="logo"`, with `width`, `height` and `viewBox="0 0 W 47"`, where W ≈ 148 — the pill's
    right edge plus its 1.5 stroke, plus about 1.
  - **Pill**: the reference pill path, with its right side moved left so it spans x 104.388 →
    ≈ 145.54, keeping the corner arcs. Set `fill="currentColor" stroke="currentColor"
stroke-width="3"`.
  - **Letters**: delete "P", "R" and "O". Draw "A" and "I" as paths, each with
    `style="fill: var(--background, #FFFFFF)"`, from the measured geometry: cap height y 11.255 →
    37.025, stem 4.054.
    - **"I"**: a rectangle at x ≈ 135.2–139.25.
    - **"A"**: starts at x 110.529, ≈ 20.3 wide. Two legs 4.054 thick meet at a flat apex, one stem
      wide, which matches the squared terminals of "P", "R" and "O". A crossbar 4.054 thick sits at
      y ≈ 23.8–27.6.
  - **Check**: open the file in a browser at 400% and compare the letter weight with the reference's
    "PRO". Follow every rule in contracts/brand-assets.md: no `<style>` block, no external reference.
- [x] T009 [US2] Create `src/components/brand-logo/brand-logo.tsx` (contracts/ui.md § BrandLogo,
      research R6). Depends on T001, T008.
  - **Asset import**: `import logoAsset from "./atmo-ai-logo.svg";` then
    `const logo: StaticImageData = logoAsset;`, with a one-line comment that Next types SVG imports as
    `any` for SVGR's sake. `StaticImageData` is from `next/image`.
  - **Signature**: `export function BrandLogo({ className }: { className?: string })`. It calls
    `useTranslations("common")` and returns
    `<svg role="img" aria-label={t("appName")} viewBox={`0 0 ${logo.width} ${logo.height}`} className={cn("text-foreground", className)}><use href={`${logo.src}#logo`} /></svg>`.
  - **No `"use client"`**: it must render in server components and inside a client `Link`.
- [x] T010 [US2] Write `src/components/brand-logo/brand-logo.test.tsx`. Use
      `vi.mock("next-intl", () => import("@/testing/next-intl-mock"))` and assert:
  - `getByRole("img", { name: "common.appName" })`;
  - the `viewBox` equals `0 0 {width} {height}` of the real asset, as the T001 shim reads it;
  - the `<use>` `href` ends with `atmo-ai-logo.svg#logo`;
  - `className` is merged.

  Depends on T009.

- [x] T011 [P] [US2] Add the `logo?: ReactNode` slot to `src/components/app-shell/app-shell.tsx`
      (contracts/ui.md § AppShell).
  - Render it as the header's first child, in a `shrink-0 flex items-center` wrapper.
  - The nav keeps `order-last w-full` on narrow screens and `sm:order-0`, so on mobile the logo and
    controls share row 1.
  - In `app-shell.test.tsx`, extend the first test to pass `logo={<a href="/x">logo</a>}` and assert
    the banner's first element child contains it. Extend the second test to assert no link renders
    when `logo` is omitted.
- [x] T012 [US2] Pass the linked compact logo from `src/app/[locale]/(private)/layout.tsx`:
      `logo={<Link href="/dashboard" className="rounded-sm"><BrandLogo className="h-6 w-auto" /></Link>}`,
      using `Link` from `@/i18n/navigation` (FR-021, FR-022). Depends on T009, T011.
- [x] T013 [P] [US2] Add the large logo to `src/app/[locale]/(public)/sign-in/page.tsx` and
      `src/app/[locale]/(public)/invite/[token]/page.tsx`. In each page's outer
      `flex flex-col gap-4` column, render `<BrandLogo className="mx-auto h-10 w-auto" />` as the
      first child, before the notice and the card (FR-024). Depends on T009.
- [x] T014 [P] [US2] Rename the product in `src/messages/en.json` and `src/messages/uk.json`
      (data-model § Catalog changes, FR-025, FR-026, SC-005).

  First add an `it` to `src/i18n/catalogs.test.ts`: "names the product Atmo AI, once per title".
  For every locale it asserts:
  - no message contains `Atmo` that is not followed by ` AI`;
  - `common.titleTemplate` ends with `— Atmo AI` and contains `%s`;
  - no `*.metaTitle` key other than `common.metaTitle` contains `Atmo`, because the template supplies
    the name.

  Run it and see it fail on today's catalogs. Then make these edits:
  - `common.appName` → "Atmo AI".
  - `common.metaTitle` → "Atmo AI — solar support" / "Atmo AI — підтримка сонячної енергетики".
  - New `common.titleTemplate`: "%s — Atmo AI" in both.
  - Drop the " — Atmo" suffix from `auth.signIn.metaTitle`, `dashboard.metaTitle`,
    `invite.metaTitle`, `users.metaTitle` and `account.metaTitle`.
  - `auth.signIn.description` → "…your Atmo AI account." / "…облікового запису Atmo AI."

  Run `npm run test:run`: the new catalog test passes.

- [x] T015 [US2] Use the title template in `src/app/[locale]/layout.tsx`'s `generateMetadata`:
      `title: { template: t("titleTemplate"), default: t("metaTitle") }` (research R9). Depends on T014.
- [x] T016 [US2] Add `test.describe("logo and name (US2)")` to `e2e/brand.spec.ts`
      (contracts/ui.md). Depends on T012, T013, T015.
  - **Signed in** (`signedInAsOwner(browser)` from `e2e/support/sign-in.ts`): within
    `getByRole("banner")`, the first link is `getByRole("link", { name: "Atmo AI" })` with
    `href="/en/dashboard"`. From `/en/dashboard/account`, clicking it lands on `/en/dashboard`.
  - **Public**: on `/en/sign-in`, the banner has no `img` named "Atmo AI". The page has one
    `img` named "Atmo AI", outside any link, positioned above the `h1`. The image has no `tabindex`,
    and pressing Tab from the top of the page never focuses it (FR-024). Do the same on `/en/invite/`
    plus 43 `A` characters, which renders the invalid-link card.
  - **Titles**: `toHaveTitle("Sign in — Atmo AI")` on `/en/sign-in`, `"Вхід — Atmo AI"` on
    `/uk/sign-in`, and `"Home — Atmo AI"` after sign-in.
  - **Theme**: with the dark theme pinned through the control, the logo `svg`'s computed `color` is
    `rgb(249, 250, 251)`; in light it is `rgb(17, 24, 39)`.

  Run the spec.

**Checkpoint**: US2 is shippable together with US1 — the identity is complete.

---

## Phase 5: User Story 3 — The browser tab shows the Atmo mark (Priority: P2)

**Goal**: The reference "a" mark as the tab icon, legible on light and dark tab strips, plus an opaque
Apple touch icon.

**Independent Test**: The head declares `/favicon.ico`, `/icon.svg` and `/apple-icon.png`. All three
answer 200 unprefixed. By eye, the tab reads on both a light and a dark browser theme.

- [x] T017 [P] [US3] Create `src/app/icon.svg` (research R10), with `width="64" height="64"
viewBox="0 0 64 64"`, from the reference preloader's two paths (login page,
      `#app-preloader svg`):
  - **Outer** rounded-square path: `fill="#F3F4F6" stroke="#111827" stroke-width="4"`. The
    reference path sits 1.22 from the edge, sized for a stroke of 2. Wrap it in
    `<g transform="translate(32 32) scale(0.97) translate(-32 -32)">` so the wider stroke stays inside
    the 64 box: the edge moves to ≈ 2.1, just over half the stroke. Keep the "a" unscaled.
  - **Inner "a"** path: `fill="#C02444" fill-rule="evenodd" clip-rule="evenodd"`, with no stroke.

  Open it at 16px and 32px in a browser and confirm the outline and the "a" stay distinct.

- [x] T018 [US3] Write `scripts/brand-icons.ts`, run as `npx tsx scripts/brand-icons.ts` (research
      R10). Depends on T017.
  - **Rasterize**: with `chromium` from `@playwright/test`, open a page whose content is
    `src/app/icon.svg`. Screenshot it at 16, 32 and 48 px with `omitBackground: true`. For 180 px,
    draw the SVG at 75% centred on an opaque `#F9FAFB` square.
  - **Write**: `src/app/favicon.ico` as an ICO container — a 6-byte header, a 16-byte directory entry
    per image, then the PNG payloads. Write `src/app/apple-icon.png` as the 180 PNG.
  - Read no `process.env`. One comment line at the top says how to run it and when: after `icon.svg`
    changes.

  Run it and keep both outputs in the tree; they ship with the feature. `file src/app/favicon.ico` reports 3 icons, and
  `file src/app/apple-icon.png` reports 180 x 180.

- [x] T019 [US3] Add `test.describe("tab and touch icons (US3)")` to `e2e/brand.spec.ts` (contracts/ui.md
      § Document head). Depends on T018.
  - On `/en/sign-in`, `link[rel="icon"]` includes an `href` starting `/icon.svg` with
    `type="image/svg+xml"`, and one equal to `/favicon.ico`.
  - `link[rel="apple-touch-icon"]` has an `href` starting `/apple-icon.png` and `sizes="180x180"`.
  - `request.get` on each of the three `href`s, with `maxRedirects: 0`, returns 200 with
    `image/svg+xml`, `image/x-icon` (or `image/vnd.microsoft.icon`) and `image/png` respectively —
    no locale redirect (FR-029).

**Checkpoint**: US3 is shippable on its own.

---

## Phase 6: User Story 4 — A slow page shows the brand mark drawing itself (Priority: P3)

**Goal**: After about 300ms of waiting, the content area under the header shows the self-drawing "a"
with a localized loading status. It is still under reduced motion. It never sits above a check that
can redirect.

**Independent Test**: A navigation delayed by over a second shows the status "Loading…" under a
visible header, then the page. Reduced motion stops the animation. A revoked cookie still gets a 307.
Sign-in has no loader.

- [x] T020 [P] [US4] Add `loader.label` to `src/messages/en.json` ("Loading…") and
      `src/messages/uk.json` ("Завантаження…"). Use the single-character ellipsis, as the catalogs
      already do (`"Signing in…"`).
- [x] T021 [P] [US4] Add the loader animation to `src/app/globals.css` (research R12, R1). In a `@theme`
      block (not `inline`):
  - `--animate-loader-outer: loader-outer 1.4s linear infinite;`;
  - `--animate-loader-inner: loader-inner 1.4s linear infinite;`;
  - `@keyframes loader-outer`: `stroke-dashoffset` 220 → 100 (50%) → 0;
  - `@keyframes loader-inner`: 180 → 90 (50%) → 0.

  Check the `@theme` animation syntax against the installed `node_modules/tailwindcss/theme.css`,
  where `--animate-spin` and `@keyframes spin` are defined.

- [x] T022 [US4] Create `src/components/page-loader/page-loader.tsx`, a client component with no props
      (contracts/ui.md § PageLoader). Depends on T002, T020, T021.
  - **State**: `useState(false)` for `visible`. A `useEffect` sets
    `setTimeout(() => setVisible(true), 300)` and clears it on unmount. Name the delay
    `const REVEAL_DELAY_MS = 300`.
  - **Region**: `<div role="status" className="flex justify-center px-4 py-24">` is always rendered. It uses
    standard spacing utilities only, with no arbitrary values, so the mark sits centred below the header
    without depending on the layout of `<main>` (constitution, Technology Constraints).
  - **Content**, when `visible`:
    - `<svg aria-hidden="true" viewBox="0 0 64 64" className="size-16" fill="none" strokeWidth={2}>`;
    - the outer path from `src/app/icon.svg` (same `d`), with
      `className="stroke-current text-foreground [stroke-dasharray:230] [stroke-dashoffset:230] animate-loader-outer motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"`;
    - the inner path, with
      `className="stroke-brand-mark [stroke-dasharray:200] [stroke-dashoffset:200] animate-loader-inner motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"`;
    - `<span className="sr-only">{t("label")}</span>` from `useTranslations("loader")`.
- [x] T023 [US4] Write `src/components/page-loader/page-loader.test.tsx` with `vi.useFakeTimers()` and
      the next-intl mock. Depends on T022.
  - **Before**: right after render, `getByRole("status")` exists and is empty.
  - **299ms**: after `act(() => vi.advanceTimersByTime(299))`, it is still empty.
  - **300ms**: after 1 ms more, it contains the text `loader.label` and one `svg[aria-hidden="true"]`
    with two paths.
  - **Unmount**: unmounting before 300ms leaves no pending timer (`vi.getTimerCount()` is 0).
- [x] T024 [P] [US4] Create `loading.tsx` beside every signed-in page —
      `src/app/[locale]/(private)/dashboard/`, `…/dashboard/users/`, `…/dashboard/account/` — and
      `src/app/[locale]/(public)/invite/[token]/loading.tsx` (research R11, corrected in
      implementation: one file at `dashboard/` showed nothing between dashboard pages). Each
      default-exports a component returning `<PageLoader />`. Guard the placement with
      `src/lib/loading-boundaries.test.ts`. Add **no** `loading.tsx` in `(private)/`, `(public)/`,
      `(public)/sign-in/` or `[locale]/` (FR-036, FR-038). Depends on T022.
- [x] T025 [US4] Add `test.describe("page loader (US4)")` to `e2e/brand.spec.ts` (research R13).
      Depends on T024.
  - **Delayed navigation**: signed in on `/en/dashboard`, `page.route("**/en/dashboard/users**", …)`.
    Delay by 1500 ms only requests whose headers have `rsc: "1"` and neither `next-router-prefetch`
    nor `next-router-segment-prefetch`; `route.continue()` everything else. Click the "Users" nav
    link. Within the delay, `getByRole("status")` has text "Loading…". The banner, with the logo link
    "Atmo AI", stays visible. Then the "Users" `h1` appears and the status is gone. Confirm the header
    names in `node_modules/next/dist/client/components/app-router-headers.js` before relying on them.
  - **Reduced motion**: the same with `page.emulateMedia({ reducedMotion: "reduce" })`. Both
    `[role=status] svg path` elements have computed `animation-name` `none`.
  - **Real redirect with the loader in place (FR-036)**: as in `e2e/auth.spec.ts`'s copied-cookie
    test, copy cookies, sign out, add them to a fresh context, and
    `context.request.get("/en/dashboard/users", { maxRedirects: 0 })`. The status is 307 and the
    `location` pathname is `/en/sign-in`.
  - **Sign-in redirect unchanged (FR-038)**: a signed-in context's
    `request.get("/en/sign-in", { maxRedirects: 0 })` returns 307 to `/en/dashboard`.

  Run the spec, then the whole of `auth.spec.ts` and `session.spec.ts` (FR-037).

**Checkpoint**: All four stories are complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T026 [P] In `specs/002-theme-switching/spec.md`, append to FR-022: "Superseded for the palette
      values by feature 005 (`specs/005-atmo-brand/`)." (research R15).
- [x] T027 Run every merge gate:
  - `npm run typecheck`, `npm run lint`, `npm run test:run`, then the full `npm run e2e`, because the
    header, titles and layouts are shared with 001–004;
  - `npm run build`: confirm every `/[locale]/dashboard…` route is still `ƒ` (dynamic), as 003
    requires;
  - `npx prettier --check .`.

  Report any failure with its output. Depends on all tasks above.

- [x] T028 Hand the user the by-hand checks from quickstart.md § By hand that no automation covers:
  - step 1 (side by side with the reference);
  - step 3 (font shift in the Performance panel);
  - step 4 (tab strips);
  - step 5 (touch icon);
  - step 7 (Safari / WebKit — a failure here blocks merge, research R6).
  - step 8 (designer swap — confirms FR-020 / SC-009 beyond the unit test).

  Report which steps could be done in this session and which need the user.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** blocks T009 and T010: the logo import needs the shim in tests.
- **Foundational (T002)** blocks T022 (`stroke-brand-mark`). The logo asset only needs the token at
  runtime, and has a fallback.
- **US1 (T003 – T007)** depends only on T002. T003 comes before T004 by design.
- **US2 (T008 – T016)** depends on T001 and T002. T014 and T015 also touch `[locale]/layout.tsx`,
  after T006 if US1 is running, so do T006 first to avoid editing the same file twice at once.
- **US3 (T017 – T019)** is independent of all other stories.
- **US4 (T020 – T025)** depends on T002. T020 and T014 both edit the catalogs, and T021 and T004 both
  edit `globals.css`, so sequence them if they run concurrently.
- **Polish**: T026 anytime. T027 and T028 come last.

### Shared files (do not edit concurrently)

| File                              | Tasks                  |
| --------------------------------- | ---------------------- |
| `src/app/globals.css`             | T002, T004, T021       |
| `src/app/[locale]/layout.tsx`     | T006, T015             |
| `src/messages/en.json`, `uk.json` | T014, T020             |
| `e2e/brand.spec.ts`               | T007, T016, T019, T025 |

### Parallel Opportunities

- T008 (asset), T011 (AppShell) and T014 (catalogs) touch different files.
- T017 and T018 (icons) can run alongside any US1 or US2 task.
- T020, T021 and T024 are separate files.

## Parallel Example: User Story 2

```text
T008 asset ─┐
T011 shell  ├─ in parallel (after T001, T002)
T014 copy  ─┘
T009 (needs T008) → T010
T012 (needs T009, T011), T013 (needs T009), T015 (needs T014)
T016 e2e (needs T012, T013, T015)
```

## Implementation Strategy

**MVP = Phases 1–2 + US1 (T001 – T007).** The product already reads as part of the family: palette,
typeface, AA. **US2** completes the identity and should ship in the same pull request. The name and
logo are the "own name" half of the goal, and the spec puts both stories at P1. **US3** and **US4** are
independent increments and can follow in the same pull request or the next. US4 carries the one
structural risk, the `loading.tsx` placement, and its FR-036 / FR-038 tests guard it.
