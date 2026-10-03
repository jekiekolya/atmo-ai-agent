import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { verifySession } from "@/auth/dal";
import { ChangePasswordForm } from "@/components/account/change-password-form/change-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle") };
}

export default async function AccountPage() {
  await verifySession();
  const t = await getTranslations("account");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("changePassword")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("changePasswordHint")}
          </p>
        </div>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
