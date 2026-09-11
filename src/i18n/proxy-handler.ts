import createMiddleware from "next-intl/middleware";
import type { NextRequest, NextResponse } from "next/server";

import { routing } from "./routing";

const handle = createMiddleware(routing);

export function handleLocaleRequest(request: NextRequest): NextResponse {
  const response = handle(request);

  // Otherwise a shared /uk/... link overwrites the recipient's own choice.
  // `localeCookie: false` is not the fix — it also disables reading (FR-030, R2).
  response.headers.delete("set-cookie");

  if (response.status >= 300 && response.status < 400) {
    // The target varies per visitor; a shared cache would pin every later one
    // to a single locale (FR-031).
    response.headers.set("cache-control", "no-store");
  }

  return response;
}
