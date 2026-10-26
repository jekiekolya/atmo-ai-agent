---
description: "Task list for Password Visibility Toggle"
---

# Tasks: Password Visibility Toggle

**Input**: Design documents from `/specs/008-password-visibility-toggle/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui.md](./contracts/ui.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The spec asks for them (FR-015), and so does the constitution (Principle IV). Every
module here is test-together (plan.md § Test regime): a test ships in the same task as the code it
covers.

**Organization**: Tasks are grouped by the spec's user stories:

- US1 — check a password before sending it (P1): the component and its four call sites;
- US2 — use the toggle without a mouse (P1): keyboard and assistive-technology behaviour, proven by tests;
- US3 — the password hides itself when the form is sent (P2): the submit listener.

The accessible name and `type="button"` ship in US1, because a button cannot ship without them. US2 adds
the tests that prove them, plus the by-hand check.

**Conventions for every task**:

- Component tests mock next-intl with `vi.mock("next-intl", () => import("@/testing/next-intl-mock"))`.
  Keys then render as `namespace.key`, for example `passwordInput.show`.
- Import lucide icons by their `…Icon` names (`EyeIcon`, `EyeOffIcon`), as the rest of `src` does.
- Use only theme tokens for colour.
- Comments are rare and one line (CLAUDE.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 – US3)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Confirm the baseline on branch `008-password-visibility-toggle`: run `npm run typecheck`,
      `npm run lint` and `npm run test:run`. All must be green before any change.

- [x] T002 Vendor the input group through the shadcn CLI (research R1, R2). It creates
      `src/components/ui/input-group.tsx` and `src/components/ui/textarea.tsx`.
  - Run `npx shadcn add input-group --yes --overwrite`. It is non-interactive: without `--overwrite` the
    CLI stops at a prompt for each existing file.
  - Restore the two primitives it rewrote:
    `git checkout -- src/components/ui/button.tsx src/components/ui/input.tsx`. `git diff --stat` must
    show neither file changed.
  - In both new files, replace `import { cn } from "cn"` with `import { cn } from "@/lib/utils"`. Change
    nothing else in them.
  - If the CLI installed the `cn` package, run `npm uninstall cn`. `git diff package.json package-lock.json`
    must then be empty.
  - Run `npm run typecheck` and `npm run lint`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 [P] Add a top-level `passwordInput` namespace to `src/messages/en.json` and
      `src/messages/uk.json`, with exactly the keys in data-model.md § Catalog keys:
  - en: `show` "Show password", `hide` "Hide password";
  - uk: `show` "Показати пароль", `hide` "Сховати пароль".

  Place it at the same position in both files. Run `npm run test:run -- src/i18n` and confirm parity
  passes.

- [x] T004 [P] In `e2e/support/sign-in.ts`, pass `{ exact: true }` to both `getByLabel` calls in
      `submitSignIn` (email and password; research R8).
  - Without it, "Password" / "Пароль" also matches the new button's name, and Playwright's strict mode
    fails.
  - Check `signedInPage` and any other helper in the file that locates by label.

**Checkpoint**: copy exists, and the e2e helpers survive a second "…password" name on the page.

---

## Phase 3: User Story 1 — Check a password before sending it (Priority: P1) 🎯 MVP

**Goal**: every password field on sign-in, change password, and set password from an invitation has an
eye button that reveals and masks only its own field.

**Independent Test**: On each of the three forms, type into every password field, press its eye, read
the value, and press again. Check the icon, that the value is unchanged, and that no other field changed.

- [x] T005 [US1] Create `PasswordInput` in
      `src/components/form-kit/password-input/password-input.tsx` (contracts/ui.md, data-model.md
      § Field state). It depends on T002 and T003.
  - `"use client"`.
  - Props: `Omit<React.ComponentProps<"input">, "type" | "ref">`.
  - State: `const [visible, setVisible] = useState(false)`.
  - Copy: `const t = useTranslations("passwordInput")`.
  - Render:

    ```tsx
    <InputGroup>
      <InputGroupInput
        {...props}
        type={visible ? "text" : "password"}
        className={cn("[&::-ms-reveal]:hidden", props.className)}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? t("hide") : t("show")}
          disabled={props.disabled}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
    ```

  - Do not add `aria-pressed` (research R4). The submit listener comes in T012.

  Test in `src/components/form-kit/password-input/password-input.test.tsx`. Render inside
  `<Field name="password"><FieldLabel>Password</FieldLabel><PasswordInput autoComplete="current-password" /></Field>`.
  Cover:
  - **masked on mount**: the input has `type="password"`, and the button is named `passwordInput.show`;
  - **toggles**: after typing "secret" and clicking the button, the input has `type="text"` and value
    "secret", and the button is named `passwordInput.hide`; a second click restores `type="password"`
    with the value kept;
  - **independent**: with two `PasswordInput`s, revealing the first leaves the second at
    `type="password"`;
  - **keeps attributes**: `autoComplete` stays `current-password` in both states, and
    `getByLabelText("Password")` still finds the input;
  - **disabled**: `<PasswordInput disabled />` disables both the input and the button.

- [x] T006 [P] [US1] In `src/components/account/sign-in-form/sign-in-form.tsx`, replace
      `<Input type="password" autoComplete="current-password" />` with
      `<PasswordInput autoComplete="current-password" />`.
  - Remove the `Input` import only if nothing else in the file uses it. The email field still does.
  - Run `src/components/account/sign-in-form/sign-in-form.test.tsx` unchanged; it must pass.

- [x] T007 [P] [US1] In `src/components/account/change-password-form/change-password-form.tsx`, replace
      the current-password `<Input type="password" autoComplete="current-password" />` with
      `<PasswordInput autoComplete="current-password" />`.
  - Drop the `Input` import if it becomes unused.
  - Run `change-password-form.test.tsx` unchanged; it must pass.

- [x] T008 [P] [US1] In `src/components/account/new-password-fields/new-password-fields.tsx`, replace both
      `<Input type="password" … />` with `<PasswordInput … />`.
  - Keep `autoComplete="new-password"` and the first field's `onChange` exactly as they are.
  - Drop the `Input` import.
  - Run `new-password-fields.test.tsx` and `set-password-form.test.tsx` unchanged; they must pass.

- [x] T009 [P] [US1] In `src/conventions/theme-contrast.test.ts`, add
      `{ fg: "muted-foreground", surface: "input/30", over: surface, min: GRAPHIC }` to the per-surface
      `flatMap` (research R7, FR-013).
  - Run `npm run test:run -- src/conventions`. It must pass in both themes; the expected dark-theme
    ratios are about 6.1:1 over `card` and 7.0:1 over `background`.
  - If the file's header comment lists the pairs it covers, extend it.

- [x] T010 [US1] In `e2e/auth.spec.ts`, add the test "revealing the password on sign-in still signs in
      (spec 008)". It depends on T004 and T006.
  - Create an admin and go to `/en/sign-in`.
  - Fill the email, and the password with `getByLabel("Password", { exact: true })`.
  - Click `getByRole("button", { name: "Show password" })`. Expect the field to have `type="text"` and
    the admin's password as its value, and the button to be named "Hide password".
  - Click Sign in. Expect the URL `/en/dashboard`.

**Checkpoint**: every password field reveals and masks; existing form tests and e2e flows are green.

---

## Phase 4: User Story 2 — Use the toggle without a mouse (Priority: P1)

**Goal**: the toggle is fully operable by keyboard and announced by its action in the page's language.

**Independent Test**: Operate each form by keyboard only and with a screen reader, in English and
Ukrainian.

- [x] T011 [US2] In `src/components/form-kit/password-input/password-input.test.tsx`, add keyboard tests.
      Render inside a Base UI `<Form onFormSubmit={onSubmit}>`, with a second input after the field and a
      submit button.
  - **Tab order**: focus the password input, `user.tab()`, and the eye button is focused; another
    `user.tab()` moves on to the next input (FR-009).
  - **Enter and Space**: with the button focused, `user.keyboard("{Enter}")` reveals and
    `user.keyboard(" ")` masks again; `onSubmit` is never called (FR-009).
  - **Clicking never submits**: the button has `type="button"`, and clicking it never calls `onSubmit`.
  - **The name follows the state**: the button is named `passwordInput.show` while masked and
    `passwordInput.hide` while revealed (FR-010).

---

## Phase 5: User Story 3 — The password hides itself when the form is sent (Priority: P2)

**Goal**: submitting a form masks every revealed password field in it, before any request starts,
whether or not the form's own checks let the submission through.

**Independent Test**: On each form, reveal every password field and submit. Observe each field at the
moment of submission and after the response.

- [x] T012 [US3] Add the submit listener to `src/components/form-kit/password-input/password-input.tsx`
      (research R3).
  - Hold a ref to the input: `const input = useRef<HTMLInputElement>(null)`, passed as
    `ref={input}` on `InputGroupInput`.
  - Add the effect:

    ```tsx
    useEffect(() => {
      const form = input.current?.form;
      if (!form) return;
      // Masked before the form's own submit handler can start the request (FR-005).
      const mask = () => flushSync(() => setVisible(false));
      form.addEventListener("submit", mask);
      return () => form.removeEventListener("submit", mask);
    }, []);
    ```

  - Import `flushSync` from `react-dom`.

  Tests in `password-input.test.tsx`, inside a Base UI `<Form>`:
  - **Masked before the handler**: reveal, click the submit button, and expect `type="password"`. In
    `onFormSubmit`, record `input.type` at call time; it must be `"password"`.
  - **Masked when the form's checks stop the submission**: the `Field` has a `validate` that always
    returns an error. Reveal, submit, and expect `type="password"`, `onFormSubmit` not called, and the
    error shown.
  - **Revealing again after submit**: one click reveals again.
  - **No form**: rendered outside a `<form>`, the component mounts and toggles without error.

- [x] T013 [US3] Re-run `sign-in-form.test.tsx`, `change-password-form.test.tsx`,
      `new-password-fields.test.tsx` and `set-password-form.test.tsx`. All four forms now mask on submit,
      and their existing assertions must still pass unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T014 Run every merge gate:
  - `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, `npm run e2e`;
  - all green;
  - `git diff package.json package-lock.json` is empty.

