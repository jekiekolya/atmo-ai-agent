import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locales";

// One year. The preference is a functional choice the visitor made, so it
// should outlive a browser restart (FR-014).
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,

  // Every locale is prefixed, the default included: one address shape, no
  // special case to reason about (FR-005, MC-003).
  localePrefix: "always",

  // Priority 2 of the resolution order. Note this flag also gates *reading*
  // the cookie in next-intl, which is why the write is suppressed on the
  // response instead of disabled here — see i18n/proxy-handler.ts (FR-006).
  localeDetection: true,

  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "lax",
    // Static, not derived from the environment. This config is imported by the
    // navigation helpers, which a client component uses, so anything read here
    // is bundled for the browser — importing the Config module would ship it
    // (and its process.env read) to the client, where it throws. Browsers treat
    // http://localhost as a trustworthy origin, so `true` holds in development
    // as well as production.
    secure: true,
  },

  // Emits `Link` headers announcing each page's other-locale versions. The
  // switcher is a dropdown and therefore not crawlable, so these headers are
  // the only cross-locale signal search engines get.
  alternateLinks: true,
});
