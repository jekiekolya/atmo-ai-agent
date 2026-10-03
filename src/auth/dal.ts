import { locale as localeParam } from "next/root-params";
import { cache } from "react";

import { auth } from "@/auth/auth";
import { resolveLocale } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import { PAGES } from "@/lib/routes";
import { identityOf, type SessionIdentity } from "@/server/auth/session-policy";

export type SessionUser = SessionIdentity & { id: string };

/** Runs the jwt callback's database re-check (FR-022), once per request. */
const getSession = cache(() => auth());

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session?.user?.id) return null;

  return { id: session.user.id, ...identityOf(session.user) };
});

/** For pages and layouts. Route handlers use getSessionUser and return 401. */
export async function verifySession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  return redirect({
    href: PAGES.signIn,
    locale: resolveLocale(await localeParam()),
  });
}

/** An admin gets `permitted: false` and the page renders NotPermitted (FR-037). */
export async function requireSuperAdmin(): Promise<{
  user: SessionUser;
  permitted: boolean;
}> {
  const user = await verifySession();
  return { user, permitted: user.role === "SUPER_ADMIN" };
}
