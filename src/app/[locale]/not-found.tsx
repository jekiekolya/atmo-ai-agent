import { useTranslations } from "next-intl";

import { AppShell } from "@/components/shell/app-shell/app-shell";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-8">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
        <Link className="text-primary underline underline-offset-4" href="/">
          {t("backHome")}
        </Link>
      </div>
    </AppShell>
  );
}
