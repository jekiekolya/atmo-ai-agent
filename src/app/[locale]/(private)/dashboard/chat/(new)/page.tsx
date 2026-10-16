import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireChatAccess } from "@/auth/dal";
import { ChatPanel } from "@/components/chat/chat-panel/chat-panel";
import { NotPermitted } from "@/components/shell/not-permitted/not-permitted";
import { config } from "@/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("metaTitle") };
}

export default async function NewChatPage() {
  const { permitted } = await requireChatAccess();
  if (!permitted) return <NotPermitted />;

  return (
    <ChatPanel
      key="new"
      initialMessages={[]}
      maxLength={config.chat.maxMessageLength}
    />
  );
}
