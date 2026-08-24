// The supported-locale set is application code, not configuration: a locale
// cannot exist without its catalog committed alongside it, so adding one is a
// reviewed code change rather than an environment variable (FR-002, FR-003).
export const SUPPORTED_LOCALES = ["en", "uk"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE = "en" satisfies Locale;

// Endonyms: each language named as its own speakers write it, so the switcher
// reads correctly whichever locale is active. Never translated.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  uk: "Українська",
};

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}
