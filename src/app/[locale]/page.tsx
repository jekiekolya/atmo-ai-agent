import { getTranslations } from "next-intl/server";

import { AppShell } from "@/components/shell/app-shell/app-shell";
import { Link } from "@/i18n/navigation";
import { PAGES, pathTo } from "@/lib/routes";

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-8">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        {/* Localized navigation helper, never next/link: it cannot emit an
            address that omits the locale segment (MC-001). */}
        <Link
          className="text-primary underline underline-offset-4"
          href={pathTo(PAGES.demo, { id: "42" })}
        >
          {t("demoLink")}
        </Link>
      </div>
    </AppShell>
  );
}
