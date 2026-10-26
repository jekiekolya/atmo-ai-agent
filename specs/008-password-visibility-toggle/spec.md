# Feature Specification: Password Visibility Toggle

**Feature Branch**: `008-password-visibility-toggle`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Add a show/hide toggle to every password field in the app. Where: every password input — sign-in (current password), change password (current password, new password, confirmation), and set password from an invite (new password, confirmation). Behavior: Each password field shows an eye button inside the input, at its trailing edge. Pressing it reveals the typed password as plain text; pressing it again hides it. Every field has its own independent toggle — revealing the new password does not reveal its confirmation. A field is hidden whenever its page opens; the revealed state is never remembered. When the form is submitted, every revealed field in it is hidden again before the submission goes out, so password managers recognise the field and offer to save, and a password does not stay visible after a failed attempt. Toggling never changes the value, the field's validation state, or what the browser and password managers are told about the field (it stays a current/new password for autofill). The icon shows an eye while the password is hidden and a crossed-out eye while it is visible. The button is a real, keyboard-reachable control in the normal Tab order, operable with Enter and Space. Its accessible name states the action it will perform ('Show password' / 'Hide password') and updates when the state changes. The copy is localized in every supported locale. The button is disabled whenever its field is disabled. Only one reveal control appears per field: a browser's own built-in reveal button (e.g. Microsoft Edge) must not appear alongside ours. Out of scope: caps-lock warnings, password strength meters, removing the confirmation field, and any non-password input."

## Overview

Every password the product asks for is typed blind. A user who mistypes one finds out only when sign-in
fails, or when the confirmation does not match — and the long passwords the product requires (feature
003, FR-040) make a typo more likely and harder to spot.

This feature puts an eye button inside each password field. Pressing it shows what was typed; pressing it
again hides it. The password starts hidden every time, each field is revealed on its own, and a form hides
its passwords again the moment it is sent, so a password manager still recognises the field and nothing
stays on screen after a failed attempt.

## Clarifications

### Session 2026-10-26

- Q: When the form's own checks stop a submission (too short, not matching), are revealed passwords
  masked or left visible? → A: Masked — on every submit attempt, whether or not it passes the checks
  (FR-005; User Story 3, scenario 3).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Check a password before sending it (Priority: P1)

A user signing in, setting a password from an invitation, or changing their password types a password and
is unsure it is right. They press the eye at the end of the field and read what they typed; the eye turns
into a crossed-out eye. They correct a character, press it again, and the password is hidden. The
confirmation field next to it stays hidden until they press its own eye.

**Why this priority**: This is the whole feature. It removes the failed attempt or mismatch that a single
unseen typo causes.

**Independent Test**: On each of the three forms, type into every password field, press its eye, read the
value, press again; check the icon, that the value is unchanged, and that no other field changed.

**Acceptance Scenarios**:

1. **Given** any password field with text typed in, **When** the user presses its eye button, **Then** the
   field shows the text as typed and the button shows a crossed-out eye.
2. **Given** a revealed password field, **When** the user presses the button again, **Then** the text is
   masked again and the button shows an eye.
3. **Given** the new-password field and its confirmation, **When** the user reveals one of them, **Then**
   the other stays as it was.
4. **Given** a field that has shown a validation message, **When** the user reveals or hides it, **Then**
   the message, the value, and the field's validity stay exactly as they were.
5. **Given** a form whose password field was revealed, **When** the user leaves the page and opens it
   again, **Then** every password field on it is hidden.

---

### User Story 2 - Use the toggle without a mouse (Priority: P1)

A keyboard user tabs from the password field to its eye button, presses Enter or Space to reveal the
password, and tabs on to the next field. A screen-reader user hears the button as "Show password", and
after pressing it as "Hide password", in the language of the page.

**Why this priority**: A control only some users can operate is not finished; it ships with the visual
behaviour or not at all.

**Independent Test**: Operate each form by keyboard only and with a screen reader, in English and
Ukrainian.

**Acceptance Scenarios**:

1. **Given** focus on a password field, **When** the user presses Tab, **Then** focus moves to that field's
   eye button, and the next Tab moves on to the next control in the form.
2. **Given** focus on the eye button, **When** the user presses Enter or Space, **Then** the field toggles
   and the form is not submitted.
3. **Given** assistive technology, **When** it reaches the button, **Then** it is announced as a button
   named "Show password" while the field is hidden and "Hide password" while it is revealed, localized to
   the page's language.
4. **Given** the button has focus, **When** it is shown in either theme, **Then** it draws a visible focus
   indicator.

---

### User Story 3 - The password hides itself when the form is sent (Priority: P2)

A user reveals their password and presses Sign in. The field is masked again at once, before anything is
sent. The browser's password manager recognises the field and offers to save the password as it did
before this feature. If sign-in fails, the password is not left readable on screen.

**Why this priority**: The toggle works without it; this keeps the toggle from weakening password-manager
support and from leaving a password on display after a failure.

**Independent Test**: On each form, reveal every password field, submit, and observe each field at the
moment of submission and after the response.

**Acceptance Scenarios**:

1. **Given** a form with one or more revealed password fields, **When** the user submits it with its button
   or with Enter, **Then** every password field in it is masked before any request is sent.
2. **Given** a revealed password and a failed sign-in, **When** the form shows the failure, **Then** the
   password field is hidden.
3. **Given** a revealed password and a submission that the form's own checks stop (too short, not
   matching), **When** the messages appear, **Then** the fields are hidden and one press reveals each
   again.

