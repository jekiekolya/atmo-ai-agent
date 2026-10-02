# Feature Specification: Dates and Times in the Reader's Time Zone

**Feature Branch**: `004-reader-time-zone`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Show dates and times in the reader's own time zone instead of the fixed UTC zone. WHY NOW: feature 001 fixed the display zone to UTC (`src/i18n/request.ts`) and listed 'Times in the visitor's own time zone' as Out of Scope, to be specified once a zone source existed; storage is already correct (every timestamp column is `@db.Timestamptz(3)`, stays UTC) — only reading changes. SETTLED DECISIONS, not to be reopened in clarify: (1) the zone comes from the reader's browser, resolved there and applied after the page becomes interactive — no zone cookie, no database column, no reader setting, no IP or locale guessing; locale and zone are independent (a Ukrainian-language reader in Berlin sees Ukrainian text and Berlin time). (2) Before the zone is known — server rendering, before hydration, JavaScript disabled — the time is shown in UTC and then replaced with the local value; nothing hidden, blanked or skeletoned; a reader without JavaScript still sees a correct, readable, unambiguous instant. (3) The reader's own zone carries no zone label ('14 Mar 2026, 11:30'); the UTC fallback is labelled ('14 Mar 2026, 09:30 UTC'); a time is never displayed in a zone that is not the reader's without saying so — a silently wrong hour on an expiry deadline is the failure being prevented. (4) Scope is every date and time shown today: the created date and the pending-invite expiry in the users table, the invite expiry in the invite link dialog, and the opened-at date on the demo case page, which today is formatted on the server and must move onto the same mechanism; date-only values move zone too, so a date may show as the previous or next day near midnight, which is intended. (5) One shared mechanism that holds for what comes later — chat message timestamps above all, dense and repeated — with something that fails when a new date is formatted outside it. (6) Proof: end-to-end coverage under a fixed Europe/Kyiv browser zone shows a known UTC instant rendered as its local equivalent, not as UTC; component coverage shows both states, zone known (no label) and zone unknown (UTC, labelled). CONSTRAINTS: no new runtime dependency — next-intl 4.13.7 does the formatting, its behaviour with an absent or explicit zone to be confirmed against node_modules during planning; no database migration; no change to authentication; no hardcoded copy, en and uk; minimal surface — no zone picker, settings screen, or per-component configuration. OUT OF SCOPE, each with its return condition: a `timeZone` column on the user written at sign-in; a reader-chosen override; relative time; entering a date or time; changing stored values, column types, or how instants are written. SUCCESS CRITERIA observable — e.g. a Europe/Kyiv reader sees 09:30 UTC as 11:30 with no suffix; the same instant in two zones shows two correct wall-clock times; a reader without JavaScript sees UTC, labelled; no hydration mismatch in the console on any page showing a time." (Condensed from the full request in the `/speckit-specify` invocation; nothing above adds to or departs from it.)

## Overview

Every date and time the product shows is currently rendered in UTC, a choice feature 001 made on
purpose because pages render on the server and the server cannot know where the reader is. This
feature shows each reader the time on their own clock, taken from their browser, and keeps one rule
above all others: **a time is never shown in a zone that is not the reader's without the zone being
named.** Until the reader's zone is known, the time stays in UTC and says so; once it is known, the
time is shown in the reader's zone and needs no label.

It also makes date and time display a single shared path, enforced by an automated check, so that
the next dates the product adds — chat message timestamps first — inherit these rules instead of
re-deciding them.

## Clarifications

### Session 2026-10-02

- Q: When a date-only value is shown in the UTC fallback, does it carry the UTC label? → A: Yes — every
  value in the fallback is labelled, date-only or not; once the reader's zone is known, none is
  (FR-007, FR-008).
- Q: Does the automated check cover only code that renders the screen, or all application code
  including server-only output? → A: Only the screen. Instants are UTC everywhere else — stored, sent
  between server and browser, and (in a future date input) submitted as UTC; only on-screen display
  converts to the reader's zone. Output with no browser, such as email, is its own feature and decides
  its zone and display there (FR-016, FR-018).
- Q: Should end-to-end coverage also check a page as first delivered, before scripts run? → A: No. The
  only public candidate is the demo case page, which is slated for removal; the zone-unknown state is
  covered at component level (FR-020, FR-021).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A reader sees every date and time on their own clock (Priority: P1)

