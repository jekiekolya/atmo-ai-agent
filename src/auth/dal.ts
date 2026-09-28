import { locale as localeParam } from "next/root-params";
import { cache } from "react";

import { auth } from "@/auth/auth";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import type { Role } from "@generated/client";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
};

/** Runs the jwt callback's database re-check (FR-022), once per request. */
export const getSession = cache(() => auth());

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const { id, email, role, firstName, lastName } = session.user;
  return { id, email, role, firstName, lastName };
});

/** For pages and layouts. Route handlers use getSessionUser and return 401. */
export async function verifySession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  const requested = await localeParam();
  const locale =
    requested !== undefined && isSupportedLocale(requested)
      ? requested
      : DEFAULT_LOCALE;

  return redirect({ href: "/sign-in", locale });
}

/** An admin gets `permitted: false` and the page renders NotPermitted (FR-037). */
export async function requireSuperAdmin(): Promise<{
  user: SessionUser;
  permitted: boolean;
}> {
  const user = await verifySession();
  return { user, permitted: user.role === "SUPER_ADMIN" };
}
