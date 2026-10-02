# Feature Specification: i18n Foundation

**Feature Branch**: `001-i18n-foundation`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "i18n foundation: locale-aware routing, message catalogs, and a language switcher. Supported locales: en (default) and uk. The supported-locale set and the default are a typed constant in application code, not environment configuration — a locale cannot exist without its catalog committed to the repo. Routing: every route lives under a /[locale]/... path segment, always prefixed, including the default locale. All internal navigation goes through next-intl's localized navigation helpers. Locale resolution order for a visitor: URL segment > NEXT_LOCALE cookie > Accept-Language header > default. First visit with no cookie and no locale in the URL redirects to the negotiated locale. Language switcher: preserves the current path and its params (/uk/x/42 -> /en/x/42) and persists the choice in the NEXT_LOCALE cookie. Catalog completeness is enforced twice: TypeScript types derive message keys from the en catalog so a missing or misspelled key fails `npm run typecheck`, and a Vitest test compares key sets across all locales and fails listing every gap. Locale-dependent values (dates, numbers, currency, units) are rendered through locale-aware formatters — never assembled from strings. Acceptance must include a Playwright e2e covering locale switching: switching language preserves the current page, the copy changes, and the choice survives a reload and a visit to the site root. Out of scope, to be specified later as their own features: per-tenant locale sets and defaults (no database yet), a user-profile locale that overrides the URL (no auth yet), and the agent replying in the customer's locale (no agent yet)."

## Overview

Atmo AI Agent supports the end customers of solar-energy partner companies across more than one
language market. This feature establishes the language foundation the rest of the product builds
on: every page is reachable at a language-specific address, all copy comes from per-language
message catalogs, a visitor is served the language they most likely want on their first visit, and
a visible switcher lets them change it and have that choice remembered.

It also establishes the guarantee that makes the above trustworthy: a screen can never ship with a
missing or untranslated string. Completeness is proven before release rather than discovered by a
partner's customer.

This feature ships the mechanism together with a small, genuine surface to prove it on: a
localized shell and one nested route carrying a dynamic segment and locale-dependent values. It does
not translate future screens — each later feature carries its own copy in every supported language.

## Clarifications

### Session 2026-08-24

- Q: Which screens and copy should this feature actually localize, given the app today has only a scaffolding page? → A: Full demonstration surface — a localized shell replacing the scaffolding, plus one nested route with a dynamic segment rendering a date, a decimal number, a monetary amount, and a count-dependent phrase, so FR-013, FR-023, and FR-024 are verifiable against a real shipped route.
- Q: Should the language switcher be a set of real links (one per language), or a dropdown control? → A: A dropdown / select menu — chosen deliberately for the cleaner interface, even at two languages, and it scales to further languages at constant width. A link-pair alternative was presented and declined. Accepted consequences: switching requires JavaScript, the switcher itself is not a crawlable path between languages, and a dropdown primitive must be vendored through the shadcn/ui CLI and kept accessible.
- Q: When should the stored language preference be written — only on an explicit choice in the switcher, or on every navigation reflecting the language served? → A: Only when the visitor explicitly chooses a language in the switcher. Navigating to a prefixed address never writes or overwrites the preference, so a shared link cannot silently replace a recipient's own choice. This resolves the contradiction between the "Two visitors, one link" edge case and the former "Preference updates on navigation" assumption, in favour of the edge case.
- Q: May the redirect from an unprefixed address to a language-specific one be cached? → A: No. It MUST be a temporary redirect that browsers and shared caches are instructed not to store, because its destination varies per visitor. A permanent or shared-cached redirect would freeze a visitor's language and silently break FR-015 in production while tests still pass.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A visitor is served the product in a language they can read (Priority: P1)

A solar customer in Ukraine opens a link to the support site. Their browser advertises Ukrainian.
Without touching any setting, they land on the Ukrainian version of the page they asked for, at a
Ukrainian-specific address they can bookmark or share. A colleague in an English-speaking market
opening the same link lands on the English version. Either of them can share their address with
someone else and that person sees the same language, regardless of their own browser settings.

**Why this priority**: Without this, there is no localized product at all — every other story
depends on locale-aware addresses and catalogs existing. On its own it already delivers the core
value: customers read the interface in their own language.

