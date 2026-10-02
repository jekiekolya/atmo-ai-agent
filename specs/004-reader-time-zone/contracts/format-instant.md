# Contract: `useFormatInstant` and the rule that enforces it

This feature exposes no HTTP or user-facing interface of its own. It has two internal contracts that
later features build on: the hook every on-screen date goes through, and the check that keeps it that
way.

## 1. `useFormatInstant` — `src/i18n/use-format-instant.ts`

```ts
type InstantFormat = "date" | "dateTime";

function useFormatInstant(): (value: Date, format: InstantFormat) => string;
```

A client hook (`"use client"`). Call it once per component and use the returned function for every
value in that component.

**Input**

| param    | meaning                                                                                  |
| -------- | ---------------------------------------------------------------------------------------- |
| `value`  | The instant. A JSON string from the API is converted with `new Date(...)` by the caller. |
| `format` | `date`: day, short month, year. `dateTime`: `date` plus two-digit hour and minute (R5).  |

**Output** — a string in the active next-intl locale, ready to pass as a message argument.

| reader's zone                                           | output                                    | example (en)                 |
| ------------------------------------------------------- | ----------------------------------------- | ---------------------------- |
| unknown: server render, hydration render, unusable zone | the UTC rendering, **labelled**           | `Mar 14, 2026, 09:30 AM UTC` |
| known, including `UTC` itself                           | the reader's-zone rendering, **no label** | `Mar 14, 2026, 11:30 AM`     |

Both formats follow this table. A `date` in the fallback reads `Mar 14, 2026, UTC` (Clarification
Q1).

**Guarantees**

- **No hydration mismatch.** The first client render of a hydrating tree reproduces the server
  output; the local value replaces it after hydration (R2, FR-006).
- **No UTC interim after hydration.** A component that mounts later — a dialog, a client-side
  navigation — renders the local value directly (FR-003).
- **One zone per page.** Every call on a page uses the same cached zone (FR-017).
- **Never empty.** The output is always a complete string. The hook has no loading state (FR-005).

**Non-goals** — no relative time, no ranges, no custom options, no zone parameter. Each is a spec
change. A new shape of absolute date is added here as a named format, never as options at a call site.

## 2. The check — `eslint.config.mjs`

Applies to `src/**/*.{ts,tsx}`, except:

- `src/server/**` — browser-less output, decided by its own feature (Clarification Q2);
- `src/config/**`;
- `**/*.test.{ts,tsx}`;
- `src/i18n/use-format-instant.ts`.

| reported                                                                  | why                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| a call to a member named `dateTime`, `dateTimeRange`, or `relativeTime`   | next-intl's `useFormatter()` / `getFormatter()` formatters |
| a call to `toLocaleDateString`, `toLocaleTimeString`, or `toLocaleString` | the platform's own date formatting                         |
| `new Intl.DateTimeFormat(…)`, `new Intl.RelativeTimeFormat(…)`            | the platform's own date formatting                         |

The message reads: `Format dates and times with useFormatInstant from @/i18n/use-format-instant (spec
004, FR-015).`

The block repeats Principle V's `process.env` selector from a shared constant, because flat config
replaces `no-restricted-syntax` instead of merging it (R7).

**Catalogs**: no message in any locale may contain an ICU `date` or `time` argument. This is enforced
in `src/i18n/catalogs.test.ts`.

**Escape**: an `eslint-disable-next-line no-restricted-syntax` with an inline reason (CLAUDE.md). A
suppression is a signal that the hook is missing a format, or that the code is not screen code.
