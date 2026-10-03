# Feature Specification: Atmo AI Brand Look

**Feature Branch**: `005-atmo-brand`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Rebrand the app's look to match my.atmo.pro, the product we branch from: palette, typography, logo, favicon and a page loader. Keep it minimal. This is a token-and-asset change, not a component redesign. WHY: end customers of our solar partners move between my.atmo.pro and our support agent; the agent should read as part of the same product family, under its own name 'Atmo AI'. REFERENCE: my.atmo.pro/login is the only style source; ignore atmosfera.ua. MEASURED: Roboto 400/500/700 with Cyrillic; the Tailwind gray scale — primary and text #111827, page background #F9FAFB, cards white, borders #E5E7EB/#D1D5DB, muted text #6B7280, radius 8px; brand red #C02444 only in brand marks (logo, favicon, loader), never on buttons or interactive states; logo /static/logos/dark-outline.svg = red 'atmo' wordmark + dark #1E1E1E pill with white 'PRO', all glyphs vector paths; favicon = red lowercase 'a' in a black rounded-square outline, whose vector form is the page preloader's inline SVG; preloader = that mark drawn by an animated stroke, 1.4s loop. REQUIREMENTS: (1) light theme follows the reference (background gray-50, card and popover white, radius 8px); dark theme stays — light/dark/system from 002 unchanged — and mirrors the scale (background gray-950, cards gray-900, primary gray-50); destructive stays clearly distinct from brand red; all body text and controls meet WCAG AA in both themes. (2) the whole app uses Roboto, Latin and Cyrillic, no layout shift while the font loads. (3) logo 'atmo AI': keep the 'atmo' wordmark paths, replace 'PRO' with 'AI' drawn as paths in the same letter geometry, pill narrowed to fit; one asset for both themes — wordmark stays red, pill inverts (dark pill/light letters in light theme, light pill/dark letters in dark theme); our hand-drawn 'AI' is acceptable for now and a designer's version must replace it with no code change beyond the asset. (4) placement: a) signed-in header shows a compact logo at the start linking to /dashboard, localized accessible name; b) public header (theme and locale switchers only) shows no logo; c) sign-in and invite/set-password pages show a larger logo centered above their card, not a link. (5) 'Atmo' becomes 'Atmo AI' in the app name and every page title, all locales. (6) favicon: the reference 'a' mark, legible in light and dark tab strips, plus an Apple touch icon, replacing the default favicon. (7) page loader: a) while a route waits on the server, the content area under the header shows the brand mark drawing itself, under both the signed-in and public layouts, header stays visible; b) never above the signed-in layout's session check (R8/R17); c) appears only after about 300ms; d) announced as a loading status with a localized label; e) static mark under prefers-reduced-motion; f) uses theme tokens to read in both themes; no full-screen splash or first-load overlay. OUT OF SCOPE: component sizes or shapes beyond tokens; in-button spinners; a PWA manifest; chart and sidebar styling beyond keeping their tokens consistent; atmosfera.ua styling; removing dark mode. CONSTRAINTS: no new runtime dependencies; all new copy through next-intl in every locale; brand colors as theme tokens, not scattered literals." (Condensed from the full request in the `/speckit-specify` invocation; nothing above adds to or departs from it.)

## Overview

End customers of our solar partners use my.atmo.pro, and they will reach our support agent from it
and return to it. Today the agent looks like an unbranded starter app: a generic neutral palette, a
different typeface, the framework's default tab icon, and the bare name "Atmo". This feature makes it
read as a member of the same product family — same grays, same typeface, same corner radius, the same
red brand mark — under its own name, **Atmo AI**.

It changes values and assets, not components. Buttons, fields, cards, dialogs, and tables keep their
current sizes, shapes, and behavior; they only pick up the new colours, radius, and typeface through
the theme. On top of that it adds three brand assets — the "atmo AI" logo, the "a" favicon, and a page
loader drawn from the same mark — and renames the product in its own copy.

