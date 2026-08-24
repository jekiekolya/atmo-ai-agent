import { getRequestConfig } from "next-intl/server";
import { locale as localeParam } from "next/root-params";

import { DEFAULT_LOCALE, isSupportedLocale } from "./locales";

// Reads the `[locale]` root parameter. next-intl's `requestLocale` is
// deprecated in favour of this, and Next 16 exposes the segment above the root
// layout to any Server Component without prop drilling.
//
// The segment is untrusted input and can be absent entirely when something
// renders outside `[locale]`, so it is narrowed before it can select a
// catalog; anything unrecognized falls back to the default locale rather than
// throwing or serving an empty catalog (FR-008).
export default getRequestConfig(async () => {
  const requested = await localeParam();
  const locale =
    requested !== undefined && isSupportedLocale(requested)
      ? requested
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
