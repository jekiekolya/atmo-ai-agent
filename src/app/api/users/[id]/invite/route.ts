import { defineRoute } from "@/lib/http/define-route";
import { userIdFrom } from "@/lib/http/params";
import { created, noContent } from "@/lib/http/route-response";
import { issueInvite, revokeInvite } from "@/server/invites/invite-service";

export const POST = defineRoute({
  session: "required",
  handler: async ({ actor, params }) => {
    const invite = await issueInvite(actor, userIdFrom(params));
    return created({
      invite: { path: `/invite/${invite.token}`, expiresAt: invite.expiresAt },
    });
  },
});

export const DELETE = defineRoute({
  session: "required",
  handler: async ({ actor, params }) => {
    await revokeInvite(actor, userIdFrom(params));
    return noContent();
  },
});
