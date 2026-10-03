"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

export function LocaleSwitcher() {
  const t = useTranslations("switcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(next: Locale | null) {
    // Base UI models "nothing selected"; this control always has a value.
    if (next === null || next === locale) return;

    // usePathname drops the query, and useSearchParams would opt every page
    // rendering this switcher out of static rendering (FR-013, R13).
    const query = window.location.search;
    const target = `${pathname}${query}`;

    startTransition(() => {
      // The one place NEXT_LOCALE is ever written (FR-030).
      router.replace(target, { locale: next });
    });
  }

  return (
    <Select value={locale} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger aria-label={t("label")} size="sm">
        <SelectValue>
          {(value: Locale | null) => (value ? LOCALE_LABELS[value] : null)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((candidate) => (
          <SelectItem key={candidate} value={candidate}>
            {LOCALE_LABELS[candidate]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
