# Quickstart: Password Visibility Toggle

## 1. Automated

```bash
npm run typecheck && npm run lint
npm run test:run     # password-input, the three form tests, catalogs, theme-contrast
npm run e2e          # auth (incl. reveal-then-sign-in), invite, users, session — all use the sign-in helper
```

Expected: all green. `package.json` and `package-lock.json` are unchanged (R2).

## 2. In the app (`npm run dev`)

For `/en/sign-in`, `/en/dashboard/account`, and an invitation link:

1. Type a password → it is masked; the button shows an eye.
2. Press the eye → the text is readable, the icon is a crossed-out eye; the other password field on the
   form is still masked.
3. Tab from the field → focus lands on the button with a visible ring; Enter and Space toggle it; the form
   is not sent.
4. Reveal, then submit an invalid form (short password, or mismatched confirmation) → every field is
   masked and the errors show.
5. Reveal, then sign in with a wrong password → the field comes back empty and masked.
6. Repeat 1–3 in `/uk/...`, in the dark theme, and at 320 px wide; the long password text stops before the
   button.

## 3. By hand, outside Chromium

- **Microsoft Edge**: each password field shows exactly one eye (FR-008, SC-004).
- **Safari** with iCloud Keychain, and Chrome's password manager: after revealing and signing in, the
  browser still offers to save the password, and on the next visit it fills the field (FR-006).
- **VoiceOver**: the button is announced as "Show password, button", and as "Hide password, button"
  after it is pressed. In `uk` it is announced as "Показати пароль" / "Сховати пароль".