**Independent Test**: Request the site root and any deeper path with different browser language
preferences and with no stored preference, and confirm the language served, the address landed on,
and the language declared by the page. No switcher and no persistence needed.

**Acceptance Scenarios**:

1. **Given** a visitor with no stored language preference whose browser prefers Ukrainian, **When** they open the site root, **Then** they are redirected to the Ukrainian-prefixed root and see Ukrainian copy.
2. **Given** a visitor with no stored language preference whose browser prefers a language the product does not support, **When** they open the site root, **Then** they are redirected to the English-prefixed root and see English copy.
3. **Given** any visitor, **When** they open an English-prefixed address directly, **Then** they see English copy even if their browser prefers Ukrainian and even if a different language is stored as their preference.
4. **Given** a visitor opening a deeper path with no language prefix, **When** the request is resolved, **Then** they are redirected to the same path under their negotiated language, with any query string preserved unchanged.
5. **Given** any page in any supported language, **When** it renders, **Then** the page declares that language as its document language.

---

### User Story 2 - A visitor changes language and the product remembers (Priority: P2)

A customer reading a page in Ukrainian prefers English support wording. They pick English from the
language switcher that is present on the page. They stay exactly where they were — same page, same
record, same filters — now in English. When they reload, it is still English. When they come back
later and open the site root, they get English without having to switch again.

**Why this priority**: Automatic negotiation is right most of the time but not always; a customer
whose device language differs from their reading preference is stuck without this. It depends on
Story 1 being in place.

**Independent Test**: From a deep page with a dynamic segment and a query string, switch language
and verify the address, the copy, that a reload keeps the choice, and that a subsequent visit to
the site root honors it.

**Acceptance Scenarios**:

1. **Given** a visitor on a Ukrainian page, **When** they choose English in the switcher, **Then** the same content is shown in English and the address differs only in its language segment.
2. **Given** a visitor on a Ukrainian page with a dynamic segment and a query string, **When** they switch to English, **Then** the dynamic segment and the query string are unchanged in the resulting address.
3. **Given** a visitor who has switched language, **When** they reload the page, **Then** the copy stays in the chosen language.
4. **Given** a visitor who has switched language, **When** they later open the site root with no language prefix, **Then** they are served the language they chose, even if their browser prefers the other one.
5. **Given** any page, **When** the switcher is rendered, **Then** it lists every supported language, marks the active one, names each language in that language itself, and is operable by keyboard alone and announced correctly to assistive technology.
6. **Given** a visitor who has chosen English, **When** they follow a shared Ukrainian-prefixed link and afterwards open the site root, **Then** they see the shared page in Ukrainian but are returned to English at the root — the shared link did not change their stored choice.

---

### User Story 3 - A contributor cannot ship an untranslated or misspelled string (Priority: P3)

A developer adds a screen with new copy and forgets the Ukrainian text for one of its labels.
Another mistypes a message key. Neither change can reach a customer: the quality gates that run
before merge reject both, naming exactly what is missing or wrong, so the fix takes seconds rather
than being discovered as broken Ukrainian copy in production.

**Why this priority**: This is the durability of the feature rather than its visible behavior — the
product works without it, but only until the first deadline. Independently valuable and
independently verifiable.

**Independent Test**: Deliberately remove a key from the Ukrainian catalog and reference a
non-existent key, then run the pre-merge quality gates and confirm both are rejected with a message
naming the offending locale and key.

**Acceptance Scenarios**:

1. **Given** a key present in the English catalog and absent from the Ukrainian catalog, **When** the pre-merge quality gates run, **Then** they fail and the failure names the missing key and the locale missing it.
2. **Given** several keys missing across locales, **When** the completeness gate runs, **Then** the failure lists every gap, not only the first one found.
3. **Given** a reference to a message key that exists in no catalog, or a misspelling of an existing key, **When** the type-checking gate runs, **Then** it fails and identifies the offending reference.
4. **Given** a page that renders, **When** any message is resolved, **Then** no key name, empty string, or other language's text is ever displayed in place of a missing translation — the condition cannot reach a running page.

---

