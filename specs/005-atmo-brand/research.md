# Research: Atmo AI Brand Look

Every finding below was checked against the installed packages — Next.js 16.3.0 (Turbopack),
Tailwind CSS 4.3.3, next-intl 4.13.7, Playwright 1.62.1 (Chromium 1234 only) — or measured from the
reference, my.atmo.pro/login, on 2026-10-02.

## R1. The reference assets, as fetched

**Finding**: Three public files were downloaded for this plan. The site's leaf certificate is valid
(4 Sep – 3 Dec 2026), but `curl` rejects its chain, so they were fetched without chain verification.
They are inspected below and copied into the repository by hand, never fetched at runtime.

- **Logo**: `/static/logos/dark-outline.svg`, `viewBox="0 0 195 47"`.
  - The "atmo" wordmark is one `#C02444` path, inside a luminance mask and a `clip-path` 95.89 wide.
  - The pill is one path from x 104.388 to 186.5 and y 5.5 to 42.5, with corner radius ≈ 10.8. It is
    filled `#1E1E1E` and stroked `#1E1E1E` at width 3, which widens it by 1.5 on every side.
  - The letters are three white paths, "P", "R" and "O".
    - Cap height: y 11.255 to 37.025, so 25.77.
    - Stem width: 4.054, from P's stem at x 110.529–114.583.
    - Side bearing inside the pill: 6.14 on the left, 6.29 on the right.
    - Gap between letters: ≈ 4.4.
- **Preloader**: an inline 64×64 SVG on the login page, with two paths.
  - `.outer-path` is the rounded square. It is stroked black at width 2, `stroke-dasharray: 230`, and
    animated by `drawOuter` over 1.4s, linear and infinite (offset 220 → 100 → 0).
  - `.inner-path` is the "a", drawn as an outline. It is stroked `#C02444` at width 2,
    `stroke-dasharray: 200`, and animated by `drawInner` (180 → 90 → 0).
  - The SVG sits in an 80px tile with a neumorphic shadow, over a fixed full-screen `#F9FAFB` overlay.