A super admin in Kyiv opens the users page. The pending invite that expires at 09:30 UTC on
14 March 2026 reads "Pending until 14 Mar 2026, 11:30" — the hour on the reader's own clock, with no
zone appended because none is needed. Each user's creation date is the calendar day in Kyiv. When
the admin issues an invite, the link dialog states the expiry in Kyiv time. A visitor to the demo
case page sees the opened-at date as the day in their own zone. A colleague in Berlin, reading the
same page in Ukrainian, sees Ukrainian text and Berlin times.

**Why this priority**: This is the feature. An expiry deadline shown in a zone the reader did not
expect is read as their own and acted on at the wrong hour.

**Independent Test**: Open each page showing a date or time in a browser whose zone is
Europe/Kyiv and confirm every value is the local equivalent of its stored instant, with no zone
label.

**Acceptance Scenarios**:

1. **Given** a reader whose browser zone is Europe/Kyiv and a pending invite expiring at 09:30 UTC on
   14 March 2026, **When** they open the users page, **Then** the expiry reads as 11:30 on
   14 March 2026 and carries no zone label.
2. **Given** the same reader, **When** they issue or re-issue an invite, **Then** the expiry in the
   invite link dialog is shown in Kyiv time with no zone label.
3. **Given** a user created at 23:30 UTC on 14 March 2026, **When** a reader in Europe/Kyiv views the
   users table, **Then** the creation date reads 15 March 2026.
4. **Given** a reader in Europe/Kyiv, **When** they open the demo case page, **Then** the opened-at
   date is the calendar day of that instant in Kyiv.
5. **Given** one instant, **When** it is read by a reader in Europe/Kyiv and by a reader in
   America/New_York, **Then** each sees a different wall-clock time, each correct for their own zone.
6. **Given** a reader whose language is Ukrainian and whose browser zone is Europe/Berlin, **When**
   they view any date or time, **Then** it is formatted in Ukrainian and shown in Berlin time.
7. **Given** a reader whose browser zone is UTC itself, **When** they view any time, **Then** it is
   shown in UTC without a zone label, because UTC is their own zone.
8. **Given** a reader in a zone that observes daylight saving and two instants on either side of a
   change, **When** they view both, **Then** each is converted with the offset that zone used at
   that instant, not the offset in effect today.

---

### User Story 2 - Before the zone is known, the reader still sees a correct, labelled time (Priority: P2)

A reader whose browser has JavaScript disabled opens the users page. The pending-invite expiry reads
"Pending until 14 Mar 2026, 09:30 UTC" and stays that way: the reader knows exactly which instant is
meant, and the zone label stops them mistaking it for their own clock. A reader with JavaScript
enabled sees the same labelled UTC value in the first moment the page appears, and it is replaced
with their local value as the page becomes interactive — no gap, no blank, no placeholder.

**Why this priority**: The local display (Story 1) is only safe if the moment before it is also
honest. An unlabelled UTC value is exactly the silently-wrong hour this feature exists to remove.

**Independent Test**: Open each page showing a date or time with JavaScript disabled and confirm
every value is the UTC rendering of its instant, labelled as UTC; then load with JavaScript enabled
and confirm the console reports no rendering mismatch.

**Acceptance Scenarios**:

1. **Given** a reader with JavaScript disabled, **When** they open any page showing a date or time,
   **Then** every value is shown in UTC and labelled as UTC.
2. **Given** a reader with JavaScript disabled, **When** a date-only value is shown, **Then** it is
   the UTC calendar day and labelled as UTC.
3. **Given** a reader with JavaScript enabled, **When** the page first appears, **Then** every date or
   time position already contains a complete, readable value — the labelled UTC one — and never a
   blank, placeholder, or loading indicator.
4. **Given** a reader with JavaScript enabled, **When** the page becomes interactive, **Then** each
   labelled UTC value is replaced in place with the reader's local value without a label.
5. **Given** any page showing a date or time, **When** it loads and becomes interactive, **Then** the
   browser console reports no rendering-mismatch error or warning.
6. **Given** a browser that reports no usable time zone, **When** the page becomes interactive,
   **Then** every value stays in UTC with its label.

---

### User Story 3 - Every date added later follows the same rules automatically (Priority: P3)

A developer adding chat message timestamps — or any other date — to the product formats them
through the shared mechanism and gets the reader's zone, the labelled UTC fallback, and locale-aware
formatting without deciding any of it again. If they format a date any other way, an automated check
fails before the change can merge.

**Why this priority**: The rules in Stories 1 and 2 hold only as long as no screen bypasses them.
Chat will show far more timestamps than every current screen combined, and one bypassed call is
enough to reintroduce an unlabelled wrong hour.

**Independent Test**: Introduce a date formatted outside the shared mechanism and confirm the
automated check fails and names the location; remove it and confirm the check passes.

