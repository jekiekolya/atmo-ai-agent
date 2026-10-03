# Quickstart: Validating the Atmo AI Brand Look

## Prerequisites

- Services up and migrated: `npm run services:up`, `npm run db:migrate`.
- A super admin bootstrapped (`npm run bootstrap`) for the signed-in checks.

## Automated

```bash
npm run typecheck
npm run lint
npm run test:run          # incl. theme-contrast, brand-mark-usage, brand-logo, page-loader, app-shell, catalogs
npm run e2e               # incl. e2e/brand.spec.ts; 003's auth/session specs must stay green
```

| Proves                                                                                         | Where                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Every listed text pair ≥ 4.5:1 and ring / loader ≥ 3:1, in both themes                         | `src/lib/theme-contrast.test.ts`           |
| Brand red only in the logo, loader, icon and theme file                                        | `src/lib/brand-mark-usage.test.ts`         |
| Every signed-in page has its own loading boundary; none sits above a redirecting check         | `src/lib/loading-boundaries.test.ts`       |
| Logo: image role, localized name, aspect ratio from the asset                                  | `brand-logo.test.tsx`                      |
| Header: logo first when given, absent when not                                                 | `app-shell.test.tsx`                       |
| Loader: nothing before 300ms, status + mark after, timer cleared on unmount                    | `page-loader.test.tsx` (fake timers)       |
| en/uk parity, including `common.titleTemplate` and `loader.label`                              | `src/i18n/catalogs.test.ts` (existing)     |
| Header logo links to `/{l}/dashboard` and is named "Atmo AI"; public header has none           | `e2e/brand.spec.ts`                        |
| Sign-in and invite show the non-link logo above the card                                       | `e2e/brand.spec.ts`                        |
| Titles end in "— Atmo AI" in en and uk                                                         | `e2e/brand.spec.ts`                        |
| Icons declared and served unprefixed (`/favicon.ico`, `/icon.svg`, `/apple-icon.png`)          | `e2e/brand.spec.ts`                        |
| Delayed navigation shows "Loading…" under a visible header; reduced motion stops the animation | `e2e/brand.spec.ts`                        |
| Revoked cookie → 307 from `/en/dashboard/users` with the loader in place                       | `e2e/brand.spec.ts`                        |
| Back after sign-out, anonymous redirects, revoked session on sign-in                           | existing `auth.spec.ts`, `session.spec.ts` |

Also run `npm run build` and confirm every `/[locale]/dashboard…` route is still listed as `ƒ` (dynamic),
as in 003.

## By hand

1. **Side by side with the reference (SC-001).** Open my.atmo.pro/login and `/uk/sign-in` in the light
   theme at the same width. Compare the page background, card, text, button, corner radius, typeface
   and logo position.
2. **Dark theme.** Pin dark with the theme control while the OS is light:
   - The page is near-black and the cards are dark gray.
   - The logo's wordmark stays red, and its pill turns light with dark "AI".
3. **No font shift (SC-004).** In DevTools, disable the cache and throttle to "Fast 4G". Reload
   `/en/sign-in` and `/en/dashboard` with the Performance panel recording. Layout Shift shows no entry
   caused by text.
4. **Tab icon (SC-006).** Look at the tab in Chrome with a light browser theme and with a dark one: the
   tile, the outline and the red "a" are all distinct.
5. **Touch icon.** Add the page to an iOS home screen, or open `/apple-icon.png`. The "a" mark sits on
   an opaque light square.
6. **Loader.**
   - In DevTools, throttle to "Slow 4G", then click "Users" in the header. After a moment the mark
     draws itself under the header.
   - With "Emulate CSS prefers-reduced-motion: reduce", the mark is still and fully drawn.
   - On a fast connection the same click shows no loader.
7. **Safari / WebKit (R6, not automated).** Open `/en/sign-in` and the signed-in header in Safari, in
   both themes. The logo must render, with the pill following the theme. If the `<use>` reference
   fails there, stop: R6 needs revisiting before merge.
8. **Designer swap (SC-009).** Follow [contracts/brand-assets.md](./contracts/brand-assets.md) with any
   compliant SVG, then revert.
