import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PAGES } from "@/lib/routes";

export default function ConversationNotFound() {
  const t = useTranslations("chat.notFound");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-6">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Link href={PAGES.chat} className={buttonVariants()}>
        {t("newChat")}
      </Link>
    </div>
  );
}
