import { PAGES } from "@/lib/routes";

const DUMMY_ORIGIN = "http://callback.invalid";

export function safeCallbackUrl(
  value: string | null | undefined,
  locale: string,
): string {
  const fallback = `/${locale}${PAGES.dashboard}`;
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  if (value.startsWith("/\\")) return fallback;

  try {
    const url = new URL(value, DUMMY_ORIGIN);
    if (url.origin !== DUMMY_ORIGIN) return fallback;
    // Dot segments collapse during parsing, so "/.//evil.com" only becomes protocol-relative here.
    if (url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** The sign-in address that returns the visitor to where they are now. */
export function signInUrlFor(location: {
  pathname: string;
  search: string;
}): string {
  const locale = location.pathname.split("/")[1];
  const callbackUrl = encodeURIComponent(location.pathname + location.search);
  return `/${locale}${PAGES.signIn}?callbackUrl=${callbackUrl}`;
}
