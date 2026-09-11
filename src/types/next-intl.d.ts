import type { Locale } from "@/i18n/locales";
import type messages from "../messages/en.json";

// Gate 1 of catalog completeness: an unknown key fails `npm run typecheck`
// (FR-020, MC-004). Gate 2, for the other locales, is in catalogs.test.ts.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
