// Application code, not configuration: a locale cannot exist without its
// catalog committed alongside it (FR-002, FR-003).
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

export function resolveLocale(value: string | undefined): Locale {
  return value !== undefined && isSupportedLocale(value)
    ? value
    : DEFAULT_LOCALE;
}
