import { describe, expect, it, vi } from "vitest";

// The module reads the `[locale]` root parameter. Stubbed so the fallback
// rules can be exercised without a running server.
const rootLocale = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock("next/root-params", () => ({
  locale: () => Promise.resolve(rootLocale.value),
}));

vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}));

import { DEFAULT_LOCALE } from "./locales";
import getRequestConfig from "./request";

function resolve(requested: string | undefined) {
  rootLocale.value = requested;
  return (
    getRequestConfig as unknown as () => Promise<{
      locale: string;
      messages: Record<string, unknown>;
    }>
  )();
}

describe("request config", () => {
  it("serves a supported locale its own catalog", async () => {
    const { locale, messages } = await resolve("uk");

    expect(locale).toBe("uk");
    expect((messages.switcher as { label: string }).label).toBe("Мова");
  });

  it("falls back to the default when the segment names an unsupported locale", async () => {
    // A URL like /de/... must not throw and must not serve an empty catalog:
    // it renders the default locale, where the not-found page takes over.
    const { locale, messages } = await resolve("de");

    expect(locale).toBe(DEFAULT_LOCALE);
    expect(Object.keys(messages).length).toBeGreaterThan(0);
  });

  it("falls back to the default when no root parameter is present", async () => {
    // Rendering can happen outside the [locale] segment, where the getter
    // resolves to undefined.
    const { locale } = await resolve(undefined);

    expect(locale).toBe(DEFAULT_LOCALE);
  });

  it("pins the time zone so the same instant renders identically everywhere", async () => {
    // Without this, Intl falls back to the server's zone: the same stored
    // moment renders as a different day depending on where the container runs.
    const { timeZone } = (await resolve("uk")) as unknown as {
      timeZone: string;
    };

    expect(timeZone).toBe("UTC");
  });

  it("reports the locale it actually resolved, not the one requested", async () => {
    // next-intl needs the effective locale back, or formatters would bind to a
    // locale whose catalog was never loaded.
    const { locale } = await resolve("xx-YY");

    expect(locale).toBe(DEFAULT_LOCALE);
  });
});
