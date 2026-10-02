"use client";

import { useTranslations } from "next-intl";

import { useFormatInstant } from "@/i18n/use-format-instant";

export function DemoOpenedAt({ openedAt }: { openedAt: Date }) {
  const t = useTranslations("demo");
  const formatInstant = useFormatInstant();

  return (
    <p data-testid="opened-at">
      {t("openedAt", { date: formatInstant(openedAt, "date") })}
    </p>
  );
}