Two rules hold throughout. **Brand red belongs to brand marks only**: it never colours a button, a
link, a focus ring, or an error, so a customer never confuses "this is Atmo" with "this is dangerous"
or "press here". **Both themes stay first-class**: dark mode mirrors the reference's gray scale rather
than being dropped or left on the old palette.

## Clarifications

### Session 2026-10-02

- Q: The reference's field border (#D1D5DB on white, about 1.5:1) falls short of the 3:1 WCAG AA asks
  of the outline that identifies a control. Follow the reference, or reach 3:1? → A: Follow the
  reference. Control borders keep the reference values; AA is met through text, labels, and focus
  indicators. The gap against WCAG 1.4.11 for field outlines is accepted, as it already is with
  today's palette (FR-008).
- Q: Besides the app name and page titles, does copy that names the product — today the sign-in
  description's "your Atmo account" — also become "Atmo AI"? → A: Yes. Every place the product names
  itself says "Atmo AI", so the sign-in page cannot be read as asking for a my.atmo.pro account
  (FR-026).

### Session 2026-10-02 (planning)

- Q: Red destructive text on its own 10–30% red tint — the deactivate menu item, the confirm button, the
  destructive badge — measures 3.99:1 at rest and 3.31:1 on hover in the light theme, and 3.55:1 on
  hover in the dark theme. Token values alone cannot fix the dark hover without turning the red pink.
  How is AA reached? → A: The light destructive is darkened along its own hue (it stays more orange
  than the brand crimson), the dark one keeps its value, and the tints behind destructive text are
  lowered in the three primitives that draw them, edited in place. Every state, hover and focus
  included, then meets 4.5:1 (FR-006, FR-013).
- Q: A loader above the sign-in page turns its "already signed in" redirect into a redirect sent after
  the page has started (status 200 instead of 307), and the only thing sign-in waits on is that session
  check, so the loader would almost never be seen there. Loader on sign-in or not? → A: No loader on
  sign-in. The redirect stays a real redirect, as feature 003 decided (FR-030, FR-038).
- Amendment found in planning, no choice involved: the tab icon and the touch icon are drawn by the
  browser outside the page and cannot read theme values, so they carry the brand red in their own files
  (FR-010).

### Session 2026-10-02 (analysis)

- Q: Menu and select items show focus only by tinting their background (about 1.1:1 against the
  popover in the light theme), and the destructive button's focus border is drawn at 40% (about
  2.2:1). Does FR-007 cover every control's focus treatment, or the focus rings and borders controls
  draw? → A: Focus rings and borders. Each must reach 3:1, so the destructive button's focus border
  is drawn at full strength. The background highlight of a focused item inside a menu or list stays
  as it is (FR-007).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The product looks like it belongs with my.atmo.pro (Priority: P1)

A customer comes from my.atmo.pro to get help. The page in front of them has the same near-white
gray background, white cards, dark gray text and buttons, 8px corners, and Roboto typeface they just
left. A staff member who prefers dark mode sees the same scale mirrored: a near-black background,
dark gray cards, near-white text and buttons. Nothing in either theme is hard to read.

**Why this priority**: The palette and typeface cover every pixel of every page; they are most of
what "looks like the same product" means. Without them, the logo alone would sit on a page that still
looks foreign.

**Independent Test**: Open every page in light and in dark theme and compare its background, card,
text, muted text, border, primary button and corner radius with the reference values; measure the
contrast of every text and control colour against the surface it sits on.

**Acceptance Scenarios**:

1. **Given** the light theme, **When** any page is shown, **Then** the page background is #F9FAFB,
   cards and popovers are white, body text and primary buttons are #111827, muted text is #6B7280,
   borders are #E5E7EB or #D1D5DB, and the standard corner radius is 8px.
2. **Given** the dark theme, **When** any page is shown, **Then** the page background is the darkest
   step of the same gray scale (gray-950), cards and popovers are gray-900, primary buttons and body
   text are gray-50, and the standard corner radius is 8px.
3. **Given** either theme, **When** any text — body, muted, button label, link, error, badge, table
   cell — is measured against the surface it sits on, **Then** it meets at least 4.5:1, or 3:1 for
   large text.
