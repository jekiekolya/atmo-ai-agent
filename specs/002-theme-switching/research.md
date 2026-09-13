# Phase 0 Research: Theme Switching

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-12

The spec arrived with the mechanism already chosen, so this phase did not re-open that choice. It
did two things instead: gathered the evidence the constitution's dependency rule requires, and
resolved the six unknowns that would otherwise have been discovered during implementation.

Everything below was verified against the installed Next.js 16.3.0 documentation in
`node_modules/next/dist/docs/` and against the published source of `next-themes@0.4.6`
(`dist/index.mjs`), not from recollection.

---

## Decision 1: `next-themes@^0.4.6` as the mechanism

**Decision**: Add it as a runtime dependency.

**Rationale** — measured, not estimated:

| Property                | Verified value                                  | How                                            |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------- |
| Unpacked size           | 33,783 bytes                                    | `npm view next-themes dist.unpackedSize`       |
| Runtime dependencies    | **none**                                        | `npm view next-themes dependencies` → no field |
| React peer range        | `^16.8 \|\| ^17 \|\| ^18 \|\| ^19`              | `npm view next-themes peerDependencies`        |
| TypeScript declarations | bundled (`dist/index.d.ts`, `dist/index.d.mts`) | package contents                               |
| Public surface          | `ThemeProvider`, `useTheme`, and three types    | `dist/index.d.ts`                              |
| Minified runtime        | ~3.4 KB of JS                                   | `dist/index.mjs` byte length                   |

Next.js 16 ships its own guide for this exact problem — `01-app/02-guides/preventing-flash-before-hydration.md`
— and it explicitly documents the theme case, the `localStorage` `try/catch`, and the cookie
variant. It stops there. Read against this spec's requirements, the guide leaves five behaviours to
the implementer, each of which `next-themes` provides and each of which was confirmed present in
its source:

| Requirement                  | What the guide gives you                                                                                                  | What `next-themes@0.4.6` actually does                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| FR-020 pre-paint application | The technique itself                                                                                                      | Renders `<script suppressHydrationWarning dangerouslySetInnerHTML>` immediately before its children                              |
| FR-018 blocked storage       | `try/catch` shown in the read snippet only                                                                                | `try/catch` on the inline-script read, on the lazy `useState` initializer, **and** on the write in `setTheme`                    |
| FR-005 live OS following     | Not covered                                                                                                               | `useEffect` attaching a `(prefers-color-scheme: dark)` listener, re-resolving while the preference is `system`                   |
| FR-017 cross-tab convergence | Not covered                                                                                                               | `useEffect` attaching a `window` `storage` listener keyed on the storage key                                                     |
| FR-021 `color-scheme`        | Not covered                                                                                                               | Sets `documentElement.style.colorScheme` in both the inline script and the effect, gated on `enableColorScheme` (default `true`) |
| Strict Mode dev remount      | Named as a problem, then handed back: _"One way to fix this is to do what you would do without the inline script at all"_ | The `useEffect` that applies the attribute re-runs on the remount, restoring the class React cleared                             |

That last row is the decisive one. The guide's own remedy for the dev remount is to re-implement
the client-side application path by hand in a `useLayoutEffect` — which is most of what the library
is. Building all six behaviours ourselves is more code, and more importantly more _test surface_,
than 34 KB of a library whose exit path is one provider and one hook.

**Alternatives considered**:

- **Hand-rolled inline script per the Next guide.** Rejected on the cost comparison above. It is the
  right choice for a product that only needs "read a key, set an attribute" — this spec needs five
  things more than that, and each is a silent-failure mode.
- **A cookie read via `cookies()` in the layout.** Rejected, and the Next guide rejects it in the
  same terms the spec does: _"reading it in the root layout opts the entire app out of static
  prerendering"_. It would also put the preference on every request, which FR-016 forbids outright.
- **CSS-only via `prefers-color-scheme` with no control.** Rejected — it cannot satisfy FR-006 (an
  explicit choice overriding the OS) at all.

---

## Decision 2: Where the provider is mounted

**Decision**: `<ThemeProvider>` is the outermost element inside `<body>` in
`src/app/[locale]/layout.tsx`, wrapping `NextIntlClientProvider`, the header, and `main`.

