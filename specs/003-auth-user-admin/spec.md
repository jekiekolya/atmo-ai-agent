# Feature Specification: Authentication and User Administration

**Feature Branch**: `003-auth-user-admin`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Authentication and user administration foundation. Establishes who may enter the application and who may let others in. This is the first feature to add Prisma models, so it also establishes the data layer's shape. ROLES: exactly two, SUPER_ADMIN and ADMIN; no client role and no company/tenant concept — both deliberately deferred; an ADMIN's only capability is to sign in, see the protected area, and change their own password; all user administration belongs to the SUPER_ADMIN alone. SUPER_ADMIN UNIQUENESS: at most one, ever, enforced by a partial unique index, not only a service check; the SUPER_ADMIN can never be deactivated. BOOTSTRAP: one idempotent command, `npm run bootstrap`, creates the SUPER_ADMIN from environment variables when none exists, and otherwise leaves it untouched and says so — never a second one, never a silent credential rewrite; a deployment step, documented in the README, allowed to read process.env under the tooling exemption; no demo/seed script. SIGN-IN: email and password only; no self-registration, OAuth, or SSO; one uniform failure message that never reveals whether the email exists, the account is deactivated, or a password has been set; an invited user without a password gets that same message. BRUTE-FORCE PROTECTION: count consecutive failures per account, lock for a cooling-off window past a threshold, clear on success; a locked account gets the uniform message; threshold and window as concrete numbers. SESSIONS: next-auth (Auth.js v5), JWT strategy because Credentials requires it; the user is re-read from the database on every session resolution and the session is rejected when the user is gone, deactivated, or the token predates the last password change; acceptance criteria: deactivation ends access immediately, a role change takes effect without re-login, a password change ends every earlier session; rolling window whose maximum age comes from Config (default eight hours), described rather than built; the `jwt` callback is the single seam (verified against next-auth 5.0.0-beta.32). ROUTE PROTECTION in three layers per the installed Next.js authentication guide: (1) `src/proxy.ts` optimistic cookie check only, no database, redirects anonymous visitors to the locale-prefixed sign-in page and signed-in visitors away from it, composed with the existing next-intl handling without breaking feature 001; (2) route groups under `src/app/[locale]` — a public group (sign-in, invite acceptance) and a private group whose layout is the page-level security boundary; a client-side current-user provider is not a security boundary; (3) a data access layer, `verifySession()` memoized with React `cache()`, called by every service and route handler, where authorization lives. TRANSPORT AND LAYERING: REST route handlers under `src/app/api/`, each doing exactly validate (zod) → resolve and authorize session → call a service; services under `src/server/<domain>/` import nothing from `next/*`; Prisma behind a repository module; no server actions; hand-written client request layer; CSRF via SameSite cookie policy plus a same-origin check. FORMS: no form library; Base UI Form/Field/Fieldset with server errors keyed by field name and the same zod schema on client and boundary; no single configurable form component for the four forms. ONE ACKNOWLEDGED EXCEPTION: sign-in and sign-out at `/api/auth/[...nextauth]` are next-auth's, not ours, and will not move to another backend unchanged. INVITES: creating a user sets no password; a single-use, expiring invite token, stored only as a hash; link shown once to the SUPER_ADMIN for out-of-band transfer (no email yet — an accepted compromise); invitee sets their password on a public locale-prefixed route, activating the account and consuming the token; revoke and re-issue, the latter doubling as forgotten-password recovery; defined behavior for expired, used, revoked, and forged tokens. USER ADMINISTRATION (SUPER_ADMIN only): list with email, role, status (invited / active / deactivated), creation date; create with a chosen role; deactivate/reactivate as a flag, never a delete; re-issue and revoke invites; email unique forever, never released. SELF-SERVICE: any signed-in user changes their own password by supplying the current one. KEY ENTITIES: User (email, password hash absent until invite accepted, display name — the one cuttable attribute, role, active flag, password-changed moment, failed-attempt count, lock expiry, created/updated); Invite (one user, token hash, expiry, consumed, revoked, issued-by); no session entity. PASSWORDS: bcryptjs, dependency justification in the plan, 72-byte truncation noted. CONFIGURATION: auth secret, session maximum age, bootstrap credentials through Config and `.env.example`; pass next-auth values explicitly from Config where its API allows. LOCALIZATION: every new string in `en` and `uk`. TESTING: test-first for services, the data access layer, authorization rules, zod schemas, bootstrap idempotency, Config additions; test-together for UI; Playwright must cover successful sign-in, uniform failure, anonymous redirect and return to the original destination, invite acceptance then sign-in, and immediate loss of access on deactivation. OUT OF SCOPE: self-registration, forgotten-password self-service, email sending and verification, 2FA, OAuth/SSO, the CLIENT role, the company/tenant model and tenant scoping, an audit log, changing an existing user's role. VERIFIED BEFORE WRITING: next-auth 5.0.0-beta.32 peers `next ^14 || ^15 || ^16`; the `jwt` callback runs on every session resolution including server-side `auth()`, and returning `null` clears the cookie; Next 16 Proxy runs on Node.js by default; Base UI 1.7.0 exports Form, Field, Fieldset, Input with external-error and per-field validation; the shadcn registry has no `form` for `base-nova`; a Proxy file exports exactly one function. STILL OPEN FOR /speckit-plan: the composition order of the auth check and the next-intl handler and its interaction with 001's Set-Cookie stripping and `no-store` rules; the spec carries acceptance criteria for an anonymous visitor at a protected address with and without a locale prefix." (Condensed from the full request in the `/speckit-specify` invocation; nothing above adds to or departs from it.)

## Overview

Atmo AI Agent will be run by a small team of our own staff on behalf of partner companies. Before
any of that work can exist, the product needs to know who is allowed in and who is allowed to let
others in. This feature establishes exactly that, and nothing more.

There are two kinds of account. The **super admin** is the single owner of the installation: created
once at deployment, never deactivatable, and the only person who can add, deactivate, reactivate, or
re-invite other people. An **admin** is everyone else the super admin lets in. In this feature an
admin can sign in, see the protected area, and change their own password — **and nothing else**.
That is deliberate, not missing work: what admins will actually do (partners, tenants, customer
conversations) arrives in later features, each with its own spec.

People join by invitation. The super admin creates an account, receives a one-time link, and passes
it on personally; the invitee opens it and chooses their own password. No one ever types a password
on another person's behalf, and the product stores no password or link in a form that could be
reused if its data leaked.

Because the sign-in page is the only form anyone on the internet can reach, and it leads straight to
administrative power, it is hardened: it never tells a stranger which accounts exist, and it locks an
account after repeated failures. And because being signed in must stop meaning anything the moment
the super admin says so, access is re-checked against the stored account on every request rather
than trusted until a timer runs out.

