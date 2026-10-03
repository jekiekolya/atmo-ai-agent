import { defineRoute } from "@/lib/http/define-route";
import { userIdFrom } from "@/lib/http/params";
import { created, noContent } from "@/lib/http/route-response";
import { PAGES, pathTo } from "@/lib/routes";
import { issueInvite, revokeInvite } from "@/server/invites/invite-service";

export const POST = defineRoute({
  session: "required",
  handler: async ({ actor, params }) => {
    const invite = await issueInvite(actor, userIdFrom(params));
    return created({
      invite: {
        path: pathTo(PAGES.invite, { token: invite.token }),
        expiresAt: invite.expiresAt,
      },
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
