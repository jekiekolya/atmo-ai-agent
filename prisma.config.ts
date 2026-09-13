import "dotenv/config";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env itself; dotenv also tolerates its absence in CI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
