# Feature Specification: Theme Switching

**Feature Branch**: `002-theme-switching`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Theme switching: a light/dark colour scheme the visitor controls and the product remembers. The product resolves to one of two rendered appearances, light or dark. Three preference states exist: light, dark, and system. A visitor with no stored preference gets 'system' — the appearance follows the operating system's colour-scheme setting, and follows it live if the OS setting changes while the page is open. A visible control lets the visitor pin an explicit light or dark; the pinned choice then overrides the OS setting everywhere, on every route, until they change it again. The control is a single icon button (sun/moon) in the header that already carries the language switcher, present on every page, composed from the existing button primitive. Its accessible name MUST NOT depend on the active theme. Both icons are rendered and their visibility swapped in CSS, so the button shows the right icon from the first paint with no placeholder, no icon flash, and no layout shift. The preference lives in per-browser local storage — never a cookie, never part of the URL, never sent to the server; the locale middleware is untouched and no route loses static prerendering. The server renders a generic default and the correct appearance is applied before the browser's first paint. Local storage being unavailable or blocked MUST NOT throw or break the page; the product falls back to following the OS. Two tabs open at once converge on the same preference. Use next-themes for the mechanism, driving the existing `dark` class; the feature adds no colour tokens and edits no palette. The document's `color-scheme` MUST follow the active theme. The default preference state and the storage key are application code, not environment configuration. Every string the control renders resolves through next-intl in both the en and uk catalogs."

## Overview

Today the product renders in one fixed appearance. The dark colour palette already exists in the
stylesheet but nothing ever selects it, so a visitor whose device is set to a dark colour scheme —
and, increasingly, whose device switches to one automatically after dark — is served a bright
interface regardless.

This feature gives the visitor an appearance that matches their device by default and a one-press
control to pin the other one. It is a small surface with strict quality bars: the appearance must
be right in the very first frame the browser paints (a flash of the wrong colour scheme on every
page load is the failure mode that makes people distrust the feature), the control must be
announced identically no matter which appearance is active, and none of it may reach the server —
the language middleware and the product's static prerendering stay exactly as they are.

It ships no new colours. The palette, and any judgement about whether that palette is good, is a
separate piece of work.

## Clarifications

These decisions were taken deliberately when the feature was described and are **not** open
questions. They are recorded here so they are not re-raised during clarification or planning.

### Session 2026-09-12

- Q: Should the control expose all three preference states (light / dark / follow the system), or
  only toggle between light and dark? → A: Two-state. A single icon button that pins the appearance
  opposite to the one currently shown. Accepted consequence: once a visitor has pinned a choice
  there is no interface affordance to return to "follow the system" — that state is reachable only
  as the initial one, or by clearing site data. A three-state control was considered and declined in
  favour of the lighter affordance.
- Q: Should the end-to-end tests assert the absence of a flash of the wrong appearance by measuring
  paint timing? → A: No. The absence of flash is a stated requirement (FR-012, FR-013) and is
  verified by review rather than by an automated paint-timing assertion. The risk of a regression
  going unnoticed by the suite was weighed and accepted; the assertion is out of scope.
- Q: Where does the preference live, given there is no database and no accounts yet? → A:
  Per-browser local storage only. It is deliberately not a cookie, not a URL parameter, and never
  sent to the server, so the locale middleware, its cookie handling, and static prerendering are
  untouched. A per-account preference synced across devices is a later feature.
- Q: Implementation found that the chosen mechanism applies whatever string is in storage directly
  as a class name, so an unrecognised value is not treated as absent — FR-019 as first written was
  not satisfied. Guard it, or weaken the requirement? → A: Weaken it. The exposure was measured and
  is small: the visitor sees the wrong appearance on that one load, and a single press of the control
  restores a recognised state — it is not a stuck state. The guard would have been an undocumented
  patch over library behaviour, carrying an inline script that a future Content-Security-Policy would
  break. FR-019 now states what the product actually guarantees.
