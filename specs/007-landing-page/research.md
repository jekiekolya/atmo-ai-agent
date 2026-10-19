# Research: Product Landing Page

Every library claim below was checked against the installed version: Next.js 16.3.0, next-intl 4.13.7,
Tailwind CSS 4.3.3, tw-animate-css 1.4.0, lucide-react 1.31.0, @base-ui/react 1.7.0.

## R1 — Where the page lives

**Decision**: The page stays at `src/app/[locale]/page.tsx` and renders `AppShell` itself, as the
not-found page does. It does not move under `(public)`.

**Rationale**: `(public)/layout.tsx` renders `AppShell` with no logo and no extra items, which is what
sign-in and invite need (spec FR-023). A layout cannot receive anything from its page, so a landing page
under `(public)` would need the layout to branch on the path or a nested layout of its own. Either way
costs more than the page passing its own slots. The proxy guard decides by path segment, not route
group, so the move would not change protection either.

**Alternatives considered**: Moving under `(public)` with a nested `(landing)` group and its own layout —
one more file and one more level for no behavioural gain.

## R2 — Header

**Decision**: The page passes `AppShell` two existing slots:

- `logo`: `<Link href={PAGES.home}>` around `<BrandLogo className="h-6 w-auto" />`, the same markup the
  signed-in header uses with `PAGES.dashboard`;
- `account`: a Sign in `Link` styled with `buttonVariants({ variant: "outline", size: "sm" })`.

**Rationale**: `AppShell` already places `logo` first and `account` after the theme and language controls,
and its header wraps (`flex-wrap`), so four items fit at 320px. Links styled as buttons follow the repo's
existing pattern (`dashboard/chat/not-found.tsx`, `conversation-list.tsx`). The header button is
`outline` so that only the hero's call to action is drawn in the primary colour.

**Alternatives considered**: Base UI `Button` with `render={<Link/>}` — not used anywhere in the repo,
and it needs `nativeButton={false}` to stop announcing a link as a button.

## R3 — Footer

**Decision**: `AppShell` gains an optional `footer` slot, rendered as `<footer>` after `<main>`. The
landing page passes the product name (`common.appName`).

**Rationale**: A footer inside `<main>` is not a page footer (contentinfo landmark), and `AppShell` owns
everything around `<main>`. `body` is already a full-height flex column with `main` as `flex-1`, so the
footer sits at the bottom with no layout work. The slot is optional, so every other page is unchanged.

**Alternatives considered**: A `<footer>` inside the page's children — it renders inside `<main>`, where
assistive technology does not treat it as the page's footer.

## R4 — Motion: styles only, finite, reveal by opacity

**Decision**: All motion is CSS. There is no client component and no script.

- **Hero text**: `animate-in fade-in` from tw-animate-css.
- **Question and answer**: `animate-in fade-in` with `delay-*` and `fill-mode-backwards`, so each is
  invisible until its delay passes.
- **Typing indicator**: two keyframes added to `globals.css` `@theme`, beside the loader's. One shows the
  indicator and then hides it within a fixed window; the other moves its dots a fixed number of times.
  Neither repeats indefinitely.
- **Reduced motion**: every animated element carries `motion-reduce:animate-none`, and the indicator
  carries `motion-reduce:hidden`.

The answer bubble is in the layout from the first paint, with only its opacity animated. The indicator is
positioned over the start of the answer's space. Nothing moves the layout.

