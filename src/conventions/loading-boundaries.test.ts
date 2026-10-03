import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src/app/[locale]");

function pageFolders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageFolders(path);
    return entry.name === "page.tsx" ? [dir] : [];
  });
}

// Spec 005: Next 16 shows a loading state only for a segment with its own loading.tsx (research R11).
describe("loading boundaries", () => {
  it("give every signed-in page its own, so each navigation shows the loader (FR-030)", () => {
    const missing = pageFolders(join(APP, "(private)"))
      .filter((dir) => !existsSync(join(dir, "loading.tsx")))
      .map((dir) => relative(process.cwd(), dir));

    expect(missing).toEqual([]);
  });

  it("never sit above a check that can redirect (FR-036, FR-038)", () => {
    const above = ["", "(private)", "(public)", "(public)/sign-in"]
      .map((dir) => join(APP, dir, "loading.tsx"))
      .filter((path) => existsSync(path))
      .map((path) => relative(process.cwd(), path));

    expect(above).toEqual([]);
  });
});
