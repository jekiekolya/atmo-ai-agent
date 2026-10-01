import { getToken } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

import { secureCookiesFor } from "@/auth/cookie-policy";
import { config } from "@/config";
import { isSupportedLocale } from "@/i18n/locales";

const PROTECTED_SEGMENT = "dashboard";

function protectedLocale(pathname: string): string | null {
  const [, locale, segment] = pathname.split("/");
  if (!locale || !isSupportedLocale(locale)) return null;
  return segment === PROTECTED_SEGMENT ? locale : null;
}

// Cookie only, never the database (FR-032); never leaves sign-in, or revoked sessions loop (R4).
export async function proxyGuard(
  request: NextRequest,
  intlResponse: NextResponse,
): Promise<NextResponse> {
  const locale = protectedLocale(request.nextUrl.pathname);
  if (locale === null) return intlResponse;

  const token = await getToken({
    req: request,
    secret: config.authSecret,
    secureCookie: secureCookiesFor(config),
  });
  if (token) return intlResponse;

  const signIn = new URL(`/${locale}/sign-in`, request.url);
  signIn.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const response = NextResponse.redirect(signIn);
  response.headers.set("cache-control", "no-store");
  return response;
}
