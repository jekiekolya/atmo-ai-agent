import createMiddleware from "next-intl/middleware";
import type { NextRequest, NextResponse } from "next/server";

import { routing } from "./routing";

const handle = createMiddleware(routing);

/**
 * next-intl's locale handling, with two behaviours this product requires and
 * the library does not provide.
 *
 * **The preference is written only by an explicit switch (FR-030).** next-intl
 * syncs `NEXT_LOCALE` to whatever locale it just served, so following a shared
 * `/uk/...` link would silently overwrite the recipient's own choice. Turning
 * that off via `localeCookie: false` is not an option: the same flag gates
 * *reading* the cookie, which is priority 2 of the resolution order. Read and
 * write are coupled behind one option, so the write is stripped from the
 * response instead. The switch itself writes the cookie in the browser, from
 * next-intl's navigation helper, and never passes through here.
 *
 * **The negotiation redirect is never cached (FR-031).** Its target depends on
 * the individual visitor's cookie and headers. A shared cache that stored one
 * would pin every later visitor to one locale — a bug no local test would
 * reproduce.
 */
export function handleLocaleRequest(request: NextRequest): NextResponse {
  const response = handle(request);

  response.headers.delete("set-cookie");

  if (response.status >= 300 && response.status < 400) {
    response.headers.set("cache-control", "no-store");
  }

  return response;
}
