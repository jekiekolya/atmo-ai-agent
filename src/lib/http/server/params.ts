import { z } from "zod";

import { NotFoundError } from "@/server/errors";

const uuid = z.uuid();

// 404, not 400: a malformed id names no account, and Postgres would otherwise throw a 500.
export function userIdFrom(params: Record<string, string | string[]>): string {
  const parsed = uuid.safeParse(params.id);
  if (!parsed.success) throw new NotFoundError();
  return parsed.data;
}