This is also the first feature to store data, so it sets the shape the rest of the product follows:
thin endpoints, business rules in services that know nothing about the web framework, and database
access behind a single layer.

## Clarifications

### Session 2026-09-24

- Q: Which pages sit behind sign-in, given that feature 001's pages are public and its end-to-end tests
  visit them anonymously? → A: Only a new protected area, with its own home page, user administration,
  and account page. The existing localized landing page, the demonstration route, and the not-found
  page stay public, so feature 001's behavior and tests are untouched (FR-038, FR-065). Two
  alternatives were declined: protecting everything, and protecting everything except a list of public
  pages. Both would have broken 001's not-found tests, because the first-layer check cannot tell an
  unmatched address from a protected one.
- Q: Should the create-user form offer a role choice, when admin is the only role that can ever be
  created? → A: Yes. A role control is shown with admin preselected as its only selectable option, and
  the server refuses a request that names super admin (FR-048). Leaving the control out until a second
  choosable role exists was presented and declined.

### Session 2026-09-26

- Q: With sessions held only in a signed cookie, signing out merely deletes that cookie; a copy taken
  earlier keeps working until it expires. Should sign-out revoke sessions on the server? → A: Yes.
  Signing out records the moment on the account, and every session of that user issued before it is
  refused by the per-request check (FR-066, FR-022). Accepted consequence: signing out on one device
  signs the user out on all of them. Accepting the cookie-only behavior as a known boundary was
  presented and declined.
- Q: Where does the interface show problems and confirmations? → A: Field problems under their field;
  problems with the form as a whole inside the form, where they stay until the next attempt; brief
  notifications only for confirmations of completed actions and for unexpected failures; and an
  expired session mid-work sends the user to sign-in instead of showing an error (FR-068 – FR-071).
- Q: Should a session also have an absolute lifetime counted from sign-in, so continuous use still ends
  in a fresh sign-in eventually? → A: Yes — 24 hours from sign-in by default, read from configuration
  alongside the rolling lifetime (FR-073, MC-002).
- Q: Should the server write security events (sign-ins, failures, lockouts, deactivations, invitations,
  password changes) to its operational log? → A: No. This feature requires no security-event logging;
  it arrives with the audit-log feature (Out of Scope, Known Boundaries). A minimal structured log
  with a ban on logging secrets was presented and declined.
- Q: Should a user's name be one display name or separate parts? → A: Separate first name and last
  name, both required, replacing the single display name everywhere: account creation, the setup
  command, the user list, and the signed-in indicator. The full name is shown through a localized
  message, so each language controls the order of the two parts (FR-074).

### Session 2026-09-27

- Q: The user list's row actions (issue link, revoke, deactivate, reactivate) can be triggered again
  while their request is still in flight, because the pending rule covered forms only. Should it cover
  them too? → A: Yes. Every control that sends a request shows a pending state and cannot send again
  until the request settles (FR-059).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The super admin exists from the first deploy and can sign in (Priority: P1)

An operator deploys the product to a fresh environment. The deployment runs one setup command that
creates the super admin from the environment's configuration. The super admin opens the product,
signs in with that email and password, and reaches the protected area, where the interface shows
who they are signed in as and offers a way to sign out.

**Why this priority**: Without a first account nothing else in this feature — or any later feature —
can be reached. This slice alone makes a deployment usable and secure.

**Independent Test**: On an empty database, run the setup command, sign in with the configured
credentials, and confirm arrival in the protected area; sign out and confirm the protected area is no
longer reachable.

**Acceptance Scenarios**:

1. **Given** an environment with no super admin and valid super-admin settings, **When** the setup
   command runs, **Then** a super admin is created with the configured email, first name, last name, and password, and
   the command reports that it created one.
2. **Given** a super admin already exists, **When** the setup command runs again — with the same or
   with different settings — **Then** nothing is created or changed, and the command reports plainly
   that a super admin already exists and was left untouched.
3. **Given** the super-admin settings are missing or the configured password breaks the password
   rules, **When** the setup command runs on an empty database, **Then** it creates nothing, exits
   with a failure, and names the problem.
4. **Given** a super admin exists, **When** they submit the correct email and password on the sign-in
   page, **Then** they arrive in the protected area and see their full name as the signed-in person.
5. **Given** any failed sign-in — unknown email, wrong password, deactivated account, invited account
   with no password yet, or locked account — **When** the form is submitted, **Then** the same single
   message is shown, and nothing on the page, in the response, or in its timing reveals which of these
   it was.
6. **Given** an anonymous visitor, **When** they open a protected address that carries a language
   segment (`/uk/<protected path>`), **Then** they are sent to the sign-in page in that language, and
   after signing in they arrive at the address they originally asked for.
7. **Given** an anonymous visitor, **When** they open a protected address without a language segment
   (`/<protected path>`), **Then** they are sent to the sign-in page in the language feature 001
   would have resolved for them, no language preference is written, no redirect in the chain is
   cacheable, and after signing in they arrive at the protected address under that language.
8. **Given** a signed-in user, **When** they open the sign-in page, **Then** they are sent to the
   protected area's home page instead.
9. **Given** a signed-in user on any page of the protected area, **When** they sign out, **Then** they
   arrive on the sign-in page in the same language, and any protected address sends them back to
   sign-in.
10. **Given** a sign-in request carrying a "return to" destination that points outside the product,
    **When** sign-in succeeds, **Then** the user lands on the protected area's home page and never on the outside
    address.
11. **Given** a user signed in on two devices, **When** they sign out on one, **Then** the session on
    the other device ends as well, and its next request sends it to sign-in.
12. **Given** a copy of a user's session cookie taken before they signed out, **When** it is presented
    after the sign-out, **Then** it is refused like any revoked session.
13. **Given** a user who has just signed out, **When** they use the browser's back button, **Then** no
    protected content is shown from the browser's cache.

---

### User Story 2 - Access ends the moment it should (Priority: P1)

The super admin deactivates someone. That person, mid-session, clicks anything — and is out. A user
changes their password because they suspect it leaked; every session opened with the old one, on
any device, stops working. A session left idle for longer than the session lifetime is gone, while
a session in steady use is not interrupted.

**Why this priority**: A sign-in that cannot be revoked is a liability rather than a control. This
is what makes deactivation and password changes mean something, and every later feature inherits it.

**Independent Test**: Sign a user in, deactivate them from a second session, and confirm their very
next request is refused; repeat with a password change instead of a deactivation.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the super admin deactivates them, **Then** that user's next
   request — page or endpoint — is refused and they are returned to sign-in, without waiting for any
   session lifetime to run out.