**Rationale**: `next-themes@0.4.6` exports **only** `ThemeProvider` and `useTheme`. There is no
separate script export, so the inline script cannot be hoisted into `<head>` the way the Next guide's
hand-rolled example does. The provider renders its `<script>` and then its children, in that order,
so whatever the provider wraps is parsed _after_ the script has already set the class on `<html>`.
Making it the first thing inside `<body>` means nothing paintable precedes it.

This is a real constraint, not a stylistic preference: mounting the provider deeper (inside the
header, or around only part of the tree) leaves earlier nodes to paint before the script runs, and
FR-020 fails in exactly the way the spec's Overview describes.

**Alternatives considered**: mounting in a root `app/layout.tsx` — impossible and undesirable here,
since the project deliberately has no root layout so that `<html lang>` is rendered by a layout that
knows the locale. Mounting around `{children}` only — rejected, it would leave the header painting
in the wrong appearance.

---

## Decision 3: How the control avoids a hydration mismatch

**Decision**: The component renders both icons unconditionally with a static, theme-independent
`aria-label`, and reads `resolvedTheme` **only inside the click handler** — never during render.

**Rationale**: This was the single most important thing to get right, and the source makes the trap
explicit. `next-themes` initializes its state with a lazy initializer that returns `undefined` when
`typeof window === "undefined"`. So during server rendering `theme` and `resolvedTheme` are both
`undefined`; on the client's first render they are `"light"` or `"dark"`. Any JSX that branches on
either value produces different server and client output — which is a hydration mismatch, and on
recovery, a visible flash of the wrong icon.

Rendering both icons and letting the `dark:` variant choose sidesteps it entirely: the markup is
identical on both sides, and the CSS has already been made correct by the inline script before
anything paints. The click handler runs long after mount, where `resolvedTheme` is reliable.

This is also why FR-011 insists the accessible name not depend on the theme — a name like
"Switch to dark" would have to branch during render and would reintroduce the same mismatch.

**Alternatives considered**: the common `mounted` boolean (`useEffect(() => setMounted(true), [])`,
render a placeholder until then). Rejected — it is the "not yet mounted placeholder" FR-012 names
directly, it guarantees a post-hydration icon swap, and it reserves the wrong box in the meantime.

---

## Decision 4: Provider configuration

**Decision**:

