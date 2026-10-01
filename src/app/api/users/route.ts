import { defineRoute } from "@/lib/http/define-route";
import { created } from "@/lib/http/route-response";
import { createUserSchema } from "@/lib/schemas/create-user";
import { createUser } from "@/server/users/user-service";

export const POST = defineRoute({
  schema: createUserSchema,
  session: "required",
  handler: async ({ body, actor }) => {
    const { user, invite } = await createUser(actor, body);
    // No language segment: the invitee's own resolution applies (FR-043).
    return created({
      user,
      invite: { path: `/invite/${invite.token}`, expiresAt: invite.expiresAt },
    });
  },
});
