# Phase 0 Research: i18n Foundation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

Every decision below was verified against the Next.js 16.3 documentation bundled in
`node_modules/next/dist/docs/` and against the published source of `next-intl@4.13.7`, not from
recollection. Where a finding contradicts the commonly documented setup, the evidence is quoted.

## R1. Next.js 16 renamed `middleware.ts` to `proxy.ts`

**Decision**: Create `src/proxy.ts` exporting a function named `proxy`. Import next-intl's factory
from `next-intl/middleware` — the package name does not change.

**Rationale**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`
states the convention is _"deprecated in Next.js 16 and renamed to `proxy.js`"_. The proxy reference
adds that it _"defaults to using the Node.js runtime"_ in v16 and that `runtime` config throws. The
file must sit _"in the project root, or inside `src` if applicable, so that it is located at the same
level as `pages` or `app`"_ — this project has `src/app`, so the file is `src/proxy.ts`.

next-intl has no `./proxy` export; its export map (verified from the packaged `package.json`) is
`.`, `./server`, `./config`, `./middleware`, `./navigation`, `./routing`, `./plugin`, `./extractor`.
So the file is named `proxy.ts` while the import stays `next-intl/middleware`. This looks
inconsistent and will invite "fixes" — it is called out here and in a code comment.

**Alternatives considered**: Keeping `middleware.ts`. Rejected: deprecated on arrival, and a codemod
(`npx @next/codemod@canary middleware-to-proxy .`) exists precisely to move off it.

## R2. next-intl writes the preference cookie in a way FR-030 forbids

**Decision**: Keep `localeCookie` **enabled** in the routing config, and strip any
`Set-Cookie: NEXT_LOCALE=...` that next-intl's middleware adds to a proxy response.

**Rationale**: This is the sharpest finding of the research phase, and it inverts the obvious fix.

`dist/esm/development/middleware/syncCookie.js` writes the cookie on document navigations in two
cases: when a stored cookie disagrees with the served locale (it **overwrites**), and when there is
no cookie and the served locale differs from what `Accept-Language` would have chosen. The first case
is exactly the scenario clarification 3 ruled out — a visitor who chose English follows a shared
`/uk/...` link and silently loses their choice.

The obvious remedy, `localeCookie: false`, breaks a different requirement. From
`dist/esm/development/middleware/resolveLocale.js`:

```js
function getLocaleFromCookie(routing, requestCookies) {
  if (routing.localeCookie && requestCookies.has(routing.localeCookie.name)) {
```

The same flag gates reading. Disabling the write disables priority 2 of FR-006. The read and the
write are coupled behind one option, so the write must be neutralised on the response instead.

Two facts make the stripping safe and narrow:

- `syncCookie` returns early unless `Sec-Fetch-Dest` is absent or `document`, so background RSC
  requests and prefetches never write the cookie. Only full document loads are affected.
- The **explicit switch** writes the cookie in the browser via `document.cookie`, in
  `dist/esm/development/navigation/shared/syncLocaleCookie.js`, guarded by
  `const isSwitchingLocale = nextLocale !== locale && nextLocale != null`. That write never travels
  through the proxy, so stripping response cookies cannot undo it.

The result is that next-intl's own client-side behaviour already implements FR-030 exactly; only its
server-side sync disagrees, and that is the single thing we suppress.

**Alternatives considered**:

- `localeCookie: false` plus a hand-written cookie read in the proxy — more code, duplicates
  resolution logic, and the switcher would then have to write the cookie manually too.
- Replacing next-intl's middleware entirely — re-implements `Accept-Language` matching (quality
  values, regional variants) that `@formatjs/intl-localematcher` already handles correctly, and
  loses the alternate-links behaviour of R5.

## R3. Resolution order matches FR-006 out of the box

**Decision**: Use next-intl's resolution as-is; do not re-order anything.

**Rationale**: `resolveLocaleFromPrefix` in `resolveLocale.js` implements, in order: route prefix →
cookie → `accept-language` → `defaultLocale`. That is FR-006 verbatim. Regional variants (FR-009) and
unsupported values (FR-008) are handled by `@formatjs/intl-localematcher`, with an invalid-language
`try/catch` that falls through to the next source rather than throwing.

## R4. The negotiation redirect is temporary but not explicitly uncacheable

**Decision**: Set `Cache-Control: no-store` on any 3xx the proxy returns.

**Rationale**: next-intl redirects via `NextResponse.redirect(url)`, which defaults to **307
Temporary Redirect** — the correct status, so FR-031's "temporary" half is already satisfied. But no
cache header is set. A 307 is not cached by default under HTTP semantics, yet a CDN configured to
cache redirects, or a proxy layer added later, could store one and pin a visitor to a language
permanently. FR-031 asks for the guarantee, not the default, so the header is set explicitly. This
costs one line and removes an entire class of bug that no test would catch in development.

## R5. Cross-language discoverability is partly recovered for free

**Decision**: Leave `alternateLinks` at its default (`true`).

**Rationale**: The switcher is a dropdown (clarification 2), which is not a crawlable path between
locales — the spec records this as an accepted cost. next-intl's routing config defaults
`alternateLinks: true`, which emits `Link` response headers announcing the alternate-locale versions
of each page. That does not make the switcher crawlable, but it does give search engines the
cross-locale relationship the spec's Assumptions section flags as "worth specifying before launch".
Free mitigation, no requirement change.

## R6. Type-safe message keys via `AppConfig` declaration merging

**Decision**: Add `src/types/next-intl.d.ts` augmenting next-intl's `AppConfig` with `Locale` and
`Messages`.

**Rationale**: `use-intl` exports `AppConfig` as a deliberately empty interface, with helper types
that read `Locale`, `Messages` and `Formats` from it when merged:

```ts
export default interface AppConfig {}
export type Locale = AppConfig extends { Locale: infer AppLocale }
  ? AppLocale
  : string;
```

Setting `Messages: typeof import('../messages/en.json')` makes `t('some.key')` a compile error when
the key does not exist in the English catalog — MC-004. `resolveJsonModule` is already enabled in
`tsconfig.json`, so no compiler change is needed.

**Scope limit worth stating**: this types keys against **English only**. A key missing from the
Ukrainian catalog is _not_ a type error — that is precisely why FR-021 requires the separate Vitest
parity test (MC-005). The two gates are complementary by design, not redundant.

## R7. The root layout must move under `[locale]`

**Decision**: Delete `src/app/layout.tsx`; make `src/app/[locale]/layout.tsx` the root layout.

**Rationale**: `layout.md` states a root layout _"must define `<html>` and `<body>` tags"_ and that it
_"can be under a dynamic segment, for example when implementing internationalization with
`app/[lang]/layout.js`. Dynamic segments before the root layout are root parameters."_ Keeping a
layout above `[locale]` would force `<html lang>` to be rendered without knowing the locale, breaking
FR-010. Next.js explicitly permits omitting `app/layout.js` so a subdirectory layout becomes the root.

**Consequence worth noting**: `locale` becomes a Next 16 _root parameter_, readable from any Server
Component via `next/root-params` without prop drilling. Root-param getters do **not** work in Client
Components, Server Actions, or Route Handlers — the switcher is a client component and therefore
takes its locale from next-intl's `useLocale()` instead.

## R8. The `select` primitive exists in this project's shadcn style

**Decision**: `npx shadcn@latest add select`, then customize in place.

**Rationale**: Verified against the live registry rather than assumed. `components.json` pins style
`base-nova`; `shadcn view select` returns `registry/base-nova/ui/select.tsx`, built on
`@base-ui/react/select` (already a direct dependency at ^1.7.0) and marked `"use client"`. It exposes
`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` and friends with Base UI's
listbox semantics, which is what FR-016 needs. The vendored file references
`@/registry/base-nova/lib/utils` and an `IconPlaceholder`; the CLI rewrites those to this project's
`@/lib/utils` and its configured `lucide` icon library on install — verify after adding rather than
assuming, and fix in place if not.

## R9. Vitest would not pick up the new tests

**Decision**: Extend the `unit` project's `include` glob to cover `src/i18n`.

**Rationale**: `vitest.config.mts` currently includes `src/{config,lib,services}/**/*.test.ts` for the
node project and `src/{components,app}/**/*.test.tsx` for jsdom. Every new test in this feature lives
in `src/i18n/`, which matches neither. Without this change the catalog parity test and the proxy
handler tests would silently never run — green CI, zero coverage. Adding `i18n` to the node project's
brace expansion is the whole fix.

## R10. Cookie attributes

**Decision**: `{ name: 'NEXT_LOCALE', maxAge: 31_536_000, sameSite: 'lax', path: '/', secure: true }`.

**Rationale**: The name is fixed by MC-002 and happens to be next-intl's default (verified in
`routing/config.js`, which also defaults `sameSite: 'lax'` and `localePrefix: 'always'` — both what we
want). One year satisfies the spec's "long-lived" assumption; `path: '/'` satisfies FR-014's
site-wide scope. The cookie holds a language code and no personal data; because it is written only
as the direct result of a user action (FR-030), it is a functional preference rather than something
requiring consent machinery.

**Amended during implementation.** This section originally specified
`secure: config.appEnv !== 'development'`, reading the Config module so the flag could relax on a
plain-HTTP dev server. That is not implementable: `routing.ts` is imported by `navigation.ts`, which
the client-side switcher imports, so **everything this config touches is bundled for the browser**.
Importing Config shipped its `process.env` read to the client, where it threw
`Invalid environment configuration` on every page — confirmed by finding the message in
`.next/static/chunks/`. The cookie is written client-side by next-intl, so the attribute has to be a
static value in a browser-safe module. `secure: true` unconditionally is correct in production and
works in development too, because browsers treat `http://localhost` as a trustworthy origin. Verified
by the Playwright run: the preference persists on `http://localhost:3100`.

## R11. `setRequestLocale` and `requestLocale` are deprecated in this version

**Decision**: Read the locale from `next/root-params`; do not call `setRequestLocale`.

**Rationale**: Discovered during implementation, from an editor warning. next-intl 4.13.7 marks both
`getRequestConfig`'s `requestLocale` parameter and `setCachedRequestLocale` as
`@deprecated Please migrate to next/root-params`. Next 16 exposes every dynamic segment above the
root layout as a root parameter, so `src/app/[locale]/` makes `locale` importable from
`next/root-params` in any Server Component — which is what R7 already noted. `request.ts` reads it
directly and the `setRequestLocale(locale)` call disappears from every page.

The getter can resolve to `undefined` when something renders outside the `[locale]` segment, so the
narrowing in `request.ts` is load-bearing, not defensive.

**Not usable in Client Components** (also Server Actions and Route Handlers), so the switcher still
takes its locale from next-intl's `useLocale()`.

## R12. An unmatched path escapes the localized not-found page

**Decision**: Add `src/app/[locale]/[...rest]/page.tsx` that calls `notFound()`.

**Rationale**: Found by manual testing after the suite was green — the automated coverage had a hole.
`/uk/demo` (the demonstration route without its `[id]`) and `/uk/whatever` match no route inside
`[locale]`, so Next fell through to its own built-in 404: no `lang` attribute, no switcher, English
text only. That breaks FR-010 and contradicts both the spec's "not-found and error pages are
localized" assumption and its "switching from a not-found page" edge case.

`not-found.tsx` inside `[locale]` only handles `notFound()` raised _within_ that segment; an
unmatched URL never enters it. A catch-all route that immediately calls `notFound()` puts those URLs
back inside the segment, where the localized page and the layout (and therefore the switcher) apply.
Covered now by three Playwright cases, including switching locale from a 404.

`[...rest]` cannot be dropped in favour of `not-found.tsx` alone: that file is a boundary, not a
route, so it only catches `notFound()` raised _inside_ the segment. Verified by removing it —
`/uk/demo` then serves Next's built-in English 404.

The 404 body is client-rendered: `notFound()` returns an error shell plus an RSC payload, so the
server HTML carries no `lang`. This is inherent to a root layout under a dynamic segment, which the
Next docs call out as the hard case. Rendering the UI directly instead would return 200 — a soft
404, worse for indexing than a missing `lang`. Accepted as-is.

## R13. `useSearchParams` in the switcher opts every page out of static rendering

**Decision**: Read `window.location.search` inside the click handler instead.

**Rationale**: The switcher renders in the root layout, so it is on every page. Calling
`useSearchParams()` in it failed the build outright:
`useSearchParams() should be wrapped in a suspense boundary at page "/[locale]"`. Wrapping it in
`<Suspense>` would work but degrades every page to client-side rendering for a value needed only at
the moment of a click. The handler runs exclusively in the browser, so reading the live URL there is
both simpler and more accurate. `/en` and `/uk` remain statically prerendered — confirmed in the
build output.
