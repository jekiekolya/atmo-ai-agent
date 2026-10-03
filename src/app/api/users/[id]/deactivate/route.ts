import { defineRoute } from "@/lib/http/server/define-route";
import { userIdFrom } from "@/lib/http/server/params";
import { ok } from "@/lib/http/server/route-response";
import { deactivateUser } from "@/server/users/user-service";

export const POST = defineRoute({
  session: "required",
  handler: async ({ actor, params }) =>
    ok({ user: await deactivateUser(actor, userIdFrom(params)) }),
});