### User Story 4 - Dates, numbers, and amounts read naturally in the active language (Priority: P4)

A customer sees a date, a quantity, and a monetary amount on a support page. In Ukrainian these
follow Ukrainian conventions; in English they follow English ones — the order of day and month, the
decimal and thousands separators, the placement of the currency symbol, and the wording of units all
change with the language, without any screen assembling them from fragments of text.

**Why this priority**: A correctly translated page that shows a date in the wrong order still reads
as broken, but the interface is usable before this lands, and only the copy that exists today needs
it.

**Independent Test**: Render a page containing a date, a decimal number, a monetary amount, and a
count-dependent phrase in both languages and compare the output against each language's
conventions.

**Acceptance Scenarios**:

1. **Given** the same underlying date and number, **When** the page is viewed in each supported language, **Then** each rendering follows that language's conventions for date order and for decimal and grouping separators.
2. **Given** a monetary amount, **When** it is rendered in each supported language, **Then** the symbol placement and separators follow that language's conventions and the amount's value is identical.
3. **Given** a phrase whose wording depends on a count, **When** it is rendered for counts that take different plural forms in Ukrainian, **Then** each form is correct for that count in that language.
4. **Given** any locale-dependent value, **When** its rendering is reviewed, **Then** it is produced by a locale-aware formatter rather than by joining strings, so translators control word order.

---

### Edge Cases

- **Unknown first path segment**: A path whose first segment is not a supported language (for example `/de/dashboard`) is not silently reinterpreted as that language. It is treated as an unprefixed path, redirected under the negotiated language, and — if no route matches there — renders the localized not-found page in that language.
- **Stored preference is unrecognized**: A stored preference holding a value that is not a supported language is ignored, and negotiation continues with the browser's advertised languages.
- **Regional variants**: A browser advertising `uk-UA` or `en-GB` is served the corresponding base language. A browser advertising only unsupported languages is served the default.
- **No language advertised at all**: A request with no browser language information and no stored preference is served the default language.
- **Preferences cannot be stored**: When storage is blocked, switching language still works for that navigation and for as long as the visitor stays on prefixed addresses; a later visit to the site root falls back to browser negotiation. Nothing errors, and no message tells the visitor to change browser settings.
- **JavaScript unavailable or not yet loaded**: The switcher cannot open, and no error is shown. The page still renders fully in its own language, and the visitor can still reach the other language by address. The switcher never appears functional while it is not.
- **A path that matches no route**: Any address under a supported language that names no real page — `/uk/demo` without its case number, `/uk/whatever` — renders the localized not-found page: correct document language, the switcher present, and a 404 status. It is a page like any other, never a bare framework error screen. Its markup arrives on hydration rather than in the server response — the status code is still 404, so a visitor without JavaScript sees an empty page rather than a wrong one.
- **Switching from a not-found page**: The switcher still moves the visitor to the same path under the other language, where the not-found page renders in that language.
- **Switching mid-form or mid-scroll**: A language switch is a navigation; unsaved input on the page is not preserved and the visitor is not promised otherwise.
- **Browser back after switching**: Going back returns the visitor to the previous language's address and shows that language, even though the stored preference now names the other one — the address always wins.
- **Non-page resources**: Addresses that do not serve pages — programmatic endpoints, static assets, the site icon, crawler and sitemap files, and framework internals — are neither language-prefixed nor redirected, and remain reachable at their unprefixed addresses.
- **A cached redirect**: No visitor can be pinned to a language by a stored redirect. After switching language, the site root serves the newly chosen language on the very next request, from any entry point, without clearing browser data.
- **A translation exists but is empty**: A key present in a catalog with empty text is treated as a gap by the completeness gate, not as a deliberate blank.
- **Two visitors, one link**: A link containing a language prefix shows the same language to every recipient regardless of their own stored preference or browser settings, and following it leaves the recipient's own stored choice untouched (FR-030). A recipient who had chosen English reads the shared Ukrainian page in Ukrainian, then returns to English on their next visit to the site root.

## Requirements _(mandatory)_

### Functional Requirements

**Supported languages**

