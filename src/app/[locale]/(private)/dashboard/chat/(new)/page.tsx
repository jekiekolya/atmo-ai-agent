import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireChatAccess } from "@/auth/dal";
import { ChatPanelSlot } from "@/components/chat/chat-panel-slot/chat-panel-slot";
import { NotPermitted } from "@/components/shell/not-permitted/not-permitted";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("metaTitle") };
}

export default async function NewChatPage() {
  const { permitted } = await requireChatAccess();
  if (!permitted) return <NotPermitted />;

  return <ChatPanelSlot initialMessages={[]} />;
}