**Acceptance Scenarios**:

1. **Given** the four displays in scope, **When** the codebase is inspected, **Then** each produces
   its date or time through the shared mechanism and none formats one directly.
2. **Given** a change that formats a date or time outside the shared mechanism, **When** the merge
   gates run, **Then** the automated check fails and identifies where.
3. **Given** a new date added through the shared mechanism, **When** it is displayed, **Then** it
   follows Stories 1 and 2 with no configuration at its call site beyond the value and its format.

---

### Edge Cases

- **Near midnight**: a date-only value may show as the previous or next calendar day relative to UTC.
  This is intended (FR-012). In the UTC fallback, the same value shows the UTC day and is labelled.
- **Reader's zone is UTC**: the zone is known, so the value is unlabelled (FR-009).
- **Browser reports no usable zone**: the page stays in the labelled UTC fallback (FR-004).
- **Values that appear after the page is interactive** — the invite link dialog opened after issuing
  an invite — are shown directly in the reader's zone with no labelled UTC interim (FR-003).
- **Daylight-saving boundaries**: each instant uses the offset in effect at that instant (FR-013).
- **The reader's zone changes while a page is open** (travel, a system setting changed): values
  already shown are not re-converted; the next page load uses the new zone.
- **Locale and zone disagree** — a Ukrainian-language reader in Berlin: language follows the address
  as feature 001 defines; zone follows the browser (FR-002).

## Requirements _(mandatory)_

### Functional Requirements

**Source of the zone**

- **FR-001**: The zone in which dates and times are shown MUST be the time zone the reader's browser
  reports. No other source MAY be used: no stored preference, cookie, profile value, setting, network
  location, or inference from the language.
- **FR-002**: The display zone and the display language MUST be independent. The language continues to
  resolve exactly as feature 001 defines.
- **FR-003**: The reader's zone MUST be determined once the page is interactive and applied to every
  date and time on that page. A value that first appears after that moment MUST be shown in the
  reader's zone directly, with no UTC interim.

**Before the zone is known**

- **FR-004**: Until the reader's zone is known — in the page as first delivered, before the page is
  interactive, when JavaScript is disabled, and when the browser reports no usable zone — every date
  and time MUST be shown in UTC.
- **FR-005**: No date or time MAY be hidden, blanked, or replaced by a placeholder or loading indicator
  at any point. The UTC value MUST be complete and readable on its own.
- **FR-006**: Replacing the UTC value with the local value MUST NOT produce a rendering-mismatch error
  or warning in the browser console.

**Labelling**

- **FR-007**: A date or time shown in the reader's own zone MUST NOT carry a zone label.
- **FR-008**: A date or time shown in the UTC fallback MUST carry a label naming UTC. This applies to
  date-only values as well as values with a time of day, because a UTC calendar day near midnight can
  differ from the reader's.
- **FR-009**: When the reader's own zone is UTC, values MUST be treated as being in the reader's zone
  (FR-007), not as the fallback.
- **FR-010**: Values and their zone labels MUST be produced by locale-aware formatting in both English
  and Ukrainian, never assembled from strings. Any new copy this feature needs MUST exist in both
  locales, subject to feature 001's completeness checks.

**Scope of displays**

- **FR-011**: FR-001 – FR-010 MUST apply to every date and time the product shows today:
  - the creation date in the users table;
  - the pending-invite expiry in the users table;
  - the invite expiry in the invite link dialog;
  - the opened-at date on the demo case page, which today is fixed when the page is produced on the
    server and MUST instead follow the same rules as the others.
- **FR-012**: Date-only values MUST be shown as the calendar day of the instant in the display zone,
  even where that differs from the UTC day.
- **FR-013**: Conversion MUST use the zone's offset in effect at the displayed instant, including
  daylight saving, not the offset at the moment of viewing.
- **FR-014**: Each display MUST keep its current level of detail: date-only values stay date-only, and
  values with a time of day keep their date and time of day.

**One shared mechanism**

- **FR-015**: Every date or time the product shows on screen — the four in FR-011 and every one added
  after this feature — MUST be produced through one shared mechanism. No display MAY format a date or time
  directly.
- **FR-016**: An automated check, part of the merge gates, MUST fail when code that renders the screen
  formats a date or time outside the shared mechanism, and MUST identify where. The check MUST be shown
  to catch at least one such violation. Output produced with no browser — email, export, report — is
  outside the check; the feature that introduces it decides its zone and display.
