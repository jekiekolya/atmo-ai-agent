import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALE_LABELS, SUPPORTED_LOCALES } from "./locales";

describe("supported locales", () => {
  it("offers exactly the locales this feature supports", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "uk"]);
  });

  it("defaults to a locale that is actually supported", () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it("lists every locale once", () => {
    expect(new Set(SUPPORTED_LOCALES).size).toBe(SUPPORTED_LOCALES.length);
  });

  it("labels every locale in that locale's own language", () => {
    // Endonyms, not translations: the switcher shows each language the way its
    // own speakers write it, so the labels never move into a message catalog.
    expect(Object.keys(LOCALE_LABELS).sort()).toEqual(
      [...SUPPORTED_LOCALES].sort(),
    );
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
    }
    expect(LOCALE_LABELS.uk).toBe("Українська");
  });
});
