import { defineRoute } from "@/lib/http/server/define-route";
import { conversationIdFrom } from "@/lib/http/server/params";
import { noContent } from "@/lib/http/server/route-response";
import { deleteConversation } from "@/server/chat/chat-service";

export const DELETE = defineRoute({
  session: "required",
  handler: ({ actor, params }) =>
    deleteConversation(actor, conversationIdFrom(params)).then(noContent),
});
