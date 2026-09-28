import { SessionProvider } from "next-auth/react";
import { getTranslations } from "next-intl/server";

import { getSession, verifySession } from "@/auth/dal";
import { AccountMenu } from "@/components/account-menu/account-menu";
import { AppShell } from "@/components/app-shell/app-shell";
import { SessionKeepAlive } from "@/components/session-keep-alive/session-keep-alive";
import { Link } from "@/i18n/navigation";

// Layouts don't re-render, so every page re-checks; no Suspense above this check (R8, R17).
export default async function PrivateLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const user = await verifySession();
  const session = await getSession();
  const t = await getTranslations();
  const fullName = t("common.fullName", {
    firstName: user.firstName,
    lastName: user.lastName,
  });

  return (
    // No refetch interval: polling would keep an idle session alive (R3).
    <SessionProvider session={session} refetchOnWindowFocus refetchInterval={0}>
      <SessionKeepAlive />
      <AppShell
        nav={
          <nav
            aria-label={t("shell.navLabel")}
            className="flex gap-4 text-sm whitespace-nowrap"
          >
            <Link href="/dashboard">{t("shell.home")}</Link>
            <Link href="/dashboard/account">{t("shell.account")}</Link>
            {user.role === "SUPER_ADMIN" && (
              <Link href="/dashboard/users">{t("shell.users")}</Link>
            )}
          </nav>
        }
        account={<AccountMenu name={fullName} />}
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
