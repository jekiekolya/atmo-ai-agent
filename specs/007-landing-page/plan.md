# Implementation Plan: Product Landing Page

**Branch**: `007-landing-page` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-landing-page/spec.md`

## Summary

`src/app/[locale]/page.tsx` stays where it is and keeps rendering `AppShell` itself (R1). It now passes
`AppShell` three things:

- the linked compact logo, in the `logo` slot;
- an outline Sign in link, in the `account` slot;
- the product name, in a new optional `footer` slot (R2, R3).

Its content comes from three server components in a new `src/components/landing/` group:

- **`LandingHero`**: the headline, subheading, primary Sign in link, and a faint brand-red glow.
- **`ExampleConversation`**: a `<figure>` with a visible caption, two bubbles with hidden speaker labels,
  and an `aria-hidden` typing indicator.
- **`BenefitCards`**: four cards, with lucide icons in brand red.

**Motion** is CSS only (R4):

- tw-animate-css `animate-in` with delays and `fill-mode-backwards`, plus two finite keyframes for the
  typing indicator in `globals.css`;
- `motion-reduce:animate-none` on every animated element.

The page stays a static, session-free server render that replays on every mount and works without
scripts.

**Brand red** is held to 10% in the glow, and all text over the glow uses `foreground`. The icons sit
directly on the card, at 3.02:1 in the dark theme (R6). New pairs join the contrast gate, and the two
landing files join the brand-red allow-list (R7).

**Logo links**: on sign-in and invite, the centred logo is wrapped in a link to the landing page, with
its look unchanged (R8).

**Copy** moves from `home.*` to `landing.*` in en and uk (R10).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node 24

**Primary Dependencies**: All already present.

- Next.js 16.3.0, with `next/root-params` static rendering.
- next-intl 4.13.7.
- Tailwind CSS 4.3.3.
- tw-animate-css 1.4.0.
- lucide-react 1.31.0.

No new dependency (FR-031, MC-001).

**Storage**: N/A — no schema or migration.

**Testing**:

- Vitest `ui`: the three landing components and `AppShell`.
- Vitest `unit`: the contrast and brand-red conventions, and the catalogs.
- Playwright: smoke, a new `landing.spec.ts`, brand, locale-switching, and locale-resolution.

**Target Platform**: Evergreen browsers. Chromium is automated. Safari and VoiceOver are checked by hand
(quickstart §3).

**Project Type**: Next.js App Router web application, single project.

**Performance Goals**:

- The page is prerendered per locale and reads no request data.
- No layout shift from the sequence: opacity only, with space reserved.
- Every animation ends by about 2.2s.

**Constraints**:

- WCAG AA in both themes.
- Brand red only as the glow (≤ 10%) and the icons (≥ 3:1).
- No script for motion.
- Usable at 320px.
- en/uk parity.
- No session read.

**Scale/Scope**: About 20 files.

- 1 page and 2 public pages;
- `AppShell` and its test;
- 3 new components with tests;
- `globals.css`;
- 2 catalogs;
- 2 convention tests;
- 5 e2e files, 1 of them new.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | How                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Type-Safe by Default**        | PASS   | Components take no props or typed slots. No `any`, no suppression.                                                                                                                                                                                                                                                                                |
| **II. Simple, Modular, Readable**  | PASS   | Three render-only server components, composed from `Card`, `buttonVariants`, and `BrandLogo`. No client component, no business logic. The `footer` slot is the smallest change that gives the page a real footer. There is no shared logo-link component, because its callers differ in `href` and size (R8).                                     |
| **III. Spec-First Delivery**       | PASS   | Spec 007 is clarified (one session). Feature 005's FR-011, FR-023 and FR-024 are superseded by name in spec 007's "Relation to Earlier Features"; spec 005 gets a pointer under those FRs during implementation, as 005 did for 002's FR-022.                                                                                                     |
| **IV. Tested Business Logic**      | PASS   | No domain, config, agent, or validation module is touched. Everything is test-together (table below).                                                                                                                                                                                                                                             |
| **V. Centralized Config**          | PASS   | No configuration and no `process.env`.                                                                                                                                                                                                                                                                                                            |
| **VI. Accountable AI Agents**      | N/A    | No agent code. The example conversation is written copy, not model output.                                                                                                                                                                                                                                                                        |
| **VII. Localized by Default**      | PASS   | Every string is under `landing.*` in en and uk. The product name reuses `common.appName`. `home.*` is removed. The Ukrainian example is written in Ukrainian.                                                                                                                                                                                     |
| **VIII. Addresses Have One Owner** | PASS   | Links use `PAGES.home` and `PAGES.signIn` through next-intl's `Link`. No route is added, so `routes.test.ts` is unchanged. e2e files keep their literal paths.                                                                                                                                                                                    |
| **Technology Constraints**         | PASS   | No new dependency. Colours are theme tokens only: `brand-mark`, `foreground`, `card`, `primary`, `muted`. The two keyframes are added to the `@theme` block beside the loader's. Every library behaviour relied on was checked in `node_modules`: tw-animate utilities, the lucide default `aria-hidden`, and the root-params prerender (R4, R9). |

Post-design re-check: unchanged, all PASS.

### Test regime per module (Principle IV)

| Module                                        | Regime        | Covered by                                                                                                                                                                                                               |
| --------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shell/app-shell/` (`footer` slot)            | Test-together | `app-shell.test.tsx`: footer after main as `contentinfo` when given; none otherwise                                                                                                                                      |
| `landing/landing-hero/` (new)                 | Test-together | `landing-hero.test.tsx`: one `h1`, Sign in link to the sign-in page, glow `aria-hidden`, conversation present                                                                                                            |
| `landing/example-conversation/` (new)         | Test-together | `example-conversation.test.tsx`: `figure` named by its caption, question and answer readable with speaker labels, indicator `aria-hidden`, no focusable element, every animated element has `motion-reduce:animate-none` |
| `landing/benefit-cards/` (new)                | Test-together | `benefit-cards.test.tsx`: four `h2`s in order, each with one sentence, icons hidden from assistive technology                                                                                                            |
| `[locale]/page.tsx`, sign-in and invite pages | Test-together | `e2e/landing.spec.ts` (new), `e2e/smoke.spec.ts` (en + uk), `e2e/brand.spec.ts` (logo link replaces the non-link check), `auth.spec.ts` and `invite.spec.ts` unchanged                                                   |
| `globals.css` keyframes                       | Test-together | `e2e/landing.spec.ts`: finished by 3.5s; none under reduced motion; no restart on theme change; replay after in-product Back                                                                                             |
| Theme behaviour on the landing page (FR-024)  | Test-together | existing `e2e/theme-switching.spec.ts`, which runs entirely on `/en`, unchanged                                                                                                                                          |
| Brand-red placement and glow strength         | Test-together | `brand-mark-usage.test.ts` (+2 allowed files), `theme-contrast.test.ts` (+3 pairs, glow ≤ /10 scan)                                                                                                                      |
| Catalogs                                      | Test-together | existing `catalogs.test.ts` parity and naming rules; `locale-switching.spec.ts` and `locale-resolution.spec.ts` move to the new headline                                                                                 |