- [ ] T015 Walk through quickstart.md §2 in the dev server. Then do §3 by hand: Edge shows one eye per
      field, Safari/Chrome password managers offer to save and fill, and VoiceOver announces the name in
      en and uk. Record anything that fails as a new task here, not as a silent fix.

---

## Dependencies & Execution Order

- **Setup (T001 → T002)** comes first. T002 provides the primitives every story builds on.
- **Foundational (T003, T004)** runs in parallel after T001. T003 must land before T005; T004 before T010.
- **US1**: T005, then T006 – T009 in parallel, then T010.
- **US2 (T011)** needs T005 only. It can run beside T006 – T010.
- **US3 (T012 → T013)** needs T005. T013 needs T006 – T008.
- **Polish (T014, T015)** comes last.

### Parallel examples

```text
After T001:  T002 | T003 | T004
After T005:  T006 | T007 | T008 | T009 | T011
After T012:  T013 (with T006–T008 done)
```

## Implementation Strategy

- **MVP = Phase 1 – 3 (US1)**. Every field reveals and masks, the button is named and never submits, and
  sign-in still works end to end.
- **US2** adds only tests, so it can merge with US1.
- **US3** is one effect. Ship it in the same pull request: SC-003 is a stated outcome, and without it a
  revealed password would reach the password manager as plain text.

Commit per phase. For example:

- `feat(ui): vendor the shadcn input group`
- `feat(forms): reveal and hide passwords`
- `test(forms): keyboard access to the password toggle`
- `feat(forms): mask passwords on submit`