4. **Given** either theme, **When** any control receives keyboard focus, **Then** its focus ring or
   border is visible and meets at least 3:1 against the adjacent surface; an item inside a menu or
   list shows focus by its background highlight, as today.
5. **Given** any page in either theme, **When** it is inspected, **Then** no button, link, focus ring,
   selected state, or error is drawn in the brand red, and the destructive colour is visibly a
   different red from the brand red.
6. **Given** a reader using Ukrainian, **When** any page loads, **Then** Cyrillic text is set in the
   same typeface as Latin text, in the same weights.
7. **Given** a cold load with an empty cache, **When** the typeface arrives after the text first
   paints, **Then** no text moves, wraps differently, or changes size as the typeface swaps in.
8. **Given** the theme preference from feature 002, **When** the visitor chooses light, dark, or
   follows the system, **Then** it behaves exactly as before, with the new colours.

---

### User Story 2 - The product carries its own name and logo (Priority: P1)

A staff member opens the sign-in page and sees the "atmo AI" logo centred above the sign-in card, as
on my.atmo.pro: the red "atmo" wordmark they recognise, followed by a pill reading "AI" where the
reference reads "PRO". After signing in, a compact version of the logo sits at the start of the header;
pressing it returns them to the dashboard. The browser tab reads "Sign in — Atmo AI", then
"Home — Atmo AI". Switching to dark theme, the wordmark stays red and the pill turns light with dark
letters, so it never disappears into the dark header.

**Why this priority**: The name is what distinguishes the agent from my.atmo.pro while the logo ties
it to the family. Both are needed for the "same family, own name" goal; neither depends on the loader
or favicon.

**Independent Test**: Visit sign-in, invite, and every signed-in page in both themes and both locales;
check where the logo appears, its size, whether it links, its accessible name, and the page title.

**Acceptance Scenarios**:

1. **Given** a signed-in user on any page under the signed-in area, **When** the header renders,
   **Then** a compact logo is the first item in it, and activating it navigates to the dashboard in
   the current language.
2. **Given** the header logo, **When** assistive technology reads it, **Then** it is announced as a link
   whose name is the localized product name, in the current language.
3. **Given** the sign-in page or the invite / set-password page, **When** it renders, **Then** a larger
   logo is centred above the card, is not a link and not focusable, and is announced once with the
   localized product name.
4. **Given** a page under the public layout, **When** its header renders, **Then** the header contains
   the theme and language controls only, with no logo.
5. **Given** the light theme, **When** the logo is shown, **Then** the "atmo" wordmark is #C02444 and
   the pill is dark with light "AI" letters; **Given** the dark theme, **Then** the wordmark is still
   #C02444 and the pill is light with dark "AI" letters.
6. **Given** the visitor pins the dark theme while their operating system is light (or the reverse),
   **When** the logo is shown, **Then** the pill follows the product's active theme, not the operating
   system.
7. **Given** any page in any supported locale, **When** its browser title is read, **Then** the product
   is named "Atmo AI" and never "Atmo" alone.
8. **Given** a designer's replacement "atmo AI" logo file of the same kind, **When** it replaces the
   current file, **Then** every placement shows the new logo, with its theme behaviour, and no other
   file changes.

---

### User Story 3 - The browser tab shows the Atmo mark (Priority: P2)

A customer with several tabs open finds the support agent by its tab icon: the red "a" in a rounded
square, the same mark my.atmo.pro uses. It reads on a light tab strip and on a dark one. Saving the
product to an iPhone home screen gives the same mark instead of a page screenshot.

**Why this priority**: The tab icon is how a returning customer finds the product among many tabs, and
the current one is the framework's default. It is independent of the in-page work.

**Independent Test**: Load any page in a browser with a light tab strip and with a dark one; inspect
the icons the page declares; add the page to an iOS home screen.

**Acceptance Scenarios**:

1. **Given** any page, **When** the browser shows its tab, **Then** the icon is the reference "a" mark
   and not the framework's default icon.
