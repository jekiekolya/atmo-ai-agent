# Quickstart & Validation: Theme Switching

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-12

How to run this feature and prove it works. Contracts referenced here are defined in
[contracts/theme-contract.md](./contracts/theme-contract.md); the derivation rules are in
[data-model.md](./data-model.md).

## Prerequisites

```bash
npm install            # after next-themes is added to package.json
cp .env.example .env   # if you do not already have one — unchanged by this feature
```

## Run it

```bash
npm run dev            # http://localhost:3000/en
```

The control is in the header on every page, next to the language switcher.

> **Setting your OS colour scheme while developing**: macOS — System Settings → Appearance.
> To test without changing your system, use Chrome DevTools → ⋮ → More tools → Rendering →
> _Emulate CSS media feature prefers-color-scheme_.

## Automated validation

```bash
npm run typecheck      # fails on a missing or misspelled message key
npm run lint
npm run test:run       # includes theme-toggle.test.tsx and the catalog completeness test
npm run e2e            # builds and serves, then runs e2e/theme-switching.spec.ts
```

Faster e2e loop against a dev server you already have open:

```bash
E2E_PORT=3000 npm run e2e:ui
```

### What the automated suites cover

| Scenario                                                          | Where                            | Requirement    |
| ----------------------------------------------------------------- | -------------------------------- | -------------- |
| Both icons render; accessible name identical in either appearance | `theme-toggle.test.tsx`          | FR-011, FR-012 |
| Activation requests the opposite of the resolved appearance       | `theme-toggle.test.tsx`          | FR-008         |
| OS prefers dark, nothing stored → served dark; light → light      | e2e                              | FR-003, FR-004 |
| Clicking flips the appearance                                     | e2e                              | FR-008         |
| The choice survives a reload and a navigation to another route    | e2e                              | FR-015         |
| A stored choice beats a conflicting OS setting                    | e2e                              | FR-006         |
| A live OS change is followed while the page is open               | e2e                              | FR-005         |
| Two tabs converge on one preference                               | e2e                              | FR-017         |
| Blocked storage leaves the page rendering and usable              | e2e                              | FR-018         |
| An unrecognised stored value stays recoverable in one press       | e2e                              | FR-019         |
| Switching language leaves the appearance alone, and the reverse   | e2e                              | FR-026, FR-027 |
| The control is reachable and operable by keyboard                 | e2e                              | FR-010         |
| The new message key exists in every locale                        | `catalogs.test.ts` + `typecheck` | FR-024         |

## Manual review gate

**Two requirements have no automated guard, by decision.** They are checked by a person before
merge. This is the list; it is short on purpose.

### 1. No flash of the wrong appearance (FR-020, FR-012, FR-013)

An automated paint-timing assertion is out of scope — see the second Clarification in the spec.
Against a **production build** (`npm run build && npm run start`, not the dev server):

- [x] OS set to dark, no stored preference, hard-load a route — no light frame, at normal speed and
  ```
  with DevTools network throttling set to Slow 3G.
  ```
- [x] Same with a stored preference that disagrees with the OS.
- [x] Reload repeatedly — the control's icon is correct in the first frame every time, never a blank
  ```
  box that fills in, never a sun that becomes a moon.
  ```
- [x] Nothing in the header moves as the page settles.

### 2. No route lost static prerendering (FR-023)

- [x] `npm run build` — every `/[locale]` route is still listed as prerendered static content, the
  ```
  same as before this feature. Compare against the build output on `main` if unsure.
  ```
- [x] `src/proxy.ts` and `src/config/` show no diff. `.env.example` shows no diff (FR-025).

### 3. Spot checks worth thirty seconds

- [x] Native scrollbars and form controls match the appearance, rather than staying light in dark
  ```
  mode (FR-021).
  ```
- [x] `git diff src/app/globals.css` is empty — no colour token added or changed (FR-022).

## Troubleshooting

| Symptom                                                         | Likely cause                                                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Flash of light before dark on load                              | The provider is not the outermost element inside `<body>`, so painted nodes precede its inline script. See [research.md](./research.md#decision-2-where-the-provider-is-mounted).    |
| Hydration warning naming `<html>`                               | `suppressHydrationWarning` missing from the `<html>` element.                                                                                                                        |
| The icon swaps shortly after load                               | Something in the component branches on a theme value during render. It must not — see the component contract.                                                                        |
| Theme resets on every dev save, but production is fine          | The Strict Mode remount discussed in Next's flash guide. `next-themes` re-applies in an effect; if you see this, check the provider is actually mounted rather than short-circuited. |
| Component test fails with `window.matchMedia is not a function` | The test is rendering a real `ThemeProvider`. Mock `useTheme` instead — [research.md](./research.md#decision-6-test-approach).                                                       |
| e2e cross-tab test is flaky                                     | Assert with `expect.poll` rather than a single read; the `storage` event is asynchronous across pages.                                                                               |