- **FR-001**: The product MUST support exactly two languages in this feature: English (default) and Ukrainian.
- **FR-002**: The set of supported languages and which one is the default MUST be defined in application code as a typed constant, not in environment or deployment configuration. Changing either MUST require a code change that goes through review.
- **FR-003**: A language MUST NOT be offerable unless its complete message catalog is committed to the repository. There MUST be no way to enable a language whose catalog is absent, partial, or supplied at runtime.
- **FR-004**: This feature MUST NOT introduce any new environment variable; language behavior MUST be identical across every deployment environment.

**Addresses and language resolution**

- **FR-005**: Every page MUST be reachable only at an address whose first path segment names the language, including the default language. There MUST be no unprefixed page address that serves content.
- **FR-006**: The language for a request MUST be resolved in this order, using the first source that yields a supported language: the address's language segment, then the visitor's stored preference, then the languages advertised by their browser, then the default.
- **FR-007**: A request for a path with no supported language segment — including the site root — MUST be redirected to the same path under the resolved language, preserving the rest of the path and the query string byte-for-byte.
- **FR-031**: That redirect MUST be temporary and MUST NOT be stored by the visitor's browser or by any shared cache. Its destination depends on the individual visitor, so every unprefixed request MUST be resolved afresh. A visitor who changes language MUST see the new language honoured at the site root immediately, with no cache to clear.
- **FR-008**: A value from any source that names an unsupported language MUST be ignored, and resolution MUST continue with the next source rather than failing or showing an error.
- **FR-009**: A browser-advertised language that carries a region or script MUST resolve to the supported language it belongs to when one exists.
- **FR-010**: Every rendered page MUST declare its active language as the document language, so browsers and assistive technology apply the correct pronunciation, hyphenation, and translation behavior.
- **FR-011**: Addresses that do not serve pages MUST be excluded from language prefixing and redirection.

**Language switcher**

- **FR-012**: Every page MUST present a language switcher, rendered as a single dropdown control that opens a list of all supported languages, indicates which is active, and labels each language with its own name in that language. The control MUST occupy the same space regardless of how many languages exist, so adding a language later needs no layout change.
- **FR-013**: Choosing a language MUST keep the visitor on the equivalent address, changing only the language segment: every remaining path segment — dynamic values included — and the entire query string MUST survive the switch unchanged (`/uk/x/42?tab=notes` becomes `/en/x/42?tab=notes`).
- **FR-014**: Choosing a language in the switcher MUST store that choice as the visitor's preference, scoped to the whole site and persisting across browser sessions.
- **FR-030**: The stored preference MUST be written ONLY by an explicit choice in the switcher. Serving a page — including one reached by a language-prefixed address, a shared link, or an automatic redirect — MUST NOT create, update, or overwrite it. A visitor with no stored preference stays without one until they choose.
- **FR-015**: After a language has been chosen, a reload of the current page and a later visit to the site root MUST both serve the chosen language, including when the browser advertises a different one.
- **FR-016**: The switcher MUST be fully operable with the keyboard alone — opening the list, moving between languages, choosing one, and dismissing without choosing — and MUST expose its state to assistive technology: that it is a list of choices, which languages are available, and which is selected. Focus MUST return to the control when the list is dismissed.
- **FR-017**: The switcher MUST degrade without error when the visitor's preference cannot be stored: the switch still takes effect for the current navigation.
- **FR-029**: Because the switcher is an interactive control (FR-012), changing language through it requires JavaScript. Every language MUST therefore remain reachable by address alone, so a visitor without JavaScript can still read the product in either language by navigating directly. No page may present the switcher as the only route to another language.

**Copy and catalogs**

- **FR-018**: Every string a person can see MUST resolve from a message catalog. No user-facing literal may be written into a page, component, or message-producing code path.
- **FR-019**: The English catalog MUST be the authoritative definition of the key set; every other supported language's catalog MUST contain exactly the same keys.
- **FR-020**: A key missing from any supported language's catalog, a key present but empty, and a reference to a key that no catalog defines MUST each block merge and release. These MUST be caught before deployment, never handled at runtime.
- **FR-021**: The completeness check MUST report every gap in one run — each missing key together with the language missing it — rather than stopping at the first.
- **FR-022**: There MUST be no runtime fallback that substitutes another language's text, the key name, or a blank for a missing message. Such a state MUST be unreachable in a released build.