2. **Given** a browser whose tab strip is dark, **When** the tab is shown, **Then** the mark's outline
   and letter are both distinguishable from the tab strip.
3. **Given** an iOS device, **When** the page is added to the home screen, **Then** the icon is the
   "a" mark on an opaque background, at the size the platform asks for.

---

### User Story 4 - A slow page shows the brand mark drawing itself (Priority: P3)

A staff member opens the users list on a slow connection. The header stays where it is; after a
moment the content area below it shows the "a" mark drawing itself, as my.atmo.pro does, and a
screen-reader user hears that the page is loading. When the list arrives the mark is replaced by it.
On a fast connection the same navigation never shows the mark at all. A staff member who has asked
their system to reduce motion sees the mark still, without the drawing animation.

**Why this priority**: It replaces a blank content area with a familiar brand moment and an explicit
loading status, but the product works without it, so it comes after the identity work.

**Independent Test**: Navigate to a page whose server response is artificially delayed, with and
without reduced motion, in both themes, with a screen reader; repeat with a fast response.

**Acceptance Scenarios**:

1. **Given** a signed-in user navigating to a page whose content takes longer than about 300ms, **When**
   the wait passes that threshold, **Then** the content area under the header shows the mark drawing
   itself in a loop of about 1.4 seconds, and the header — logo, navigation, controls — stays visible
   and usable.
2. **Given** a visitor opening an invite link whose page takes longer than about 300ms, **When** the
   wait passes that threshold, **Then** the same loader appears in the content area under the public
   header. (Sign-in has no loader — FR-030.)
3. **Given** a navigation whose content arrives within about 300ms, **When** it completes, **Then** the
   loader was never painted.
4. **Given** the loader is showing, **When** assistive technology inspects the content area, **Then** it
   finds a loading status whose label is localized in the current language.
5. **Given** the visitor's system asks for reduced motion, **When** the loader is shown, **Then** the
   mark is shown fully drawn and still.
6. **Given** either theme, **When** the loader is shown, **Then** the mark is legible against the
   content area.
7. **Given** a signed-out visitor opening a page in the signed-in area, **When** the request is
   handled, **Then** they are redirected to sign-in exactly as today, without the loader or any part
   of the signed-in page being sent first.
8. **Given** a signed-in user who signs out and presses Back, **When** the browser goes back, **Then**
   they see the sign-in page, as today.

---

### Edge Cases

- **Muted text on a muted surface**: the reference's muted text (#6B7280) reaches 4.8:1 on white and
  4.6:1 on the page background, but only 4.4:1 on gray-100. Wherever a rendered screen puts muted text on
  a tinted surface (muted, secondary, accent), that pairing must still reach 4.5:1 (FR-006); matching
  the reference does not excuse a failing pair. Combinations the primitives define but no screen
  renders today are listed in the data model, and are fixed when first rendered.
- **Brand red in dark theme**: #C02444 reaches about 3.4:1 on gray-950 and 3.0:1 on gray-900. That is
  enough for a logotype (exempt) and for the loader as a graphic (3:1), but brand red is never used for
  text (FR-012).
- **Theme pinned against the operating system**: the logo pill and the loader follow the product's
  active theme (feature 002), not the system setting (FR-019, FR-033). The tab icon cannot see the
  product's theme and follows only what the browser shows (FR-027).
- **Weights the typeface does not load**: only 400, 500 and 700 are loaded; nothing in the interface
  asks for another weight today. A future request for another weight shows the nearest loaded one.
- **Header on a narrow screen**: the compact logo stays at the start of the header and does not push
  the theme, language or account controls off screen; the navigation keeps wrapping as it does today.
- **Navigation abandoned while the loader is showing**: going to another page replaces the loader with
  that page's own loading behaviour; no loader is left behind.
- **A signed-in visitor opening sign-in**: they are still sent to the dashboard (feature 003), and the
  sign-in form is never shown on the way (FR-038).
- **Pages outside both layouts** — the start page, the not-found page, and the demo page — use the
  public header (no logo) and have no loader; they do not wait on the server.