---

### Edge Cases

- **Failed attempt clears the field**: a form that empties its password fields after a failure (feature
  003, FR-059) shows them empty and hidden.
- **Long password**: the text scrolls inside the field and never runs underneath the eye button.
- **Language switch**: switching language reopens the page, so every password field is hidden there.
- **Theme switch**: changes colours only; a revealed field stays revealed.
- **Password manager fills a revealed field**: the filled value shows as text, as anything typed would.
- **Browser with its own reveal button** (Microsoft Edge): only our button appears.
- **Disabled field**: its eye button is disabled too and cannot be focused or pressed.

## Requirements _(mandatory)_

### Functional Requirements

**Where**

- **FR-001**: Every password field in the product MUST offer the visibility toggle. Today these are: the
  password on sign-in; the current password, new password, and confirmation on change password; the new
  password and confirmation on set password from an invitation.
- **FR-002**: The toggle MUST be a button inside the field, at its end. Typed text MUST NOT run underneath
  it.

**Behaviour**

- **FR-003**: Pressing the button MUST reveal the field's value as plain text; pressing it again MUST mask
  it. Each field's toggle MUST affect only that field.
- **FR-004**: A password field MUST be hidden whenever it appears — when its page opens, and when a form
  replaces or clears it. The revealed state MUST NOT be remembered between visits.
- **FR-005**: When the user submits a form — with its submit button or with Enter — every revealed password
  field in it MUST be masked at that moment, before any request is sent, whether or not the form's own
  checks then let the submission through.
- **FR-006**: Revealing or hiding MUST NOT change the field's value, its validation state or message, or
  the purpose it declares to the browser and password managers (current password or new password).
  Password managers MUST fill and offer to save these fields as they did before this feature.
- **FR-007**: The button MUST show an eye while its field is masked and a crossed-out eye while it is
  revealed. The icon MUST be decorative and hidden from assistive technology.
- **FR-008**: Exactly one reveal control MUST appear per field: a browser's own built-in reveal button
  MUST NOT appear alongside it.

**Access**

- **FR-009**: The button MUST be reachable with Tab, directly after its field, and operable with Enter and
  Space. Pressing it by any means MUST NOT submit the form.
- **FR-010**: The button's accessible name MUST state the action it will perform — "Show password" while
  masked, "Hide password" while revealed — and MUST update when the state changes.
- **FR-011**: The button MUST be disabled whenever its field is disabled.
- **FR-012**: The button's pointer target MUST be at least 24 × 24 CSS pixels.
- **FR-013**: In both themes, the icon MUST reach at least 3:1 against the field's background, and the
  focused button MUST show a focus indicator meeting feature 005's FR-007. Brand red MUST NOT colour the
  button in any state (feature 005, FR-012).

**Localization and coverage**

- **FR-014**: The button's names MUST exist in every supported locale, under feature 001's catalog
  completeness check.
- **FR-015**: Component tests, written together with the change, MUST cover revealing and hiding, the
  independence of two fields, the accessible name in each state, a disabled field, and masking on submit.
  End-to-end coverage MUST show that a user who reveals their password on sign-in still signs in.

### Relation to Earlier Features

- **Unchanged and restated**: feature 003's FR-040 (password rules), FR-058 (validation on each form), and
  FR-059 (password fields are not kept after a failure); feature 005's FR-007 (focus indicators) and FR-012
  (brand red only in brand marks); feature 001's catalog completeness check.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 6 password fields across the 3 forms offer the toggle; zero password fields without it.
- **SC-002**: A user can read a password they typed with one press, by mouse, touch, or keyboard.
- **SC-003**: Zero password fields are revealed at the moment any form sends its request.
- **SC-004**: Exactly one reveal control per password field in current Chrome, Edge, Firefox, and Safari.
- **SC-005**: Every string this feature adds is present in English and Ukrainian — zero gaps.
- **SC-006**: The existing sign-in, set-password, and change-password end-to-end checks pass; the only
  change to them is that the sign-in helper matches its field labels exactly, since the button's name
  also contains "password".

## Assumptions

- **Focus stays on the button** after it is pressed, as with any button; the user tabs or clicks back into
  the field.
- **No tooltip**: the eye is a widely recognised symbol and the accessible name carries the meaning.
- **"End of the field"** is the right-hand side; both supported languages read left to right.
- **24 × 24 CSS pixels** is WCAG 2.2's minimum target size (2.5.8, level AA); the 3:1 icon contrast is
  WCAG's non-text contrast (1.4.11).
- **Revealing is the user's own choice.** The product does not guard against someone reading over their
  shoulder beyond starting every field hidden.

## Out of Scope

- Caps-lock warnings.
- Password strength meters.
- Removing the confirmation field.
- Any non-password input.
- Remembering the user's choice, a single toggle for several fields, or press-and-hold reveal.

## Open for Planning

All settled in the plan; see [research.md](./research.md).

- **Composition** — shadcn/ui's input group with its in-field button, pulled through the CLI; the
  registry's new `cn` package import is replaced by the project's own helper, so no dependency is added
  (R1, R2).
- **Icons** — lucide's eye and crossed-out eye, already installed and decorative by default (R4).
- **One component** — a shared password field in the form kit, replacing the four plain password inputs
  (R9).
- **Masking on submit** — the field masks itself on its form's submit event, before any form handler
  runs, so no form changes for FR-005 (R3).
- **Edge's built-in reveal button** — hidden with a style rule rather than by any script (R5).
