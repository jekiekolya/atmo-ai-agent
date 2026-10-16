import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireChatAccess } from "@/auth/dal";
import { ChatPanel } from "@/components/chat/chat-panel/chat-panel";
import { NotPermitted } from "@/components/shell/not-permitted/not-permitted";
import { config } from "@/config";
import { conversationIdFrom } from "@/lib/http/server/params";
import {
  findOwnConversation,
  getOwnConversation,
} from "@/server/chat/chat-service";
import { NotFoundError } from "@/server/errors";

type Props = PageProps<"/[locale]/dashboard/chat/[id]">;

// The layout has already answered not found; a conversation deleted since then still gets one.
async function orNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user, permitted } = await requireChatAccess();
  if (!permitted) return {};
  const { title } = await orNotFound(async () =>
    findOwnConversation(user, conversationIdFrom(await params)),
  );
  return { title };
}

export default async function ConversationPage({ params }: Props) {
  const { user, permitted } = await requireChatAccess();
  if (!permitted) return <NotPermitted />;

  const conversation = await orNotFound(async () =>
    getOwnConversation(user, conversationIdFrom(await params), new Date()),
  );

  return (
    <ChatPanel
      key={conversation.id}
      conversationId={conversation.id}
      initialMessages={conversation.messages}
      maxLength={config.chat.maxMessageLength}
    />
  );
}
