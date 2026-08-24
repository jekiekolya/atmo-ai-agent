# Phase 1 Data Model: i18n Foundation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

No database is involved. The "data" in this feature is a fixed constant in code, two committed JSON
catalogs, and one cookie in the visitor's browser. Each entity from the spec is mapped to its
concrete shape below.

## 1. Supported Locale

**Spec entity**: Supported Language · **Lives in**: `src/i18n/locales.ts` · **Requirements**: FR-001, FR-002, FR-003

A compile-time constant, not configuration. The tuple is declared `as const` so its members become a
union type used everywhere a locale is accepted.

| Field   | Type           | Notes                                                                                                                                                                                                 |
| ------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`  | `'en' \| 'uk'` | Derived from the `SUPPORTED_LOCALES` tuple, not written out by hand                                                                                                                                   |
| `label` | `string`       | The locale's own name in its own language — "English", "Українська" (FR-012). Not a translated string: it is identical in every catalog by definition, so it belongs here rather than in the catalogs |

**Shape**:

```ts
export const SUPPORTED_LOCALES = ["en", "uk"] as const;
export const DEFAULT_LOCALE = "en" satisfies Locale;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, string>;
```

**Rules**:

- `DEFAULT_LOCALE` must be a member of `SUPPORTED_LOCALES` — enforced by `satisfies Locale`, so a
  typo fails `npm run typecheck` rather than at runtime.
- `LOCALE_LABELS` is a total `Record<Locale, string>`, so adding a locale without its label is a type
  error.
- Adding a locale here without committing its catalog must fail the build (FR-003). This is what the
  catalog parity test enforces — see §2.
- No value in this file may be read from the environment (FR-002, FR-004).

**Validation to test first**: default is a member of the set; labels are total; the set has no
duplicates.

## 2. Message Catalog

**Spec entity**: Message Catalog · **Lives in**: `src/messages/{en,uk}.json` · **Requirements**: FR-003, FR-018, FR-019, FR-020, FR-021

One JSON file per locale, committed. Nested objects form namespaces; leaves are ICU message strings.

```json
{
  "common": { "appName": "Atmo" },
  "home": { "title": "…", "intro": "…" },
  "switcher": { "label": "Language" },
  "demo": {
    "updatedAt": "Updated {date}",
    "readingCount": "{count, plural, …}"
  }
}
```

**Rules**:

- `en.json` defines the authoritative key set (FR-019). Its type is the source for `AppConfig["Messages"]`.
- Every other catalog holds exactly the same key paths — no extras, no gaps (FR-019).
- A key whose value is an empty string counts as a gap, not a deliberate blank (spec Edge Cases).
- Placeholders and plural categories live inside the message (FR-024). Ukrainian needs `one`/`few`/
  `many`/`other`; English needs `one`/`other`. Plural _categories_ may therefore legitimately differ
  between catalogs — the parity test compares **key paths**, not the internals of an ICU string, or
  it would produce false failures on every plural message.

**Two independent gates** (deliberately not redundant — see research R6):

| Gate                            | Catches                                                                                             | Command             |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- |
| Types (`AppConfig["Messages"]`) | A reference to a key that English does not define, including misspellings                           | `npm run typecheck` |
| Vitest parity test              | A key present in English and missing or empty in any other locale, listing **every** gap in one run | `npm run test:run`  |

## 3. Message Key

**Spec entity**: Message Key · **Requirements**: FR-018, FR-024

A dot path into a catalog (`home.title`), resolved through next-intl's `t()`. Not a stored record —
it exists as a type derived from the English catalog and as a string in the JSON files.

**Rules**:

- Namespaced by product area, mirroring the route or component that uses it.
- Never assembled at runtime from fragments (`t('errors.' + code)` defeats the type gate and hides
  gaps from both checks). Keys are literals.
- Interpolation and pluralization are expressed in the message, never by concatenating translated
  pieces (FR-024).

## 4. Language Preference

**Spec entity**: Language Preference · **Lives in**: the visitor's browser · **Requirements**: FR-014, FR-015, FR-030

| Attribute  | Value                 | Why                                                                                                                                                                                                                                                |
| ---------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name       | `NEXT_LOCALE`         | MC-002; also next-intl's default                                                                                                                                                                                                                   |
| Value      | a `Locale` code       | Any other value is ignored and resolution continues (FR-008)                                                                                                                                                                                       |
| `maxAge`   | 31 536 000 (one year) | Spec assumption: long-lived                                                                                                                                                                                                                        |
| `path`     | `/`                   | FR-014: scoped to the whole site                                                                                                                                                                                                                   |
| `sameSite` | `lax`                 | Survives following an external link to the site; the value is not sensitive                                                                                                                                                                        |
| `secure`   | `true`                | Static, not env-derived. This config reaches the client bundle through the switcher, so importing Config would ship its `process.env` read to the browser (research R10). `http://localhost` is a trustworthy origin, so development is unaffected |
| `httpOnly` | **no**                | The explicit switch writes it from the browser via `document.cookie`; making it httpOnly would break FR-030's write path                                                                                                                           |

**Lifecycle** — the whole of FR-030 in three lines:

| Event                                                                   | Effect on the cookie                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Visitor chooses a locale in the switcher                                | **Written** (client-side, by next-intl's navigation helper)    |
| Any page is served — direct address, shared link, or automatic redirect | **Untouched** (the proxy strips next-intl's server-side write) |
| Value is not a supported locale                                         | Ignored for resolution; not rewritten or cleared               |

**Read path**: priority 2 in resolution, below the URL segment and above `Accept-Language` (FR-006).

## Relationships

```text
SUPPORTED_LOCALES ──1:1──> Message Catalog        (a locale cannot exist without one — FR-003)
Message Catalog   ──1:N──> Message Key            (identical key sets across catalogs — FR-019)
en.json           ──type─> AppConfig["Messages"]  (authoritative key set — MC-004)
Language Preference ─ref─> SUPPORTED_LOCALES      (unrecognized values ignored — FR-008)
```

## State transitions

Only one thing in this feature has state: which locale a request resolves to.

```text
request
  ├── URL has a supported locale segment ──────────────> serve it        (cookie untouched)
  ├── no segment, valid NEXT_LOCALE cookie ────────────> 307 to /{cookie}{path}
  ├── no segment, no/invalid cookie, Accept-Language ──> 307 to /{negotiated}{path}
  └── no segment, nothing usable ──────────────────────> 307 to /{default}{path}

every 307 above: Cache-Control: no-store  (FR-031)
every branch above: no Set-Cookie         (FR-030)
```
