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
    // Pages render on the server, so an absent zone means the container's —
    // the same instant would show a different day per deployment. Showing the
    // visitor's own zone is a separate feature; see Out of Scope.
    timeZone: "UTC",
  };
});
