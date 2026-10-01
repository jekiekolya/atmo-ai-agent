// For `vi.mock("next-intl", () => import("@/testing/next-intl-mock"))`: a key renders as itself, under its namespace.
export const useLocale = () => "en";

export const useTranslations = (namespace?: string) => (key: string) =>
  namespace ? `${namespace}.${key}` : key;

export const useFormatter = () => ({ dateTime: () => "the date" });
