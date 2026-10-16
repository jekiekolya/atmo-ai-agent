import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src/app/[locale]");

const CONVERSATION = "(private)/dashboard/chat/[id]";

function pageFolders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageFolders(path);
    return entry.name === "page.tsx" ? [dir] : [];
  });
}

// Spec 005: Next 16 shows a loading state only for a segment with its own loading.tsx (research R11).
describe("loading boundaries", () => {
  it("give every signed-in page but a conversation its own, so each navigation shows the loader (FR-030)", () => {
    const missing = pageFolders(join(APP, "(private)"))
      .filter((dir) => dir !== join(APP, CONVERSATION))
      .filter((dir) => !existsSync(join(dir, "loading.tsx")))
      .map((dir) => relative(process.cwd(), dir));

    expect(missing).toEqual([]);
  });

  // Spec 006, FR-004: a loading.tsx above the conversation's ownership check would turn its 404 into a 200 (R7).
  it("never sit above a check that can redirect or answer not found (FR-036, FR-038; spec 006, FR-004)", () => {
    const above = [
      "",
      "(private)",
      "(public)",
      "(public)/sign-in",
      "(private)/dashboard",
      "(private)/dashboard/chat",
    ]
      .map((dir) => join(APP, dir, "loading.tsx"))
      .filter((path) => existsSync(path))
      .map((path) => relative(process.cwd(), path));

    expect(above).toEqual([]);
  });

  it("leave a conversation without one, so its page takes over from the new chat with no blank (spec 006, FR-007)", () => {
    expect(existsSync(join(APP, CONVERSATION, "loading.tsx"))).toBe(false);
  });
});
