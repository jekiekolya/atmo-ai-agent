# Contract: Screens, Forms, and Feedback

**Feature**: [spec.md](../spec.md) — FR-058 – FR-072 | **Research**: R14 – R16

## Primitives (all under `src/components/ui`, via the shadcn CLI, style `base-nova`)

| Primitive       | Status                                                                                  | Used for                                  |
| --------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| `button`        | exists, unchanged                                                                       | every action                              |
| `field`         | **new, customized in place** to wrap Base UI `Field.Root/Label/Description/Error` (R14) | every form field                          |
| `input`         | new (Base UI `Input`)                                                                   | text, email, and password inputs          |
| `label`         | new (a `field` dependency)                                                              | —                                         |
| `alert`         | new (`role="alert"`)                                                                    | form-level errors (FR-068)                |
| `card`          | new                                                                                     | the sign-in and invite panels             |
| `table`         | new                                                                                     | the user list                             |
| `badge`         | new                                                                                     | status: invited, active, deactivated      |
| `dialog`        | new                                                                                     | the create-user form; the link shown once |
| `alert-dialog`  | new                                                                                     | confirming deactivation and revocation    |
| `dropdown-menu` | new                                                                                     | per-row actions                           |
| `separator`     | new (a `field` dependency)                                                              | —                                         |
| `toast`         | new (Base UI Toast, R15)                                                                | brief notifications (FR-069, FR-070)      |

After each `shadcn add`: decline the `button.tsx` overwrite, point `cn` imports to `@/lib/utils`,
remove the `cn` package if it was added, and run Prettier (R16). Every hardcoded English string inside a
primitive ("Close", "Notifications", "Close toast") takes a translated prop instead.

## The four forms

Each one is a client component in its own folder, composed from Base UI `Form` and the `field`
primitive, and owns exactly one schema from `src/lib/schemas/` shared with its endpoint. There is no
shared form component (MC-010).

| Form            | Folder                                 | Fields (`name`)                                                            | Submits to                  | On success                                                          |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| Sign-in         | `src/components/sign-in-form/`         | `email`, `password`                                                        | next-auth client `signIn`   | `location.assign(callbackUrl)`                                      |
| Set password    | `src/components/set-password-form/`    | `password`, `confirmPassword` (+ hidden token)                             | `POST /api/invites/accept`  | `location.assign(/{l}/sign-in?notice=password-set)`                 |
| Create user     | `src/components/create-user-form/`     | `email`, `firstName`, `lastName`, `role` (select: admin only, preselected) | `POST /api/users`           | close the form; open the link-shown-once dialog; `router.refresh()` |
| Change password | `src/components/change-password-form/` | `currentPassword`, `newPassword`, `confirmPassword`                        | `PUT /api/account/password` | `location.assign(/{l}/sign-in?notice=password-changed)`             |

The same flow applies to every form:

1. `Field.Root validate` runs the field's zod rule, and the key it returns is translated.
2. The submit button disables and shows a pending label while the request is in flight. A second
   submission is impossible (FR-059).
3. The request goes through `apiRequest` ([http-api.md](./http-api.md#shared-plumbing-r22)). On
   `400`, `toFormErrors(fields, t)` feeds Base UI's `errors`, which focuses the first invalid control.
4. Any other error with a form meaning renders in the `alert` inside the form, stays until the next
   submission, and is announced (FR-068).
5. On a network failure or `5xx`, a toast shows the generic message. Inputs are kept, except password
   fields, which are cleared (FR-070).
6. On `401`, the browser does a full navigation to sign-in with the current address as `callbackUrl`
   (FR-071).

The sign-in form shows one message for every failure: `auth.signIn.failed`. It never distinguishes
causes, never mentions a lock, and never shows password rules (FR-015).

## Where each message appears

| Event                                      | Where                                       | Key namespace                                             |
| ------------------------------------------ | ------------------------------------------- | --------------------------------------------------------- |
| Field rule broken (client or server)       | under the field                             | `validation.*`                                            |
| Sign-in failed (any cause)                 | form alert                                  | `auth.signIn.failed`                                      |
| Email already in use; "reactivate instead" | create-user form alert                      | `users.create.emailInUse*`                                |
| Invite expired, used, or invalid (on open) | invite page body, no form                   | `invite.expired` · `invite.used` · `invite.invalid`       |
| Invite became unusable before submit       | set-password form alert, same three keys    | `invite.*`                                                |
| Wrong current password                     | under `currentPassword`                     | `account.currentPasswordWrong`                            |
| Account locked while changing password     | change-password form alert                  | `account.locked`                                          |
| Not permitted                              | form alert (API) or the `NotPermitted` page | `errors.notPermitted`                                     |
| Deactivated, reactivated, invite revoked   | toast                                       | `users.notify.*`                                          |
| Password set, password changed             | notice on the sign-in page                  | `auth.notice.passwordSet` · `auth.notice.passwordChanged` |
| No connection or server error              | toast                                       | `errors.unexpected`                                       |

## Link shown once (FR-042)

A `dialog` holds a read-only `input` with the full URL, a copy button, and the notice
`users.invite.shownOnce`. The copy button confirms with a toast: `users.invite.copied`. The URL lives
only in that dialog's component state. When the dialog closes, the state is discarded, and nothing
caches or refetches it.

## User list (FR-047)

The full name is always rendered through the catalog message `common.fullName`
(`"{firstName} {lastName}"` in both locales today), so a language can reorder the parts without a
code change (FR-074). Columns: full name, email, role, status badge, created date, and pending-invite expiry. Dates and
times go through next-intl's `format.dateTime`, which uses 001's fixed UTC time zone, with the zone
shown next to times of day. Rows are newest first.

The row actions menu offers only valid actions:

- **Deactivate** or **Reactivate**.
- **Issue new link**: shown for active or invited admins, never for the super admin or a deactivated
  account.
- **Revoke link**: shown only when an invite is pending.

The super admin's own row offers no actions. Destructive actions ask for confirmation in an
`alert-dialog`.

## Protected shell (this feature only)

The `(private)` layout adds a minimal bar: the signed-in full name, a sign-out button, and links to
Home, Account, and — for the super admin only — Users. The existing header with the language switcher
and theme toggle stays. A sidebar and a navigation configuration are **not** part of this feature;
they belong to a later spec.

## Accessibility checks (test-together)

- Every field has a visible label. Errors are linked through `aria-describedby`, which Base UI does.
- Form alerts use `role="alert"`, and toasts go to the polite live region without taking focus.
- Dialogs trap focus and return it to the trigger on close.
- All flows can be completed with the keyboard alone. The sign-in e2e drives the form with the keyboard.
