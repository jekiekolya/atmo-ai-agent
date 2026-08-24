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
  // Locale-aware: returns the current path with the locale segment stripped
  // and every other segment resolved, so /uk/demo/42 yields /demo/42.
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(next: Locale | null) {
    // Base UI models "nothing selected"; this control always has a value, so
    // a null here is not a locale change.
    if (next === null || next === locale) return;

    // usePathname drops the query string, so it is re-attached here: a switch
    // must preserve the whole address, not just the path (FR-013). Read from
    // the live URL rather than useSearchParams, which would opt every page
    // that renders this switcher out of static rendering. This runs only in
    // the browser, on click, so the value is current by construction.
    const query = window.location.search;
    const target = `${pathname}${query}`;

    startTransition(() => {
      // next-intl writes NEXT_LOCALE here, in the browser. That is the only
      // place the preference is ever written (FR-030).
      router.replace(target, { locale: next });
    });
  }

  return (
    <Select value={locale} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger aria-label={t("label")} size="sm">
        {/* The trigger must show the language's own name, not its code: a
            visitor looking for Ukrainian looks for "Українська", not "uk". */}
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
