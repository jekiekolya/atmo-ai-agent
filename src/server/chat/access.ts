import type { Role } from "@generated/client";

import type { Actor } from "@/server/auth/authorization";
import { ForbiddenError } from "@/server/errors";

/** Every role decided explicitly: a role added later fails typecheck here until a spec grants it the chat (FR-001). */
export const CHAT_ACCESS = {
  SUPER_ADMIN: true,
  ADMIN: true,
} as const satisfies Record<Role, boolean>;

export const CHAT_ROLES = (Object.keys(CHAT_ACCESS) as Role[]).filter(
  (role) => CHAT_ACCESS[role],
);

export function canUseChat(role: Role): boolean {
  return CHAT_ROLES.includes(role);
}

export function assertChatAccess(actor: Actor): void {
  if (!canUseChat(actor.role)) throw new ForbiddenError();
}
