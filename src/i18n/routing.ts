import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locales";

// The preference should outlive a browser restart (FR-014).
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,

  // The default locale is prefixed too: one address shape, no special case to
  // reason about (FR-005, MC-003).
  localePrefix: "always",

  // Priority 2 of the resolution order. This flag also gates *reading* the
  // cookie, which is why the write is stripped in proxy-handler.ts (FR-006, R2).
  localeDetection: true,

  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "lax",
    // Static, not from Config: this module reaches the client bundle through
    // the switcher, and localhost is a trustworthy origin anyway (R10).
    secure: true,
  },

  // The switcher is a dropdown and therefore not crawlable, so these Link
  // headers are the only cross-locale signal search engines get.
  alternateLinks: true,
});