- **Images disabled or the logo file failing to load**: the product name is still announced, and the
  header link still works.

## Requirements _(mandatory)_

### Functional Requirements

**Palette and shape**

- **FR-001**: In the light theme the page background MUST be #F9FAFB; cards and popovers MUST be white;
  body text and the primary action colour MUST be #111827; muted text MUST be #6B7280; borders and
  dividers MUST be #E5E7EB or #D1D5DB.
- **FR-002**: In the dark theme the page background MUST be gray-950, cards and popovers MUST be
  gray-900, and body text and the primary action colour MUST be gray-50, all from the same gray scale
  as FR-001. Every other dark-theme colour MUST come from that scale too.
- **FR-003**: The standard corner radius MUST be 8px in both themes; smaller and larger radii the
  interface derives from it MUST scale with it.
- **FR-004**: Secondary, muted, accent, input, ring, chart and sidebar colours MUST be re-expressed on
  the same gray scale in both themes, so that no colour from the previous neutral palette remains.
  Their roles do not change.
- **FR-005**: The light / dark / system preference and every behaviour feature 002 specifies MUST
  continue to hold. Feature 002's rule that no palette value changes (its FR-022) is superseded by this
  feature for the values listed here.

**Contrast**

- **FR-006**: In both themes, every text colour MUST meet at least 4.5:1 against every surface it is
  used on (3:1 for large text), at rest and in its hover and focus states. This includes muted text,
  link text, button labels, badge text, error text, destructive text on its own tinted surface, and
  text on muted, secondary and accent surfaces.
- **FR-007**: In both themes, every focus ring or focus border a control draws MUST be visible and
  meet at least 3:1 against the surfaces adjacent to it. Items inside a menu or list (menu items,
  select options), which show focus by highlighting their background, keep that highlight as it is.
- **FR-008**: The boundaries of text fields and other controls MUST use the reference border values
  (FR-001 in the light theme, their mirror on the same scale in the dark theme). They are not required
  to reach 3:1; every text field MUST instead carry a visible text label, and every control MUST meet
  FR-007 when focused.
- **FR-009**: Disabled controls are exempt from FR-006 – FR-008, as WCAG exempts inactive components,
  but MUST remain distinguishable from the surface.

**Brand colour**

- **FR-010**: The brand red #C02444 MUST be defined once, as a theme value, and every brand mark drawn
  inside the page — the logo and the loader — MUST take its red from there. No component MAY carry the
  brand red as a literal. The tab icon and the touch icon, which the browser draws outside the page,
  carry it in their own image files.
- **FR-011**: The brand red MUST appear only in the logo, the favicon, the Apple touch icon, and the
  page loader.
- **FR-012**: The brand red MUST NOT be used for any button, link, focus indicator, selected or hover
  state, error, validation message, badge, or text.
- **FR-013**: The destructive colour MUST be a separate theme value from the brand red and MUST keep
  its present, more orange-leaning hue rather than move toward the brand crimson. Its lightness, and
  the strength of the tints drawn behind destructive text, change only as far as FR-006 requires in
  both themes. It MUST NOT appear in any brand mark.

**Typography**

- **FR-014**: All text in the product MUST be set in Roboto, covering Latin and Cyrillic, in weights
  400, 500 and 700.
- **FR-015**: Loading the typeface MUST NOT shift layout: no text may move, rewrap, or change size when
  the typeface arrives.
- **FR-016**: The typeface MUST be delivered by the product itself; no page MAY request a font from a
  third-party server at runtime.

**Logo**

- **FR-017**: The product MUST have one "atmo AI" logo asset, derived from the reference logo: the
  reference's "atmo" wordmark paths unchanged, followed by a pill containing "AI" drawn as paths in the
  letter geometry of the "atmo" wordmark — its stroke width — the pill sized to fit the two letters.
- **FR-018**: The logo's "atmo" wordmark MUST be the brand red in both themes.
- **FR-019**: The logo's pill MUST follow the product's active theme: in the light theme a dark pill
  with light letters, in the dark theme a light pill with dark letters, both taken from theme values.