## Project Structure

### Documentation (this feature)

```text
specs/007-landing-page/
├── plan.md                 # this file
├── research.md             # R1–R10
├── data-model.md           # page tree, catalog keys (en/uk copy), motion timeline, contrast pairs
├── quickstart.md           # automated, build, and by-hand validation
├── contracts/ui.md         # AppShell footer slot, landing components, page invariants, logo links
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
src/app/
├── globals.css                               # + typing-indicator keyframes in @theme
└── [locale]/
    ├── page.tsx                              # REWRITTEN — metadata, AppShell slots, hero + cards
    ├── (public)/sign-in/page.tsx             # logo wrapped in Link → PAGES.home
    └── (public)/invite/[token]/page.tsx      # logo wrapped in Link → PAGES.home

src/components/
├── shell/app-shell/app-shell.tsx             # + optional footer slot
├── shell/app-shell/app-shell.test.tsx
└── landing/                                  # NEW group
    ├── landing-hero/
    │   ├── landing-hero.tsx
    │   └── landing-hero.test.tsx
    ├── example-conversation/
    │   ├── example-conversation.tsx
    │   └── example-conversation.test.tsx
    └── benefit-cards/
        ├── benefit-cards.tsx
        └── benefit-cards.test.tsx

src/conventions/brand-mark-usage.test.ts      # + two landing files (FR-026)
src/conventions/theme-contrast.test.ts        # + glow and icon pairs, glow ≤ /10 scan
src/messages/en.json, uk.json                 # − home.*, + landing.*

e2e/landing.spec.ts                           # NEW — Sign in, session-unaware, motion, 320px
e2e/smoke.spec.ts                             # + /en and /uk
e2e/brand.spec.ts                             # sign-in/invite logo: link to /{locale}
e2e/locale-switching.spec.ts                  # new headline
e2e/locale-resolution.spec.ts                 # new headline
specs/005-atmo-brand/spec.md                  # pointers under FR-011, FR-023, FR-024 → spec 007
```

**Structure Decision**: The landing components form their own domain group, one folder per component, as
CLAUDE.md prescribes and MC-005 asks. The header and footer are not components of their own: they are
slot contents the page passes to `AppShell`, as the signed-in layout already does.

## Complexity Tracking

No violations to justify.

## Phase Status

- [x] Phase 0 — research.md (no NEEDS CLARIFICATION left)
- [x] Phase 1 — data-model.md, contracts/ui.md, quickstart.md
- [ ] Phase 2 — tasks.md (`/speckit-tasks`)
