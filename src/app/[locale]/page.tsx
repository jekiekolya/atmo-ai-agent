import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
      {/* Localized navigation helper, never next/link: it cannot emit an
          address that omits the locale segment (MC-001). */}
      <Link
        className="text-primary underline underline-offset-4"
        href="/demo/42"
      >
        {t("demoLink")}
      </Link>
    </div>
  );
}