2. **Given** a user signed in on two devices, **When** they change their password on one, **Then**
   both sessions end, and only a sign-in with the new password succeeds.
3. **Given** a signed-in user whose stored role changes by any means (in this feature only an
   operator acting on the database directly can do so), **When** they make their next request,
   **Then** what they are allowed to see and do follows the new role, without signing in again.
4. **Given** a signed-in user whose account no longer exists in storage, **When** they make their
   next request, **Then** it is refused and they are returned to sign-in.
5. **Given** a signed-in user who keeps using the product, **When** the total time since sign-in
   exceeds the rolling lifetime but not the absolute lifetime, and no gap between requests exceeds
   the rolling lifetime, **Then** they remain signed in.
6. **Given** a signed-in user who makes no request for longer than the session lifetime, **When**
   they return, **Then** they must sign in again.
7. **Given** a user whose session has just been refused on the server, **When** they are sent to the
   sign-in page, **Then** the sign-in page is shown — never a redirect loop between sign-in and the
   protected area.
8. **Given** a user who has been in continuous use since signing in, **When** the absolute lifetime
   (24 hours by default) since that sign-in passes, **Then** their next request sends them to sign-in,
   and after signing in they return to the page they were on.

---

### User Story 3 - The super admin invites someone and they let themselves in (Priority: P2)

The super admin creates an account for a colleague with their email, first name, and last name. The product shows a
one-time link, once, with a way to copy it. The super admin sends it to the colleague over a channel
of their choice. The colleague opens it, sees which account it is for, chooses a password, and is
taken to sign-in, where the new password works.

**Why this priority**: This is how every account other than the super admin comes to exist. It
depends on US1 (someone must be signed in to invite).

**Independent Test**: As the super admin, create a user and copy the link; in a fresh browser, open
it, set a password, and sign in with it.

**Acceptance Scenarios**:

1. **Given** the super admin on the create-user form, whose role control offers admin as its only
   selectable role, preselected, **When** they submit a valid, unused email, a first name, and a last name, **Then** the account is created in the invited state with no password, and a link is shown
   exactly once with a copy control and a notice that it cannot be shown again.
2. **Given** the link has been shown and dismissed, **When** the super admin looks for it again,
   **Then** it is nowhere to be found; the only way forward is to issue a fresh one.
3. **Given** a valid link, **When** the invitee opens it, **Then** they see the email the account is
   for and a form to choose and confirm a password; opening the link alone changes nothing.
4. **Given** a valid link, **When** the invitee submits a password that meets the rules and matches
   its confirmation, **Then** the account becomes active, the link stops working, and the invitee is
   taken to sign-in with a confirmation that they can now sign in.
5. **Given** an expired link, **When** it is opened, **Then** the invitee is told it has expired and
   to ask their administrator for a new one, and no form is offered.
6. **Given** a link that has already been used, **When** it is opened, **Then** the invitee is told it
   has already been used and is pointed to sign-in, and no form is offered.
7. **Given** a revoked or superseded link, or one that was never issued, **When** it is opened,
   **Then** one generic "this link is not valid" message is shown, identical for both cases, and no
   form is offered.
8. **Given** the link is valid when the page opens but becomes unusable before the form is submitted,
   **When** it is submitted, **Then** nothing changes and the matching message from scenarios 5–7 is
   shown.
9. **Given** the link carries no language segment, **When** the invitee opens it, **Then** it opens in
   the language the invitee's own browser resolves to under feature 001, with the link intact.

---

### User Story 4 - The super admin manages who has access (Priority: P2)

The super admin opens the user list and sees everyone: full name, email, role, status, when they were
added, and whether an invitation is pending. From there they deactivate someone who has left,
reactivate someone who returned, re-issue a link for someone who never used theirs or has forgotten
their password, or revoke a link sent to the wrong person.

**Why this priority**: Control over access is the point of having a super admin. It depends on US1
and builds on US3.

**Independent Test**: As the super admin, deactivate an admin and confirm they cannot sign in;
reactivate them and confirm they can; re-issue and revoke links and confirm which ones work.

**Acceptance Scenarios**:

1. **Given** the super admin, **When** they open the user list, **Then** every account is listed with
   full name, email, role, status (invited, active, or deactivated), creation date in the active language's
   date format, and — for accounts with an outstanding link — that a link is pending and when it
   expires.
2. **Given** an active or invited admin, **When** the super admin deactivates them, **Then** their
   status becomes deactivated, their sessions end (US2), any outstanding link is revoked, and they
   cannot sign in.
3. **Given** a deactivated admin, **When** the super admin reactivates them, **Then** they return to
   active if they had set a password, or to invited if they had not, keeping the same email, first and last name,
   role, and creation date.
4. **Given** the super admin, **When** they try to deactivate the super admin account (their own),
   **Then** the action is refused and the account is unchanged; the interface offers no such action.
5. **Given** an invited or active admin, **When** the super admin issues a fresh link, **Then** the new
   link is shown exactly once, every earlier outstanding link for that account stops working, and —
   for an active admin — their current password keeps working until the new link is used.
6. **Given** an active admin who accepts a re-issued link, **When** they set a new password, **Then**
   the old password stops working, all their earlier sessions end, and any lock on the account is
   cleared.
7. **Given** an outstanding link, **When** the super admin revokes it, **Then** it stops working and
   the account's password, if any, is unaffected.
8. **Given** an email already held by any account — including a deactivated one — **When** the super
   admin tries to create a user with it, in any combination of upper and lower case, **Then** the
   creation is refused with a message that the address is already in use, suggesting reactivation for
   a deactivated account.
9. **Given** a signed-in admin, **When** they open any user-administration page or call any
   user-administration endpoint directly, **Then** they are refused with a "not permitted" response
   and nothing changes.

---

### User Story 5 - Repeated guessing locks the account (Priority: P2)

Someone who knows or guesses an admin's email tries password after password. After the fifth wrong
password in a row the account is locked for fifteen minutes; during that window even the right
password is refused, with the same message as any failure. When the window passes, the real owner
signs in normally.

**Why this priority**: The sign-in page is public and leads straight to administrative power. It is
split from US1 so it can be verified on its own, but it must ship with sign-in.

**Independent Test**: Submit five wrong passwords for one account, then the correct one, and confirm
refusal; advance past the window and confirm the correct password works.

**Acceptance Scenarios**:

1. **Given** an account with four consecutive failures, **When** a fifth wrong password is submitted,
   **Then** the account is locked for fifteen minutes and the uniform failure message is shown.
2. **Given** a locked account, **When** the correct password is submitted within the window, **Then**
   sign-in fails with the uniform message, indistinguishable from any other failure.
3. **Given** a lock whose window has passed, **When** the correct password is submitted, **Then**
   sign-in succeeds and the failure count returns to zero.
