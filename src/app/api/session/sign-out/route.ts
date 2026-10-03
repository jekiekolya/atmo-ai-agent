import { signOut } from "@/auth/auth";
import { defineRoute } from "@/lib/http/server/define-route";
import { noContent } from "@/lib/http/server/route-response";
import { recordSignOut } from "@/server/users/user-service";

// Not next-auth's sign-out endpoint: its hook swallows errors (research R5).
export const POST = defineRoute({
  session: "required",
  handler: async ({ actor }) => {
    await recordSignOut(actor);
    await signOut({ redirect: false });
    return noContent();
  },
});
