import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Spec 005, FR-011 / FR-012: brand red belongs to brand marks, never to a control or an error.
const ALLOWED = new Set([
  "src/app/globals.css",
  "src/app/icon.svg",
  "src/components/shell/brand-logo/atmo-ai-logo.svg",
  "src/components/shell/page-loader/page-loader.tsx",
]);

// Spec 007, FR-026 / FR-027: the hero glow and the benefit icons, and nothing else in those files.
const ALLOWED_CLASSES = new Map([
  ["src/components/landing/landing-hero/landing-hero.tsx", /^bg-brand-mark\//],
  [
    "src/components/landing/benefit-cards/benefit-cards.tsx",
    /^text-brand-mark$/,
  ],
]);

const SCANNED = /\.(ts|tsx|css|svg|json)$/;
const BRAND_RED = /brand-mark|#c02444/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SCANNED.test(entry.name) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

describe("brand red", () => {
  it("appears only in the theme and the brand marks", () => {
    const root = process.cwd();
    const offenders = sourceFiles(join(root, "src"))
      .map((path) => relative(root, path))
      .filter((path) => !ALLOWED.has(path) && !ALLOWED_CLASSES.has(path))
      .filter((path) => BRAND_RED.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });

  it.each([...ALLOWED_CLASSES])(
    "appears in %s only as its accent",
    (path, allowed) => {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      const uses = source.match(/[^\s"'`]*(?:brand-mark|#c02444)[^\s"'`]*/gi);

      expect(uses).not.toBeNull();
      expect(uses!.filter((use) => !allowed.test(use))).toEqual([]);
    },
  );
});
