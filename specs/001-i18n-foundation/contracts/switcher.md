# Contract: Language Switcher

**Requirements**: FR-012 – FR-017, FR-029, MC-007, SC-010 · **Enforced by**: `src/components/locale-switcher/locale-switcher.tsx`

A client component rendered in `src/app/[locale]/layout.tsx`, so it appears on every page (FR-012).
Composed from the shadcn/ui `select` primitive on Base UI (MC-007).

## Presentation

| Aspect        | Contract                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Form          | one dropdown control, constant width regardless of locale count (FR-012)                         |
| Options       | every member of `SUPPORTED_LOCALES`, in declaration order                                        |
| Option label  | the locale's own name in its own language — `LOCALE_LABELS`, never a translated string           |
| Active option | marked as selected; the trigger shows the active locale                                          |
| Control label | accessible name from a catalog key (`switcher.label`) — the only translated string here (FR-018) |

## Behaviour

| Action                           | Result                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Choose the active locale         | no navigation, no cookie write                                                                                                                         |
| Choose a different locale        | navigate to the same pathname under the new locale, preserving every dynamic segment and the whole query string (FR-013); write `NEXT_LOCALE` (FR-014) |
| Choose while on a not-found page | same path under the new locale, where the localized 404 renders                                                                                        |
| Cookie cannot be stored          | the navigation still happens; nothing errors and no message is shown (FR-017)                                                                          |
| JavaScript unavailable           | the control does not open and never appears functional; every locale stays reachable by address (FR-029)                                               |

The pathname and locale come from `usePathname()` and `useLocale()`, and the navigation from
`useRouter()` — all from `src/i18n/navigation.ts` (MC-001). The switcher never builds an address by
string manipulation. A root-param getter cannot be used here: `next/root-params` does not work in
Client Components (research R7).

## Accessibility (FR-016, SC-010)

Base UI's select semantics are preserved, not re-implemented:

| Requirement     | Contract                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------- |
| Keyboard        | open, move between options, choose, and dismiss without choosing — all without a pointer |
| Focus           | returns to the trigger when the list is dismissed                                        |
| Announcement    | exposed as a list of choices with the current selection identified                       |
| Accessible name | present on the trigger, from `switcher.label`                                            |

Customization happens **in place** in `src/components/ui/select.tsx`; no wrapper layer that
re-implements or intercepts these semantics.

## Test contract

| Level                            | Covers                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component (jsdom, test-together) | renders every locale, marks the active one, labels are endonyms, choosing a locale calls the router with the expected target, accessible name present |
| e2e (Playwright, MC-006)         | the visitor-facing flow in [quickstart.md](../quickstart.md) — copy changes, path and query survive, choice survives reload and a root visit          |