- **FR-020**: Replacing the logo asset with a designer's version of the same kind MUST change every
  placement, including its theme behaviour, with no change to any other file.

**Logo placement**

- **FR-021**: The header of the signed-in area MUST show a compact logo as its first item, linking to
  the dashboard in the current language.
- **FR-022**: The header logo's accessible name MUST be the localized product name, from the message
  catalogs of every supported locale.
- **FR-023**: The header of the public layout MUST NOT show a logo; it keeps only the theme and
  language controls.
- **FR-024**: The sign-in page and the invite / set-password page MUST show a larger logo, centred above
  their card. It MUST NOT be a link or receive focus, and MUST be announced once with the localized
  product name.

**Product name**

- **FR-025**: The product's name MUST be "Atmo AI" in every supported locale: the app name and every
  page title, including the default title and description.
- **FR-026**: Copy elsewhere that names the product — today only the sign-in description, "your Atmo
  account" — MUST also say "Atmo AI", in every supported locale.

**Favicon**

- **FR-027**: Every page MUST declare the reference "a" mark as its tab icon, replacing the framework's
  default. The mark MUST be distinguishable — outline and letter — on both a light and a dark tab
  strip.
- **FR-028**: Every page MUST declare an Apple touch icon showing the same mark on an opaque background.
- **FR-029**: The tab icon and the touch icon MUST remain reachable without a language prefix, as
  today's icon is.

**Page loader**

- **FR-030**: While a page under the signed-in layout or the public layout is waiting on the server,
  the content area under the header MUST show the "a" mark being drawn by an animated stroke in a loop
  of about 1.4 seconds. The header MUST stay visible and usable. The sign-in page is the one exception:
  all it waits on is the session check that may redirect, so it has no loader (FR-038).
- **FR-031**: The loader MUST NOT be painted until the wait has lasted about 300ms. A wait shorter than
  that MUST NOT paint it at all.
- **FR-032**: The loader MUST be exposed to assistive technology as a loading status, with a label
  localized in every supported locale.
- **FR-033**: The loader MUST take its colours from theme values, so that it is legible in both themes
  and follows the product's active theme.
- **FR-034**: When the visitor's system asks for reduced motion, the loader MUST show the mark fully
  drawn and still.
- **FR-035**: The loader MUST NOT cover the header, the full screen, or appear as a first-load overlay
  or splash.
- **FR-036**: In the signed-in area, the session check MUST complete before the loader or any page
  content is sent: a signed-out or rejected visitor MUST receive a redirect to sign-in, never a loader
  followed by a redirect (feature 003, R8 and R17).
- **FR-037**: After sign-out, pressing Back MUST still show the sign-in page (feature 003).
- **FR-038**: Every redirect and not-found outcome that is decided before content is sent today MUST
  still be decided before content is sent; in particular a signed-in visitor opening sign-in is still
  taken to the dashboard without the form appearing.
- **FR-039**: Buttons that show their own pending spinner keep it unchanged; the page loader does not
  replace or add to them.

**Localization and dependencies**

- **FR-040**: Every new piece of copy — the product name as logo label and the loader label — MUST
  exist in every supported locale, under feature 001's catalog completeness check.
- **FR-041**: This feature MUST add no runtime dependency.

**Acceptance coverage**

- **FR-042**: Automated coverage MUST show: the header logo's presence, link target and localized
  name in the signed-in area and its absence in the public header; the centred, non-link logo on
  sign-in and invite pages; "Atmo AI" in every page title in every locale; the declared tab and touch
  icons; and the loader's localized status, its delay, and its reduced-motion state.
- **FR-043**: The contrast pairs of both themes required by FR-006 and FR-007 MUST be checked
  automatically, so that a later token change that breaks AA fails the merge gates.

### Key Entities

- **Theme values**: the named colours and radius both themes define — background, card, popover,
  text, muted text, primary, secondary, accent, border, input, ring, destructive, chart, sidebar, and
  the new brand red. Components read only these.
