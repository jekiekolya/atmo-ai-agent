import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "@/config";
import { type Prisma, PrismaClient } from "@generated/client";

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
}

const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db = globalForDb.db ?? createClient();

if (config.nodeEnv !== "production") {
  globalForDb.db = db;
}

/** The client or an open transaction; repositories accept either. */
export type Db = Prisma.TransactionClient;
