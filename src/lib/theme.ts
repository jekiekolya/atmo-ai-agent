export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "atmo-theme";

// `satisfies`, not an annotation: checks the vocabulary without widening the literal.
export const DEFAULT_THEME_PREFERENCE = "system" satisfies ThemePreference;