- Q: The end-to-end coverage carried into planning left three stated MUSTs untested — live following
  of the system setting (FR-005), two-tab convergence (FR-017), and storage being blocked (FR-018).
  Should the suite cover them? → A: Yes, all three. Each is cheap and deterministic to automate, and
  a requirement with no automated guard can regress and still merge green. The absence-of-flash
  guarantee stays the single deliberately uncovered exception.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The product matches the visitor's device without being asked (Priority: P1)

A solar customer opens a support link in the evening on a phone that has switched itself to a dark
colour scheme. The page they land on is dark from the first frame they see — there is no white
flash, and they did not have to find a setting. A colleague on a laptop set to a light scheme opens
the same link and gets the light appearance. Later, the phone crosses its scheduled switch to light
while the page is still open; the page follows, without a reload.

**Why this priority**: This is the whole feature for the majority of visitors, who will never touch
the control. It delivers value on its own with no persistence and no control shipped, and every
other story is built on the same resolution rule.

**Independent Test**: Load any route with the device colour-scheme preference set to dark, then to
light, with nothing stored, and confirm the appearance served in each case and that no frame of the
opposite appearance is visible. Then change the device preference while the page is open and
confirm the page follows.

**Acceptance Scenarios**:

1. **Given** a visitor with no stored preference whose device prefers a dark colour scheme, **When** they open any route directly, **Then** the page is rendered dark.
2. **Given** a visitor with no stored preference whose device prefers a light colour scheme, **When** they open any route directly, **Then** the page is rendered light.
3. **Given** a visitor with no stored preference whose device prefers dark, **When** the page loads or is reloaded, **Then** no frame of the light appearance is shown before the dark one.
4. **Given** a visitor with no stored preference viewing an open page, **When** the device colour-scheme setting changes, **Then** the page's appearance follows the new setting without a reload and without losing the visitor's place on the page.
5. **Given** any rendered appearance, **When** the page shows native browser furniture — scrollbars, form controls, the browser's own chrome — **Then** that furniture matches the active appearance rather than the opposite one.

---

### User Story 2 - A visitor pins the appearance they want and the product remembers it (Priority: P2)

A customer whose laptop is set to light finds the dark interface easier to read at night. They press
the appearance control in the header. The page turns dark immediately, without a reload and without
leaving the page. Every other page they visit is dark. They close the browser, come back the next
day — still dark, even though the laptop is still set to light. They open a second tab; that tab is
dark too.

**Why this priority**: Automatic matching is right most of the time but not always, and a visitor
whose device setting does not reflect their reading preference is stuck without this. It depends on
Story 1's resolution rule existing.

**Independent Test**: From any route, press the control, and verify the appearance flips, then
verify it survives a reload, a navigation to another route, a second tab, and a device setting that
disagrees with it.

**Acceptance Scenarios**:

1. **Given** a page rendered light, **When** the visitor activates the appearance control, **Then** the page is rendered dark immediately, on the same page, with no reload and no loss of the visitor's place.
2. **Given** a page rendered dark, **When** the visitor activates the appearance control, **Then** the page is rendered light immediately.
3. **Given** a visitor who has pinned an appearance, **When** they reload the page, **Then** the pinned appearance is rendered, from the first frame.
4. **Given** a visitor who has pinned an appearance, **When** they navigate to any other route, **Then** the pinned appearance is rendered there too.
5. **Given** a visitor who has pinned dark, **When** their device prefers light, **Then** dark is rendered — the pinned choice wins over the device setting.
6. **Given** a visitor who has pinned an appearance and whose device setting later changes, **When** the device change occurs, **Then** the rendered appearance does not change.
7. **Given** a visitor with two tabs of the product open, **When** they change the appearance in one tab, **Then** both tabs end up on the same preference.
8. **Given** a visitor who has pinned an appearance, **When** they return in a later session on the same browser, **Then** the pinned appearance is still in effect.

---

### User Story 3 - The control is usable and correctly announced by everyone (Priority: P3)

A customer navigating by keyboard reaches the appearance control by tabbing, sees where their focus
is, and activates it with the keyboard alone. A customer using a screen reader hears the same name
for the control whether the page is currently light or dark, so the control does not appear to
change identity under them. Nobody sees the control appear late, swap its icon a moment after the
page arrives, or push the language switcher sideways as it settles.