- **Favicon**: `/favicon.ico` holds 9 images. Rendered, it is a light-gray tile (≈ #E6E6E6) inside a
  thick black rounded outline, with a filled red "a". Its opaque light tile already reads on a dark tab
  strip.
- **Not used**: the reference's Apple touch icon (`icon-180x180.png`) is a different mark, a dark "A"
  on a lavender tile, from the Atmosfera family. The spec asks for the "a" mark, so this plan draws the
  touch icon from the "a" (R10).
- **Not used**: the reference loads Roboto from Google Fonts at runtime. FR-016 forbids that, so R5
  delivers the font from the app itself.

## R2. Theme tokens: hex values, reference first

**Decision**: Every theme value in `src/app/globals.css` becomes an opaque six-digit hex. The full
table is in [data-model.md](./data-model.md).

- **Light theme**: the reference's measured values.
- **Dark theme**: the same gray scale, mirrored.
- **Brand red**: a new token, `--brand-mark: #c02444`, the same in both themes, exposed to Tailwind as
  `--color-brand-mark`.
- **Radius**: `--radius` becomes `0.5rem` (8px). The derived radii already scale from it.

**Rationale**:

- **The installed grays differ from the reference.** Tailwind 4.3.3 defines its grays in OKLCH, and
  they are close to the reference but not equal: its gray-900 is `oklch(21% 0.034 264.665)`, not
  `#111827`. The reference values are the v3 hex scale, and the spec makes them authoritative.
- **Hex keeps everything readable.** Every value can be compared with the reference at a glance, and
  the contrast test (R4) can read the file without converting colour spaces.
- **The token name carries the rule.** Calling it `brand-mark` rather than `brand` makes its
  restriction — brand marks only, FR-011 / FR-012 — visible wherever it is used.
- **Every value is opaque.** The old dark `border` (`oklch(1 0 0 / 10%)`) and `input` (`/ 15%`) were
  translucent. Opaque grays from the scale replace them, so every border sits on the scale (FR-002).

**Muted text on a muted surface.** `#6B7280` on gray-100 measures 4.39:1. The pair occurs only where
a badge is a link or uses the ghost variant (`hover:bg-muted hover:text-muted-foreground`), and the
table's selected-row state. Nothing renders any of them today: the users table uses the `default`,
`secondary` and `outline` badges, without links or selection. `muted` therefore stays gray-100 —
making it lighter would make every ghost-button hover invisible on the gray-50 header. The contrast
test documents the excluded pair, so whoever first renders one of these sees the failure (R4).

**Focus indicator.** `globals.css` gives every element `outline-ring/50`. At 50% opacity a gray-500
ring falls to about 2:1, so the base rule becomes `outline-ring`. Buttons and fields already draw a
solid 1px `border-ring` on focus. With `--ring` at gray-500 (light) and gray-400 (dark), that border
measures 4.6–8:1 against every surface (FR-007).

The destructive button overrides that border with `focus-visible:border-destructive/40`, about
2.2:1 on white. It becomes `focus-visible:border-destructive`: 6.1:1 or more in both themes, as the
`destructive` pairs already assert. Menu and select items show focus only through a `bg-accent`
highlight, about 1.1:1 against the popover. By the analysis clarification, FR-007 covers focus rings
and borders, so those items stay as they are.

**Alternatives considered**:

- **Tailwind's own `--color-gray-*` through `var()`**: off-reference by small amounts, and it hides
  the measured values behind a second name.
- **OKLCH conversions of the hex values**: no gain, and harder to compare with the reference.

## R3. Destructive: darker along its own hue, lighter tints behind it (planning clarification)

**Finding**: shadcn's destructive variants draw destructive text on a tint of itself. With today's
light value `#E7000B` (`oklch(0.577 0.245 27.325)`), the pairs measure:

| Pair (light)                | Ratio | Pair (dark, `#FF6467`)          | Ratio |
| --------------------------- | ----- | ------------------------------- | ----- |
| on card                     | 4.76  | on gray-900                     | 6.13  |
| on its `/10` tint over card | 3.99  | on its `/20` tint over gray-900 | 4.24  |
| on its `/20` tint (hover)   | 3.31  | on its `/30` tint (hover)       | 3.55  |

**Decision** (clarified 2026-10-02):

- **Light `--destructive`**: `#C10007`. This is Tailwind's red-700, `oklch(0.505 0.213 27.518)`, on the
  same hue as before and still more orange than the brand crimson (hue 16.2°).
- **Dark `--destructive`**: stays `#FF6467`.
- **Tint ceiling**: with these values the strongest tint that keeps 4.5:1 is `/15` — light 4.62,
  dark 4.60 over the worst surface. Every tint behind destructive text is held to `/15` or less:

| File                                  | Class today                                               | Becomes                                                 |
| ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `src/components/ui/button.tsx`        | `hover:bg-destructive/20`                                 | `hover:bg-destructive/15`                               |
| `src/components/ui/button.tsx`        | `dark:bg-destructive/20` `dark:hover:bg-destructive/30`   | `dark:bg-destructive/10` `dark:hover:bg-destructive/15` |
| `src/components/ui/badge.tsx`         | `dark:bg-destructive/20` `[a]:hover:bg-destructive/20`    | `dark:bg-destructive/10` `[a]:hover:bg-destructive/15`  |
| `src/components/ui/dropdown-menu.tsx` | `dark:data-[variant=destructive]:focus:bg-destructive/20` | `…/15`                                                  |

The focus rings drawn in destructive (`ring-destructive/20`, `/40`) are rings, not surfaces behind
text, and stay as they are. The alert's `text-destructive/90` on the card measures 5.60 (light) and
4.77 (dark), so it passes unchanged.

**Rationale**: Token values alone cannot pass the dark hover state: even the near-pink `#FFA2A2` gives
only 4.38:1 on its `/30` tint. Lowering the tint is a class change in three vendored primitives. The
constitution allows that edit ("customize those primitives in place"), and it leaves their structure,
sizes and behaviour alone.

**Alternatives considered**:

- **AA at rest only**: rejected — WCAG applies to hover text too.
- **Tokens alone, with a blood-red light value (`#B70000`) and a pink dark one**: rejected — moves
  toward the brand crimson, and still fails dark hover.

## R4. Contrast as a test

**Decision**: `src/lib/theme-contrast.test.ts` (Vitest, `unit` project) reads `src/app/globals.css`,
parses the `:root` and `.dark` blocks into token → hex maps, and asserts every pair in the data
model's pair list. Each pair is computed with WCAG 2.x relative luminance, and a translucent surface
is composited over the surface beneath it first (`muted/50` over the card, `destructive/15` over the
popover, `primary/80` over the background).

- Text pairs must reach 4.5:1.
- Focus rings and the loader's graphic must reach 3:1.
- The test also checks that every token in the light block has a dark counterpart, so a token added
  to one theme only fails.
- The pair list in the test mirrors data-model's list, and the excluded pair from R2 appears in it as
  a comment with its reason.

**Rationale**: FR-043 asks for the check to run automatically. The UI project only runs `.tsx` tests
in `components`, `app` and `i18n`, and the unit project runs `.ts` tests in `lib` and others, so the
test lives in `src/lib/`, beside `theme.ts`. The luminance helper stays inside the test file: it has one
caller (Principle II).

**Alternatives considered**:

- **An axe scan in Playwright**: it only sees what a test happens to render, and in one state.
- **Asserting OKLCH values**: needs a colour-space conversion in the test for no benefit.

## R5. Typography: Roboto through `next/font/google`, variable, `display: "optional"`

**Decision**: `src/app/[locale]/layout.tsx` drops Geist and Geist Mono for
`Roboto({ subsets: ["latin", "cyrillic"], display: "optional", variable: "--font-roboto" })`.
`@theme inline` sets `--font-sans: var(--font-roboto)` and drops `--font-mono`, so a future
`font-mono` uses Tailwind's default monospace stack. Nothing uses `font-mono` today.

**Rationale**:

- **Variable font**: Roboto is variable in the installed font data (`wght` 100–900; the `wdth` axis
  loads only if asked for). Omitting `weight` gives one file per subset that covers 400, 500 and 700.
  Naming the three weights would give three static files per subset instead.
- **Only 500 and 400 are in use**: the interface uses `font-medium` (500) and the default 400. No 600
  or other weight is requested, so nothing is synthesized.
- **Self-hosted (FR-016)**: `next/font/google` downloads the files at build time and serves them from
  the app (`font.md`, "Google Fonts are automatically … self-hosted"). Builds already need that network
  access for Geist.
- **No shift (FR-015)**: `display: "optional"` is the only `font-display` that guarantees no swap after
  first paint.
  - The font is preloaded for both subsets (`preload` defaults to true), so a normal load uses Roboto
    from the first frame.
  - `adjustFontFallback` (default `true`) gives the fallback Roboto's metrics, so even a load that
    misses the window looks right.
  - Cost: on a slow first visit the metric-matched fallback can stay for that document, including its
    client-side navigations, until the next full load.

**Alternatives considered**:

- **`swap` with `adjustFontFallback`**: small but non-zero shift, against SC-004.
- **Static weights**: six requests instead of two.
- **Keeping Geist Mono for a future code font**: YAGNI.

## R6. The logo follows the product's theme through `<use>` of a statically imported SVG

**Decision**:

- **The asset**: `src/components/brand-logo/atmo-ai-logo.svg`. Its root `<svg>` carries `id="logo"`,
  and its colours come only from the theme:
  - the wordmark: `style="fill: var(--brand-mark, #C02444)"`;
  - the pill: `fill="currentColor" stroke="currentColor"`;
  - the "AI" letters: `style="fill: var(--background, #FFFFFF)"`.
- **The component**: `BrandLogo` imports the file and renders
  `<svg role="img" aria-label={…} viewBox={`0 0 ${width} ${height}`}><use href={`${src}#logo`} /></svg>`,
  with `text-foreground` setting `currentColor`.

The results:

- **Light theme**: gray-900 pill, gray-50 letters.
- **Dark theme**: gray-50 pill, gray-950 letters.
- **Wordmark**: brand red in both themes.

The pill follows the `.dark` class — the product's theme, not the OS — which is FR-019's case for a
pinned theme.

**Verified**:

- **What the import returns**: Next's static import returns
  `{ src: "/_next/static/media/<name>.<hash>.svg", width, height }`, with the size read from the file.
  It was checked on the running dev server through a temporary route, since removed.
- **Theme values reach the clone (Chromium)**: an `id`-ed root `<svg>` referenced through `<use>`
  rendered `var(--brand)` and `currentColor` from the host page, and a parent's values changed both.
  Custom properties and `color` inherit into the `<use>` shadow tree, as the SVG spec defines.
- **Not verified in WebKit or Firefox**: only Chromium is installed. Safari is a manual check in the
  quickstart.

**What this gives FR-020**:

- The size comes from the file, and the hashed URL changes when the file does. A designer's file with
  a different aspect ratio therefore works with no code change.
- The "same kind" it must be is written down in [contracts/brand-assets.md](./contracts/brand-assets.md):
  root `id="logo"` and the three theme hooks.

**Typing**: `next/image-types/global.d.ts` declares `*.svg` as `any`, to stay compatible with SVGR.
The import is narrowed once at the boundary, `const logo: StaticImageData = logoAsset`, with a
one-line reason (Principle I).

**Vitest**: Vite imports `.svg` as a URL string. The `ui` project in `vitest.config.mts` gets an
inline `enforce: "pre"` plugin. Its `load` hook returns `{ src, width, height }` read from the file's
`width`/`height` attributes, mirroring Next. It is tooling config, so no dependency and no
`process.env`.

**Alternatives considered, several by measurement**:

- **`<img src>`**: an image document cannot see the page's `.dark` class. A `prefers-color-scheme`
  query inside it would follow the OS, against FR-019.
- **`import … with { turbopackModuleType: "raw" }`**: tried — Next's built-in image rule wins for
  `.svg` and the attribute is ignored; the import still returned the static-image object.
- **`readFileSync(new URL("./x.svg", import.meta.url))`**: tried — Turbopack rewrites the `URL` into its
  own asset reference, and Node rejects it ("Received an instance of URL").
- **A global `turbopack.rules['*.svg'] = { type: "raw" }` with `dangerouslySetInnerHTML`**: changes how
  every `.svg` import behaves, needs the same Vitest shim, and injects markup.
- **`readFileSync(join(process.cwd(), …))`**: ties the running server to the source tree being present
  at runtime.
- **SVGR**: a new dependency and loader config.
- **Paths inlined in a `.tsx`**: a designer's replacement would be a code change, against FR-020.

## R7. Drawing "AI" and narrowing the pill

**Decision**: The asset keeps the reference's wordmark path, mask and clip byte for byte. "AI" is
drawn in the "atmo" wordmark's geometry rather than the reference's "PRO", because letters taken from
"PRO" read as a different typeface next to the wordmark. All numbers are in the wordmark's
coordinates, before the asset's vertical offset:

- **Stroke**: 4.28 — the stem width of "t" and "m".
- **Letters**: 29.5 tall, from y 7.256 to 36.756, centred on the wordmark's vertical middle.
- **A**: straight legs 4.28 thick, measured square to the leg, meeting at a flat apex 5.2 wide, 22
  wide at the base. A crossbar 4.28 thick sits at 58% of the letter height.
- **I**: a rectangle 4.28 wide, 5 after "A".
- **Pill**: a filled rectangle with a corner radius of 6, starting 8.9 after "o", with 8 padding above
  and below the letters and 9 to their sides: x 104.5 – 153.78, y −0.744 – 44.756.
- **Size**: `viewBox` and `width`/`height` are `0 0 154 47`. One `translate(0 1.494)` around the
  drawing centres the pill vertically in that box.

**Rationale**: The spec accepts a hand-drawn "AI" for now. Sharing the wordmark's stroke width keeps
"AI" in the same family. The pill keeps the reference's "PRO" layout, and the contract lets a
designer's file replace it.

## R8. Logo placement

**Decision**:

- **`BrandLogo` is a server-compatible component**: no hooks beyond `useTranslations`, which next-intl
  supports in synchronous server components, as `not-found.tsx` already does. Its accessible name is
  `common.appName`, so every call site is localized by construction (FR-022, FR-024).
- **`AppShell` gains a `logo?: ReactNode` slot**, rendered as the header's first child and kept on the
  first row on narrow screens, with the nav still wrapping below.
  - `(private)/layout.tsx` passes `<Link href="/dashboard"><BrandLogo className="h-6 w-auto" /></Link>`.
    The link's accessible name is the image's name, "Atmo AI".
  - The public layout passes nothing (FR-023), and nor do the start page, not-found and demo, which
    render `AppShell` directly.
- **Sign-in and invite pages**: they render `<BrandLogo className="mx-auto h-10 w-auto" />` as the first
  item in their existing column, above any notice and the card. It is not a link and not focusable
  (FR-024).

**Rationale**:

- **Placement in the pages**: there are two callers and one line each. A shared auth layout would
  also wrap any future public page, and putting the logo in `(public)/layout.tsx` would do the same.
- **Sizes**: 24px for the compact logo matches the header's 28px controls. 40px is close to the
  reference's rendered height above the card.

## R9. Product name and page titles

**Decision**: The locale layout's `generateMetadata` returns
`title: { template: t("titleTemplate"), default: t("metaTitle") }`.

- **The template**: `common.titleTemplate` is `"%s — Atmo AI"` in both locales.
- **Page titles**: each page's `metaTitle` drops the suffix (`"Sign in"`, `"Вхід"`, …), so the product
  name appears once per locale for every title.
- **Other copy**:
  - `common.appName` becomes `"Atmo AI"`.
  - `common.metaTitle` becomes `"Atmo AI — solar support"` / `"Atmo AI — підтримка сонячної енергетики"`.
  - The sign-in description becomes "…your Atmo AI account" / "…облікового запису Atmo AI" (FR-026).
- **New key**: `loader.label`, "Loading…" / "Завантаження…".

**Rationale**: `title.template` applies to child segments (`generate-metadata.md` l.243–289). Every
titled page sits under `[locale]/layout.tsx`, and pages without a title get `default`. `%s` has no
meaning in ICU, so next-intl returns it untouched.

**Alternatives considered**: Editing each `"… — Atmo"` string to `"… — Atmo AI"`. Same diff size, but
the name stays duplicated in 12 strings and the next rename repeats the work.

## R10. Favicon and Apple touch icon

**Decision**: Three files in `src/app/`, the root segment, which is the only place `favicon.ico` may
live (`app-icons.md`):

- **`icon.svg`**: the vector source.
  - The reference's 64×64 preloader geometry.
  - The rounded square: filled `#F3F4F6`, stroked `#111827` at width 4. That is thicker than the
    preloader's 2, so it holds at 16px.
  - The "a": the inner path, filled `#C02444` with `fill-rule="evenodd"`.
  - Next emits `<link rel="icon" type="image/svg+xml" sizes="any">`.
- **`favicon.ico`**: replaces Next's default. It holds 16, 32 and 48px PNG images rasterized from
  `icon.svg`, for clients that ask for `/favicon.ico` directly.
- **`apple-icon.png`**: 180×180. The mark at about 75% on an opaque `#F9FAFB` square, since iOS draws
  transparency as black and rounds the corners itself.

`scripts/brand-icons.ts`, run once with `npx tsx scripts/brand-icons.ts`, produces the two raster files
from `icon.svg`, and both are committed. Chromium, through `@playwright/test`, which is already a dev
dependency, rasterizes them. A few lines assemble the ICO container: a header, one directory entry per
image, and the PNG payloads.

**Rationale**:

- **Legible on both tab strips (FR-027)**: the opaque light tile with a dark outline reads on light and
  dark tab strips without a media query, as the reference's own icon does. The same holds for `.ico`
  and `.png`, which cannot carry a media query.
- **Reachable unprefixed (FR-029)**: the proxy matcher already skips any path with an extension
  (`.*\.[\w]+$`), so `/icon.svg`, `/apple-icon.png` and `/favicon.ico` stay reachable without a
  language prefix.
- **Literal colours (FR-010)**: the icons carry the brand red as a literal, as the amended FR-010
  allows.

**Alternatives considered**:

- **`apple-icon.tsx` with `ImageResponse`**: it cannot produce `.ico`, so a script is needed anyway.
- **Copying the reference's `.ico`**: no SVG source to keep it in step with.
- **A `prefers-color-scheme` SVG favicon**: Safari and `.ico` ignore it.

## R11. Where the loader sits: below every check that can redirect

**Finding**: In the installed Next, `loading.js` "will be nested inside `layout.js`" of its folder, and
wraps `page.js` and the segments below it (`loading.md`). Without Cache Components (not enabled),
"navigation blocks until the layout finishes rendering". Once a fallback has streamed, a later
`redirect` can only be sent inside the stream, with status 200 (`loading.md`, "Status Codes").

**Decision**:

- **One `loading.tsx` per signed-in page**: `(private)/dashboard/loading.tsx`,
  `(private)/dashboard/users/loading.tsx` and `(private)/dashboard/account/loading.tsx`. All sit below
  `(private)/layout.tsx`, whose `verifySession()` must finish before the shell — header plus
  fallback — can flush.
  - A rejected session therefore still gets a real 307 to sign-in (FR-036).
  - The anonymous case never reaches the layout: the proxy redirects first (`proxy-guard.ts`).
  - On client navigation between `/dashboard`, `/dashboard/users` and `/dashboard/account`, the layout
    does not re-render and the target page's boundary shows the loader under the unchanged header.
- **`src/app/[locale]/(public)/invite/[token]/loading.tsx`**: `inspectInvite` never redirects. It
  renders one of four outcomes in place.
- **No loader for sign-in** (planning clarification). Its only wait is the session check that may
  redirect a signed-in visitor (003 R4), so a boundary there would turn that 307 into an in-stream
  redirect (FR-038).

**Each page's own `verifySession()` now runs under the boundary.** That is safe:

- **On a full load**, the layout's call is the same `cache()`d result, and it has already redirected
  or passed before anything is sent.
- **On a client navigation**, there is no HTTP status at stake. Next's router follows a redirect in
  the payload, as it does today.

Exits from the private area stay full-document navigations (003 R8), so Back after sign-out is
unaffected (FR-037).

**Proof**: an e2e request with a revoked but well-signed cookie — the proxy lets it through and the
layout rejects it — asks for `/en/dashboard/users` with `maxRedirects: 0` and expects 307 to
`/en/sign-in`. Three tests keep running unchanged: 003's Back-after-sign-out test, its
anonymous-redirect tests, and session's "revoked session sees the form".

**Corrected in implementation** (measured on a production build): a single
`(private)/dashboard/loading.tsx` showed nothing on `/dashboard` → `/dashboard/users`. The old page
stayed for the whole delayed response, and the URL changed only when the response arrived. The
installed router commits a navigation at once, with a loading state, only when the target segment's
prefetched route carries its own `loading.tsx`. With one file per page, all three directions —
home → users, users → account, account → home — show the loader from ≈ 300ms until the page
arrives. The prefetch must have finished: a click before it completes waits without a loader, which
is Next's own behaviour.

`src/lib/loading-boundaries.test.ts` keeps the rule. It fails when a signed-in page has no
`loading.tsx` of its own, and when a `loading.tsx` appears in `[locale]/`, `(private)/`,
`(public)/` or `(public)/sign-in/`.

**Alternatives considered**:

- **`(private)/loading.tsx` or only `dashboard/loading.tsx`**: shows nothing on navigations between
  dashboard pages, as measured above.
- **`dashboard/template.tsx` with `<Suspense fallback={<PageLoader />}>`**: `template.md` says
  templates show a Suspense fallback on every navigation. Measured: nothing showed, because the
  router waits for the response before committing when no `loading.tsx` was prefetched.
- **`(public)/loading.tsx`**: would sit above sign-in's check.

## R12. Loader behaviour

**Decision**: `PageLoader` is a client component in `src/components/page-loader/`, rendered by every
`loading.tsx` file (R11).

- **A live region from the first render**: an empty `<div role="status">` that fills the content area
  and centres its content.
- **The 300ms delay**: a `setTimeout` started on mount (cleared on unmount) sets `visible` after
  300ms. Only then does the region receive:
  - the 64×64 mark, `aria-hidden`, from the reference's two preloader paths;
  - a visually hidden `t("loader.label")`.
    A navigation that finishes first unmounts the fallback before anything is painted or announced
    (FR-031, FR-032).
- **Animation**: Tailwind v4 `@theme` entries `--animate-loader-outer` and `--animate-loader-inner`,
  with the reference keyframes in `globals.css`.
  - Outer: dasharray 230, offset 220 → 100 → 0.
  - Inner: dasharray 200, offset 180 → 90 → 0.
  - Both run 1.4s, linear and infinite.
- **Reduced motion (FR-034)**: `motion-reduce:animate-none` and a zero dash offset show the mark fully
  drawn and still. The delay still applies, because it is not motion.
- **Colours (FR-033)**:
  - outer stroke `currentColor` with `text-foreground`;
  - inner stroke `stroke-brand-mark`.
    Brand red measures 3.43:1 on gray-950 and 5.62:1 on gray-50, above the 3:1 for a graphic.
- **No tile, no shadow, no overlay (FR-035)**: the reference's neumorphic tile uses literal shadow
  colours and belongs to its full-screen splash.

**Rationale**:

- **Why a timer and not CSS**: a CSS-only delay (`visibility` animated in after 300ms) cannot announce
  reliably. Screen readers do not consistently report a region that turns visible, and inserting
  content into an existing live region is the dependable pattern.
- **What it costs**: on a hard load the timer starts at hydration rather than at the request, which
  the spec's "about 300ms" allows.
- **Without JavaScript**: there is no loader, which matches streaming itself, since swapping in
  streamed content needs JavaScript.

## R13. Proving the loader end to end

**Decision**: In `e2e/brand.spec.ts`, the signed-in page routes the navigation request for
`/en/dashboard/users` and delays it by about 1.5s. The navigation request carries `rsc: 1` and neither
`next-router-prefetch` nor `next-router-segment-prefetch` (header names from
`next/dist/client/components/app-router-headers.js`). The test then clicks "Users" and checks:

- `getByRole("status")` shows "Loading…" within the delay;
- the banner, with the logo link, stays visible;
- the users heading replaces the status.

A second test emulates `reducedMotion: "reduce"` and asserts the loader paths' computed
`animation-name` is `none`.

The never-before-300ms rule is proven in Vitest with fake timers on `PageLoader`: nothing at 299ms,
the mark and label at 300ms. Asserting it in a browser would depend on a fast navigation staying fast
on CI.

## R14. Dependencies and tooling

No runtime dependency is added (FR-041).

- **Fonts**: `next/font/google` ships with Next.
- **Logo**: static image import, also in Next.
- **Icon rasterization**: `@playwright/test` and `tsx`, both existing dev dependencies.
- **Tooling touched**:
  - the `ui` project's inline SVG shim in `vitest.config.mts` (R6);
  - `scripts/brand-icons.ts` (R10).
    Both are exempt from the Config rule, and neither reads `process.env`.

## R15. Documents this feature supersedes

Spec 002 FR-022 ("no colour token changes") gets a pointer line to this feature. Two items stand as
they are, now restated here as FR-036 and FR-038:

- 003's R8, no Suspense above the private auth check;
- 003's R4, sign-in's own redirect.
