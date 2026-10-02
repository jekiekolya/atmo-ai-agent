# Data Model: Dates and Times in the Reader's Time Zone

No persisted data changes: no Prisma model, column, or migration (FR-018). Every instant is already
`@db.Timestamptz(3)` and is written from the application's clock. It travels to the browser either as
a `Date` in the React Server Components payload (users table) or as an ISO-8601 string with `Z` in
JSON (the invite response). Both are UTC instants.

## Displayed instant

What the product shows. Today there are four, and each maps to one format (FR-011, FR-014):

| display                      | source                                                | arrives as | format     |
| ---------------------------- | ----------------------------------------------------- | ---------- | ---------- |
| users table — created        | `User.createdAt`                                      | `Date`     | `date`     |
| users table — pending until  | `Invite.expiresAt` (unconsumed, unrevoked)            | `Date`     | `dateTime` |
| invite link dialog — expires | `expiresAt` in the create / re-issue response         | ISO string | `dateTime` |
| demo case page — opened      | `SAMPLE.openedAt` (fixed, now `2026-03-14T23:30:00Z`) | `Date`     | `date`     |

## Reader's zone (transient)

Lives only in the browser tab. It is never stored, sent to the server, or written to a cookie (FR-001).

| state       | when                                                                                            | display                                                      |
| ----------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **unknown** | server render; the hydration render; JavaScript not running; the browser reports no usable zone | UTC, labelled (FR-004, FR-008)                               |
| **known**   | after hydration, or on any client-only mount, when the browser reports a usable zone (R6)       | that zone, no label (FR-007); `UTC` itself is known (FR-009) |

There is one transition, **unknown → known**, once per page load, right after hydration. There is no
transition back, and a zone change mid-page is not observed until the next load.