**Why this priority**: The control is the only way to reach Story 2, and the product serves partner
customers we do not choose. It is separately testable from the persistence behaviour.

**Independent Test**: With the keyboard alone, reach and activate the control on any page and
confirm the appearance changes. Inspect the control's accessible name in both appearances and
confirm it is identical. Load a page and confirm the control renders in its final position with its
final icon in the first frame.

**Acceptance Scenarios**:

1. **Given** any page, **When** a visitor navigates with the keyboard alone, **Then** the appearance control is reachable, its focus is visible, and it can be activated without a pointer.
2. **Given** any page in either appearance, **When** assistive technology announces the control, **Then** it is announced as a button with a name that is identical in both appearances.
3. **Given** any page, **When** it first paints, **Then** the control already shows the icon corresponding to the rendered appearance — no placeholder, no icon appearing or swapping after the fact.
4. **Given** any page, **When** it first paints and then finishes loading, **Then** the control occupies the same space throughout and nothing in the header shifts position.
5. **Given** the header on any page, **When** the control is rendered next to the language switcher, **Then** the two align on a common height.
6. **Given** any supported language, **When** the control renders, **Then** every string it presents is in that language.

---

### User Story 4 - Appearance and language are independent (Priority: P4)

A Ukrainian-speaking customer reading a case page in dark mode switches the interface to English.
They stay on the same case page, now in English — still dark. Switching the appearance back does not
send them anywhere or change the language.

**Why this priority**: The two controls sit next to each other in the same header, and the product
already persists a language choice by a different mechanism. Cross-contamination between them is the
most likely regression, and it is cheap to pin down.

**Independent Test**: From a deep page, change the language and confirm the appearance is unchanged;
change the appearance and confirm both the language and the current page are unchanged.

**Acceptance Scenarios**:

1. **Given** a visitor on any page in a pinned appearance, **When** they switch language, **Then** the appearance is unchanged.
2. **Given** a visitor with no stored appearance preference, **When** they switch language, **Then** the appearance still follows the device setting.
3. **Given** a visitor on a page with a dynamic segment and a query string, **When** they change the appearance, **Then** the language, the address, and their place on the page are all unchanged.

---

### Edge Cases

- **Site data is blocked or unavailable** (private browsing, blocked storage, a browser policy): the
  page MUST render and remain fully usable; nothing is reported to the visitor as an error. The
  product falls back to following the device setting. Activating the control still changes the
  appearance for the current page view; it simply cannot be remembered.
- **A stored value that is not a recognised preference** (corrupt, hand-edited, left by an earlier
  version): the page renders and the control works; that one load may show the wrong appearance, and
  one press of the control restores a recognised state. Deliberately not guarded against — see the
  fifth Clarification.
- **The visitor clears site data**: the preference is gone and the visitor returns to following the
  device setting. This is the only route back to "follow the system" once a choice has been pinned,
  and it is accepted (see Clarifications).
- **The device expresses no colour-scheme preference at all**: the product renders its generic
  default appearance rather than failing to resolve.
- **JavaScript is unavailable**: the generic default appearance renders and the control does nothing.
  Accepted — the language switcher already depends on scripting, so this is not a new limitation.
- **A page is opened directly deep in the site, or reloaded**: the first-paint guarantee applies
  equally; there is no path into the product that shows the wrong appearance first.
- **Two tabs disagree**: the most recent choice wins and both tabs converge on it.

## Requirements _(mandatory)_

### Functional Requirements

**Resolution and preference states**

- **FR-001**: The product MUST render in exactly one of two appearances at any moment: light or dark.
- **FR-002**: The product MUST support exactly three preference states: light, dark, and follow-the-system.
- **FR-003**: A visitor with no stored preference MUST be in the follow-the-system state.
- **FR-004**: In the follow-the-system state, the rendered appearance MUST match the operating system's colour-scheme setting.
- **FR-005**: In the follow-the-system state, the rendered appearance MUST follow a change to the operating system's setting while the page is open, without a reload and without disturbing the visitor's place on the page.
- **FR-006**: An explicitly pinned preference MUST override the operating system's setting, on every route, until the visitor changes it.

