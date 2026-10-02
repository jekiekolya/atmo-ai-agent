import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSessionUser } from "@/auth/dal";
import { SignInForm } from "@/components/sign-in-form/sign-in-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveLocale } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import { safeCallbackUrl } from "@/lib/http/callback-url";

const NOTICES = {
  "password-set": "passwordSet",
  "password-changed": "passwordChanged",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const locale = resolveLocale((await params).locale);

  // The full check, not the proxy's: a revoked session must see the form, not loop (R4).
  if (await getSessionUser()) {
    redirect({ href: "/dashboard", locale });
  }

  const query = await searchParams;
  const single = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;

  const callbackUrl = safeCallbackUrl(single(query.callbackUrl), locale);
  const requestedNotice = single(query.notice);
  const notice =
    requestedNotice !== undefined && Object.hasOwn(NOTICES, requestedNotice)
      ? NOTICES[requestedNotice as keyof typeof NOTICES]
      : undefined;

  const t = await getTranslations("auth");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4 sm:p-8">
      {notice && (
        <Alert>
          <AlertDescription>{t(`notice.${notice}`)}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t("signIn.title")}</h1>
          </CardTitle>
          <CardDescription>{t("signIn.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
