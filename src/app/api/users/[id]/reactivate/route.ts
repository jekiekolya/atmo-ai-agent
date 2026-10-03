import { defineRoute } from "@/lib/http/server/define-route";
import { userIdFrom } from "@/lib/http/server/params";
import { ok } from "@/lib/http/server/route-response";
import { reactivateUser } from "@/server/users/user-service";

export const POST = defineRoute({
  session: "required",
  handler: async ({ actor, params }) =>
    ok({ user: await reactivateUser(actor, userIdFrom(params)) }),
});
