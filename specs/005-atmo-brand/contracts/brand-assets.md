# Asset Contract: Replacing the "atmo AI" Logo

**Feature**: [spec.md](../spec.md) FR-017 – FR-020 | **Research**: R6, R7

A designer's logo replaces `src/components/brand-logo/atmo-ai-logo.svg` and nothing else. Every
placement picks it up, including its theme behaviour, provided the file follows the four rules below.

## Rules

1. **The file is an SVG whose root element carries `id="logo"`.** The product draws it with
   `<use href="…atmo-ai-logo.svg#logo">`, and a root without the id draws nothing.
2. **The root declares its size**: `width`, `height` and a matching `viewBox` in the same units. The
   product reads the width and height from the file to set the aspect ratio, so any aspect ratio works.
3. **Colours come from the theme, not from the file.** Use exactly these three:

   | Part                    | Write                                           | Renders as                         |
   | ----------------------- | ----------------------------------------------- | ---------------------------------- |
   | "atmo" wordmark         | `style="fill: var(--brand-mark, #C02444)"`      | brand red in both themes           |
   | pill (fill and stroke)  | `fill="currentColor"` / `stroke="currentColor"` | dark in light theme, light in dark |
   | letters inside the pill | `style="fill: var(--background, #FFFFFF)"`      | light in light theme, dark in dark |

   The literal after the comma is only a fallback for viewing the file on its own. Any other literal
   colour in the file does not follow the theme.

4. **Self-contained.** No external references, scripts, fonts or `<style>` blocks. Text is drawn as
   paths. Internal `id`s, such as masks and clip paths, may stay; keep them unique.

## Checking a replacement

1. Replace the file and run `npm run dev`.
2. Open `/en/sign-in` in the light and the dark theme, then sign in and look at the header. Check the
   rules above against what you see.
3. `git status` shows exactly one changed file.
