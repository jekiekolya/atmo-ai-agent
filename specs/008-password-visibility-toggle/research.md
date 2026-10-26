# Research: Password Visibility Toggle

Every library behaviour below was checked in this repository's `node_modules` or against the shadcn
registry the CLI resolves, on 2026-10-26.

## R1 — Composition: shadcn input group

**Decision**: Pull `input-group` through the shadcn CLI and build the field from `InputGroup`,
`InputGroupInput`, `InputGroupAddon align="inline-end"`, and `InputGroupButton size="icon-xs"`.

**Rationale**: It is shadcn's documented pattern for a button inside an input, and it already does what
a hand-made overlay would have to repeat:

- the group draws the field's border, focus ring, and invalid state, so the input and the button read as
  one control;
- the input is a flex item, so typed text stops at the button instead of running underneath it (FR-002);
- `InputGroupButton` defaults to `type="button"`, so pressing it never submits the form (FR-009);
- `icon-xs` is `size-6`, 24 × 24 CSS pixels (FR-012).

`InputGroupInput` renders our `Input`, which renders Base UI's `Input`, so the `Field` label,
description, error, and `aria-invalid` keep working unchanged.

**Alternatives considered**: An `Input` with right padding and an absolutely positioned `Button`. Fewer
files, but the input keeps its own focus ring with a button floating over it, and the padding must track
the button's size by hand. Principle II asks for the existing primitive.

## R2 — The registry now imports `cn` from an npm package

**Finding**: The `base-nova` registry items (`input-group`, `input`, `button`, `textarea`) now declare
the npm package `cn` as a dependency and import `{ cn } from "cn"`. `shadcn add input-group --dry-run`
plans to create `input-group.tsx` and `textarea.tsx`, overwrite `button.tsx` and `input.tsx`, and install
`cn`. The overwrites would also drop our local edits to `button.tsx`.

**Decision**:

1. Run `npx shadcn add input-group --yes --overwrite`, then restore `button.tsx` and `input.tsx` with
   `git checkout --`. Without `--overwrite` the CLI prompts for each existing file, and an agent's shell
   cannot answer that prompt.
2. In the two new files, change `import { cn } from "cn"` to `import { cn } from "@/lib/utils"`.
3. `npm uninstall cn` if the CLI installed it, so `package.json` and the lock file are unchanged.

Nothing else in the two files changes.

**Rationale**: `cn` would be a second class-merging utility beside `clsx` and `tailwind-merge`, which
`@/lib/utils` already wraps. Adding it is a runtime dependency the dependency rule asks a reason for, and
this feature has none. Moving every `src/components/ui` file to the package is a separate chore if the
team wants it.

**Alternatives considered**: Accepting the CLI's output as is. That adds a dependency, rewrites two
primitives this feature does not need changed, and loses local edits to `button.tsx`.

## R3 — Masking on submit

**Decision**: The component holds `visible` in state. An effect adds a native `submit` listener to the
input's own form (`input.form`). The listener calls `flushSync(() => setVisible(false))`.

**Rationale**:

- Base UI's `Form` (`node_modules/@base-ui/react/form/Form.js`) renders with `noValidate` and runs its
  checks inside its own `onSubmit`. The native `submit` event therefore fires on every attempt, including
  one those checks stop. That is the clarified behaviour (spec, Clarifications 2026-10-26).
- The listener sits on the form element. React's handlers sit on the root container, so the listener
  runs before Base UI's `onSubmit` and before `onFormSubmit` starts the request.
- `flushSync` commits `type="password"` to the DOM inside the listener. Without it React would apply the
  update after the event, and the request would already have started (FR-005, SC-003).
- The component masks itself, so no form changes.

**Alternatives considered**:

- Masking from each form's `onFormSubmit`. Three forms would need to signal their fields, and it misses
  attempts the checks stop.
- A `setTimeout` or a plain `setState`. The DOM changes only after the request starts.

## R4 — Accessible name and icon

**Decision**: The button's `aria-label` is `t("show")` while masked and `t("hide")` while revealed. It
carries no `aria-pressed`. The icon is lucide's `Eye` while masked and `EyeOff` while revealed.

**Rationale**:

- A name that changes with the state already tells the user what the button will do (FR-010).
  Adding `aria-pressed` would make a screen reader read "Hide password, toggle button, pressed": the
  state twice, with opposite wording.
- lucide 1.31 (`Icon.mjs`) adds `aria-hidden="true"` to an icon that has no accessibility props, so the
  icon stays decorative with no extra code (FR-007).

## R5 — Edge's built-in reveal button

**Decision**: Add `[&::-ms-reveal]:hidden` to the input's classes.

**Rationale**: Chromium-based Edge still draws its own reveal button in `type="password"` fields and
still honours `::-ms-reveal`. Other browsers ignore the selector. One utility on the input meets FR-008
and needs no script and no global rule. Playwright runs Chromium only, so Edge is checked by hand
(quickstart §3).

## R6 — Disabled state

**Decision**: The component reads `disabled` from its own props and passes it to both the input and the
button.

**Rationale**: Base UI exposes a `Field`'s disabled state to its control, but not through a public hook.
Every password field today is enabled. A prop that a caller disables covers FR-011 without depending on
internals. A `Field` disabled at its root would not reach the button, and no field does that.

## R7 — Contrast

**Finding**: `InputGroupAddon` sets `text-muted-foreground`, and the ghost button inherits it.

| Where the icon sits                | Theme | Ratio  |
| ---------------------------------- | ----- | ------ |
| card, input background transparent | light | 4.83:1 |
| `input/30` over card               | dark  | 6.10:1 |
| `input/30` over background         | dark  | 6.97:1 |

The light-theme surfaces are already in `theme-contrast.test.ts` at 4.5:1. The dark input tint is not,
so one pair joins the test's per-surface list: `muted-foreground` on `input/30` over each surface, at
least 3:1 (FR-013). The focus ring is the Button primitive's own, which the existing `ring` pairs cover.

## R8 — Tests that find fields by label

**Finding**: Playwright's `getByLabel` matches a substring by default, and it reads an `aria-label` as a
label.

- `e2e/support/sign-in.ts` fills `getByLabel("Password")` / `getByLabel("Пароль")`. Each would now also
  match "Show password" / "Показати пароль", and Playwright's strict mode fails on two matches. The
  helper adds `{ exact: true }`.
- The other e2e labels ("Current password", "New password", "Repeat the password", "Новий пароль",
  "Повторіть пароль") are not substrings of either button name, so they stay as they are.
- Vitest's `getByLabelText` matches exact strings by default, and the mocked translator returns key
  paths. No component test changes.

## R9 — Where the component and its copy live

**Decision**:

- The component goes in `src/components/form-kit/password-input/`. It is a control every form with a
  password shares, like `submit-button`, not account-domain logic.
- The copy goes under a top-level `passwordInput` namespace with keys `show` and `hide`. Other shared
  controls follow the same pattern: `dialog.close`, `theme.label`, `switcher.label`.
