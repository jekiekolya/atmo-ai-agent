# Implementation Plan: i18n Foundation

**Branch**: `001-i18n-foundation` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-i18n-foundation/spec.md`

## Summary

Move every route under a `/[locale]/...` segment, resolve a visitor's language in the order
URL → cookie → `Accept-Language` → default, and give every page a dropdown switcher that keeps the
visitor on the same address. All copy moves into per-locale catalogs whose completeness is proven
twice before merge: TypeScript derives the key set from the English catalog, and a Vitest test
compares key sets across locales.

The technical spine is next-intl 4.13 wired into Next.js 16's `proxy.ts` (the renamed
`middleware.ts`), with the root layout moved under the dynamic segment so `locale` becomes a Next 16
_root parameter_. Two behaviours the spec pinned down in clarification cannot be had from next-intl's
defaults — writing the preference only on an explicit switch (FR-030) and never caching the
negotiation redirect (FR-031) — so a thin project-owned wrapper around next-intl's middleware
enforces both. That wrapper is the only non-obvious piece of this feature and is justified in
Complexity Tracking.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node >= 22.12

**Primary Dependencies**: Next.js 16.3 (App Router, Turbopack), React 19.2, **next-intl 4.13.7**
(new — mandated by the constitution; peer range verified as `next: ^16.0.0`), Tailwind CSS v4,
shadcn/ui on `@base-ui/react` 1.7

**Storage**: N/A — no database in this feature. Catalogs are committed JSON; the visitor's
preference lives in their browser cookie.

**Testing**: Vitest 4 (`unit` project in node, `ui` project in jsdom), Playwright 1.62 (chromium)

**Target Platform**: Server-rendered web app; `proxy.ts` runs on the Node.js runtime (the Next 16
default for proxy)

**Project Type**: Single Next.js application (no separate frontend/backend)

**Performance Goals**: No new per-request work beyond locale negotiation in the proxy, which is
header and cookie parsing only — no I/O, no database. Catalogs are imported server-side, so
translations add nothing to the client bundle except the messages a client component actually needs.

**Constraints**: The negotiation redirect must never be stored by a browser or shared cache
(FR-031). The preference cookie must be written only by an explicit switch (FR-030). No new
environment variable (FR-004). No user-facing string outside a catalog (FR-018).

**Scale/Scope**: 2 locales, 2 catalogs, ~4 routes (localized shell, demonstration detail route,
localized not-found), 1 new UI primitive, 1 proxy.

## Constitution Check

_GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design. Both passes recorded._

| Principle                               | Verdict                         | How this plan satisfies it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Type-Safe by Default**             | PASS                            | All new code is TypeScript. Message keys are typed by augmenting next-intl's `AppConfig` interface with `Locale` and `Messages` (verified: `AppConfig` is an empty interface in `use-intl` intended for declaration merging), which is what makes MC-004 real. No `any` is planned anywhere; if the Set-Cookie header manipulation needs one it stays at that boundary with an inline reason.                                                                                                                                                                                                                                                                                           |
| **II. Simple, Modular, Readable**       | PASS with one tracked deviation | Locale rules live in `src/i18n/`, UI renders, `src/proxy.ts` is a thin adapter over a testable handler module. The one deviation — stripping a `Set-Cookie` header — is recorded in Complexity Tracking with the simpler alternative and why it fails.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **III. Spec-First Delivery**            | PASS                            | Spec written and clarified (4 recorded decisions) before this plan. No behaviour here is absent from the spec.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **IV. Tested Business Logic**           | PASS                            | **Test-first**: the locale constant, per-request locale resolution and its fallback, proxy resolution order, cookie-write suppression, redirect cache headers, and catalog parity — all `src/i18n/**`, all Vitest, failing test first, commit order shows it. **Test-together**: the switcher component, the locale-aware formatting rendered by the demonstration route (both jsdom), and the Playwright e2e. Formatting is asserted where it renders rather than behind a helper module — no such module exists, and inventing one to satisfy a test regime would violate Principle II. Constitution IV names locale switching as mandatory Playwright coverage; FR-025 is that test. |
| **V. Centralized Config, Zero Secrets** | PASS                            | No new environment variable and no `.env.example` change (FR-004). The supported-locale set is a typed constant in `src/i18n/locales.ts`, not configuration — a deliberate distinction: Config exists for values that differ per deployment, and FR-002 requires these _not_ to. The cookie's `secure` flag reads `config.appEnv` from the existing Config module rather than touching `process.env`.                                                                                                                                                                                                                                                                                   |
| **VI. Accountable AI Agents**           | N/A                             | No agent surface in this feature. The agent replying in the customer's locale is explicitly out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **VII. Localized by Default**           | PASS                            | This feature _is_ the principle's implementation. Build-time completeness (FR-020, FR-022) matches the constitution's "a key missing from any supported locale is a build failure, not a fallback".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Technology Constraints**              | PASS                            | next-intl is the constitution's named i18n library. The shadcn/ui `select` primitive is pulled through the CLI, which the constitution explicitly exempts. No second component library, no new styling system.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**New runtime dependency**: `next-intl@^4.13.7`. Required by the constitution's fixed stack, so this
is not a new-dependency decision — but for the record: it provides locale-aware routing, the
localized navigation helpers MC-001 requires, ICU message formatting with plural support (FR-024),
and `Intl`-backed formatters (FR-023). It brings `use-intl`, `@formatjs/intl-localematcher` and
`negotiator` as transitive dependencies. Nothing else is added.

## Project Structure

### Documentation (this feature)

```text
specs/001-i18n-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions with evidence
├── data-model.md        # Phase 1 output — locale, catalog, key, preference
├── quickstart.md        # Phase 1 output — how to run and verify
├── contracts/
│   ├── routing.md       # Address shape, resolution order, redirect semantics
│   ├── catalog.md       # Catalog format, key rules, completeness gates
│   └── switcher.md      # Switcher behaviour and accessibility contract
├── checklists/
│   └── requirements.md  # Written by /speckit-specify
└── tasks.md             # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
src/
├── proxy.ts                          # NEW — Next 16 convention (renamed from middleware.ts);
│                                     #   thin: delegates to i18n/proxy-handler
├── i18n/                             # NEW — all locale rules live here
│   ├── locales.ts                    #   SUPPORTED_LOCALES / DEFAULT_LOCALE typed constant (FR-002)
│   ├── locales.test.ts               #   test-first
│   ├── routing.ts                    #   defineRouting(): prefix always, cookie, detection
│   ├── navigation.ts                 #   createNavigation(): Link, useRouter, usePathname (MC-001)
│   ├── request.ts                    #   getRequestConfig(): loads the catalog per request
│   ├── request.test.ts               #   test-first
│   ├── proxy-handler.ts              #   FR-030 cookie suppression + FR-031 cache headers
│   ├── proxy-handler.test.ts         #   test-first
│   └── catalogs.test.ts              #   key-set parity across locales (MC-005), test-first
├── messages/                         # NEW — committed catalogs (FR-003)
│   ├── en.json                       #   authoritative key set (FR-019)
│   └── uk.json
├── types/
│   └── next-intl.d.ts                # NEW — AppConfig augmentation: Locale + Messages (MC-004)
├── app/
│   ├── layout.tsx                    # DELETED — root layout moves under [locale]
│   ├── page.tsx                      # DELETED — replaced by the localized shell
│   ├── globals.css                   # unchanged
│   └── [locale]/                     # NEW — every route lives here (FR-005)
│       ├── layout.tsx                #   root layout: <html lang>, header, switcher
│       ├── page.tsx                  #   localized shell (FR-027)
│       ├── not-found.tsx             #   localized 404
│       └── demo/[id]/page.tsx        #   demonstration route (FR-028)
└── components/
    ├── locale-switcher/              # NEW — one folder per component (project convention)
    │   ├── locale-switcher.tsx       #   client component (FR-012)
    │   └── locale-switcher.test.tsx  #   test-together
    └── ui/                           # flat — the shadcn CLI owns these paths
        ├── button.tsx                # unchanged
        ├── button.test.tsx           # unchanged
        └── select.tsx                # NEW — vendored via shadcn CLI (MC-007)

e2e/
├── smoke.spec.ts                     # updated — existing paths become locale-prefixed
└── locale-switching.spec.ts          # NEW — FR-025, FR-026 (MC-006)

next.config.ts                        # updated — wrap with createNextIntlPlugin()
vitest.config.mts                     # updated — unit project must include src/i18n
```

**Structure Decision**: Single Next.js application, unchanged in shape. Three structural facts drive
the layout above:

1. **One folder per component.** Every component we author gets its own directory holding the
   component and its test, named in full rather than `index.tsx` so the file stays greppable and the
   editor does not fill with identical tabs. `src/components/ui/` is the deliberate exception: the
   shadcn CLI writes flat files there, and fighting it on every `shadcn add` would cost more than the
   consistency is worth.
2. **The root layout moves under the dynamic segment.** Next.js 16 explicitly supports this: _"The
   root layout can be under a dynamic segment, for example when implementing internationalization
   with `app/[lang]/layout.js`. Dynamic segments before the root layout are root parameters."_
   `src/app/layout.tsx` is therefore deleted rather than kept — a root layout above `[locale]` would
   have to render `<html lang>` without knowing the locale, which breaks FR-010.
3. **`middleware.ts` does not exist in Next 16.** The convention is `proxy.ts` exporting `proxy`.
   next-intl's entry point is still `next-intl/middleware` (there is no `next-intl/proxy` export —
   verified against the package's export map), so the import name and the file name deliberately
   differ. `src/proxy.ts` sits beside `src/app/`, as the file convention requires.

## Complexity Tracking

| Violation                                                                                                   | Why Needed                                                                                                                                                                                                                                                    | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/proxy-handler.ts` wraps next-intl's middleware to remove `Set-Cookie: NEXT_LOCALE` from responses | FR-030 requires the preference to be written **only** by an explicit switch. next-intl's `syncCookie` overwrites the cookie on any document navigation whose served locale differs from the stored one — precisely the shared-link scenario the spec forbids. | Setting `localeCookie: false` was the obvious fix and does not work: the same flag gates _reading_ the cookie (`getLocaleFromCookie` returns early when `localeCookie` is falsy), which would delete priority 2 of FR-006. The two behaviours are coupled behind one option, so suppressing the write while keeping the read requires acting on the response. Hand-rolling the whole negotiation instead would re-implement `Accept-Language` matching that next-intl already does correctly. |
| A demonstration route (`/[locale]/demo/[id]`) ships as product surface                                      | FR-028, decided in clarification. FR-013 (dynamic segment + query string survive a switch) and FR-023/FR-024 (locale-aware formatting, plurals) have nothing to run against otherwise.                                                                        | Verifying only against the root was offered during clarification and declined; it would leave three requirements unverified until an unrelated future feature happens to add a nested route.                                                                                                                                                                                                                                                                                                  |

## Phase Status

- [x] Phase 0 — research complete → [research.md](./research.md)
- [x] Phase 1 — design complete → [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)
- [x] Constitution check re-evaluated after design — still PASS, no new deviations
- [ ] Phase 2 — `/speckit-tasks` (not this command)
