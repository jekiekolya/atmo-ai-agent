# Quickstart: Validating the Landing Page

## Prerequisites

- The local database and `.env` from the README. This feature adds no configuration.
- `npm install`. This feature adds no dependency.

## 1. Automated gates

```bash
npm run typecheck   # a leftover home.* key or a wrong landing.* key fails here
npm run lint
npm run test:run    # catalogs, contrast pairs, brand-red allow-list, landing and AppShell components
npm run e2e -- smoke landing brand locale-switching locale-resolution theme-switching
```

| Check                                                           | Where                                             | Spec                   |
| --------------------------------------------------------------- | ------------------------------------------------- | ---------------------- |
| `/en` and `/uk` load with no console errors                     | `e2e/smoke.spec.ts`                               | SC-008                 |
| Both Sign in actions: anonymous → sign-in form                  | `e2e/landing.spec.ts`                             | US2-1, SC-002          |
| Both Sign in actions: signed in → dashboard                     | `e2e/landing.spec.ts`                             | US2-2, SC-002          |
| Signed-in visitor stays on `/en`, same headline                 | `e2e/landing.spec.ts`                             | US2-3, FR-019          |
| Reduced motion: zero animations, answer shown, indicator hidden | `e2e/landing.spec.ts`                             | US3-3, FR-016, SC-007  |
| Normal motion: every animation finished by 3.5s, indicator gone | `e2e/landing.spec.ts`                             | US3-1, FR-015, SC-007  |
| Theme change after the sequence restarts nothing                | `e2e/landing.spec.ts`                             | US3-2, FR-017          |
| Sign in → Back (in-product) replays the sequence                | `e2e/landing.spec.ts`                             | FR-015                 |
| Not-found back-home link reaches the landing page               | `e2e/landing.spec.ts`                             | FR-021                 |
| Light/dark/system behaviour on `/en`                            | `e2e/theme-switching.spec.ts` (unchanged)         | FR-024                 |
| 320px: no horizontal scroll, en and uk                          | `e2e/landing.spec.ts`                             | FR-028, SC-006         |
| Sign-in and invite logos lead to `/{locale}`                    | `e2e/brand.spec.ts` (non-link assertion replaced) | US4, FR-022, SC-003    |
| Language switch keeps the landing page                          | `e2e/locale-switching.spec.ts` (new headline)     | FR-030                 |
| Figure named, no focusable content, indicator hidden from AT    | `example-conversation.test.tsx`                   | FR-013, FR-014         |
| Brand red only in the allowed files                             | `src/conventions/brand-mark-usage.test.ts`        | FR-026, FR-027         |
| Glow and icon contrast pairs, glow ≤ /10                        | `src/conventions/theme-contrast.test.ts`          | FR-024, FR-026, SC-005 |
| en/uk parity, no "Atmo" alone, title leaves name to template    | `src/i18n/catalogs.test.ts` (unchanged)           | FR-029, SC-009         |

## 2. Static rendering

```bash
npm run build
```

Expected: the route table marks `/[locale]` as prerendered (SSG), with `/en` and `/uk` listed. A dynamic
marker on that route means the page or a component started reading request data (FR-019, MC-003).

## 3. By hand

Run `npm run build && npm start`, then open `http://localhost:3000/en`.

1. **Content** (FR-003, FR-004): read the page in English and in Ukrainian against the spec's lists.
   Check that the browser tab reads "AI support for your solar system — Atmo AI", and the Ukrainian
   equivalent.
2. **Themes** (FR-024): switch to dark and back.
   - Check that the glow is faint and the headline crisp.
   - Check that the icons are red on the card in both themes.
   - Check that no button, link, or focus ring is red.
   - Check that the sequence does not replay.
3. **Phone width** (FR-028): in DevTools, set 320×640 and check both languages.
   - Check that the header wraps rather than overflows.
   - Check that the conversation sits under the call to action.
   - Check that the cards stack.
4. **Reduced motion** (FR-016): in DevTools Rendering, emulate `prefers-reduced-motion: reduce` and
   reload. Check that the finished conversation is there at once and nothing moves.
5. **No scripts** (FR-018): disable JavaScript and reload. Check that the sequence still plays once and
   ends complete.
   - **Back-forward cache** (FR-015): with scripts back on, type another site's address in the tab, then
     press Back. The landing page shows the finished conversation with no replay. This is the accepted
     limit.
6. **Screen reader** (FR-014): use VoiceOver in Safari.
   - Check that the conversation is one figure named "Example conversation", read as
     "Customer, …" and "Atmo AI, …".
   - Check that nothing about typing is read.
   - Check that nothing is announced while the sequence plays.
7. **Logo links** (FR-022): on `/uk/sign-in`, tab to the logo, check the focus outline, press Enter, and
   check that you land on `/uk`. Repeat on an invite link. Check that the sign-in and invite headers still
   show no logo.
8. **Signed in** (FR-019, FR-020): sign in, open `/en`, and check that it is the same page. Press Sign in
   and check that you reach the dashboard in one step.
