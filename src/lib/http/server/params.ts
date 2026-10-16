import { z } from "zod";

import { NotFoundError } from "@/server/errors";

const uuid = z.uuid();

type Params = Record<string, string | string[]>;

// 404, not 400: a malformed id names nothing, and Postgres would otherwise throw a 500.
function idFrom(params: Params): string {
  const parsed = uuid.safeParse(params.id);
  if (!parsed.success) throw new NotFoundError();
  return parsed.data;
}

export function userIdFrom(params: Params): string {
  return idFrom(params);
}

export function conversationIdFrom(params: Params): string {
  return idFrom(params);
}