**Locale-dependent values**

- **FR-023**: Dates, times, numbers, percentages, monetary amounts, and units MUST be rendered by locale-aware formatters bound to the active language. Assembling them by concatenating or hand-formatting strings is prohibited.
- **FR-024**: Interpolated values and count-dependent wording MUST be expressed inside the message itself, so each language controls word order and its own plural forms. Sentences MUST NOT be built by joining translated fragments.

**Acceptance coverage**

- **FR-025**: Automated end-to-end coverage MUST demonstrate, against a running application, that switching language keeps the visitor on the same page, that the visible copy changes, and that the choice survives both a reload and a later visit to the site root.
- **FR-026**: Automated coverage MUST demonstrate that the language segment, the stored preference, and the browser's advertised languages take precedence over one another in the order stated in FR-006.

**Demonstration surface**

- **FR-027**: This feature MUST replace the application's current scaffolding text with a minimal but genuine localized shell — a welcome heading, a supporting line, and localized page metadata (title and description) — so that a language switch produces a visible, meaningful change in copy rather than a change in placeholder text.
- **FR-028**: This feature MUST ship at least one nested route carrying a dynamic segment, reachable in every supported language, that renders a date, a decimal number, a monetary amount, and a count-dependent phrase. It exists so that FR-013, FR-023, and FR-024 are verifiable against a real shipped route; later features MAY replace it once real screens cover the same ground.

### Mandated Implementation Constraints

These are stated by the requester and by the project constitution rather than derived from the
behavior above. They are recorded here because they constrain the plan, and they are deliberate —
not implementation detail leaking into the requirements.

- **MC-001**: Localization is provided by next-intl. All internal navigation MUST go through its
  localized navigation helpers rather than raw addresses, so no link can omit or hardcode a language
  segment.
- **MC-002**: The stored language preference MUST use the cookie name `NEXT_LOCALE`.
- **MC-003**: The address form MUST be a `/[locale]/...` route segment, always prefixed, including
  for the default language.
- **MC-004**: FR-020's reference check MUST be enforced by types derived from the English catalog, so
  a missing or misspelled key fails `npm run typecheck`.
- **MC-005**: FR-021's completeness check MUST be a Vitest test comparing key sets across all
  supported languages and failing with every gap listed.
- **MC-006**: FR-025's coverage MUST be a Playwright end-to-end test.
- **MC-007**: The switcher MUST be composed from the project's shadcn/ui primitives in
  `src/components/ui`. The dropdown primitive FR-012 requires is not vendored yet; it MUST be pulled
  in through the shadcn/ui CLI (expressly permitted by the constitution) and customized in place with
  its Base UI accessibility semantics preserved. No additional component library.

### Key Entities

- **Supported Language**: One language the product is available in. Identified by a short standard
  code (`en`, `uk`), carries its own name as displayed to speakers of that language, and is marked
  as the default or not. The complete set is fixed in code and each member owns exactly one catalog.
- **Message Catalog**: The full set of user-facing text for one supported language, organized into
  namespaces by area of the product. One per supported language, committed to the repository. The
  English catalog additionally defines the authoritative key set.
- **Message Key**: The stable identifier a screen uses to ask for a piece of text. Belongs to a
  namespace, exists identically in every catalog, and may declare placeholders and count-dependent
  variants that each language fills in its own way.
- **Language Preference**: A visitor's remembered choice of language, recording a deliberate selection
  and nothing else — it exists only after the visitor uses the switcher. Lives in the visitor's browser,
  applies across the whole site, survives browser restarts, and ranks below the address but above the
  browser's advertised languages when resolving a request. Absent for every visitor who has never
  chosen.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor whose browser prefers a supported language reaches that language's version of the page they requested in a single navigation, with zero manual actions.
