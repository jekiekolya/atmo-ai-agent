import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { type Locale } from "@/i18n/locales";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

import { DemoOpenedAt } from "./demo-opened-at";

const MESSAGES = { en, uk } as const;
// Late enough in the UTC day that Kyiv, where the ui tests run, is already on the next one.
const OPENED_AT = new Date("2026-03-14T23:30:00Z");

function textIn(locale: Locale) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="UTC"
    >
      <DemoOpenedAt openedAt={OPENED_AT} />
    </NextIntlClientProvider>,
  ).getByTestId("opened-at").textContent;
}

describe("DemoOpenedAt (FR-011)", () => {
  it("shows the day the case was opened in the reader's zone, unlabelled", () => {
    expect(textIn("en")).toBe("Opened Mar 15, 2026");
  });

  it("follows the page's language", () => {
    const text = textIn("uk");

    expect(text).toMatch(/15\s+бер/);
    expect(text).not.toContain("UTC");
  });
});
