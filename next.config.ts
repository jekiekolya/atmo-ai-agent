import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up looking for a
  // lockfile and can land outside the repository.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
