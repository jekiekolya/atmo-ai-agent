# Data Model: Atmo AI Brand Look

No database change. The "data" of this feature is two theme blocks in `src/app/globals.css`, three
brand assets, and a handful of catalog strings.

## Theme values

All values are opaque hex (research R2). Gray names refer to the reference's scale (the Tailwind v3 hex
scale): 50 `#f9fafb`, 100 `#f3f4f6`, 200 `#e5e7eb`, 300 `#d1d5db`, 400 `#9ca3af`, 500 `#6b7280`,
600 `#4b5563`, 700 `#374151`, 800 `#1f2937`, 900 `#111827`, 950 `#030712`.

| Token                          | Light (`:root`)              | Dark (`.dark`)     | Source / note                                |
| ------------------------------ | ---------------------------- | ------------------ | -------------------------------------------- |
| `--background`                 | `#f9fafb` gray-50            | `#030712` gray-950 | FR-001 / FR-002                              |
| `--foreground`                 | `#111827` gray-900           | `#f9fafb` gray-50  | FR-001 / FR-002                              |
| `--card`                       | `#ffffff`                    | `#111827` gray-900 | FR-001 / FR-002                              |
| `--card-foreground`            | `#111827`                    | `#f9fafb`          |                                              |
| `--popover`                    | `#ffffff`                    | `#111827`          | FR-001 / FR-002                              |
| `--popover-foreground`         | `#111827`                    | `#f9fafb`          |                                              |
| `--primary`                    | `#111827`                    | `#f9fafb`          | FR-001 / FR-002                              |
| `--primary-foreground`         | `#ffffff`                    | `#111827`          | reference button text is white               |
| `--secondary`                  | `#f3f4f6` gray-100           | `#1f2937` gray-800 | FR-004                                       |
| `--secondary-foreground`       | `#111827`                    | `#f9fafb`          |                                              |
| `--muted`                      | `#f3f4f6`                    | `#1f2937`          | R2 — kept at gray-100, see excluded pair     |
| `--muted-foreground`           | `#6b7280` gray-500           | `#9ca3af` gray-400 | FR-001                                       |
| `--accent`                     | `#f3f4f6`                    | `#1f2937`          |                                              |
| `--accent-foreground`          | `#111827`                    | `#f9fafb`          |                                              |
| `--destructive`                | `#c10007` red-700            | `#ff6467` red-400  | R3 — light darkened along its hue, dark kept |
| `--border`                     | `#e5e7eb` gray-200           | `#1f2937` gray-800 | FR-001; FR-008 accepted below 3:1            |
| `--input`                      | `#d1d5db` gray-300           | `#374151` gray-700 | FR-001; FR-008                               |
| `--ring`                       | `#6b7280` gray-500           | `#9ca3af` gray-400 | FR-007                                       |
| `--brand-mark`                 | `#c02444`                    | `#c02444`          | FR-010 — logo wordmark and loader only       |
| `--chart-1` … `--chart-5`      | gray 300, 400, 500, 600, 700 | same               | FR-004 — today's neutral ramp, re-expressed  |
| `--sidebar`                    | `#f9fafb`                    | `#111827`          | FR-004 — no sidebar is rendered today        |
| `--sidebar-foreground`         | `#111827`                    | `#f9fafb`          |                                              |
| `--sidebar-primary`            | `#111827`                    | `#f9fafb`          | replaces today's dark-theme blue             |
| `--sidebar-primary-foreground` | `#ffffff`                    | `#111827`          |                                              |
| `--sidebar-accent`             | `#f3f4f6`                    | `#1f2937`          |                                              |
| `--sidebar-accent-foreground`  | `#111827`                    | `#f9fafb`          |                                              |
| `--sidebar-border`             | `#e5e7eb`                    | `#1f2937`          |                                              |
| `--sidebar-ring`               | `#6b7280`                    | `#9ca3af`          |                                              |
| `--radius`                     | `0.5rem`                     | — (shared)         | FR-003                                       |

`@theme inline` gains `--color-brand-mark: var(--brand-mark)` and `--font-sans: var(--font-roboto)`,
and loses `--font-mono` (R5). The base layer's `outline-ring/50` becomes `outline-ring` (R2).

### Destructive tints in primitives (R3)

Every surface drawn behind destructive text is at most `/15` of `--destructive`:

- `button.tsx`, destructive variant: light rest `/10` and hover `/15`; dark rest `/10` and hover `/15`.
- `badge.tsx`, destructive variant: light `/10`; dark `/10`; link hover `/15`.
- `dropdown-menu.tsx`, destructive item: light focus `/10`; dark focus `/15`.

The destructive button's focus border is drawn at full strength, `focus-visible:border-destructive`
instead of `/40`, so it meets FR-007 through the `destructive` pairs below (R2).

## Contrast pairs (asserted by `src/lib/theme-contrast.test.ts`)

Each row is asserted in both themes. A translucent surface (`token/NN`) is composited over the
"over" surface first.

