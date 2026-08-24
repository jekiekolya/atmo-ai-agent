import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// The only sanctioned way to build an internal address. Raw `next/link` or a
// hand-written string can omit the locale segment; these cannot (MC-001).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