4. **Given** an account with some failures below the threshold, **When** the correct password is
   submitted, **Then** sign-in succeeds and the count returns to zero.
5. **Given** a lock whose window has passed, **When** a wrong password is submitted, **Then** it counts
   as the first failure of a new run, not the sixth of the old one.
6. **Given** an email that belongs to no account, **When** any number of attempts are made, **Then**
   every response is the uniform message, and nothing about the responses differs from those for a
   real account.

---

### User Story 6 - Anyone signed in can change their own password (Priority: P3)

A signed-in user — admin or super admin — opens their account page, enters their current password
and a new one twice, and saves. They are signed out everywhere and sign back in with the new
password. The super admin uses this right after the first deploy so they no longer depend on the
password stored in the deployment's configuration.

**Why this priority**: Needed so no one lives permanently on a password someone else chose or that
sits in deployment configuration; it follows the core access flows.

**Independent Test**: Sign in, change the password, confirm the old password fails and the new one
succeeds.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they submit the correct current password and a new password
   that meets the rules, differs from the current one, and matches its confirmation, **Then** the
   password changes, every session of theirs ends including the current one, and they are taken to
   sign-in with a confirmation.
2. **Given** a signed-in user, **When** they submit a wrong current password, **Then** nothing changes,
   the current-password field shows an error, and the attempt counts toward the lock in US5.
3. **Given** a locked account, **When** a password change is attempted from a session that is still
   open, **Then** it is refused until the lock window passes.
4. **Given** a new password that breaks the rules or does not match its confirmation, **When** it is
   submitted, **Then** each problem is shown on the field it concerns and nothing changes.

---

### Edge Cases

- **Two super admins at once.** Two setup commands, or any two operations, racing to create a super
  admin at the same moment: exactly one succeeds; the other reports that one already exists. No path —
  interface, endpoint, setup command, or direct database write — can leave two super admins stored.
- **Setup command meets an existing email.** No super admin exists, but an admin already holds the
  configured email: the command refuses, promotes no one, changes nothing, and fails naming the
  conflict.
- **Setup command with changed settings.** The settings now name a different email or password than
  the existing super admin: nothing is changed; the report says the existing super admin was left
  untouched. Rotating the super admin's password is done through US6, never by editing settings.
- **Super admin loses their password.** No one can issue them a link (links cannot target the super
  admin) and the setup command will not rewrite them. Recovery requires an operator acting on the
  database directly; see Known Boundaries.
- **Stale session cookie meets the sign-in page.** A session revoked on the server can still look
  present to the optimistic first check. The sign-in page must still be reachable for that visitor —
  no loop between sign-in and the protected area (US2 scenario 7).
- **Session issued in the same instant as a password change.** A session created by signing in with
  the new password immediately after a change must not be mistaken for one issued before it. The same
  holds for signing in again right after signing out.
- **Sign-out in one tab, another tab still open.** The other tab's next request — page or endpoint —
  sends it to sign-in (FR-071).
- **Storage briefly unreachable.** When the per-request account check (FR-022) cannot reach storage,
  the session is treated as ended: the visitor is sent to sign-in and any unsaved form input is lost.
  Accepted for this feature; see Known Boundaries.
- **Two tabs accept the same link at once.** Exactly one succeeds; the other sees the "already used"
  outcome and its password is not applied.
- **Link issued, then account deactivated.** Deactivation revokes the link; opening it shows the
  generic "not valid" message.
- **Re-issue for a deactivated account.** Refused; the account must be reactivated first.
- **Link for the super admin.** Issuing one is refused.
- **Email with mixed case or surrounding spaces.** Treated as the same address everywhere: at
  creation, at sign-in, and for uniqueness.
- **Password longer than the hashing limit.** A password beyond the length the product can store
  faithfully is rejected with a field error — never silently shortened, so every character typed
  always matters.
- **"Return to" pointing elsewhere.** An absolute address, another host, a protocol-relative address,
  or anything that is not a path inside the product is ignored in favour of the protected area's home
  page.
- **Locked account and an open session.** A lock stops new sign-ins and password changes; it does not
  end a session opened before the lock.
- **Lockout used against a real user.** Anyone who knows an admin's email can keep that account
  locked by failing on purpose. Accepted for this feature; see Known Boundaries.
- **Request from another site.** A state-changing request to one of the product's own endpoints that
  does not come from the product's own origin is refused and changes nothing, even when the browser
  sends the session cookie.
- **Endpoint called without a session.** Every user-administration and self-service endpoint refuses
  an anonymous call on its own, regardless of what the first-layer route check covers.
- **Admin navigates to an administration address.** Gets the localized "not permitted" page, not a
  crash and not the super admin's content.
- **Unknown address inside a locale.** Feature 001's localized not-found behavior continues to hold
  for everyone, anonymous visitors included (FR-038). An unknown address under the protected area's
  prefix sends an anonymous visitor to sign-in first, because the first-layer check cannot tell it
  from a real protected page.
- **Invite link leaks through the address bar.** The invite page must not pass its address to any
  other site it links to or loads from.

## Requirements _(mandatory)_

### Functional Requirements

**Roles and accounts**

- **FR-001**: The product MUST recognise exactly two roles: super admin and admin. There is no
  customer role and no company or tenant concept in this feature.
- **FR-002**: At most one super admin MUST exist at any moment. This MUST hold under concurrent
  attempts and MUST be guaranteed by the stored data itself, so that no sequence of checks performed
  by application code can be raced into creating a second one.
- **FR-003**: The super admin account MUST NOT be deactivatable by anyone, including itself.
- **FR-004**: An admin's capabilities in this feature MUST be limited to: signing in, viewing the
  protected area, changing their own password, and signing out. Every user-administration capability
  belongs to the super admin alone.
- **FR-005**: An email address MUST identify at most one account, compared without regard to letter
  case or surrounding whitespace, and MUST remain bound to that account permanently — deactivation
  does not release it, and there is no deletion.
- **FR-006**: Accounts MUST NOT be deleted. Removing access is a deactivation, which keeps the account
  and everything tied to it intact and attributable.
- **FR-007**: An account's status MUST be derivable as exactly one of: _invited_ (active, no password
  set yet), _active_ (active, password set), or _deactivated_ (not active, regardless of password).

**Setup command**

- **FR-008**: The product MUST provide one setup command that creates the super admin from the
  deployment's configuration — email, first name, last name, and password — when no super admin exists.
- **FR-009**: When a super admin already exists, the command MUST change nothing — including when the
  configured values differ from the stored account — and MUST report plainly that an existing super
  admin was left untouched, finishing successfully.
