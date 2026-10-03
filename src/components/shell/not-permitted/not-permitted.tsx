import { getTranslations } from "next-intl/server";

/** What an admin sees on a super-admin page. No data is loaded for it (FR-037). */
export async function NotPermitted() {
  const t = await getTranslations("notPermitted");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 p-4 sm:p-8">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
    </div>
  );
}
