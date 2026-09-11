# Contract: Message Catalogs and Completeness Gates

**Requirements**: FR-003, FR-018 – FR-022, FR-024, MC-004, MC-005 · **Enforced by**: `src/types/next-intl.d.ts`, `src/i18n/catalogs.test.ts`

## Format

One file per locale at `src/messages/{locale}.json`. Nested objects are namespaces; leaves are ICU
message strings. `src/messages/en.json` is authoritative for the key set.

## Rules

| #   | Rule                                                                                            | Requirement |
| --- | ----------------------------------------------------------------------------------------------- | ----------- |
| C1  | Every user-visible string resolves through `t()` — no literal in a page, component, or metadata | FR-018      |
| C2  | Every locale's catalog holds exactly the key paths of `en.json`                                 | FR-019      |
| C3  | An empty-string value is a gap, not a blank                                                     | Edge Cases  |
| C4  | Keys are literals at call sites — never built by concatenation                                  | FR-018      |
| C5  | Interpolation and plurals live inside the message                                               | FR-024      |
| C6  | No runtime fallback to another locale, the key name, or a blank                                 | FR-022      |

## Gate 1 — types (MC-004)

```ts
// src/types/next-intl.d.ts
declare module "next-intl" {
  interface AppConfig {
    Locale: import("@/i18n/locales").Locale;
    Messages: typeof import("../messages/en.json");
  }
}
```

Fails `npm run typecheck` on a reference to a key English does not define, including misspellings.

**Does not catch**: a key missing from `uk.json`. English is the only type source. That gap is Gate 2's
entire purpose — the two are complementary, not belt-and-braces.

## Gate 2 — parity test (MC-005)

`src/i18n/catalogs.test.ts`, in Vitest's node project.

| Aspect   | Contract                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Compares | the set of flattened key paths in each locale against `en.json`                                                               |
| Fails on | any key missing from a non-default locale; any key present only in a non-default locale; any empty-string value in any locale |
| Reports  | **every** gap in one failure message, each as `locale: key.path` — never just the first (FR-021)                              |
| Ignores  | the internals of ICU strings — Ukrainian's `one/few/many/other` vs English's `one/other` is correct, not a discrepancy        |
| Iterates | `SUPPORTED_LOCALES`, so a new locale is covered the moment it is added to the constant (FR-003)                               |

**Failure message shape** — the fix must need no further investigation (SC-007):

```text
Message catalogs are incomplete:
  uk: home.intro          (missing)
  uk: demo.readingCount   (missing)
  uk: switcher.label      (empty)
```

## Runtime behaviour

There is no fallback (FR-022, C6). Because both gates run before merge, a missing key cannot reach a
released build; next-intl's own error behaviour is therefore a backstop that production never
exercises, not a feature.