- **FR-010**: The command MUST be safe to run any number of times with the same result as running it
  once, and MUST never create a second super admin.
- **FR-011**: The command MUST fail without changing anything, naming the problem, when a required
  setting is missing, when the configured password breaks the password rules (FR-040), or when no
  super admin exists but the configured email already belongs to another account.
- **FR-012**: The command MUST be documented in the project's README as a deployment step, run on
  every deploy after the database is brought up to date.
- **FR-013**: The super admin created by the command MUST be active with its password set; it does not
  go through the invitation flow.

**Sign-in and sign-out**

- **FR-014**: Sign-in MUST accept an email and a password and nothing else. There MUST be no
  self-registration and no third-party or single-sign-on provider.
- **FR-015**: Every failed sign-in MUST produce one identical outcome — same message, same response
  status, and no timing difference an observer could use — whether the email is unknown, the password
  is wrong, the account is deactivated, the account has no password yet, or the account is locked.
- **FR-016**: A successful sign-in MUST start a session and send the user to the address they were
  originally trying to reach when that address is a path inside the product, and to the protected
  area's home page otherwise.
- **FR-017**: While signed in, the protected area MUST show the signed-in person's full name (FR-074) and
  offer a sign-out control, reachable from every page of the protected area. Signing out MUST end
  the session and send the user to the sign-in page in the current language.
- **FR-066**: Signing out MUST record the moment on the account, and every session of that user issued
  before that moment — on every device, including a copied session cookie — MUST be refused from then
  on (FR-022). Signing out with a session that is already invalid MUST still end on the sign-in page,
  without an error.
- **FR-067**: Pages of the protected area MUST NOT be stored by the browser or shared caches, so that
  signing out, or losing access, leaves no protected content reachable through the back button.

**Brute-force protection**

- **FR-018**: The product MUST count consecutive failed sign-in attempts per account. On the **5th**
  consecutive failure the account MUST be locked for **15 minutes**.
- **FR-019**: While locked, every sign-in attempt for that account MUST fail with the uniform outcome
  of FR-015, including attempts with the correct password.
- **FR-020**: A successful sign-in MUST reset the account's failure count to zero. A failure after a
  lock has expired MUST start a new count at one.
- **FR-021**: A wrong current password on the change-password form (FR-056) MUST count as a failed
  attempt under FR-018, and a locked account MUST NOT be able to change its password until the lock
  expires.

**Sessions**

- **FR-022**: A session MUST NOT be trusted on its own. On every request that relies on it, the
  product MUST re-read the account from storage and refuse the session when the account no longer
  exists, is deactivated, had its password changed after the session was issued, or signed out after
  the session was issued (FR-066).
- **FR-023**: Deactivating a user MUST end their access on their very next request, not at session
  expiry.
- **FR-024**: What a signed-in user may see and do MUST follow the role currently stored for them,
  on every request, without requiring them to sign in again.
- **FR-025**: Changing a user's password — by self-service or by accepting a link — MUST end every
  session of that user issued before the change, on every device, including the one the change was
  made from.
- **FR-026**: Session lifetime MUST be a rolling window: each request that relies on the session
  extends it, and a session with no such request for longer than the configured maximum age expires.
  The maximum age MUST be a single configured value, defaulting to **eight hours**.
- **FR-073**: Independently of FR-026, every session MUST end once the time since the sign-in that
  created it exceeds a configured absolute lifetime, defaulting to **24 hours**, however active it has
  been. Renewal under FR-026 MUST NOT move this limit. The absolute lifetime MUST NOT be shorter than
  the rolling maximum age; a configuration where it is MUST fail at startup, naming both values.
- **FR-027**: A visitor whose session has been refused MUST be able to reach the sign-in page; the
  product MUST NOT redirect them back and forth between sign-in and the protected area.

**Route protection**

- **FR-028**: An anonymous visitor who requests a protected address MUST be redirected to the sign-in
  page in the language of the request, carrying the original address so FR-016 can return them to it.
- **FR-029**: For a protected address without a language segment, the visitor MUST end on the sign-in
  page in the language feature 001's resolution order yields, with the original destination preserved
  under that language.
- **FR-030**: Every redirect this feature adds MUST be temporary and MUST NOT be stored by browsers or
  shared caches, and no request handled by this feature's routing MUST create or overwrite the stored
  language preference (feature 001, FR-030 and FR-031).
- **FR-031**: A signed-in visitor who requests the sign-in page MUST be redirected to the protected
  area's home page in the same language.
- **FR-032**: The first-layer route check MUST be optimistic: it decides from the session cookie
  alone and never consults stored data. It is a convenience that spares anonymous visitors a wasted
  page render, not a security control.
- **FR-033**: The real page-level check MUST happen on the server for every page in the protected
  area, before any protected content renders, and MUST apply FR-022.
- **FR-034**: Every endpoint and every service operation that needs an identity MUST establish and
  authorize it itself, so that removing or misconfiguring the first-layer check can never expose data
  or an action.
- **FR-035**: Authorization decisions — whether the current user may perform an operation — MUST be
  made in the server-side session check and in the business-rule layer, never only in the first-layer
  route check and never only in the interface.
- **FR-036**: Any client-side record of the current user, used to render the interface, MUST grant
  nothing: hiding or showing a control is presentation, and every operation behind that control is
  authorized again on the server.
- **FR-037**: A signed-in admin who requests a user-administration page MUST receive a localized
  "not permitted" page; an admin calling a user-administration endpoint MUST receive a "not permitted"
  response. Neither reveals any user data.
- **FR-038**: Only the protected area requires sign-in. It is a new area that lives under a single
  address prefix and holds the protected home page, user administration, and the account page. Every
  page that exists today stays public and behaves as feature 001 specifies: the localized landing page
  at each language's root, the demonstration route, and the localized not-found page for unmatched
  addresses. Sign-in and invitation acceptance are public as well. Whether a page is protected is
  decided by where it is placed; a page placed outside the protected area is public, and review is
  where that placement gets checked.

**Invitations**

- **FR-039**: Creating a user MUST NOT set a password. It MUST issue a single-use invitation link that
  expires **72 hours** after issue.
- **FR-040**: A password MUST be at least **12 characters** long and at most **72 bytes** when encoded
  as UTF-8. A longer password MUST be rejected rather than shortened. These rules apply everywhere a
  password is chosen: invitation, self-service change, and the setup command.
- **FR-041**: The product MUST store only a one-way fingerprint of an invitation token, never the
  token itself. A copy of the stored data MUST NOT be enough to use any invitation.
- **FR-042**: The link MUST be shown to the super admin exactly once, immediately after it is issued,
  with a copy control and a notice that it will not be shown again. There MUST be no way to display it
  afterwards.
