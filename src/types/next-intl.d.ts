import type { Locale } from "@/i18n/locales";
import type messages from "../messages/en.json";

// Gate 1 of catalog completeness: the English catalog defines the key set, so
// `t('home.title')` fails `npm run typecheck` rather than rendering at runtime
// (FR-020, MC-004). This types keys against English only — a key missing from
// another locale is Gate 2's job, in i18n/catalogs.test.ts.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
