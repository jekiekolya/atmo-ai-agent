import { defineRoute } from "@/lib/http/define-route";
import { userIdFrom } from "@/lib/http/params";
import { ok } from "@/lib/http/route-response";
import { deactivateUser } from "@/server/users/user-service";

export const POST = defineRoute({
  session: "required",
  handler: async ({ actor, params }) =>
    ok({ user: await deactivateUser(actor, userIdFrom(params)) }),
});