- **Brand marks**: the "atmo AI" logo, the "a" favicon, the Apple touch icon, and the loader mark. The
  only places brand red appears.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Side by side with my.atmo.pro/login in the light theme, the sign-in page shows the same
  page background, card colour, text colour, primary button colour, corner radius, and typeface, and a
  logo in the same position.
- **SC-002**: 100% of text-on-surface pairs in both themes meet 4.5:1 (3:1 for large text), and 100% of
  focus rings and focus borders meet 3:1.
- **SC-003**: Zero buttons, links, focus rings, errors or text in either theme are drawn in brand red.
- **SC-004**: Zero layout shift attributable to the typeface loading, measured on a cold load of the
  sign-in page and the dashboard.
- **SC-005**: Every page title and every piece of copy that names the product, in every supported
  locale, says "Atmo AI"; none reads "Atmo" alone.
- **SC-006**: The tab icon is recognisable as the Atmo "a" mark on both a light and a dark tab strip.
- **SC-007**: A navigation that completes within 300ms never paints the loader; one that takes longer
  shows it, with the header still in place.
- **SC-008**: A signed-out visitor to any signed-in page receives a redirect to sign-in with no page
  content sent first, and Back after sign-out shows sign-in — both exactly as before this feature.
- **SC-009**: Swapping in a designer's logo file changes the logo everywhere it appears in a change
  that touches that one file only.

## Assumptions

- **The reference values are authoritative.** The measured hex values (#111827, #F9FAFB, #E5E7EB,
  #D1D5DB, #6B7280, #C02444) win wherever the installed styling framework's own gray scale differs
  slightly from them. Dark-theme steps that were not measured (gray-950, gray-900, gray-50 and the
  others FR-002 needs) come from the same scale the measured values belong to.
- **Token-and-asset, with one exception.** Components keep their sizes, shapes and behaviour. The one
  change inside components is the strength of the destructive tints in three primitives, which AA
  forces (planning clarification, FR-013).
- **"About 300ms" and "about 1.4 seconds"** allow a small tolerance; the point is that fast
  navigations never flash the loader and the animation pace matches the reference.
- **The favicon follows the browser, not the product's theme.** A tab icon cannot see the in-product
  theme preference; FR-027 asks for legibility on both kinds of tab strip instead.
- **The reference assets are ours to reuse.** my.atmo.pro is the product we branch from; its logo and
  mark are copied into this repository once, during implementation, and never fetched from it at
  runtime.
- **The logo's accessible name is the product name alone**, "Atmo AI". The header link's destination
  is already conveyed by its position and by the "Home" navigation item beside it.
- **Pages outside both layouts** (start page, not-found, demo) get no loader; they render without
  waiting on the server. The demo page is slated for removal.
- **Implementation constraints are deliberate**, following earlier features: the request fixes the
  reference values, the typeface, the 1.4s loop, the ~300ms delay, and forbids new runtime
  dependencies. They are recorded as constraints, not as design.
- **This feature supersedes** feature 002's FR-022 ("no colour token changes") for the values it lists,
  and the request's constraint that the loader never sits above the signed-in session check is feature
  003's R8 / R17, restated here as FR-036.

## Out of Scope

Each item is deliberately deferred, with the condition that brings it back:

- **Matching the reference's component sizes and shapes** — large inputs, floating labels, its button
  heights. Revisit if customers report the two products feel inconsistent once the palette and
  typeface match.
- **In-button spinners.** They stay as they are; revisit if a later design pass unifies loading
  indicators.
- **A PWA manifest** and installable-app icons beyond the Apple touch icon. Revisit when the product is
  meant to be installed.
- **Chart and sidebar styling** beyond keeping their theme values on the new gray scale. Revisit when a
  page first shows a chart or a sidebar.
- **Any atmosfera.ua styling.** Its marketing look is not the product family's.
- **Removing dark mode.** Both themes stay first-class.
- **A designer-drawn "AI".** Our own drawing ships now; the designer's version replaces it under
  FR-020 when it exists.
