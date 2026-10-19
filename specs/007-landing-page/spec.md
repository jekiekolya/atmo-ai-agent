# Feature Specification: Product Landing Page

**Feature Branch**: `007-landing-page`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Landing page at the locale root (/{locale}). Replace today's placeholder home page — a heading and a paragraph addressed to end customers, no logo, no way forward — with a polished, minimal product landing page, and let visitors on the sign-in and invite pages return to it through the logo. Keep it minimal: best practice, least code, only what matters. AUDIENCE: partner companies in the solar-energy field (B2B), and our staff showing the product to them. Not end customers — they have no way in yet. The copy speaks to a partner: AI support for your customers. COPY: the product's purpose and what exists today, nothing more — an AI support agent for the partner's end customers, available around the clock, answering in the customer's language, keeping the conversation history, built for solar energy. No figures, testimonials, customer logos, pricing, or features not yet built (integration with partner data, handoff to a human, analytics, per-partner data isolation). All copy through next-intl in en and uk; the old home.title / home.intro copy is replaced. STRUCTURE: (1) header — compact logo first, linking to the landing page; then the theme and language controls and a Sign in button. (2) hero — headline, subheading, primary Sign in call to action; beside it an illustrative example conversation (a customer's question and the agent's answer, localized), stacking under the text on narrow screens; a decorative background behind the hero. (3) three or four benefit cards, each an icon, a title and one sentence. (4) a short footer with the product name. No raster images, no contact form or mailto, no FAQ, no 'how it works' section. MOTION: on load the hero fades in and the example conversation plays once — the question appears, then a typing indicator, then the answer. Under prefers-reduced-motion the final state shows at once, with no motion. No scroll-triggered animation. Assistive technology reads the conversation as one labelled illustrang indicator is not announced. SESSION: the landing page is informational and session-unaware — identical for anonymous and signed-in visitors, never redirects, reads neither the session nor the database. Both Sign in actions go to the locale's sign-in page, which already sends a signed-in visitor to the dashboard, so a signed-in visitor reaches the dashboard in one click with no new auth logic. Accepted trade-off: a signed-in visitor sees the label 'Sign in'. PUBLIC PAGES WHEN SIGNED IN — unchanged, and the spec says so: sign-in stays guest-only (003 FR-031); the invite page keeps its signed-in notice and Sign out (the fix merged in PR #22); the not-found page stays visible to everyone and its back-home link still leads to the landing page. LOGO NAVIGATION: the larger centred logo on the sign-in page and on the invite / set-password page becomes a link to the landing page in the current language, its accessible name the localized product name; its look is unchanged. This supersedes feature 005's FR-024 ('not a link and not focusable') and its User Story 2 scenario 3. The landing page's own header logo supersedes FR-023 for the landing page only — the header on sign-in and invite still shows no logo. The signed-in header logo keeps linking to the dashboard (005 FR-021). BRAND AND THEME: light and dark themes, WCAG AA for text and controls; theme tokens only, no scattered colour literals; responsive down to phone width. Brand red on the landing page: besides the logo, it may appear as decorative accents that carry no meaning and are not text — a soft glow in the hero's background and the benefit cards' icons, each icon at least 3:1 against its surface in both themes. This supersedes feature 005's FR-011 for those accents on the landing page only. FR-012 stands: brand red never colours a button, a link, a focus indicator, a hover or selected state, an error, a badge, or text — the call to action keeps the primary colour — and the destructive colour stays apart (FR-013). TESTING: e2e — the landing page renders in en and uk with no console errors (extends the existing smoke test); Sign in reaches the sign-in page when anonymous and the dashboard when signed in; the sign-in and invite logos navigate to the landing page (the brand test's not-a-link assertion changes); switching language on the landing page keeps the visitor there (001 SC-005); with reduced motion the full conversation shows at once. Test-together component tests for the landing page. OUT OF SCOPE: redirecting signed-in visitors away from the landing page; a session-aware call to action ('Open dashboard'); contact or demo-request flows; SEO beyond the localized title and description (Open Graph, sitemap, robots); images; a separate marketing domain; any change to the signed-in area; brand red anywhere else in the UI, including buttons and the signed-in area (a separate feature). FOR /speckit-plan: no new runtime dependencies — tw-animate-css and lucide-react are already installed; compose from src/components/ui and BrandLogo; the landing page stays a server component and renders statically; it lives at src/app/[locale]/page.tsx and renders AppShell itself — decide whether moving it under (public) is worth it; landing components go in a new src/components/landing/ group."

## Overview

The page at each language's root address is the first thing anyone sees who types the product's
address. Today it is a placeholder: a heading and a paragraph written to an end customer ("How can we
help?"), no logo, and no way to go anywhere. End customers cannot use the product yet, so it speaks to
nobody who arrives there.

The people who do arrive are partner companies in the solar-energy field and our own staff showing the
product to them. This feature replaces the placeholder with a short product landing page addressed to a
partner: Atmo AI is an AI support agent for **your** customers. It says what the product is and what it
does today — around the clock, in the customer's language, with the conversation kept, built for solar
energy — and nothing it does not yet do. An example conversation plays once beside the headline to show
the idea at a glance, and Sign in leads into the product.

The page is informational. It looks the same to every visitor, signed in or not, and decides nothing
about them: Sign in always goes to the sign-in page, which already sends a signed-in visitor on to the
dashboard. The second half of the feature is a way back: the large logo on the sign-in and invite pages
becomes a link to the landing page.

## Clarifications

### Session 2026-10-18

- Q: Does the fade-in and the example conversation play on every opening of the landing page, or once
  per visit? → A: On every opening — a fresh load, a return through a logo, or Back. Nothing about a
  previous viewing is remembered (FR-015). _Amended in analysis:_ a page the browser restores from its
  back-forward cache, after the visitor left with a full navigation, shows its final state instead;
  accepted rather than adding a script to restart the motion.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A partner learns what the product is (Priority: P1)

A sales contact at a solar-installation company opens the product's address. Under a header with the
"atmo AI" logo, theme and language controls and a Sign in button, a headline and one sentence tell them
it is an AI support agent for their customers. Four short cards name what it does: it is available
around the clock, answers in the customer's language, keeps the conversation history, and is built for
solar energy. A short footer carries the product name. Nothing on the page promises a figure, a
customer, a price, or a capability the product does not have. The page reads equally well in Ukrainian,
in the dark theme, and on a phone.

**Why this priority**: This is the page that replaces the placeholder. Without it the product's own
address shows text meant for someone who cannot use the product, and nothing else in this feature has a
place to live.

**Independent Test**: Open `/en` and `/uk` anonymously, in both themes, at desktop and phone widths;
read every piece of copy against the list of what exists today, and check the structure, contrast, and
absence of horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** any visitor, **When** they open a language's root address, **Then** they see, in order, a
   header, a hero with a headline, a subheading, a Sign in call to action and an example conversation,
   four benefit cards, and a footer naming the product.
2. **Given** the header, **When** it renders, **Then** its first item is the compact "atmo AI" logo,
   followed by the theme control, the language control, and a Sign in button.
3. **Given** the page in either language, **When** its copy is read, **Then** it addresses a partner
   about support for the partner's customers, names the product "Atmo AI", and describes only round-
   the-clock availability, answering in the customer's language, keeping the conversation history, and
   a focus on solar energy.
4. **Given** the page in either language, **When** it is checked against the excluded claims, **Then**
   it contains no figures, testimonials, customer logos, prices, and no mention of integration with
   partner data, handoff to a human, analytics, or separation of each partner's data.
5. **Given** the Ukrainian address, **When** the page renders, **Then** every piece of copy, the
   example conversation included, is in Ukrainian, and the browser title and description are the
   Ukrainian ones.
6. **Given** a phone-width window, **When** the page renders, **Then** the example conversation sits
   under the headline and call to action, the cards stack, and nothing scrolls sideways.
7. **Given** the dark theme, or the light one, **When** the page renders, **Then** every text and
   control meets WCAG AA, including text drawn over the hero's background glow.

---

### User Story 2 - Sign in from the landing page (Priority: P1)

The partner's contact has been given an account. From the landing page they press Sign in — in the
header or in the hero — and reach the sign-in form. A staff member who is already signed in presses the
same button and lands straight on the dashboard, as they would by opening the sign-in page directly.

**Why this priority**: Today the root page is a dead end. A way forward is the second half of what the
page is for, and it costs one link because sign-in already handles the signed-in case.

**Independent Test**: Press each Sign in action once anonymously and once signed in, in each language,
and note where the visitor lands.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor on the landing page in a language, **When** they press either Sign
   in action, **Then** they reach the sign-in page in the same language.
2. **Given** a signed-in visitor on the landing page, **When** they press either Sign in action,
   **Then** they reach the dashboard in the same language with that one press, never seeing the
   sign-in form.
3. **Given** a signed-in visitor, **When** they open the landing page, **Then** it is the same page an
   anonymous visitor sees — same copy, same "Sign in" label — and they stay on it; nothing redirects
   them.

---

### User Story 3 - The example conversation plays once (Priority: P2)

As the page opens, the hero fades in and the example conversation plays: a customer's question
appears, a typing indicator shows briefly, then the agent's answer appears. Then everything is still.
A visitor whose system asks for reduced motion sees the finished conversation at once, with nothing
moving. A screen-reader user hears one labelled example conversation with its question and answer, and
nothing about typing.

**Why this priority**: The motion makes the page feel alive and shows the idea faster than a sentence,
but the page delivers its message without it, so it follows the content and the way in.

**Independent Test**: Load the page normally, with reduced motion requested, and with a screen reader;
observe the sequence, the still final state, and what is announced.

**Acceptance Scenarios**:

1. **Given** a visitor with no motion preference, **When** the page loads, **Then** the hero fades in,
   and the question, a typing indicator, and the answer appear in that order, finishing within about
   three seconds; the typing indicator is gone at the end.
2. **Given** the sequence has finished, **When** the visitor scrolls, switches theme, or waits,
   **Then** nothing on the page animates again.
3. **Given** a visitor whose system asks for reduced motion, **When** the page loads, **Then** the
   hero and the full conversation — question and answer, no typing indicator — are visible at once,
   and nothing moves.
4. **Given** assistive technology, **When** it reaches the example conversation, **Then** it is
   presented as one illustration with a localized label identifying it as an example, whose question
   and answer can be read; the typing indicator is never announced, and nothing is announced on its own
   as the sequence plays.
5. **Given** the example conversation, **When** a visitor tries to interact with it, **Then** it
   offers nothing to type into, press, or focus; it cannot be mistaken for a working chat.

---

### User Story 4 - Back to the landing page through the logo (Priority: P2)

A visitor who reached the sign-in page by mistake, or an invitee curious about the product before
setting a password, presses the large "atmo AI" logo above the card and arrives on the landing page in
the same language. The logo looks exactly as it did; it simply leads somewhere now.

**Why this priority**: It closes the loop between the new page and the two public pages, but those
pages work without it.

**Independent Test**: On the sign-in page and on a valid invite page, in each language, press the logo
and reach it by keyboard; check the destination, the accessible name, and that its appearance is
unchanged.

**Acceptance Scenarios**:

1. **Given** the sign-in page or the invite / set-password page in a language, **When** the visitor
   activates the large logo, **Then** they reach the landing page in the same language.
2. **Given** that logo, **When** assistive technology reads it, **Then** it is announced once, as a
   link named with the localized product name.
3. **Given** that logo, **When** the visitor tabs to it, **Then** it receives focus with a visible
   focus indicator that is not brand red, and its size, position and colours are otherwise unchanged.
4. **Given** the sign-in page or the invite page, **When** its header renders, **Then** the header
   still shows no logo — only the theme and language controls.
5. **Given** the signed-in area, **When** its header logo is activated, **Then** it still leads to the
   dashboard.

---

### Edge Cases

- **Signed-in visitor on public pages**: sign-in still redirects a signed-in visitor to the dashboard
  (feature 003, FR-031); the invite page still shows a signed-in visitor which account they are signed
  in as and offers Sign out instead of the form (feature 003, FR-044); the not-found page is still
  shown to everyone. This feature changes none of them.
- **Not-found page**: its "back home" link still leads to the landing page in the current language.
- **Site root without a language**: `/` still negotiates a language and redirects to that language's
  landing page, as feature 001 specifies.
- **Language switch on the landing page**: the visitor stays on the landing page in the other language
  (feature 001, SC-005); the example conversation plays again there, as on any opening of the page.
- **Returning to the landing page**: through a logo or Back within the product, the hero fades in and
  the conversation plays again; a visitor who goes back and forth sees it each time. When the browser
  instead restores the page from its back-forward cache — the visitor had left with a full navigation —
  the finished conversation shows, as under reduced motion (FR-015).
- **Theme switch after the sequence**: the page changes colours only; the sequence does not replay and
  nothing flashes.
- **Leaving the invite page through the logo**: whatever was typed into the password form is lost, but
  the invite link itself is untouched — opening it changes nothing (feature 003, FR-044) — so the
  invitee can return to it.
- **Leaving sign-in through the logo after being sent there from a protected page**: the return address
  that page carried is not kept; signing in from the landing page later lands on the dashboard.
- **Long Ukrainian copy**: headline, buttons, and cards wrap rather than overflow or truncate at phone
  width.
- **Scripts not running**: the page as delivered already holds the full copy and the full example
  conversation; the visitor sees the final state rather than an empty hero.
- **Slow first load**: the landing page shows no page loader, as feature 005 already decided for pages
  outside both layouts.

## Requirements _(mandatory)_

### Functional Requirements

**Page and copy**

- **FR-001**: Each supported language's root address MUST show the landing page, replacing today's
  placeholder heading and paragraph; the placeholder's copy MUST be removed from every catalog.
- **FR-002**: The page's copy MUST address partner companies about AI support for their customers and
  MUST name the product "Atmo AI".
- **FR-003**: The page MUST describe only what the product does today: an AI support agent for the
  partner's end customers that is available around the clock, answers in the customer's language,
  keeps the conversation history, and is built for solar energy.
- **FR-004**: The page MUST NOT contain figures or statistics, testimonials, customer or partner logos,
  prices, or any mention of integration with partner data, handoff to a human, analytics, or
  separation of each partner's data.
- **FR-005**: The page MUST consist of, in order: a header; a hero; four benefit cards; a footer. It
  MUST NOT contain raster images, a contact form, an email link, an FAQ, or a "how it works" section.
- **FR-006**: The page MUST declare its own browser title and description, localized in every
  supported language, naming the product "Atmo AI" (feature 005, FR-025).

**Header, hero, cards, footer**

- **FR-007**: The landing page's header MUST show, in order: the compact "atmo AI" logo, linking to the
  landing page in the current language with the localized product name as its accessible name; the
  theme control; the language control; a Sign in button.
- **FR-008**: The hero MUST show a headline, a one-sentence subheading, and a primary Sign in call to
  action, with the example conversation beside them on wide screens and below them on narrow ones,
  over a decorative background.
- **FR-009**: Each of the four benefit cards MUST show an icon, a short title, and one sentence, one
  card for each capability in FR-003. The icons MUST be decorative and hidden from assistive
  technology; the title carries the meaning.
- **FR-010**: The footer MUST show the product name and nothing that leads off the page.

**Example conversation**

- **FR-011**: The example conversation MUST consist of one customer question about a solar system and
  one agent answer, localized in every supported language, each language's version written in that
  language.
- **FR-012**: The example answer MUST be one the agent could give today: general guidance about solar
  energy. It MUST NOT show the agent looking up the customer's own system, contract, or account, or
  handing the customer to a person.
- **FR-013**: The example conversation MUST NOT be interactive: no input, nothing to press, nothing
  that takes focus.
- **FR-014**: Assistive technology MUST receive the example conversation as one illustration with a
  localized label marking it as an example; its question and answer MUST be readable, its typing
  indicator MUST NOT be announced, and its playback MUST NOT trigger announcements.

**Motion**

- **FR-015**: Each time the landing page is loaded, and each time the visitor returns to it within the
  product — through a logo, or Back after moving on inside the product — the hero MUST fade in once, and
  the example conversation MUST play once: the question appears, then a typing indicator, then the answer
  replaces the indicator. The sequence MUST finish within about three seconds, after which nothing on the
  page moves. No earlier viewing is remembered to skip or shorten it. A page the browser restores from its
  back-forward cache shows the final state, as the visitor left it.
- **FR-016**: When the visitor's system asks for reduced motion, the hero and the conversation's final
  state — question and answer, no typing indicator — MUST be visible at once, with no animation.
- **FR-017**: Nothing on the page MUST animate in response to scrolling, and a theme change MUST NOT
  replay the sequence.
- **FR-018**: The full copy and the full example conversation MUST be part of the page as delivered;
  motion only reveals them. A visitor whose browser runs no scripts MUST see the final state.

**Session**

- **FR-019**: The landing page MUST be identical for anonymous and signed-in visitors, MUST NOT
  redirect anyone, and MUST NOT read the visitor's session or any stored data.
- **FR-020**: Both Sign in actions MUST lead to the sign-in page in the current language and MUST be
  labelled "Sign in" (localized) for every visitor. A signed-in visitor reaches the dashboard through
  sign-in's existing redirect (feature 003, FR-031), in one press.

**Public pages and logo navigation**

- **FR-021**: The sign-in page MUST stay guest-only (feature 003, FR-031); the invite page MUST keep its
  signed-in notice and Sign out (feature 003, FR-044); the not-found page MUST stay visible to every
  visitor and its back-home link MUST lead to the landing page in the current language.
- **FR-022**: The larger, centred logo on the sign-in page and on the invite / set-password page MUST be
  a link to the landing page in the current language, announced once with the localized product name as
  its accessible name, and MUST keep its current size, position and colours. When focused it MUST show
  a focus indicator meeting feature 005's FR-007, and neither its focus nor its hover state MAY use
  brand red.
- **FR-023**: The header on the sign-in and invite pages MUST still show no logo. The signed-in header
  logo MUST still link to the dashboard (feature 005, FR-021).

**Brand, theme, and layout**

- **FR-024**: The page MUST support the light and dark themes and every behaviour feature 002 specifies.
  In both themes, every text and control MUST meet feature 005's FR-006 and FR-007, including text
  drawn over the hero's decorative background at its strongest point.
- **FR-025**: Every colour on the page MUST come from theme values; no component MAY carry a colour as
  a literal.
- **FR-026**: On the landing page only, brand red MAY appear, besides the logo, as two decorative
  accents that carry no meaning and are not text: a soft glow in the hero's background and the benefit
  cards' icons. Each icon MUST reach at least 3:1 against the surface it sits on, in both themes.
- **FR-027**: Brand red MUST NOT colour any button, link, focus indicator, hover or selected state,
  error, badge, or text (feature 005, FR-012) — the call to action keeps the primary colour — and the
  destructive colour MUST stay separate from it (feature 005, FR-013).
- **FR-028**: The page MUST be usable from 320 CSS pixels wide upward, with no horizontal scrolling and
  no copy cut off, in every supported language.

**Localization and dependencies**

- **FR-029**: Every piece of copy this feature adds — page copy, title and description, the example
  conversation and its label, the benefit cards — MUST exist in every supported locale, under feature
  001's catalog completeness check.
- **FR-030**: Switching language on the landing page MUST keep the visitor on the landing page
  (feature 001, SC-005).
- **FR-031**: This feature MUST add no runtime dependency.

**Acceptance coverage**

- **FR-032**: End-to-end coverage MUST show: the landing page renders in English and Ukrainian with no
  console errors; each Sign in action reaches sign-in when anonymous and the dashboard when signed in;
  the sign-in and invite logos lead to the landing page; switching language on the landing page keeps
  the visitor there; under reduced motion the full conversation is visible at once. Component tests
  MUST cover the landing page's parts, written together with them.

### Relation to Earlier Features

- **Superseded**: feature 005's FR-024 ("not a link and not focusable") and its User Story 2 scenario 3,
  by FR-022; the matching non-link check under its FR-042 changes with it.
- **Superseded for the landing page only**: feature 005's FR-023 (no logo in the public header), by
  FR-007; and its FR-011 (brand red in brand marks only), by FR-026 for the two named accents.
- **Unchanged and restated**: feature 003's FR-031 and FR-044, feature 005's FR-012, FR-013 and FR-021,
  feature 001's SC-005.

### Mandated Implementation Constraints

Stated by the requester rather than derived from the behaviour above; recorded because they constrain
the plan.

- **MC-001 — No new dependencies.** The animation and icon libraries already installed are used; no
  runtime dependency is added (FR-031).
- **MC-002 — Composition.** The page is composed from the project's UI primitives and the existing logo
  component.
- **MC-003 — Rendering.** The landing page stays a server-rendered page and renders statically.
- **MC-004 — Location.** It stays at the locale root page and renders the app shell itself; whether to
  move it under the public route group is decided in the plan.
- **MC-005 — Component group.** Landing components go in a new `landing` group under the components
  directory.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A reader of only the headline and subheading, in either language, can say what the
  product is and whom it serves.
- **SC-002**: From the landing page, an anonymous visitor reaches the sign-in form, and a signed-in
  visitor reaches the dashboard, in exactly one press.
- **SC-003**: From the sign-in page and the invite page, a visitor reaches the landing page in exactly
  one press, by mouse or keyboard.
- **SC-004**: Zero excluded claims (FR-004) in either language.
- **SC-005**: 100% of text and controls on the landing page meet WCAG AA in both themes; every benefit
  icon reaches 3:1 against its surface; zero buttons, links, focus indicators, or text are drawn in
  brand red.
- **SC-006**: At 320 CSS pixels wide, zero horizontal scrolling and zero truncated copy, in both
  languages and both themes.
- **SC-007**: With no motion preference the example conversation finishes within about three seconds of
  load and plays once per opening of the page; with reduced motion, zero elements animate and the full conversation is visible
  on first paint.
- **SC-008**: Zero console errors when the landing page loads, in both languages.
- **SC-009**: Every string this feature introduces is present in English and Ukrainian — zero gaps.
- **SC-010**: Sign-in, invite, not-found, and the signed-in area behave exactly as before; their
  existing end-to-end checks pass with the logo's link check as the only intended change.

## Assumptions

- **The input's garbled sentence** — "reads the conversation as one labelled illustrang indicator is
  not announced" — is read as "reads the conversation as one labelled illustration; the typing
  indicator is not announced" (FR-014).
- **Four benefit cards**, not three: the request lists four capabilities, and one card each keeps every
  capability on the page without merging two into one sentence.
- **"About three seconds"** for the whole sequence is our default: long enough to read the question
  before the answer arrives, short enough that a visitor never waits for the page. It allows a small
  tolerance.
- **"Phone width"** means 320 CSS pixels, the narrowest width WCAG's reflow criterion asks for.
- **The example conversation is illustrative, not a recording.** It is written copy, not produced by
  the agent, and never changes per visitor.
- **The landing page is not a page of the public or signed-in layouts' flows**: it has no page loader
  (feature 005's assumption for pages outside both layouts) and no session check.
- **The current product is staff-only** (feature 006). The page speaks to partners about the product's
  purpose; it does not claim that their customers can use it today, and does not say they cannot.

## Out of Scope

- **Redirecting signed-in visitors away from the landing page**, and a session-aware call to action
  ("Open dashboard"). The accepted trade-off is that a signed-in visitor sees "Sign in".
- **Contact or demo-request flows**, including an email link.
- **Search and sharing metadata beyond the localized title and description** — Open Graph, sitemap,
  robots rules.
- **Images**, raster or photographic.
- **A separate marketing domain.**
- **Any change to the signed-in area.**
- **Brand red anywhere else in the interface**, buttons and the signed-in area included — a separate
  feature.

## Open for Planning

All settled in the plan; see [research.md](./research.md).

- **Route group** — the page stays at the locale root and renders the app shell itself; a move under the
  public route group would need a layout of its own for no behavioural gain (R1).
- **Header contents** — the logo and an outline Sign in fill the app shell's existing slots, and its
  wrapping header fits them at 320 CSS pixels; a new optional footer slot carries the product name (R2, R3).
- **Icon contrast in the dark theme** — icons sit directly on the card (3.02:1 dark, 5.87:1 light), never
  on a muted tile (2.50:1 dark) (R6).
- **Glow strength** — light-theme muted text drops below 4.5:1 under any glow, so all text over the glow
  uses the main text colour; the glow is held to 10%, where that text and the focus ring keep AA (R6).
- **Playback without scripts** — the sequence is driven by styles alone, every animation finite; static
  rendering is confirmed in the build's route table (R4, R9).
