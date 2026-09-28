import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { verifySession } from "@/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("metaTitle") };
}

export default async function DashboardPage() {
  const user = await verifySession();
  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-medium">
        {t("title", { firstName: user.firstName })}
      </h1>
      <p className="text-muted-foreground">{t("intro")}</p>
    </div>
  );
}
