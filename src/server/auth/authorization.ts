import type { Role } from "@generated/client";

import { ForbiddenError } from "@/server/errors";

/** The signed-in user a service acts for, as resolved by the caller. */
export type Actor = { id: string; role: Role };

export function assertSuperAdmin(actor: Actor): void {
  if (actor.role !== "SUPER_ADMIN") throw new ForbiddenError();
}
