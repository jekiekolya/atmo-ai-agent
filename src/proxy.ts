import type { NextRequest } from "next/server";

import { proxyGuard } from "@/auth/proxy-guard";
import { handleLocaleRequest } from "@/i18n/proxy-handler";

// Next 16 renamed the `middleware` file convention to `proxy`; next-intl still
// publishes its factory as `next-intl/middleware`. Both are correct.
export async function proxy(request: NextRequest) {
  const response = handleLocaleRequest(request);
  if (response.status >= 300 && response.status < 400) return response;

  // Language first, so the guard only ever sees prefixed paths (research R2).
  return proxyGuard(request, response);
}

export const config = {
  // Pages only: programmatic endpoints, build output, and metadata files stay
  // reachable unprefixed (FR-011). The extension pattern covers public/.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)",
  ],
};