**The control**

- **FR-007**: A single visible control MUST be present on every page, in the header that already carries the language switcher.
- **FR-008**: Activating the control MUST set the explicit preference to the appearance opposite the one currently rendered.
- **FR-009**: The control MUST be two-state: it offers no affordance for returning to the follow-the-system state (deliberate — see Clarifications).
- **FR-010**: The control MUST be operable by keyboard alone, with visible focus, and MUST be announced as a button by assistive technology.
- **FR-011**: The control's accessible name MUST NOT depend on the active appearance — the name rendered by the server and the name rendered by the browser are identical.
- **FR-012**: The control MUST present the icon matching the rendered appearance from the first paint: no "not yet ready" placeholder, no icon appearing late, and no icon swapping after the page has arrived.
- **FR-013**: The control MUST NOT change size or position between first paint and settled state — no layout shift in the header.
- **FR-014**: The control MUST be composed from the existing button primitive in `src/components/ui`, at the icon size that matches the language switcher trigger's height. No additional interface primitive is vendored for this feature.

**Persistence**

- **FR-015**: The preference MUST persist per browser and survive a reload, a navigation to any other route, and a later session.
- **FR-016**: The preference MUST NOT be stored in a cookie, MUST NOT appear in the address, and MUST NOT be sent to the server in any form.
- **FR-017**: Two open tabs MUST converge on the same preference after either one changes it.
- **FR-018**: Storage being unavailable or blocked MUST NOT raise an error to the visitor or break any page; the product falls back to the follow-the-system state.
- **FR-019**: A stored value that is not one of the recognised preference states MUST NOT break the page or leave the visitor without a usable control, and a single activation of the control MUST return the preference to a recognised value. The product does **not** guarantee the correct appearance on that one load — see the fifth Clarification.

**Rendering**

- **FR-020**: The server MUST render a generic default appearance, and the resolved appearance MUST be applied to the document before the browser's first paint — so that no direct visit and no reload shows a frame of the wrong appearance.
- **FR-021**: The document's colour-scheme MUST follow the active appearance, so that native scrollbars, form controls, and browser chrome match rather than contrast with the page.
- **FR-022**: This feature MUST NOT add, remove, or change any colour token, and MUST NOT edit the existing palette; the dark styling already present in the stylesheet is used unchanged. Superseded for the palette values by feature 005 (`specs/005-atmo-brand/`).
- **FR-023**: No route may lose static prerendering as a result of this feature, and the locale middleware and its cookie handling MUST be untouched.

**Copy and configuration**

- **FR-024**: Every string the control renders MUST resolve through the message catalogs, with its key present in both the `en` and `uk` catalogs.
- **FR-025**: The default preference state and the storage location's key are application code, not environment configuration: the Config module and `.env.example` are unchanged by this feature.

**Independence**

- **FR-026**: Changing the appearance MUST leave the active language, the current address, and the visitor's place on the page unchanged.
- **FR-027**: Changing the language MUST leave the appearance preference and the rendered appearance unchanged.

### Key Entities

- **Appearance preference**: what the visitor has chosen — one of light, dark, or follow-the-system.
  Held per browser, absent until the visitor pins something, and never leaves the browser.
- **Rendered appearance**: what is actually on screen — light or dark. Derived from the preference,
  falling back to the operating system's setting when the preference is follow-the-system.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor with no stored preference is served the appearance their device asks for on 100% of routes, for both device settings.
- **SC-002**: A pinned appearance is in effect on 100% of routes, survives a reload, a navigation, and a later session, and wins over a conflicting device setting in 100% of cases.
- **SC-003**: Changing appearance takes exactly one interaction — one press, by pointer or keyboard — and takes effect without a page reload.
- **SC-004**: No visitor-visible frame of the opposite appearance occurs on a direct visit or a reload, in either preference state, verified by review (an automated paint-timing assertion is out of scope — see Clarifications).
- **SC-005**: The header's contents occupy identical positions in the first painted frame and in the settled page — the control causes no layout shift. Verified by review, consistent with the second Clarification; there is deliberately no automated measurement here.
- **SC-006**: The control is reachable and activatable with the keyboard alone on every page, and its announced name is byte-identical between the two appearances.
- **SC-007**: With site data blocked, every page renders and remains fully usable, with zero errors surfaced to the visitor.
- **SC-008**: Switching language leaves the rendered appearance unchanged, and switching appearance leaves the language and current page unchanged, in 100% of combinations of the supported languages and the two appearances.
- **SC-009**: 100% of the control's copy is present in every supported locale, enforced by the existing pre-merge completeness gate.

