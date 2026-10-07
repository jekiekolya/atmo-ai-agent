import { config } from "@/config";
import { defineRoute } from "@/lib/http/server/define-route";
import { chatRequestSchema } from "@/lib/schemas/chat";
import { respondToChat } from "@/server/chat/respond";

export const POST = defineRoute({
  schema: chatRequestSchema(config.chat.maxMessageLength),
  session: "required",
  handler: ({ body, actor, request }) =>
    respondToChat(actor, body, request.signal),
});
