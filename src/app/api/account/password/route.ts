import { signOut } from "@/auth/auth";
import { defineRoute } from "@/lib/http/define-route";
import { noContent } from "@/lib/http/route-response";
import { changePasswordSchema } from "@/lib/schemas/change-password";
import { changeOwnPassword } from "@/server/users/user-service";

export const PUT = defineRoute({
  schema: changePasswordSchema,
  session: "required",
  handler: async ({ body, actor }) => {
    await changeOwnPassword(actor, body);
    // Every session has ended, this one included (FR-025, FR-057).
    await signOut({ redirect: false });
    return noContent();
  },
});
