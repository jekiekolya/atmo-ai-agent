import { notFound } from "next/navigation";

import { requireChatAccess } from "@/auth/dal";
import { conversationIdFrom } from "@/lib/http/server/params";
import { findOwnConversation } from "@/server/chat/chat-service";
import { NotFoundError } from "@/server/errors";

// The ownership check, outside this segment's loading.tsx: a 404 must be decided before streaming starts (R7).
export default async function ConversationLayout({
  children,
  params,
}: LayoutProps<"/[locale]/dashboard/chat/[id]">) {
  const { user, permitted } = await requireChatAccess();
  if (permitted) {
    try {
      await findOwnConversation(user, conversationIdFrom(await params));
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  }
  return children;
}
