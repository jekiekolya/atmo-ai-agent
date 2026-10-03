import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Spec 005, FR-006 / FR-007 / FR-043: every colour pair the interface renders, in both themes.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

type Rgb = [number, number, number];
type Theme = Record<string, string>;

function block(selector: string): Theme {
  const body = css.match(
    new RegExp(`^${selector}\\s*\\{([\\s\\S]*?)^\\}`, "m"),
  );
  if (!body) throw new Error(`No ${selector} block in globals.css`);
  return Object.fromEntries(
    [...body[1].matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(
      ([, name, value]) => [name, value.trim()],
    ),
  );
}

const THEMES = { light: block(":root"), dark: block("\\.dark") };

function rgb(theme: Theme, token: string): Rgb {
  const value = theme[token];
  const hex = value?.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) throw new Error(`--${token} is "${value}", not a six-digit hex`);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
}

function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((channel, i) => channel * alpha + bg[i] * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** "token", "token/NN", or "token/NN over base" — a translucent layer is composited first. */
function resolve(theme: Theme, colour: string, base?: string): Rgb {
  const [token, percent] = colour.split("/");
  const solid = rgb(theme, token);
  if (percent === undefined) return solid;
  if (!base) throw new Error(`${colour} needs a surface to sit on`);
  return over(solid, Number(percent) / 100, rgb(theme, base));
}

type Pair = { fg: string; surface: string; over?: string; min: number };

const TEXT = 4.5;
const GRAPHIC = 3;

// data-model.md § Contrast pairs. Excluded: muted-foreground on solid muted (4.39:1 light) —
// only the badge's link/ghost hover and the table's selected row draw it, and nothing renders them.
const PAIRS: Pair[] = [
  { fg: "foreground", surface: "background", min: TEXT },
  { fg: "card-foreground", surface: "card", min: TEXT },
  { fg: "popover-foreground", surface: "popover", min: TEXT },
  { fg: "primary-foreground", surface: "primary", min: TEXT },
  {
    fg: "primary-foreground",
    surface: "primary/80",
    over: "background",
    min: TEXT,
  },
  { fg: "secondary-foreground", surface: "secondary", min: TEXT },
  { fg: "accent-foreground", surface: "accent", min: TEXT },
  { fg: "foreground", surface: "muted", min: TEXT },
  ...["background", "card", "popover"].flatMap((surface) => [
    { fg: "muted-foreground", surface, min: TEXT },
    { fg: "muted-foreground", surface: "muted/50", over: surface, min: TEXT },
    { fg: "destructive", surface, min: TEXT },
    { fg: "destructive", surface: "destructive/10", over: surface, min: TEXT },
    { fg: "destructive", surface: "destructive/15", over: surface, min: TEXT },
    { fg: "ring", surface, min: GRAPHIC },
  ]),
  { fg: "destructive/90", surface: "card", min: TEXT },
  { fg: "brand-mark", surface: "background", min: GRAPHIC },
];

function label({ fg, surface, over: base, min }: Pair) {
  return `${fg} on ${surface}${base ? ` over ${base}` : ""} ≥ ${min}`;
}

describe.each(Object.entries(THEMES))("%s theme", (_, theme) => {
  it.each(PAIRS.map((pair) => [label(pair), pair] as const))(
    "%s",
    (_, pair) => {
      const base = pair.over ?? pair.surface;
      const surface = resolve(theme, pair.surface, base);
      // A translucent foreground (destructive/90) is drawn on the surface itself.
      const fg = resolve(theme, pair.fg, pair.surface);

      expect(contrast(fg, surface)).toBeGreaterThanOrEqual(pair.min);
    },
  );
});

describe("theme blocks", () => {
  it("define the same tokens in light and dark, apart from the shared radius", () => {
    const light = Object.keys(THEMES.light).filter(
      (token) => token !== "radius",
    );
    expect(light.sort()).toEqual(Object.keys(THEMES.dark).sort());
  });
});

// data-model.md § Destructive tints: the /10 and /15 pairs above hold only if these are what ships.
describe.each(["button", "badge", "dropdown-menu"])("ui/%s.tsx", (name) => {
  it("draws no destructive tint behind text stronger than /15", () => {
    const source = readFileSync(
      join(process.cwd(), `src/components/ui/${name}.tsx`),
      "utf8",
    );
    const tooStrong = [...source.matchAll(/[^\s"'`]*bg-destructive\/(\d+)/g)]
      .filter(([, percent]) => Number(percent) > 15)
      .map(([cls]) => cls);

    expect(tooStrong).toEqual([]);
  });
});
