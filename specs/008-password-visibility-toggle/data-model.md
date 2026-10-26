# Data Model: Password Visibility Toggle

No stored data and no migration. The feature has one piece of UI state and two catalog entries.

## Field state

Each `PasswordInput` has its own `visible: boolean`. Nothing shares it, and nothing persists it.

| From    | Event                                             | To                                                 |
| ------- | ------------------------------------------------- | -------------------------------------------------- |
| —       | mount, including a remount after a failed attempt | `false` (FR-004)                                   |
| `false` | button pressed                                    | `true`                                             |
| `true`  | button pressed                                    | `false`                                            |
| `true`  | the input's form fires `submit`                   | `false`, committed before the request (FR-005, R3) |

| `visible` | input `type` | icon     | button name          |
| --------- | ------------ | -------- | -------------------- |
| `false`   | `password`   | `Eye`    | `passwordInput.show` |
| `true`    | `text`       | `EyeOff` | `passwordInput.hide` |

The input's value, `autoComplete`, and `Field` validity never change with the state (FR-006).

## Catalog keys

| Key                  | en            | uk              |
| -------------------- | ------------- | --------------- |
| `passwordInput.show` | Show password | Показати пароль |
| `passwordInput.hide` | Hide password | Сховати пароль  |

## Contrast pair

Added to `src/conventions/theme-contrast.test.ts`, for each of `background`, `card`, and `popover`:
`muted-foreground` on `input/30` over that surface, at least 3:1. See R7.