## Implementation Constraints _(input to planning, decided up front)_

These were specified with the feature and are carried into `/speckit-plan` rather than re-decided
there.

- **Mechanism**: use `next-themes`. It is a new runtime dependency, so the plan MUST carry its
  justification under the constitution's dependency rule. The substance of that justification:
  Next.js's own "preventing flash before hydration" guide documents the inline-script technique but
  leaves the edge cases to us — storage fallback, cross-tab synchronisation, live following of the
  system setting, the document colour-scheme property, and the Strict Mode development remount.
  `next-themes` is roughly 34 KB unpacked with zero runtime dependencies, and the exit path is
  replacing one provider and one hook.
- **Styling hook**: configure it to drive the existing `dark` class. `src/app/globals.css` already
  contains the full `.dark` block and its custom variant, and both are used unchanged.
- **Mounting point**: the provider is mounted in `src/app/[locale]/layout.tsx` — there is
  deliberately no root `app/layout.tsx` — and the `<html>` element carries the hydration-warning
  suppression the technique requires.
- **Icons**: from `lucide-react`, already a dependency. Both icons are rendered, and their
  visibility is swapped by the dark variant in CSS, which is what delivers FR-012 and FR-013.
- **Structure**: the new component lives in its own folder with its colocated test, per the
  one-folder-per-component rule.
- **Test regime**: test-together. A Vitest component test covers the control's rendering and its
  toggle behaviour. Playwright end-to-end MUST cover: a device preferring dark with nothing stored is
  served dark on first load and a device preferring light is served light; activating the control
  flips the appearance and the choice survives a reload and a navigation to another route; a stored
  choice wins over a conflicting device preference; switching language leaves the appearance
  unchanged and switching appearance leaves the language and current page unchanged; a change to the
  device setting made while the page is open is followed live (FR-005); two open tabs converge on the
  same preference after one of them changes it (FR-017); and with storage blocked the page still
  renders and stays usable (FR-018).

## Assumptions

- The supported locales remain `en` and `uk`; the control's copy ships in both, and no other locale
  exists to complete.
- The header rendered by `src/app/[locale]/layout.tsx` is present on every page, so mounting the
  control there satisfies "on every page" without touching individual routes.
- Exactly two rendered appearances exist. No third appearance (high contrast, sepia, a partner
  theme) is introduced, and the preference vocabulary is closed.
- Because there is no database and no authentication yet, "the product remembers" means per browser.
  A visitor using a second device or a second browser starts again from follow-the-system, and
  clearing site data resets the preference. This is understood and accepted for this feature.
- The dark palette already committed in `src/app/globals.css` is fit to ship as-is. Whether it is
  well-balanced or accessible is not judged here.
- The generic default appearance the server renders is the light one, matching what the product
  renders today.
- The existing language switcher's trigger height is the reference for the control's size; if that
  height changes later, the control follows it rather than hardcoding a value.

## Out of Scope

Deliberately excluded. These are not to be invented into this feature:

- An automated paint-timing assertion proving the absence of flash in the end-to-end suite — the
  risk was weighed and accepted.
- The Atmo brand palette, and any change to the existing colour tokens. That is its own feature.
- A contrast or WCAG audit of the current dark palette.
- Per-tenant themes, and a per-account preference synced across a visitor's devices — there is
  neither a database nor authentication yet.
- Suppressing CSS transitions during an appearance change; nothing currently transitions colour.
- Forced-colors and high-contrast operating system modes.
- Any appearance behaviour specific to the agent chat surface, which does not exist yet.
