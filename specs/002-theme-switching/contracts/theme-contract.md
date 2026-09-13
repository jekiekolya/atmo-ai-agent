# Phase 1 Contracts: Theme Switching

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-09-12

This feature exposes no HTTP endpoint and no public library API. Its contracts are the four surfaces
that other code and the test suite depend on: the DOM, browser storage, the component, and the
message catalog. Each is stated as the thing a test may assert against — change one of these and
tests break by design.

---

## 1. DOM contract

The observable output of the whole feature. This is what both the e2e suite and a reviewer look at.

| Surface                       | Light                                         | Dark                          |
| ----------------------------- | --------------------------------------------- | ----------------------------- |
| `<html>` class list           | contains `light`, does **not** contain `dark` | contains `dark`               |
| `<html>` `style.color-scheme` | `light`                                       | `dark`                        |
| Sun icon                      | visible                                       | hidden (`dark:hidden`)        |
| Moon icon                     | hidden                                        | visible (`hidden dark:block`) |

**Rules**:

- `dark` is the only class any assertion may depend on. A `light` class is also present in light
  mode — a side effect of `attribute="class"` with a two-theme vocabulary — and is inert, since
  `globals.css` defines no `.light` rules. Assert presence or absence of `dark`; never an exact
  class list, and never the `light` class.
- The class and `color-scheme` are set **before the first paint**, by the inline script the provider
  renders. No frame may be painted with neither or with the wrong one (FR-020).
- The `<html>` element carries `suppressHydrationWarning`. Nothing else in the tree does.
- The classes `geistSans.variable`, `geistMono.variable`, `h-full`, `antialiased` and the `lang`
  attribute stay on `<html>` untouched — the library adds and removes only theme classes.

---

## 2. Storage contract

| Property                 | Value                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Mechanism                | `window.localStorage`                                                                                                  |
| Key                      | `THEME_STORAGE_KEY`, exported from `src/lib/theme.ts`                                                                  |
| Values                   | `"light"`, `"dark"`, `"system"` — no others are ever written                                                           |
| Absent means             | Follow the OS (FR-003)                                                                                                 |
| Unrecognised value means | Applied as a class as-is; the page stays usable and one activation of the control restores a recognised value (FR-019) |
| Written when             | The control is activated, and only then (FR-008)                                                                       |
| Read when                | The inline script runs; the provider initializes; another tab writes (`storage` event)                                 |
| Failure mode             | Any read or write that throws is swallowed; the product follows the OS and the page stays usable (FR-018)              |

Tests seed and assert this key through `src/lib/theme.ts` rather than a string literal, so renaming
the key cannot leave a test passing against the wrong one.

---

## 3. Component contract

### `src/lib/theme.ts`

```ts
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY: "atmo-theme";
export const DEFAULT_THEME_PREFERENCE: "system"; // satisfies ThemePreference
```

`ThemePreference` documents the stored vocabulary and checks the default against it. It is applied
with `satisfies` rather than as an annotation, so the constant keeps its literal type instead of
widening to the union. No resolved-theme type: that value comes from `useTheme()` and our code never
names it. No `process.env`, no side effects, no branching logic (FR-025).

### `src/components/theme-toggle/theme-toggle.tsx`

```ts
export function ThemeToggle(): JSX.Element;
```

A client component. Takes no props — it reads and writes the preference through `useTheme()`.

**Guarantees it must uphold**, each directly assertable:

| Guarantee                                                                                                              | Requirement            |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Renders exactly one `button`                                                                                           | FR-007                 |
| Its accessible name comes from the message catalog and is **identical** whatever the resolved appearance               | FR-011, FR-024         |
| Both icons are present in the markup at all times; visibility is decided by CSS alone                                  | FR-012                 |
| Renders no conditional placeholder and no mounted-check branch                                                         | FR-012                 |
| Never reads `resolvedTheme` (or any theme value) during render — only inside the click handler                         | FR-011, FR-012, FR-013 |
| On activation, calls `setTheme` with the opposite of the resolved appearance: `"dark"` → `"light"`, otherwise `"dark"` | FR-008                 |
| Composed from `Button` at `variant="ghost"`, `size="icon-sm"`                                                          | FR-014                 |
| Icons are hidden from assistive technology                                                                             | FR-010                 |

**Sizing**: `size="icon-sm"` resolves to `size-7` in `src/components/ui/button.tsx`. The language
switcher's `SelectTrigger size="sm"` resolves to `data-[size=sm]:h-7`. They match at 28px, which is
what FR-014's "matches the language switcher's trigger height" means concretely. If either changes
later, they change together.

### `src/app/[locale]/layout.tsx`

Mount order inside `<body>` is part of the contract, not a preference:

```text
<html lang={locale} suppressHydrationWarning>
  <body>
    <ThemeProvider …>        ← outermost; renders the inline script before anything paints
      <NextIntlClientProvider>
        <header> <ThemeToggle/> <LocaleSwitcher/> </header>
        <main>{children}</main>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

Provider props, and why each is pinned, are tabulated in
[research.md](../research.md#decision-4-provider-configuration): `attribute="class"`,
`defaultTheme` and `storageKey` from `src/lib/theme.ts`, `enableSystem` / `enableColorScheme` left
at their `true` defaults, `disableTransitionOnChange` left at `false`.

---

## 4. Message contract

One key, one namespace, both catalogs.

```jsonc
// src/messages/en.json  and  src/messages/uk.json
"theme": {
  "label": "…"   // the control's accessible name
}
```

**Rules**:

- The string must read correctly in **both** appearances, because it is the name in both (FR-011).
  It therefore describes the control, not a destination: "Switch between light and dark" works;
  "Switch to dark mode" does not.
- The key must exist in `en` and `uk`. `src/types/next-intl.d.ts` derives the message type from the
  `en` catalog, so a typo fails `npm run typecheck`; `src/i18n/catalogs.test.ts` fails on a gap in
  any other locale (FR-024).
- Final wording is settled during implementation; the shape above is the contract.

---

## Contract-level non-goals

Stated so the boundary is unambiguous: this feature exposes no theme value to the server, adds no
route, adds no header or cookie, changes no colour token, and adds nothing to
`src/components/ui/`. Any task proposing one of those is out of contract.