- **FR-043**: The link MUST carry no language segment, so it opens in the invitee's own resolved
  language, and the invitation page MUST NOT expose its address to other sites through referrer
  information.
- **FR-044**: Opening a valid link MUST show the email the account is for and a form to choose and
  confirm a password. Submitting a password that satisfies FR-040 and matches its confirmation MUST, in
  one indivisible step: set the password, record the moment it changed, make the account active if it
  was invited, clear any lock and failure count, and consume the link. Opening the link alone MUST
  change nothing.
- **FR-045**: Link outcomes MUST be defined as follows, both when the page opens and when the form is
  submitted:
  - _Expired_: an "expired, ask your administrator for a new link" message, no form.
  - _Already used_: an "already used" message pointing to sign-in, no form.
  - _Revoked, superseded, malformed, or never issued_: one generic "not valid" message, identical in
    all these cases, no form.
  - _Account deactivated_: treated as revoked (FR-053 revokes the link on deactivation).
    A single link MUST succeed at most once, including when submitted concurrently.
- **FR-046**: Accepting a link MUST NOT sign the invitee in; it MUST send them to sign-in with a
  confirmation that they can now sign in with their new password.

**User administration (super admin only)**

- **FR-047**: The super admin MUST be able to view a list of all accounts showing full name (FR-074), email,
  role, status (FR-007), creation date formatted for the active language, and, where a link is
  outstanding, that it is pending and when it expires. The list is ordered newest first.
- **FR-074**: Every account MUST have a first name and a last name, each required and 1–100 characters
  after trimming. Wherever a person's full name is shown, it MUST be composed by a localized message
  that places both parts, never by joining them in code (feature 001, FR-024).
- **FR-048**: The super admin MUST be able to create an account from an email, a first name, a last name,
  and a role chosen in a role control. Because a super admin always exists once the setup command has run,
  admin is the only role the control offers for selection, and it is preselected; super admin is never
  selectable. A creation request that names the super-admin role by any route MUST be refused with a
  field error on the role, and FR-002 holds regardless.
- **FR-049**: Creating an account with an email already held by any account, including a deactivated
  one, MUST be refused with a message that the address is in use; for a deactivated holder the message
  MUST point to reactivation.
- **FR-050**: The super admin MUST be able to issue a fresh link for any invited or active admin. Issuing
  MUST revoke every earlier outstanding link for that account and MUST NOT change the account's current
  password; the password is replaced only when the new link is accepted. This is the recovery path for
  an admin who has forgotten their password.
- **FR-051**: Issuing a link MUST be refused for the super admin account and for deactivated accounts.
- **FR-052**: The super admin MUST be able to revoke an outstanding link without issuing a new one. Revoking
  MUST NOT change the account's password or status.
- **FR-053**: The super admin MUST be able to deactivate any admin. Deactivation MUST end the admin's
  access per FR-023 and revoke any outstanding link.
- **FR-054**: The super admin MUST be able to reactivate a deactivated admin, returning them to active if
  a password is set and to invited otherwise, with every other attribute unchanged.
- **FR-055**: Each issued link MUST record who issued it, so a re-issued link can be told apart from the
  original.

**Self-service**

- **FR-056**: Every signed-in user MUST be able to change their own password by supplying their current
  password and a new password entered twice. The new password MUST satisfy FR-040 and MUST differ from
  the current one.
- **FR-057**: After a successful change the user MUST be signed out everywhere (FR-025) and sent to
  sign-in with a confirmation.

**Forms, endpoints, and request safety**

- **FR-058**: Each of the four forms this feature ships — sign-in, set password from a link, create
  user, change own password — MUST apply the same validation rules in the browser and at the server, and
  MUST show each server-reported problem on the field it concerns.
- **FR-059**: Every control that sends a request — a form's submit button, a menu action, a
  confirmation in a dialog — MUST show a pending state while its request is in flight and MUST NOT
  send it again until that request settles. Every form MUST also show a failure as FR-068 – FR-071
  describe without losing what the user typed (except password fields), and — for administration
  forms and actions — the affected list MUST refresh after a successful change. _Amended during
  review:_ extended from forms to every control that sends a request; the user list's row actions had
  no pending state.
- **FR-060**: Every state-changing request to the product's own endpoints MUST be refused, changing
  nothing, unless it comes from the product's own origin. The session cookie MUST be unreadable by page
  scripts, sent only over encrypted connections outside local development, and withheld by browsers
  from cross-site sub-requests.
- **FR-061**: Endpoints MUST distinguish, in their responses, a request with invalid input (with the
  problems per field), a request with no valid session, a request by a user not permitted to perform it,
  and a conflict such as a duplicate email — so the interface can respond to each correctly.

**Where problems and confirmations appear**

- **FR-068**: A problem with one field MUST appear under that field (FR-058). A problem with the form as
  a whole — the uniform sign-in failure, an address already in use, an invalid or expired link, a
  "not permitted" response — MUST appear inside the form, MUST stay visible until the next submission,
  and MUST be announced to assistive technology. Such problems MUST NOT be shown only as a brief
  notification.
- **FR-069**: Completed actions that leave the user on the same page — deactivating, reactivating,
  revoking a link — MUST be confirmed with a brief notification. Confirmations that follow a move to
  another page — after accepting a link, after changing one's password — MUST appear on the page the
  user arrives at.
- **FR-070**: An unexpected failure — no connection, or a server error the user cannot fix — MUST be
  reported with a brief notification carrying a generic message and no technical detail, and the form
  MUST keep what the user typed (except password fields) so they can retry.
- **FR-071**: When an endpoint reports that the session is no longer valid, the interface MUST send the
  user to the sign-in page, carrying the current address so FR-016 returns them to it, instead of
  showing an error.
- **FR-072**: Brief notifications MUST be announced to assistive technology without taking focus, MUST
  be dismissible, and MUST stay visible long enough to be read.

**Localization**

- **FR-062**: Every string this feature shows — sign-in, invitation screens, the user list and its
  forms and actions, the account page, the "not permitted" page, validation and error messages, and
  confirmations — MUST exist in both English and Ukrainian, subject to feature 001's completeness
  checks.
- **FR-063**: Dates and times this feature shows MUST be rendered by locale-aware formatting.

**Acceptance coverage**

- **FR-064**: Automated end-to-end coverage MUST demonstrate, against a running application: a successful
  sign-in reaching the protected area; a failed sign-in showing the uniform message; an anonymous visitor
  redirected from a protected address to sign-in and, after signing in, arriving where they were going —
  both with and without a language segment; accepting an invitation and signing in with the new
  password; a deactivated user losing access on their very next request; and signing out ending access
  on every device, including for a session cookie copied before the sign-out.
