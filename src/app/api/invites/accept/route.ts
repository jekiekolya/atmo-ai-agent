import { defineRoute } from "@/lib/http/server/define-route";
import { noContent } from "@/lib/http/server/route-response";
import { acceptInviteSchema } from "@/lib/schemas/accept-invite";
import { acceptInvite } from "@/server/invites/invite-service";

// Public: the invite is the path into the account.
export const POST = defineRoute({
  schema: acceptInviteSchema,
  session: "none",
  handler: async ({ body }) => {
    await acceptInvite({ token: body.token, password: body.password });
    return noContent();
  },
});
