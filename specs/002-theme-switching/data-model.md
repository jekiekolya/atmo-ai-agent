# Phase 1 Data Model: Theme Switching

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-12

No database, no schema, no migration. The feature's entire state is one string in one browser's
`localStorage` plus one value derived from it at read time. This document exists to pin down that
derivation, because every requirement in the spec is a statement about it.

## Entities

### Appearance preference (stored)

What the visitor has chosen. The only thing persisted.

| Property            | Value                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Storage             | `window.localStorage`, one key                                                            |
| Key                 | `THEME_STORAGE_KEY` from `src/lib/theme.ts`                                               |
| Type                | `"light"                                                                                  | "dark" | "system"` |
| Default when absent | `"system"` (FR-003)                                                                       |
| Written             | Only by an explicit activation of the control (FR-008)                                    |
| Never               | A cookie, a URL segment or parameter, a request header, or any server-held value (FR-016) |
| Scope               | One browser profile on one device. Not synced, not shared, not per-account (out of scope) |

### Resolved appearance (derived, never stored)

What is actually painted. Recomputed whenever the preference or the OS setting changes.

| Property      | Value                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Type          | `"light"                                                                                                                       | "dark"` — exactly two, always one of them (FR-001) |
| Derivation    | `preference === "system" ? osColourScheme() : preference`                                                                      |
| Expressed as  | The `dark` class on `<html>` (present ⇔ dark), and `documentElement.style.colorScheme`                                         |
| Recomputed on | First paint (inline script), preference change, OS change while `"system"` (FR-005), `storage` event from another tab (FR-017) |

## Derivation rules

Stated as a table because these seven rows _are_ the feature; each maps to requirements the tests
assert.

| Stored value                | OS prefers | Resolved                                                            | Requirement           |
| --------------------------- | ---------- | ------------------------------------------------------------------- | --------------------- |
| absent                      | dark       | **dark**                                                            | FR-003, FR-004        |
| absent                      | light      | **light**                                                           | FR-003, FR-004        |
| `"system"`                  | dark       | **dark**                                                            | FR-004                |
| `"system"`                  | light      | **light**                                                           | FR-004                |
| `"dark"`                    | light      | **dark**                                                            | FR-006 — the pin wins |
| `"light"`                   | dark       | **light**                                                           | FR-006 — the pin wins |
| unreadable (storage throws) | either     | **follows the OS**                                                  | FR-018                |
| not one of the three        | either     | applied as-is; one press of the control restores a recognised state | FR-019                |

The last two rows are distinct failures with deliberately different outcomes. Storage that throws on
access (private browsing, blocked site data) is fully handled — the product follows the OS. Storage
that returns a value outside the vocabulary is only _contained_: the mechanism applies it as a class,
so that load can look wrong, but the page works and one press of the control recovers it. Neither may
surface an error or leave the page unstyled.

## State transitions

```text
                    ┌──────────────────────────────────┐
                    │  no stored preference ("system") │  ← initial, and after
                    │  resolved = OS, follows it live  │    clearing site data
                    └───────────────┬──────────────────┘
                                    │ activate the control
                      ┌─────────────┴─────────────┐
                      │ pins the OPPOSITE of the  │
                      │ currently resolved value  │
                      ▼                           ▼
            ┌──────────────────┐        ┌──────────────────┐
            │ stored "light"   │ ◄────► │ stored "dark"    │
            │ resolved = light │ activate │ resolved = dark │
            │ ignores the OS   │        │ ignores the OS   │
            └──────────────────┘        └──────────────────┘
```

Three properties of this diagram are deliberate and are requirements, not accidents of drawing:

1. **No edge returns to "system".** The control is two-state (FR-009, and the first Clarification).
   Clearing site data is the only route back, and it is not a product affordance.
2. **The transition is computed from the _resolved_ appearance, not the stored one.** From "system"
   with an OS set to dark, activating the control stores `"light"` — the opposite of what the
   visitor is looking at, which is the only reading that makes the button do what it appears to do
   (FR-008).
3. **Every transition is idempotent across tabs.** A change in one tab reaches the others through the
   `storage` event, so the two-box state on the right is shared, not per-tab (FR-017).

## Validation rules

| Rule                                                          | Where enforced                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only the recognised values are ever written                   | `ThemePreference` in `src/lib/theme.ts` states the vocabulary and `satisfies` checks the default against it. `setTheme` accepts any string, so what the control writes is guaranteed by the call site and pinned by its component test |
| Any other value read back is contained, not corrected         | The page still renders and the control still works; the next activation writes a recognised value                                                                                                                                      |
| Reading or writing storage can never throw out of the feature | Every access is inside a `try/catch` (provided by `next-themes`; verified in [research.md](./research.md))                                                                                                                             |
| The resolved value is never `undefined` in the DOM            | The inline script always applies one of the two classes before paint                                                                                                                                                                   |

## What this feature does **not** model

Named so that `/speckit-tasks` does not invent them: no per-account preference, no per-tenant
default, no server-side record of any kind, no history of past choices, no third appearance, and no
relationship to the `NEXT_LOCALE` cookie — the two preferences are stored by different mechanisms
and never read each other (FR-026, FR-027).