- **FR-065**: Feature 001's language-resolution and language-switching behavior MUST continue to hold,
  and its automated tests MUST remain green.

### Mandated Implementation Constraints

Stated by the requester and by the constitution rather than derived from the behavior above. They are
recorded here, as in feature 001, because they constrain the plan and are deliberate.

- **MC-001 — Session library.** Sessions use next-auth (Auth.js v5, resolved as 5.0.0-beta.32) with the
  Credentials provider and therefore the JWT session strategy. The `jwt` callback runs on every session
  resolution, server-side `auth()` included, and is the single place where FR-022's re-check happens.
  _Amended during planning (research R3):_ a `null` from the callback rejects the session everywhere, but
  the cookie is re-written — renewed or cleared — only on paths that forward `Set-Cookie` (the
  `/api/auth/session` endpoint, the wrapper form of `auth`); a Server Component's `auth()` does neither.
  Rolling renewal (FR-026) is therefore driven by the protected area's client asking the session endpoint
  on navigation and on window focus, not by server rendering alone.
- **MC-002 — Configuration.** The auth secret, the session maximum age (default 28 800 seconds), and the
  absolute session lifetime (default 86 400 seconds) are read through the Config module and documented in
  `.env.example`. Where next-auth would read an environment variable itself, the value is passed
  explicitly from the Config object wherever its API allows. _Amended during planning (research R9):_ the
  setup command's super-admin email, first name, last name, and password are documented in `.env.example` but are
  **not** part of the application's Config — adding them would make the running application fail at
  boot without credentials it never uses. The setup command reads them itself (MC-003).
- **MC-003 — Setup command.** `npm run bootstrap`. It runs outside the application, so it may read
  `process.env` directly under the constitution's tooling exemption; it still validates the password
  against the same rules the application uses, and reuses the application's Config module only for what
  it shares with the application (the database connection). No demo or seed script ships with this
  feature.
- **MC-004 — Super-admin uniqueness.** FR-002 is enforced by a partial unique index on the users table,
  shipped as a committed Prisma migration.
- **MC-005 — First routing layer.** `src/proxy.ts` performs FR-032's optimistic check and never queries
  the database, because it runs on every route including prefetches. A proxy file exports exactly one
  function, so the auth check and the existing next-intl handling (including feature 001's Set-Cookie
  stripping and `no-store` redirects) are composed by hand into that one function. Proxy runs on Node.js
  by default in Next 16, so no split edge-safe configuration is needed. The existing matcher excludes
  `/api`, which is one reason FR-034 exists. _Amended during planning (research R4):_ the proxy only
  turns anonymous visitors away from the protected area; it does not send signed-in visitors away from
  sign-in, because it cannot see a server-side revocation and would loop (FR-027). FR-031 is met by the
  sign-in page itself after the real check.
- **MC-006 — Second routing layer.** Route groups under `src/app/[locale]`: a public group (sign-in,
  invitation acceptance) and a private group whose layout performs FR-033's check. A React context
  provider may expose the current user to client components for rendering only (FR-036).
- **MC-007 — Data access layer.** `verifySession()` / `getSessionUser()`, memoized per request with React
  `cache()`, is called by every page and every route handler that needs an identity. Services never call
  it — they cannot, since they import nothing from Next or next-auth (MC-008). They receive the resolved
  user as an `actor` argument and authorize it themselves (e.g. `assertSuperAdmin(actor)`), which is
  where FR-035's authorization decisions live. _Amended during analysis (I1)._
- **MC-008 — Transport and layering.** All endpoints are REST route handlers under `src/app/api/`. Each
  does exactly three things: validate the payload with a zod schema, resolve the session, call a service
  that authorizes the resolved user (MC-007). Services live under `src/server/<domain>/`, hold the business rules, and import nothing
  from `next/*` — the guarantee that lets them move to a separate backend with only new controllers.
  Prisma calls live in a repository module behind each service. In this spec "action" never means a
  database operation; database operations are the repository. No server actions are used.
- **MC-009 — Request safety.** FR-060 is met by a `SameSite=Lax`, `HttpOnly` session cookie (`Secure`
  outside local development) together with a same-origin check on every state-changing route handler.
- **MC-010 — Forms.** No form library is added. Forms are composed directly from Base UI's `Form`,
  `Field`, and `Fieldset` (already present through shadcn/ui), with server errors passed to `Form` keyed by
  each field's name and the same zod schema used by the field validation and by the endpoint. There is no
  shared configurable form component; each form owns one schema shared with its endpoint. The shadcn
  registry has no `form` entry for the `base-nova` style, so react-hook-form is not covered by the CLI
  exemption. _Amended during planning (research R14):_ the shadcn `field` primitive for `base-nova` renders
  plain elements rather than Base UI's `Field`; it is pulled through the CLI and customized in place to
  wrap Base UI's `Field` parts, so forms compose `src/components/ui/field` like every other primitive.
- **MC-011 — Hashing.** Passwords are hashed with bcryptjs. The plan records the constitution's
  dependency justification and addresses bcrypt's 72-byte input limit (FR-040 rejects rather than
  truncates). _Amended during planning (research R12):_ invitation tokens are fingerprinted with SHA-256
  from the Node.js standard library instead. A bcrypt hash is salted, so a presented token could not be
  looked up by its hash; a 256-bit random token needs no deliberately slow hash.
- **MC-012 — Test regimes.** Test-first: services, the data access layer, authorization rules, zod
  schemas, the setup command's idempotency, and the Config additions. Test-together: UI. FR-064 is
  Playwright.
- **MC-013 — Notifications.** FR-069 – FR-072 use shadcn/ui's `toast` component for the `base-nova`
  style, pulled through the shadcn CLI. _Amended during planning (research R15):_ it is built on Base UI's
  own Toast, already installed, so no new package is added; `sonner` was the original choice and would
  have brought a new runtime dependency for the same behavior.

### Known Boundaries

Accepted limitations, recorded so they are found here rather than discovered later.

- **Sign-in is not ours.** Sign-in, next-auth's own request-forgery token, and session renewal are served
  by next-auth at `/api/auth/[...nextauth]`, not by our route handlers, and are the part of this feature
  that will not move to another backend unchanged. _Amended during planning (research R5):_ sign-out goes
  through one of our own route handlers, which records the sign-out moment (FR-066) and then asks
  next-auth to clear the cookie — next-auth's sign-out hook swallows errors, which would let a failed
  write silently leave other devices signed in.
- **Out-of-band link transfer.** There is no email delivery yet. The super admin copies each link and
  passes it on personally; whoever holds it can claim the account until it is used, revoked, or expired.
  Accepted until email delivery is specified.
