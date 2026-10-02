import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import uk from "../messages/uk.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./locales";

// Gate 2 of catalog completeness. Types (Gate 1) only know the English
// catalog, so a key missing from another locale is invisible to them — this is
// what catches it (FR-020, FR-021, MC-005).
const CATALOGS: Record<Locale, unknown> = { en, uk };

type Entry = { path: string; empty: boolean };

function entries(value: unknown, prefix = ""): Entry[] {
  if (typeof value !== "object" || value === null) {
    return [
      { path: prefix, empty: typeof value === "string" && value.trim() === "" },
    ];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => entries(child, prefix ? `${prefix}.${key}` : key),
  );
}

const DATE_ARGUMENT = /\{\s*\w+\s*,\s*(date|time)\b/;

/** Key paths whose message formats a date or time with ICU. */
function dateArguments(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    return DATE_ARGUMENT.test(value) ? [prefix] : [];
  }
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => dateArguments(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogs", () => {
  it("ships a catalog for every supported locale", () => {
    // A locale added to the constant without its catalog fails here rather
    // than at runtime for a customer (FR-003).
    for (const locale of SUPPORTED_LOCALES) {
      expect(CATALOGS[locale], `no catalog for "${locale}"`).toBeDefined();
    }
  });

  it("holds the same keys in every locale, with nothing left blank", () => {
    const reference = entries(CATALOGS[DEFAULT_LOCALE]);
    const referencePaths = new Set(reference.map((entry) => entry.path));

    // Collect every gap across every locale before failing, so one run tells
    // the whole story instead of one key at a time (FR-021).
    const gaps: string[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      const found = entries(CATALOGS[locale]);
      const paths = new Set(found.map((entry) => entry.path));

      for (const path of referencePaths) {
        if (!paths.has(path)) gaps.push(`  ${locale}: ${path} (missing)`);
      }
      for (const path of paths) {
        if (!referencePaths.has(path))
          gaps.push(`  ${locale}: ${path} (not in ${DEFAULT_LOCALE})`);
      }
      for (const entry of found) {
        if (entry.empty) gaps.push(`  ${locale}: ${entry.path} (empty)`);
      }
    }

    expect(
      gaps.join("\n"),
      `Message catalogs are incomplete:\n${gaps.join("\n")}`,
    ).toBe("");
  });

  it("lets each locale use its own plural categories", () => {
    // Ukrainian needs one/few/many where English needs one/other. Comparing
    // key paths rather than ICU internals is what keeps that from reading as
    // a discrepancy (FR-024).
    expect(uk.demo.visits).toContain("few");
    expect(en.demo.visits).not.toContain("few");
  });

  it("formats no date or time itself, leaving that to useFormatInstant (spec 004, FR-015)", () => {
    // An ICU date argument formats in the provider's zone, unlabelled, where no lint rule can see it.
    expect(dateArguments({ a: { b: "On {when, date, short}" } })).toEqual([
      "a.b",
    ]);

    for (const locale of SUPPORTED_LOCALES) {
      expect(
        dateArguments(CATALOGS[locale]),
        `${locale}: format these through useFormatInstant instead`,
      ).toEqual([]);
    }
  });
});
