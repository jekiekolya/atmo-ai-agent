import { getRequestConfig } from "next-intl/server";
import { locale as localeParam } from "next/root-params";

import { resolveLocale } from "./locales";

export default getRequestConfig(async () => {
  // The root parameter is untrusted, and absent entirely when something
  // renders outside `[locale]`, so anything unrecognized falls back rather
  // than throwing or serving an empty catalog (FR-008).
  const locale = resolveLocale(await localeParam());

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // The server has no reader zone, so it stays deterministic; screens convert through useFormatInstant.
    timeZone: "UTC",
  };
});
