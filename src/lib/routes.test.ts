import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { API_ROUTES, AUTH_BASE_PATH, PAGES, pathTo } from "@/lib/routes";

const APP = join(process.cwd(), "src/app");

// Renders not-found for every unmatched address; nothing links to it.
const NOT_FOUND_FALLBACK = "/[...rest]";

function foldersWith(file: string, dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return foldersWith(file, path);
    return entry.name === file ? [dir] : [];
  });
}

function patternOf(dir: string, root: string): string {
  const segments = relative(root, dir)
    .split(sep)
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`;
}

const pagePatterns = foldersWith("page.tsx", join(APP, "[locale]"))
  .map((dir) => patternOf(dir, join(APP, "[locale]")))
  .filter((pattern) => pattern !== NOT_FOUND_FALLBACK);

const handlerPatterns = foldersWith("route.ts", join(APP, "api")).map(
  (dir) => `/api${patternOf(dir, join(APP, "api"))}`,
);

const catchAllBase = (pattern: string) =>
  /\/\[\.\.\.[^\]]+\]$/.test(pattern)
    ? pattern.slice(0, pattern.lastIndexOf("/"))
    : null;

function servedBy(entry: string, handler: string): boolean {
  if (entry === handler) return true;
  const base = catchAllBase(handler);
  return base !== null && entry.startsWith(`${base}/`);
}

describe("PAGES", () => {
  it("names every page under src/app, and nothing else", () => {
    expect([...Object.values(PAGES)].sort()).toEqual(pagePatterns.sort());
  });
});

describe("API_ROUTES", () => {
  it("names only addresses a route handler serves", () => {
    const unserved = Object.values(API_ROUTES).filter(
      (entry) => !handlerPatterns.some((handler) => servedBy(entry, handler)),
    );

    expect(unserved).toEqual([]);
  });

  it("leaves no route handler without an entry", () => {
    const unnamed = handlerPatterns.filter(
      (handler) =>
        !Object.values(API_ROUTES).some((entry) => servedBy(entry, handler)),
    );

    expect(unnamed).toEqual([]);
  });

  it("puts the Auth.js base path where its catch-all handler lives", () => {
    expect(handlerPatterns.map(catchAllBase)).toContain(AUTH_BASE_PATH);
  });
});

describe("pathTo", () => {
  it("fills each segment parameter", () => {
    expect(pathTo(API_ROUTES.userInvite, { id: "u-1" })).toBe(
      "/api/users/u-1/invite",
    );
  });

  it("encodes a value so it stays one segment", () => {
    expect(pathTo(PAGES.invite, { token: "a/b?c" })).toBe("/invite/a%2Fb%3Fc");
  });
});
