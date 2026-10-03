import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/components/shell/brand-logo/brand-logo";
import { SetPasswordForm } from "@/components/account/set-password-form/set-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { PAGES } from "@/lib/routes";
import { inspectInvite } from "@/server/invites/invite-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  // The address carries the token; never hand it to another site (FR-043).
  return { title: t("metaTitle"), referrer: "no-referrer" };
}

export default async function InvitePage({
  params,
}: PageProps<"/[locale]/invite/[token]">) {
  const { token } = await params;
  const outcome = await inspectInvite(token);
  const t = await getTranslations("invite");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4 sm:p-8">
      <BrandLogo className="mx-auto h-10 w-auto" />
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t("title")}</h1>
          </CardTitle>
          {outcome.status === "valid" && (
            <CardDescription className="break-all">
              {t("account", { email: outcome.email })}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {outcome.status === "valid" ? (
            <SetPasswordForm token={token} />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>{t(outcome.status)}</AlertDescription>
            </Alert>
          )}
          {outcome.status === "used" && (
            <Link
              className="text-primary underline underline-offset-4"
              href={PAGES.signIn}
            >
              {t("toSignIn")}
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