| Foreground             | Surface                                                                 | Minimum | Where it occurs                                                        |
| ---------------------- | ----------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `foreground`           | `background`                                                            | 4.5     | page text                                                              |
| `card-foreground`      | `card`                                                                  | 4.5     | cards                                                                  |
| `popover-foreground`   | `popover`                                                               | 4.5     | dialogs, menus, toasts                                                 |
| `primary-foreground`   | `primary`, `primary/80` over `background`                               | 4.5     | default button, rest and hover; default badge                          |
| `secondary-foreground` | `secondary`                                                             | 4.5     | secondary button and badge                                             |
| `accent-foreground`    | `accent`                                                                | 4.5     | menu and select item focus                                             |
| `foreground`           | `muted` over `background`                                               | 4.5     | ghost / outline button hover                                           |
| `muted-foreground`     | `background`, `card`, `popover`                                         | 4.5     | descriptions, placeholders, captions                                   |
| `muted-foreground`     | `muted/50` over `card`, over `popover`, over `background`               | 4.5     | card/dialog footers, table row hover                                   |
| `destructive`          | `background`, `card`, `popover`                                         | 4.5     | field errors, alert, toast icon; destructive focus border (≥ 3 needed) |
| `destructive/90`       | `card`                                                                  | 4.5     | alert description                                                      |
| `destructive`          | `destructive/10`, `destructive/15` over `card`, `popover`, `background` | 4.5     | destructive button, badge, menu item                                   |
| `ring`                 | `background`, `card`, `popover`                                         | 3.0     | focus indicator (FR-007)                                               |
| `brand-mark`           | `background`                                                            | 3.0     | loader mark (graphic)                                                  |

**Excluded, with reason** (recorded in the test as a comment): `muted-foreground` on solid `muted`
(4.39:1 light). It appears only in the badge's link and ghost hover and the table's selected row,
none of which is rendered today (R2). Whoever first renders one adds the row and fixes the pair.

**Not asserted** (FR-007 – FR-009): `border` and `input` against their surfaces, which follow the
reference below 3:1 by decision; disabled controls; the `accent` highlight of a focused menu or
select item against the popover, which FR-007 leaves as it is (analysis clarification).

### Measured values at plan time

| Pair                                      | Light | Dark |
| ----------------------------------------- | ----- | ---- |
| `muted-foreground` on `background`        | 4.63  | 7.93 |
| `muted-foreground` on `card`              | 4.83  | 6.99 |
| `muted-foreground` on `muted/50` (worst)  | 4.51  | 6.40 |
| `destructive` on `card`                   | 6.12  | 6.13 |
| `destructive` on `destructive/15` (worst) | 4.62  | 4.60 |
| `ring` on `background`                    | 4.63  | 7.93 |
| `brand-mark` on `background`              | 5.62  | 3.43 |

## Brand assets

| Asset                                        | Format                        | Colours                                                                         | Consumers                    |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| `src/components/brand-logo/atmo-ai-logo.svg` | SVG, root `id="logo"`, 154×47 | `var(--brand-mark)`, `currentColor`, `var(--background)` with literal fallbacks | `BrandLogo` via `<use>` (R6) |
| `src/app/icon.svg`                           | SVG 64×64                     | literal `#f3f4f6`, `#111827`, `#c02444`                                         | browser tab (R10)            |
| `src/app/favicon.ico`                        | ICO: 16, 32, 48 px PNG        | rasterized from `icon.svg`                                                      | `/favicon.ico` clients       |
| `src/app/apple-icon.png`                     | PNG 180×180, opaque           | rasterized from `icon.svg` on `#f9fafb`                                         | iOS home screen              |
| Loader mark (inline in `PageLoader`)         | two paths, 64×64              | `currentColor`, `var(--brand-mark)` via `stroke-brand-mark`                     | `PageLoader` (R12)           |

The asset contract for a designer's replacement logo is in
[contracts/brand-assets.md](./contracts/brand-assets.md).

## Catalog changes (`en` / `uk`)

| Key                       | en                                                           | uk                                                                               |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `common.appName`          | Atmo AI                                                      | Atmo AI                                                                          |
| `common.metaTitle`        | Atmo AI — solar support                                      | Atmo AI — підтримка сонячної енергетики                                          |
| `common.titleTemplate`    | %s — Atmo AI _(new)_                                         | %s — Atmo AI _(new)_                                                             |
| `auth.signIn.metaTitle`   | Sign in                                                      | Вхід                                                                             |
| `auth.signIn.description` | Use the email address and password for your Atmo AI account. | Використайте адресу електронної пошти й пароль вашого облікового запису Atmo AI. |
| `dashboard.metaTitle`     | Home                                                         | Головна                                                                          |
| `invite.metaTitle`        | Set your password                                            | Встановіть пароль                                                                |
| `users.metaTitle`         | Users                                                        | Користувачі                                                                      |
| `account.metaTitle`       | Account                                                      | Обліковий запис                                                                  |
| `loader.label`            | Loading… _(new)_                                             | Завантаження… _(new)_                                                            |

The logo's accessible name reuses `common.appName`, so it needs no new key.
