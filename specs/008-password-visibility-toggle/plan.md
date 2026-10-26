# Implementation Plan: Password Visibility Toggle

**Branch**: `008-password-visibility-toggle` | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-password-visibility-toggle/spec.md`

## Summary

One new client component, `PasswordInput`, in `src/components/form-kit/password-input/`. It replaces
the four `<Input type="password">` call sites. Those sit in the sign-in form, the change-password form,
and `NewPasswordFields`; set password from an invitation reaches the component through
`NewPasswordFields`.

- **Composition**: built from shadcn's `input-group`, pulled through the CLI (R1). The registry's new
  `cn` npm import is replaced with `@/lib/utils`, and `button.tsx` / `input.tsx` are not overwritten (R2).
- **State**: `visible` lives in the component. lucide's `Eye` / `EyeOff` show it. The button's
  `aria-label` names the action and comes from `passwordInput.show` / `.hide` (R4).
- **Masking on submit**: a native `submit` listener on the input's form masks the field with
  `flushSync` before any form handler runs, on every attempt (R3).
- **Edge's own reveal button**: hidden with `[&::-ms-reveal]:hidden` (R5).
- **Tests**: one contrast pair added (R7), and the e2e sign-in helper gets `exact: true` labels (R8).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node 24

**Primary Dependencies**: All already present. React 19.2.8 (`flushSync`), Base UI 1.7 (`Form`,
`Field`, `Input`), lucide-react 1.31, next-intl 4.13.7, shadcn CLI 4.18 (`input-group`). No runtime
dependency is added (R2).

**Storage**: N/A.

**Testing**: Vitest `ui` for `password-input` and the three form tests, which stay unchanged. Vitest
`unit` for the catalogs and `theme-contrast`. Playwright for `auth.spec.ts` (one new test) and the
`sign-in.ts` helper.

**Target Platform**: Evergreen browsers. Chromium is automated; Edge, Safari, password managers, and
VoiceOver are checked by hand (quickstart §3).

**Project Type**: Next.js App Router web application, single project.

**Performance Goals**: N/A. A local state toggle.

**Constraints**:

- WCAG 2.2 AA: 24 px target, 3:1 icon contrast, a name that states the action.
- No new dependency.
- en/uk parity.

**Scale/Scope**: About 14 files.

- Shared component: 1 new component and its test, plus 2 vendored primitives.
- Forms and copy: 3 forms and 2 catalogs.
- Tests: 1 convention test and 2 e2e files.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | How                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Type-Safe by Default**        | PASS   | Props are `Omit<ComponentProps<"input">, "type" \| "ref">`. No `any`, no suppression.                                                                                                                                                                                                                                                                   |
| **II. Simple, Modular, Readable**  | PASS   | One component used in four places, composed from the documented shadcn primitive. No change to any form's logic. The submit listener lives in the component, so no form has to coordinate with it (R3).                                                                                                                                                 |
| **III. Spec-First Delivery**       | PASS   | Spec 008 is clarified in one session. No earlier FR is superseded.                                                                                                                                                                                                                                                                                      |
| **IV. Tested Business Logic**      | PASS   | No domain, config, agent, or validation module is touched. The component is test-together (table below).                                                                                                                                                                                                                                                |
| **V. Centralized Config**          | PASS   | No configuration.                                                                                                                                                                                                                                                                                                                                       |
| **VI. Accountable AI Agents**      | N/A    | No agent code.                                                                                                                                                                                                                                                                                                                                          |
| **VII. Localized by Default**      | PASS   | `passwordInput.show` / `.hide` are added in en and uk under the catalog parity test.                                                                                                                                                                                                                                                                    |
| **VIII. Addresses Have One Owner** | N/A    | No address is added or used.                                                                                                                                                                                                                                                                                                                            |
| **Technology Constraints**         | PASS   | `input-group` comes through the shadcn CLI, so it is exempt from the dependency rule. Its `cn` npm dependency is declined, which keeps the dependency rule (R2). Colours are theme tokens only. Every library behaviour relied on was checked in `node_modules`: Base UI `Form`'s `noValidate`, lucide's `aria-hidden`, and the registry items (R1–R4). |

One adaptation of a documented example, as CLAUDE.md asks: the CLI's two new files import `cn` from
`@/lib/utils` instead of the `cn` package. A rule forces it (no unjustified runtime dependency), and
nothing else in the files changes.

Post-design re-check: unchanged, all PASS.

### Test regime per module (Principle IV)

| Module                                                        | Regime        | Covered by                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-kit/password-input/` (new)                              | Test-together | `password-input.test.tsx`: masked on mount; the button reveals and masks, and its name and icon follow; two instances are independent; the value is kept; `disabled` reaches the button; pressing the button does not submit; a form `submit` masks a revealed field, including when the form's own submit handler blocks the submission |
| `ui/input-group.tsx`, `ui/textarea.tsx` (vendored)            | —             | Owned code taken unchanged except the `cn` import; exercised through `password-input`                                                                                                                                                                                                                                                    |
| `sign-in-form`, `change-password-form`, `new-password-fields` | Test-together | Existing tests stay green unchanged; they find fields by exact label (R8)                                                                                                                                                                                                                                                                |
| Catalogs                                                      | Test-together | Existing `catalogs.test.ts` parity                                                                                                                                                                                                                                                                                                       |
| Icon contrast (FR-013)                                        | Test-together | `theme-contrast.test.ts`: `muted-foreground` on `input/30` over each surface ≥ 3:1                                                                                                                                                                                                                                                       |
| Sign-in flow                                                  | Test-together | `e2e/auth.spec.ts`: reveal the password, see the text, sign in, reach the protected home. `e2e/support/sign-in.ts`: exact labels                                                                                                                                                                                                         |

## Project Structure

### Documentation (this feature)

```text
specs/008-password-visibility-toggle/
├── plan.md                 # this file
├── research.md             # R1–R9
├── data-model.md           # field state, catalog keys, contrast pair
├── quickstart.md           # automated, in-app, and by-hand validation
├── contracts/ui.md         # PasswordInput props, structure, guarantees, call sites
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
src/components/
├── ui/input-group.tsx                          # NEW via shadcn CLI; cn import → @/lib/utils
├── ui/textarea.tsx                             # NEW via shadcn CLI (input-group's dependency); same import fix
├── form-kit/password-input/                    # NEW
│   ├── password-input.tsx
│   └── password-input.test.tsx
└── account/
    ├── sign-in-form/sign-in-form.tsx           # Input type=password → PasswordInput
    ├── change-password-form/change-password-form.tsx  # same
    └── new-password-fields/new-password-fields.tsx    # same, both fields

src/messages/en.json, uk.json                   # + passwordInput.show / .hide
src/conventions/theme-contrast.test.ts          # + muted-foreground on input/30 pair

e2e/support/sign-in.ts                          # getByLabel(..., { exact: true })
e2e/auth.spec.ts                                # + reveal-then-sign-in test
```

**Structure Decision**: The component sits in `form-kit/` beside `submit-button`, because it is a control
every password form shares, not account-domain logic (R9). It has its own folder with a colocated test,
as CLAUDE.md prescribes. The vendored primitives stay flat in `ui/`.

## Complexity Tracking

No violations to justify.

## Phase Status

- [x] Phase 0: research.md, with no NEEDS CLARIFICATION left
- [x] Phase 1: data-model.md, contracts/ui.md, quickstart.md
- [x] Phase 2: tasks.md (`/speckit-tasks`)
