# UI Contract: Atmo AI Brand Look

**Feature**: [spec.md](../spec.md) | **Research**: [research.md](../research.md)

What a test, a screen reader, or a later feature may rely on. Everything else, such as class names and
element nesting, may change.

## `BrandLogo` — `src/components/brand-logo/brand-logo.tsx`

```ts
function BrandLogo(props: { className?: string }): JSX.Element;
```

- Renders one `<svg role="img">` whose accessible name is `common.appName` in the active locale
  ("Atmo AI").
- Its `viewBox` is the asset's own `0 0 {width} {height}`. Its size comes from `className`, as a
  height plus `w-auto`.
- Takes no `href` and is never focusable by itself. A caller that wants a link wraps it.
- Sets `text-foreground`, so the pill follows the active theme (FR-019).

| Placement                                  | Size   | Wrapped in                         | Accessible as   |
| ------------------------------------------ | ------ | ---------------------------------- | --------------- |
| Signed-in header, first                    | `h-6`  | `Link` to `/dashboard` (localized) | link "Atmo AI"  |
| Sign-in page, above card                   | `h-10` | nothing, centred                   | image "Atmo AI" |
| Invite page, above card                    | `h-10` | nothing, centred                   | image "Atmo AI" |
| Public header, start page, not-found, demo | —      | absent                             | —               |

## `AppShell` — `src/components/app-shell/app-shell.tsx`

```ts
function AppShell(props: {
  logo?: ReactNode; // NEW — first child of <header>; omitted → no logo (FR-023)
  nav?: ReactNode;
  account?: ReactNode;
  children: ReactNode;
}): JSX.Element;
```

On a narrow screen the logo and the preference controls share the first row, and the nav wraps below
as it does today.

## `PageLoader` — `src/components/page-loader/page-loader.tsx`

```ts
"use client";
function PageLoader(): JSX.Element;
```

Rendered only by `loading.tsx` files:

- one beside every signed-in page: `(private)/dashboard/`, `(private)/dashboard/users/`,
  `(private)/dashboard/account/` — a new page under `(private)` adds its own;
- `(public)/invite/[token]/loading.tsx`.

No `loading.tsx` or Suspense boundary sits in `[locale]/`, `(private)/`, `(public)/` or
`(public)/sign-in/`, above a session check (FR-036, FR-038). `src/lib/loading-boundaries.test.ts`
enforces both rules.

| Time since mount | DOM                                                                                |
| ---------------- | ---------------------------------------------------------------------------------- |
| 0 – 299 ms       | one empty element with `role="status"`; nothing painted, nothing announced         |
| ≥ 300 ms         | the same element, now holding the mark (`aria-hidden`) and the text `loader.label` |
| unmount          | timer cleared                                                                      |

- **Animation**: two paths, 1.4s linear and infinite.
- **Reduced motion**: under `prefers-reduced-motion: reduce`, the paths' `animation-name` is `none` and
  the mark is fully drawn.
- **Colours**: outer stroke `currentColor` (`text-foreground`), inner stroke `--brand-mark`.
- **Placement**: it fills the content area below the header and never covers the header.

## Document head

| Element                         | Value                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `<title>` on a titled page      | `{page metaTitle} — Atmo AI`, per locale via `common.titleTemplate`                        |
| `<title>` otherwise             | `common.metaTitle` ("Atmo AI — solar support" / "Atmo AI — підтримка сонячної енергетики") |
| `<link rel="icon">`             | `/favicon.ico?…` (`sizes="any"`) and `/icon.svg?…` (`type="image/svg+xml"`)                |
| `<link rel="apple-touch-icon">` | `/apple-icon.png?…`, 180×180                                                               |

## HTTP behaviour that must not change

| Request                                                         | Response                                              | Owner          |
| --------------------------------------------------------------- | ----------------------------------------------------- | -------------- |
| `GET /{l}/dashboard…`, no session cookie                        | 307 → `/{l}/sign-in?callbackUrl=…` (proxy)            | 003 FR-029     |
| `GET /{l}/dashboard…`, well-signed but revoked cookie           | 307 → `/{l}/sign-in` (layout), no body streamed first | 003 R8, FR-036 |
| `GET /{l}/sign-in`, valid session                               | 307 → `/{l}/dashboard`                                | 003 R4, FR-038 |
| `GET /favicon.ico`, `/icon.svg`, `/apple-icon.png` (unprefixed) | 200, no locale redirect                               | FR-029         |
