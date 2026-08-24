import type { NextRequest } from "next/server";

import { handleLocaleRequest } from "@/i18n/proxy-handler";

// Next 16 renamed the `middleware` file convention to `proxy`; next-intl still
// publishes its factory as `next-intl/middleware`, so the file name and the
// import deliberately disagree. Both are correct — do not "fix" either.
export function proxy(request: NextRequest) {
  return handleLocaleRequest(request);
}

export const config = {
  // Pages only. Programmatic endpoints, build output, and metadata files stay
  // reachable unprefixed and redirected (FR-011). The trailing pattern skips
  // anything with a file extension, which covers public/ assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)",
  ],
};