Timeline: [data-model.md § Motion timeline](./data-model.md#motion-timeline). The sequence ends about
2.2s after load.

**Rationale**:

- **FR-018 and MC-003**: CSS keeps the page a static server render that works without scripts. CSS
  animations run without JavaScript, so a no-script visitor also gets the final state.
- **Clarification (A)**: each mount of the page restarts the animations. Client navigation (language
  switch, a logo, Back) mounts it again, so the sequence replays with nothing remembered. A page the
  browser restores from its back-forward cache is not mounted again and keeps its finished state. That
  limit was accepted in analysis (spec FR-015) instead of a script that restarts the animations on
  `pageshow`. Playwright's Chromium disables that cache, so no automated test can see the case.
- **FR-017**: a theme change only toggles a class on `<html>` and does not change any `animation-name`,
  so nothing restarts.
- **FR-016**: `animation: none` from `motion-reduce:animate-none` beats the `animate-in` utility.
  Variants sort after base utilities in Tailwind v4. The delayed elements then show at full opacity
  immediately, because `fill-mode` no longer applies.
- **Finite animations** let the e2e check prove "nothing moves afterwards": every entry of
  `document.getAnimations()` reaches `finished`.

**Alternatives considered**:

- A client component with timers — it adds a script and a hydration edge for something CSS already does.
- Mounting the answer after a delay — it shifts the layout and leaves the answer out of the delivered
  HTML (FR-018).
- `animate-bounce` for the dots — it repeats indefinitely, and making it finite needs the
  iteration-count variable to win over Tailwind's `animation` shorthand, which relies on utility order.

## R5 — The conversation for assistive technology

**Decision**: The conversation is a `<figure>` named by a visible `<figcaption>` ("Example
conversation"). Each bubble starts with a visually hidden speaker label: "Customer", and the product name
for the agent. The label is formatted through `landing.example.speaker` (`"{name}:"`), so its
punctuation comes from the catalog rather than the markup (Principle VII). The typing indicator is `aria-hidden="true"`. Nothing inside is focusable or interactive,
and there is no live region.

**Rationale**: A figure is named by its figcaption, and its content stays readable. `role="img"` with a
label would instead make the question and answer presentational, so they could not be read (FR-014). The
visible caption also tells sighted visitors it is an example, not a working chat (FR-013). Without a live
region, a screen reader announces nothing on its own as the sequence plays.

**Alternatives considered**:

- `role="img"` with `aria-label` holding the whole exchange — the text would be duplicated in the
  catalogs and could not be selected.
- `role="log"` — it implies live updates, the opposite of the requirement.

## R6 — Brand red: glow strength, icon surface, and which text sits on the glow

**Decision**:

- **Glow**: one absolutely positioned, blurred shape behind the hero text and conversation, filled with
  `brand-mark/10`. The hero is clipped with `overflow-hidden`, so the glow never reaches the header.
- **Text over the glow**: the headline and subheading use `foreground`, never `muted-foreground`.
- **Benefit icons**: `text-brand-mark` directly on the card surface, with no tinted tile behind them.

**Rationale**: These are the measured pairs against today's theme values.

| Pair                                         | Light | Dark  | Needs |
| -------------------------------------------- | ----- | ----- | ----- |
| `muted-foreground` on `brand-mark/5` over bg | 4.28  | 7.78  | 4.5   |
| `foreground` on `brand-mark/10` over bg      | 14.49 | 18.45 | 4.5   |
| `ring` on `brand-mark/10` over bg            | 3.95  | 7.59  | 3     |
| `brand-mark` on `card`                       | 5.87  | 3.02  | 3     |
| `brand-mark` on `muted`                      | 5.33  | 2.50  | 3     |

- **Muted text**: light-theme `muted-foreground` already sits close to 4.5:1 on the bare background, and
  any glow under it fails. So text over the glow uses `foreground` only.
- **Glow strength**: at 10%, `foreground` and the call to action's focus ring still pass with room. A blur
  never exceeds the fill's alpha, so 10% is the strongest point (spec FR-024).
- **Icon surface**: brand red on the dark card passes at 3.02:1. On a muted tile it fails, so the icons
  sit directly on the card.

These pairs join `src/conventions/theme-contrast.test.ts`. A scan beside them holds the hero's
`brand-mark` tint at no more than `/10`, the same way the destructive tints are held today.

**Alternatives considered**:

- A lighter brand red for the dark theme — a second brand value, which feature 005 FR-010 rules out.
- Muted subheading text with the glow kept away from it — the blur's reach depends on the viewport and
  cannot be checked by a static test.

## R7 — Brand-red allow-list

**Decision**: `src/conventions/brand-mark-usage.test.ts` adds two files to `ALLOWED`:

- `src/components/landing/landing-hero/landing-hero.tsx` (the glow);
- `src/components/landing/benefit-cards/benefit-cards.tsx` (the icons).

Each entry cites spec 007 FR-026.

**Rationale**: The test is how feature 005's FR-011 is enforced. Naming the two files keeps every other
file, including the signed-in area and every button, under the old rule (spec FR-027, Out of Scope).

## R8 — Logo links on sign-in and invite

**Decision**: On both pages, `<BrandLogo className="mx-auto h-10 w-auto" />` becomes
`<Link href={PAGES.home} className="self-center rounded-sm"><BrandLogo className="h-10 w-auto" /></Link>`.

**Rationale**:

- **Look unchanged**: the parent is a flex column, so `self-center` centres the link the way `mx-auto`
  centred the image, and size and colours are unchanged.
- **Accessible name**: the link takes its name from the image's label, "Atmo AI", as the signed-in header
  link already does (feature 005 FR-022).
- **Focus**: the global `outline-ring` base style draws the focus outline in `ring`. That is 3:1 or more
  in both themes, never brand red.
- **Invite page**: it already sets `referrer: "no-referrer"`, so following the logo sends the token
  nowhere.
- **Duplication**: the two pages duplicate three lines, as they already duplicate the logo. An extracted
  component would differ per caller in `href` and size, and wrapping it would cost more than it saves.

## R9 — Static rendering, and no session

**Decision**: The page calls only `getTranslations` (through `next/root-params`) and renders no component
that reads cookies, headers, the session, or the database. `npm run build` must keep listing `/en` and
`/uk` as prerendered, as it does today. The check is by hand in the quickstart, because a build inside
Vitest would cost more than the guard is worth.

**Rationale**: Feature 001's request config resolves the locale from the root param. That is why
`.next/prerender-manifest.json` already lists `/en` and `/uk`. `ThemeToggle`, `LocaleSwitcher` and the
lucide icons are client components, but none of them makes a route dynamic.

## R10 — Copy and catalogs

**Decision**: The `home` namespace is removed. A `landing` namespace holds every new string; the full
text is in [data-model.md § Catalog keys](./data-model.md#catalog-keys). The product name for the agent's
speaker label and the footer reuses `common.appName`. `landing.metaTitle` leaves the name to
`common.titleTemplate`, as the existing catalog test requires.

**Rationale**: next-intl's typed keys (Gate 1) fail the build on any leftover `home.*` reference, and
`catalogs.test.ts` (Gate 2) fails on any en/uk gap. Two e2e files assert the old headline:
`locale-switching.spec.ts` and `locale-resolution.spec.ts`. They switch to the new headline and keep
their checks; the first already covers spec FR-030 on this very page.

**Amendment (implementation)**: the layout's `title.template` does not apply to the page of the layout's
own segment, so the landing page's title came out without "— Atmo AI". The page now returns an `absolute`
title built from `common.titleTemplate` and `landing.metaTitle`. The sign-in and invite pages sit one
segment lower and keep using the template.
