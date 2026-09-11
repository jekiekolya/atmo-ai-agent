import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up looking for a
  // lockfile and can land outside the repository.
  turbopack: {
    root: import.meta.dirname,
  },
};

// Points next-intl at the request config so `getRequestConfig` is picked up and
// server components can resolve messages without threading the locale through.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