- **FR-017**: All dates and times on one page MUST be shown in the same zone, determined once for that
  page rather than per value, so that pages with many repeated timestamps stay consistent. Adding a
  date through the mechanism MUST need no configuration at its call site beyond the value and its
  format.

**Unchanged**

- **FR-018**: How instants are stored and written MUST NOT change: no migration, no column change, no
  change to the authentication flow. Instants MUST remain UTC in storage and wherever they pass
  between server and browser; conversion to the reader's zone happens only when a value is shown on
  screen.
- **FR-019**: Feature 001's language resolution and switching, and feature 003's behavior, MUST
  continue to hold, apart from the display zone this feature changes.

**Acceptance coverage**

- **FR-020**: Automated end-to-end coverage, with the browser's zone fixed to Europe/Kyiv, MUST
  demonstrate that a known UTC instant renders as its Kyiv equivalent and not as UTC, without a zone
  label, on: the users table (creation date and pending-invite expiry), the invite link dialog, and the
  demo case page. The same coverage MUST confirm that none of those pages reports a rendering mismatch
  in the browser console.
- **FR-021**: Component-level coverage MUST show, for the shared mechanism, both states: zone known
  (local value, no label) and zone unknown (UTC value, labelled).

### Key Entities

- **Displayed instant**: a moment stored in UTC and shown to a reader. Not changed by this feature.
- **Reader's zone**: the time zone the reader's browser reports, known only in the browser once the
  page is interactive. Transient — never stored, sent, or remembered.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A reader in Europe/Kyiv opening the users page sees a pending invite that expires at
  09:30 UTC on 14 March 2026 as 11:30 on that date, with no zone suffix.
- **SC-002**: The same instant read in two different zones (for example Europe/Kyiv and
  America/New_York) shows two different wall-clock times, each correct for its reader.
- **SC-003**: A reader with JavaScript disabled sees 100% of displayed dates and times in UTC, each
  explicitly labelled as UTC.
- **SC-004**: At no moment while any page loads is a date or time position empty or showing a
  placeholder; the page as first delivered already contains a readable value in every such position.
- **SC-005**: Zero rendering-mismatch errors or warnings are reported in the browser console on every
  page that shows a date or time.
- **SC-006**: A Ukrainian-language reader in Europe/Berlin sees dates in Ukrainian and times in Berlin
  time.
- **SC-007**: All four displays in scope go through the shared mechanism, and a deliberately
  introduced date formatted outside it fails the merge gates.

## Assumptions

- **Exact output follows the locale's conventions.** "14 Mar 2026, 11:30" and
  "14 Mar 2026, 09:30 UTC" illustrate the shape; ordering, separators, the 12- or 24-hour clock, and the
  wording of the UTC label are whatever each locale's formatting produces.
- **The switch from UTC to local is not announced** to assistive technology. It happens as the page
  becomes interactive, before a reader would normally reach the value, and announcing every timestamp
  would be noise on dense pages.
- **A zone change mid-page is picked up on the next page load**, not live.
- **The demo case page is slated for removal.** Until it is removed, its opened-at date follows this
  feature's rules (FR-011); its coverage in FR-020 is removed with it.
- **Implementation constraints are deliberate**, following features 001 and 003: the request fixes the
  formatting library (next-intl 4.13.7, already installed, no new runtime dependency) and asks for its
  behavior with an absent or explicit zone to be confirmed against the installed package during
  planning. They are recorded here as constraints, not as design.
- **This feature supersedes** feature 001's Out of Scope entry "Times in the visitor's own time zone"
  and feature 003's assumption "Times are shown in UTC" together with the UTC wording in its UI
  contract. Those documents are amended to point here during planning.

## Out of Scope

Each item is deliberately deferred, with the condition that brings it back:

- **A `timeZone` value on the user, written automatically at sign-in.** Deferred because nothing reads
  it: a profile zone is needed only where no browser is present. Revisit when the first browser-less
  time output ships — an emailed invite, a scheduled report, an export. Even then the browser stays the
  source of truth on screen; the profile value is only the fallback for output without one.
- **A reader-chosen zone override.** Revisit when readers report needing a zone other than their
  device's — for example, staff supporting customers in another zone.
- **Relative time** ("expires in 3 days"), anywhere. Revisit when a screen needs it — chat timestamps
  are the likely first — as its own specification, through the same shared mechanism.
- **Entering a date or time.** No input takes one today. Revisit when the first such input is
  specified. Its direction is already set: the reader picks the value on their own clock, and it is
  sent to the server as a UTC instant.
- **Changing stored values, column types, or anything about how instants are written on the server.**
  Storage is already UTC and correct. Revisit only if a stored value is found to be wrong.
