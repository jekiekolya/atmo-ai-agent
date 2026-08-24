import type { NextRequest } from "next/server";

import { handleLocaleRequest } from "@/i18n/proxy-handler";

// Next 16 renamed the `middleware` file convention to `proxy`; next-intl still
// publishes its factory as `next-intl/middleware`. Both are correct.
export function proxy(request: NextRequest) {
  return handleLocaleRequest(request);
}

export const config = {
  // Pages only: programmatic endpoints, build output, and metadata files stay
  // reachable unprefixed (FR-011). The extension pattern covers public/.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)",
  ],
};