- **Hand-written request layer.** Without server actions or a data-fetching library, pending states,
  error handling, and list refresh after a change (FR-059) are written by hand, and cross-site request
  protection (FR-060) is ours to maintain.
- **Deliberate lockout.** Per-account locking lets anyone who knows an admin's email keep that account
  locked. With a handful of staff accounts this is preferred over unthrottled guessing; the affected
  person waits out the window or is contacted directly. Throttling by network origin is not part of
  this feature, so guessing spread thinly across many accounts is limited only by FR-018 per account.
- **No record of security events.** Sign-ins, failed attempts, lockouts, and administrative actions
  leave no trace in this feature, so a lockout or a suspected attack cannot be investigated after the
  fact until the audit-log feature exists.
- **Super admin recovery.** A super admin who loses their password cannot be re-invited and will not be
  rewritten by the setup command. Recovery needs an operator with direct database access. A
  break-glass command, if wanted, is a later feature.
- **Storage outage ends sessions.** A failed account check is indistinguishable, to next-auth, from a
  revoked session: it clears the cookie, and the client treats an unanswered session check as signed
  out. A database failover, restart, or exhausted connection pool therefore signs out everyone who
  acts during it. With a handful of staff accounts and short forms, keeping sessions alive through an
  outage is not worth a third session state that every check must refuse correctly. Revisit when
  connection-pool timeouts appear in the logs or when end customers sign in through this layer.

### Key Entities

- **User**: A person allowed into the product. Identified at sign-in by an email address that is unique
  across all users regardless of case and never released. Has a first name and a last name, shown together as a full name in the user list
  and the signed-in indicator; a role (super admin or admin); whether the account is active; a password,
  held only as a one-way hash and absent until first set; the moment the password last changed, which
  lets a change end older sessions; the moment the user last signed out, which lets a sign-out end
  sessions on every device; the number of consecutive failed sign-in attempts and the moment
  any current lock ends; and when the account was created and last updated. At most one user is a
  super admin.
- **Invite**: The single opportunity, for exactly one user, to set that user's password. Holds only a
  one-way fingerprint of its token; when it expires; when it was consumed and when it was revoked —
  either makes it unusable; and which user issued it. A user may have many invites over time but at
  most one outstanding at once.
- **Session** is deliberately not an entity. Sessions live in a signed cookie and nothing about them is
  stored, which is exactly why every request re-checks the user (FR-022).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A fresh deployment reaches a signed-in super admin with one setup step and one sign-in —
  zero manual database edits.
- **SC-002**: Running the setup command ten times in a row, including with changed settings, leaves the
  stored accounts identical to running it once.
- **SC-003**: Under concurrent attempts to create a super admin, the number of super admins stored never
  exceeds one — in 100% of runs.
- **SC-004**: For each of the five failed sign-in causes (unknown email, wrong password, deactivated,
  no password yet, locked), the visible message and response status are identical — five out of five
  indistinguishable.
- **SC-005**: After a user is deactivated, changes their password, or signs out, zero further requests
  are served on any session issued before that moment, on any device.
- **SC-006**: After the fifth consecutive wrong password, 100% of sign-in attempts for that account in
  the following fifteen minutes fail, including those with the correct password.
- **SC-007**: An invitee who receives a link can set their password and be signed in within two minutes
  of opening it.
- **SC-008**: Every invitation link succeeds at most once, and none succeeds after it expires or is
  revoked — zero exceptions across all tested paths, including concurrent submission.
- **SC-009**: Zero user-administration operations succeed for an anonymous visitor or an admin, verified
  for every administration endpoint called directly, not only through the interface.
- **SC-010**: A user in continuous use is never signed out by the rolling lifetime before the absolute
  lifetime is reached, a session idle for longer than the rolling lifetime never resumes without a new
  sign-in, and no session survives past the absolute lifetime — zero exceptions.
- **SC-011**: Every string this feature introduces is present in English and Ukrainian — zero gaps.
- **SC-012**: Feature 001's language-resolution and switching tests pass with no loss of coverage.

## Assumptions

- **Numbers chosen.** Lock after 5 consecutive failures for 15 minutes; invitation links valid 72
  hours; session lifetime 8 hours rolling with a 24-hour absolute limit; passwords 12 characters to 72 bytes. The lock and link values
  are fixed product rules rather than configuration; only the two session lifetimes are configurable.
- **First and last name, not a display name.** Both are required when an account is created and are
  supplied to the setup command alongside email and password. Neither is editable in this feature.
- **Signing out everywhere includes the current device.** After a password change the user signs in
  again with the new password; this keeps FR-025 free of exceptions.
- **Signing out ends every device.** Per-device sign-out would need a stored session entity, which this
  feature deliberately does not have; ending all sessions is what one stored moment on the account
  can express (FR-066).
- **Accepting a link does not sign in.** The invitee proves the new password works by using it (FR-046).
- **One outstanding link per user.** Issuing a new one supersedes the old.
- **Setup command output is operator-facing.** Its messages are for the deployment log, not product
  copy, and are not localized.
- **Scale.** Staff accounts number in the tens; the user list needs no search, filter, or pagination.
- **Protected area content.** In this feature the protected area's home page shows the signed-in
  indicator, sign-out, a link to change one's password, and — for the super admin only — a link to user
  administration. Later features fill it. The public landing page is unchanged by this feature; it does
  not redirect signed-in visitors.
- **Times are shown in UTC.** Creation dates and link expiry times follow feature 001's fixed UTC time
  zone; showing each viewer's own zone is outside this feature, as it is outside 001. Where a time of
  day is shown (link expiry), its zone is shown with it.
- **Timing uniformity** means no difference an observer could use to learn whether an account exists;
  the plan chooses how to achieve it.

## Out of Scope

Each to be specified later as its own feature:

- Self-registration.
- Forgotten-password self-service, any email sending, and email-address verification.
- Two-factor authentication.
- OAuth, SSO, or any third-party sign-in provider.
- The customer (CLIENT) role.
- The company/tenant model and the tenant scoping that depends on it.
- An audit log of administrative actions, and any logging of security events (sign-ins, failures,
  lockouts, administrative actions); both arrive together.
- Changing an existing user's role, email, first name, or last name.
- Throttling by network origin.
- A development seed or demo-data script.

## Open for Planning

All four were settled in the plan; see [research.md](./research.md).

- **Order of the auth check and the language handling in the one proxy function** — language first,
  auth second (R2).
- **Avoiding the stale-cookie loop** of FR-027 — the first layer never sends anyone away from sign-in;
  the sign-in page does so itself after the real check (R4).
- **Recording the sign-out moment (FR-066)** — our own sign-out route handler (R5).
- **Confirming rolling renewal** (MC-001) — it does not hold for server rendering alone; the client
  drives it (R3).
