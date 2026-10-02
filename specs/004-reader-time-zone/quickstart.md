# Quickstart: validating Dates and Times in the Reader's Time Zone

## Automated

```bash
npm run lint       # the date-formatting rule over the whole tree (FR-016)
npm run test:run   # hook states, lint-rule proof, catalog check, component wiring (FR-021)
npm run e2e        # time-zone.spec.ts under Europe/Kyiv and America/New_York (FR-020)
```

To run only this feature's e2e spec against a server that is already running (see CLAUDE.md for its
requirements):

```bash
E2E_PORT=3100 npx playwright test e2e/time-zone.spec.ts
```

## By hand

Prerequisites: `npm run services:up`, `npm run bootstrap`, `npm run dev`, then sign in as the super
admin. Use Chrome DevTools: **Sensors → Location → Timezone ID** to set the zone, and **Command menu →
Disable JavaScript** to turn scripts off.

| #   | Do                                                              | Expect                                                                             | Spec           |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------- |
| 1   | Set the zone to `Europe/Kyiv`, open `/en/dashboard/users`       | Created dates and "Pending until …" show Kyiv time, with no zone label             | US1, SC-001    |
| 2   | Create a user                                                   | The dialog's expiry is in Kyiv time, unlabelled, from the moment the dialog opens  | FR-003         |
| 3   | Set the zone to `America/New_York`, reload                      | The same rows show different wall-clock times, each correct for New York           | SC-002         |
| 4   | Disable JavaScript, reload                                      | Every date and time is in UTC and ends in `UTC`, date-only values included         | US2, SC-003    |
| 5   | Enable JavaScript, use **Network → Slow 4G**, reload            | Labelled UTC first, then the local value in place — never an empty cell            | FR-005, SC-004 |
| 6   | Open `/uk/dashboard/users` with the zone set to `Europe/Berlin` | Ukrainian formatting, Berlin time                                                  | FR-002, SC-006 |
| 7   | Set the zone to `UTC`, reload                                   | UTC times without a label                                                          | FR-009         |
| 8   | Open `/en/demo/1` with the zone set to `Europe/Kyiv`            | "Opened Mar 15, 2026", unlabelled. With JavaScript off: "Opened Mar 14, 2026, UTC" | FR-011         |
| 9   | Watch the console through 1–8                                   | No hydration error or warning                                                      | FR-006, SC-005 |

## Proving the check

Add `format.dateTime(new Date(), { dateStyle: "short" })` to any component and run `npm run lint`. It
fails, naming the line and pointing at `useFormatInstant`. Remove the line again.
