# UI Contract: `PasswordInput`

`src/components/form-kit/password-input/password-input.tsx` (client component)

## Props

`Omit<React.ComponentProps<"input">, "type" | "ref">`, passed through to the input. The component owns
`type`. A caller passes `autoComplete` (`current-password` or `new-password`), `onChange`, and
`disabled`, as it does for `Input` today.

## Renders

```
InputGroup                                     role="group"
├── InputGroupInput                            type=password|text, [&::-ms-reveal]:hidden, …props
└── InputGroupAddon align="inline-end"
    └── InputGroupButton size="icon-xs"        type="button", aria-label=show|hide, disabled=props.disabled
        └── Eye | EyeOff                        aria-hidden (lucide default)
```

It goes inside a `Field` wherever `<Input type="password">` sits today. `FieldLabel`, `FieldDescription`,
and `FieldError` keep working through Base UI's field context.

## Guarantees

| #   | Guarantee                                                                                                                | Spec                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | Starts masked on every mount.                                                                                            | FR-004                 |
| 2   | The button toggles only its own input, between `password` and `text`.                                                    | FR-003                 |
| 3   | The value, `autoComplete`, and validity never change.                                                                    | FR-006                 |
| 4   | A `submit` on the input's form masks it before any other submit handler runs.                                            | FR-005                 |
| 5   | The button is in the Tab order directly after the input, never submits, and is named by its action in the page's locale. | FR-009, FR-010, FR-014 |
| 6   | `disabled` disables both the input and the button.                                                                       | FR-011                 |
| 7   | The button is 24 × 24 CSS pixels; the icon is decorative.                                                                | FR-012, FR-007         |
| 8   | Edge's own reveal button is hidden.                                                                                      | FR-008                 |

## Call sites

| File                                                    | Replaces                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `account/sign-in-form/sign-in-form.tsx`                 | `<Input type="password" autoComplete="current-password" />`    |
| `account/change-password-form/change-password-form.tsx` | `<Input type="password" autoComplete="current-password" />`    |
| `account/new-password-fields/new-password-fields.tsx`   | both `<Input type="password" autoComplete="new-password" … />` |

Set password from an invitation and change password reach the new-password pair through
`NewPasswordFields`.