- **SC-002**: 100% of user-facing strings on shipped screens come from message catalogs; a review of the shipped screens finds zero hardcoded literals.
- **SC-003**: Every supported language's catalog holds an identical key set — zero gaps — and this is verified automatically on every change rather than by inspection.
- **SC-004**: Zero untranslated strings, key names, or blanks reach a rendered page in any supported language, at any point in the release process.
- **SC-005**: Switching language from any page in the product returns the visitor to the same content in the other language — zero cases of being dropped on the home page, a not-found page, or a page with lost route values or query parameters.
- **SC-006**: A chosen language is honored on 100% of subsequent visits from the same browser — after a reload, and at the site root on the very next request with no cached redirect overriding it — for as long as the visitor's browser retains the preference.
- **SC-007**: A change that omits a translation or misspells a key is rejected before merge in 100% of cases, and the rejection names every offending key and language so the fix needs no further investigation.
- **SC-008**: Adding a further language later requires only application-code and catalog changes — zero environment, deployment, or infrastructure changes.
- **SC-009**: Every locale-dependent value on shipped screens follows the active language's conventions for date order, decimal and grouping separators, currency placement, and plural wording, verified for both languages.
- **SC-010**: The language switcher is completable by keyboard alone and its options and selected state are announced by assistive technology.

## Assumptions

- **Scope of copy**: This feature translates the copy that exists in the application today and
  establishes the mechanism. Later features supply their own copy in every supported language; this
  spec is not a backlog of future translations.
- **Demonstration surface is in scope and disposable**: The application today holds only
  scaffolding text, which can demonstrate neither a meaningful copy change nor FR-013's preservation
  of dynamic segments. FR-027 and FR-028 therefore add a real shell and one nested parameterized
  route. They are product surface, not test fixtures — shipped, reviewed, and localized like any
  page — but they carry no business rules and later features are expected to replace them.
- **Preference lifetime**: The stored preference is treated as long-lived — on the order of a year —
  scoped to the entire site, and readable by the application on the visitor's next request. It holds
  a language choice only and no personal data.
- **Repeat redirects are accepted**: Because the preference records only an explicit choice (FR-030), a
  visitor who never uses the switcher is re-negotiated on every unprefixed visit and redirected again.
  Negotiation is deterministic, so the destination is identical each time; the cost is one redirect per
  root visit, accepted in exchange for a preference that means exactly one thing.
- **"Params" in the requester's example**: Read as both dynamic route segments and query-string
  parameters; both are preserved across a switch.
- **Language, not region**: Locales are language-level (`en`, `uk`) with no regional variants offered.
  Regional preferences advertised by a browser are mapped to their base language.
- **Text direction**: Both supported languages are left-to-right, so no right-to-left layout work is
  in scope. Nothing in this feature may hardcode direction in a way that blocks adding a
  right-to-left language later.
- **Currency**: Locale-aware currency formatting is established as the mechanism. The currency the
  demonstration route (FR-028) displays is arbitrary and carries no product meaning; which currency a
  given partner or customer is billed in is not decided here and arrives with the features that
  display real amounts.
- **Not-found and error pages**: These are pages like any other and are localized. A request whose
  language cannot be determined at all still renders in the default language rather than failing.
- **Translation quality**: Ukrainian copy for the existing screens is authored as part of this
  feature. Establishing a professional translation workflow for future copy is a separate concern.
- **Search-engine behavior**: Language-specific addresses are the prerequisite for correct indexing,
  but cross-language link relations and sitemap entries are not part of this feature. Note that the
  dropdown switcher (FR-012) is not a crawlable path between languages, so those link relations become
  the only mechanism for cross-language discovery and are worth specifying before launch.

## Out of Scope

Each of the following is deliberately deferred and will be specified as its own feature when its
prerequisite exists:

- **Per-tenant language sets and defaults** — a partner company restricting or defaulting the
  languages its customers see. Deferred: no database yet.
- **A user-profile language that overrides the address** — a signed-in person's saved language
  taking precedence over the address's language segment. Deferred: no authentication yet.
- **Times in the visitor's own time zone** — dates and times shown in the reader's local zone
  rather than UTC. Deferred: pages render on the server, so this needs either the customer's zone
  from a profile (no database yet) or client-side formatting. Specified in feature 004
  (`specs/004-reader-time-zone/`).
- **The AI agent replying in the customer's language** — the support agent detecting and answering
  in the conversation's language. Deferred: no agent yet.
