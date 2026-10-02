import { getRequestConfig } from "next-intl/server";
import { locale as localeParam } from "next/root-params";

import { DEFAULT_LOCALE, isSupportedLocale } from "./locales";

export default getRequestConfig(async () => {
  // The root parameter is untrusted, and absent entirely when something
  // renders outside `[locale]`, so anything unrecognized falls back rather
  // than throwing or serving an empty catalog (FR-008).
  const requested = await localeParam();
  const locale =
    requested !== undefined && isSupportedLocale(requested)
      ? requested
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // The server has no reader zone, so it stays deterministic; screens convert through useFormatInstant.
    timeZone: "UTC",
  };
});
