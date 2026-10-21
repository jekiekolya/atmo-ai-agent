# UI Contract: Product Landing Page

What each piece promises the rest of the product and its tests. The page's tree and copy are in
[data-model.md](../data-model.md).

## `AppShell` — new `footer` slot

```ts
AppShell({ logo?, nav?, account?, footer?, children }: {
  logo?: ReactNode; nav?: ReactNode; account?: ReactNode; footer?: ReactNode; children: ReactNode;
})
```

- When `footer` is given, it is rendered inside one `<footer>` element placed after `<main>`. That element
  is the page's `contentinfo` landmark.
- When `footer` is absent, no `<footer>` is rendered. Every existing caller is unchanged.
- `logo`, `nav`, `account`, and the header's order are unchanged (feature 005 FR-021).

## `LandingHero` — `src/components/landing/landing-hero/landing-hero.tsx`

A server component with no props. It reads `landing.*` through `useTranslations`.

- A `<section>` holding:
  - the page's only `h1`, `landing.headline`;
  - a paragraph, `landing.subheading`;
  - one link named `landing.signIn` to `PAGES.signIn`, drawn with `buttonVariants({ size: "lg" })` in the
    primary colour;
  - `<ExampleConversation />`.
- **Glow**: a decorative element, `aria-hidden`, filled with `brand-mark` at no more than `/10`. It is the
  only brand red in the file.
- **Text colour**: the headline and subheading are drawn in `foreground` (research R6).
- **Motion**: a one-time fade-in, `motion-reduce:animate-none`.

## `ExampleConversation` — `src/components/landing/example-conversation/example-conversation.tsx`

A server component with no props.

- One `figure` whose accessible name is its `figcaption`, `landing.example.caption`.
- **Customer bubble**: a visually hidden speaker label, `landing.example.speaker` with
  `name: landing.example.customer`, then `landing.example.question`.
- **Agent bubble**: a visually hidden speaker label, `landing.example.speaker` with
  `name: common.appName`, then `landing.example.answer`. It occupies its layout space from the first
  paint.
- **No literal text**: no text, punctuation included, is written in the markup.
- **Typing indicator**: `aria-hidden="true"`, positioned over the agent bubble's space, `motion-reduce:hidden`,
  `pointer-events-none` so the answer beneath it stays selectable.
- **Not interactive**: no element inside is focusable or interactive — no link, button, input, or
  `tabindex`. There is no live region and no `role` beyond the figure's.
- **Motion**: every animation is finite and carries `motion-reduce:animate-none`. The delayed bubbles use
  `fill-mode-backwards`. The timing is in [data-model.md § Motion timeline](../data-model.md#motion-timeline).

## `BenefitCards` — `src/components/landing/benefit-cards/benefit-cards.tsx`

A server component with no props.

- Four `Card`s, in the order `allHours`, `language`, `history`, `solar`.
- Each card holds a lucide icon, an `h2` title, and a one-sentence paragraph.
- **Icons**: they are `aria-hidden`, which lucide sets by default when no label is given, and drawn in
  `text-brand-mark` directly on the card surface, with no tinted tile.
- **Brand red**: none outside the icons.

## Landing page — `src/app/[locale]/page.tsx`

- **Metadata**: `generateMetadata` returns `{ title: landing.metaTitle, description: landing.metaDescription }`.
  The layout's template renders the title as "… — Atmo AI".
- **Shell**: renders `AppShell` with:
  - `logo`: a link to `PAGES.home` around `BrandLogo` (h-6);
  - `account`: a link named `landing.signIn` to `PAGES.signIn`, outline and small;
  - `footer`: `common.appName`.
- **Children**: `<LandingHero />` followed by `<BenefitCards />`.
- **Session and data**: it reads no session, cookie, header, or database, and never redirects.
- **Static render**: it is prerendered for every locale.

### HTTP invariants

| Request                         | Response                                                                |
| ------------------------------- | ----------------------------------------------------------------------- |
| `GET /en`, `GET /uk`, anonymous | 200, landing page                                                       |
| `GET /en`, signed in            | 200, the same landing page; no redirect                                 |
| `GET /`                         | unchanged: negotiated redirect to `/{locale}` (feature 001)             |
| Sign in link, anonymous         | `/{locale}/sign-in`, form shown                                         |
| Sign in link, signed in         | `/{locale}/sign-in` → 307 to `/{locale}/dashboard` (feature 003 FR-031) |

## Sign-in and invite pages — logo link

`src/app/[locale]/(public)/sign-in/page.tsx` and `src/app/[locale]/(public)/invite/[token]/page.tsx`:

- **Link**: the centred logo is wrapped in a link to `PAGES.home`, styled `self-center rounded-sm`. Its
  accessible name is the logo's label, the localized product name.
- **Look**: `BrandLogo` keeps `h-10 w-auto`. The page's position, size, and colours are unchanged.
- **Focus**: the focus outline comes from the global `outline-ring`. No brand red is drawn on focus or
  hover.
- **Everything else unchanged**:
  - the header holds no logo;
  - sign-in's redirect for a signed-in visitor;
  - the invite page's signed-in notice and Sign out;
  - its `no-referrer` policy.