| Prop                        | Value                       | Why                                                                                                                                                                                    |
| --------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attribute`                 | `"class"`                   | The library defaults to `data-theme`. The project's `@custom-variant dark (&:is(.dark *))` and its `.dark { … }` token block are keyed on a class, and FR-022 forbids touching either. |
| `defaultTheme`              | `"system"`                  | FR-003. Also the library default when `enableSystem` is true, but stated explicitly so the requirement is legible in the code.                                                         |
| `enableSystem`              | `true` (default)            | FR-004, FR-005.                                                                                                                                                                        |
| `storageKey`                | from `src/lib/theme.ts`     | FR-025 — application code, not environment configuration. Stated explicitly rather than inheriting the library's generic `"theme"`.                                                    |
| `enableColorScheme`         | `true` (default)            | FR-021. Left at default; noted here so nobody "tidies" it away.                                                                                                                        |
| `disableTransitionOnChange` | `false` (default)           | Explicitly out of scope; nothing transitions colour today.                                                                                                                             |
| `themes`                    | default `["light", "dark"]` | FR-001. No third appearance.                                                                                                                                                           |

**Consequence worth knowing**: with `attribute="class"` the library removes both theme classes and
adds the resolved one, so `<html>` carries a `light` class in light mode. `globals.css` defines no
`.light` rules, so this is inert — but every assertion in the suite targets the presence or absence
of `dark` specifically, never an exact class list, so the extra class cannot make a test lie.

---

## Decision 5: `<html>` needs `suppressHydrationWarning`

**Decision**: Add it to the `<html>` element in `src/app/[locale]/layout.tsx`.

**Rationale**: The inline script mutates `class` and `style.colorScheme` on `<html>` during parsing,
before React hydrates. Per the Next guide's own explanation, without the suppression React treats the
difference as a hydration error and _recovers by client-rendering from the nearest boundary_ — which
both flashes and discards the script's work. With it, React keeps the DOM. The library already sets
`suppressHydrationWarning` on its own `<script>` element; the `<html>` element is ours and is not
covered by that.

**Scope note**: it is added to `<html>` only. It is not a general-purpose silencer and must not be
sprinkled elsewhere to quiet unrelated mismatches.

---

## Decision 6: Test approach

**Decision**: The component test mocks `next-themes`' `useTheme`. Real provider behaviour is proven
end-to-end in Playwright.

**Rationale**: jsdom does not implement `window.matchMedia`, which the provider calls on mount (and
via the deprecated `addListener`/`removeListener` pair, which a naive stub would miss). Rather than
maintain a stub faithful enough to be meaningful, the test mocks the hook — the same shape
`src/components/locale-switcher/locale-switcher.test.tsx` already uses for `next-intl` and
`@/i18n/navigation`, so the pattern is the project's own rather than a new one. The component test
then asserts what is genuinely the component's own behaviour: both icons present, the accessible
name identical under either resolved theme, and `setTheme` called with the opposite of the resolved
appearance.

Everything the mock papers over — pre-paint application, OS following, cross-tab, blocked storage —
is library behaviour, and library behaviour is only worth asserting in a real browser. That is where
the clarified e2e list puts it.

**Playwright mechanics confirmed for each e2e case**:

| Case                                        | Mechanism                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| OS prefers dark / light, nothing stored     | `test.use({ colorScheme: "dark" \| "light" })`                                          |
| Live OS change while open (FR-005)          | `page.emulateMedia({ colorScheme })` mid-test                                           |
| Stored choice beats conflicting OS (FR-006) | `context.addInitScript` seeding `localStorage` before load                              |
| Cross-tab convergence (FR-017)              | Two pages in one `BrowserContext`, asserted with `expect.poll`                          |
| Blocked storage (FR-018)                    | `context.addInitScript` redefining `window.localStorage` to throw                       |
| Survives reload and navigation (FR-015)     | `page.reload()` and a link click to another route                                       |
| Independence from language (FR-026, FR-027) | Drive the existing locale switcher, assert `html[lang]` and the `dark` class separately |

---

## Decision 7: an unrecognised stored value is contained, not corrected

**Found during implementation, not during research.** The e2e case for FR-019 failed on first run.

`next-themes` does **not** validate what it reads from storage against its `themes` vocabulary. The
inline script does `localStorage.getItem(key) || defaultTheme` and passes the result straight to
`classList.add`. A value like `"lite"` therefore lands on `<html>` as a real class, and the visitor
is served light regardless of their device setting on that load.

**First attempt, since reverted**: a small inline script rendered before `<ThemeProvider>` that
removed the key when its value fell outside the vocabulary. It worked and the test passed.

**Decision**: reverted, and FR-019 weakened to state what the product actually guarantees. The
measurement that changed the decision: the wrong appearance is **not** a stuck state. `resolvedTheme`
becomes `"lite"`, which is not `"dark"`, so the next activation of the control writes `"dark"` and
everything recovers — the exposure is one press, not a permanent condition.

Weighed against that:

- The guard is an undocumented patch over library behaviour. `next-themes` does not promise to
  ignore unknown values, and equally does not promise to keep applying them; either could change in
  a minor release, in which case the guard is silently either redundant or wrong.
- It adds the feature's only hand-rolled inline script, which a future Content-Security-Policy would
  block. The library's own script has a `nonce` prop for that; ours would need fixing by hand.
- `JSON.stringify` does not escape `</script>`, so the pattern is only safe because the constants it
  interpolates are ours and tame — safe by construction rather than by check.

**What remains**: the e2e case still exists, rewritten to assert the real guarantee — the page
renders, the control works, one press restores a recognised state and it survives a reload. If the
library ever starts validating, that test keeps passing; the requirement is about the visitor's
experience, not the mechanism.

---

## Resolved: no NEEDS CLARIFICATION remain

Every unknown that entered this phase left it with a decision. The two items the spec left
deliberately open — the control's exact position within the header, and the final wording of its
label — are cosmetic, do not affect any contract below, and are settled during implementation.
