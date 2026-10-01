import { getFormatter, getTranslations } from "next-intl/server";

import { AppShell } from "@/components/app-shell/app-shell";

// Stand-in for data a real case would carry. Fixed values so the rendering is
// deterministic: this route exists to prove locale-aware formatting and that a
// dynamic segment survives a locale switch (FR-028).
const SAMPLE = {
  openedAt: new Date("2026-03-14T09:30:00Z"),
  outputKwh: 1234.56,
  creditEur: 87.5,
  visits: 3,
};

export default async function DemoCase({
  params,
}: PageProps<"/[locale]/demo/[id]">) {
  const { id } = await params;
  const t = await getTranslations("demo");
  const format = await getFormatter();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4 sm:p-8">
        <h1 className="text-2xl font-medium">{t("title", { id })}</h1>

        {/* Every value below goes through a locale-aware formatter. Assembling
            any of them from strings would take word order and separators away
            from the translator (FR-023, FR-024). */}
        <p data-testid="opened-at">
          {t("openedAt", {
            date: format.dateTime(SAMPLE.openedAt, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          })}
        </p>
        <p data-testid="output">
          {t("output", { value: format.number(SAMPLE.outputKwh) })}
        </p>
        <p data-testid="credit">
          {t("credit", {
            amount: format.number(SAMPLE.creditEur, {
              style: "currency",
              currency: "EUR",
            }),
          })}
        </p>
        <p data-testid="visits">{t("visits", { count: SAMPLE.visits })}</p>
      </div>
    </AppShell>
  );
}
