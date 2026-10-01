// Route handlers get no built-in CSRF protection; only Server Actions do (research R18).
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (origin === null) {
    return request.headers.get("sec-fetch-site") === "same-origin";
  }
  if (origin === "null") return false;

  // The reverse proxy must overwrite, not append, X-Forwarded-Host.
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
