import { getTranslations } from "next-intl/server";

import { AppShell } from "@/components/app-shell/app-shell";

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-8">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
    </AppShell>
  );
}
