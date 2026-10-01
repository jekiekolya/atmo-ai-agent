"use client";

import { useTranslations } from "next-intl";

/** For keys known only at runtime; the catalog tests prove they exist. */
export function useTranslateKey(): (key: string) => string {
  const t = useTranslations();
  return (key) => t(key as Parameters<typeof t>[0]);
}
