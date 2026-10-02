import { render } from "@testing-library/react";
import {
  NextIntlClientProvider,
  useFormatter,
  useTranslations,
} from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DemoOpenedAt } from "@/components/demo-opened-at/demo-opened-at";
import { type Locale } from "@/i18n/locales";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

// The demo page is a Server Component, so what is verified here is the pairing
// of catalog message and formatter that the page uses — the part that decides
// whether a date, an amount, or a plural reads correctly in each language
// (FR-023, FR-024).
const MESSAGES = { en, uk } as const;
const OPENED_AT = new Date("2026-03-14T23:30:00Z");

/** Renders a probe in one locale and returns its text, leaving no DOM behind. */
function textIn(locale: Locale, node: ReactNode): string {
  const { container, unmount } = render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>,
  );
  const text = container.textContent ?? "";
  unmount();
  return text;
}

function Output() {
  const format = useFormatter();
  const t = useTranslations("demo");
  return t("output", { value: format.number(1234.56) });
}

function Credit() {
  const format = useFormatter();
  const t = useTranslations("demo");
  return t("credit", {
    amount: format.number(87.5, { style: "currency", currency: "EUR" }),
  });
}

function Visits({ count }: { count: number }) {
  const t = useTranslations("demo");
  return t("visits", { count });
}

describe("locale-aware formatting", () => {
  it("orders the date by each locale's convention", () => {
    expect(textIn("en", <DemoOpenedAt openedAt={OPENED_AT} />)).toContain(
      "Mar 15, 2026",
    );
    // Ukrainian leads with the day.
    expect(textIn("uk", <DemoOpenedAt openedAt={OPENED_AT} />)).toMatch(
      /15\s+бер/,
    );
  });

  it("uses each locale's decimal and grouping separators", () => {
    expect(textIn("en", <Output />)).toContain("1,234.56");
    // Ukrainian groups with a space and marks decimals with a comma.
    expect(textIn("uk", <Output />)).toMatch(/1\s234,56/);
  });

  it("positions and names the currency the way each locale does", () => {
    // English puts the symbol first. Ukrainian puts the amount first and, for
    // a currency that is not its own, prints the ISO code rather than the
    // symbol — exactly the kind of per-locale rule that hand-formatting gets
    // wrong. Both come from CLDR, not from us.
    expect(textIn("en", <Credit />)).toContain("€87.50");
    expect(textIn("uk", <Credit />)).toMatch(/87,50\s?EUR/);
  });

  it("selects the right Ukrainian plural form for each count", () => {
    // one / few / many are different words, which is why the count belongs
    // inside the message instead of being concatenated beside it.
    expect(textIn("uk", <Visits count={1} />)).toContain("1 візит");
    expect(textIn("uk", <Visits count={3} />)).toContain("3 візити");
    expect(textIn("uk", <Visits count={5} />)).toContain("5 візитів");
  });

  it("selects the right English plural form for each count", () => {
    expect(textIn("en", <Visits count={1} />)).toContain("1 site visit");
    expect(textIn("en", <Visits count={3} />)).toContain("3 site visits");
  });
});
