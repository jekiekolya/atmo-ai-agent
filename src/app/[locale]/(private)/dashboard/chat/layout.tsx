import { requireChatAccess } from "@/auth/dal";
import { ConversationList } from "@/components/chat/conversation-list/conversation-list";
import { NotPermitted } from "@/components/shell/not-permitted/not-permitted";
import { listConversations } from "@/server/chat/chat-service";

// No loading.tsx here or above: the conversation's ownership check must answer before streaming starts (R7).
export default async function ChatLayout({
  children,
}: LayoutProps<"/[locale]/dashboard/chat">) {
  const { user, permitted } = await requireChatAccess();
  if (!permitted) return <NotPermitted />;

  const conversations = await listConversations(user);

  return (
    <div className="flex h-[calc(100dvh-4.75rem)] flex-col sm:h-[calc(100dvh-3.25rem)] md:flex-row">
      <aside className="flex max-h-[45dvh] shrink-0 flex-col border-b md:max-h-none md:w-72 md:border-e md:border-b-0">
        <ConversationList conversations={conversations} />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
