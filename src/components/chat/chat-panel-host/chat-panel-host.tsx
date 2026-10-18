"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

import { ChatPanel } from "@/components/chat/chat-panel/chat-panel";
import type { ChatUIMessage } from "@/lib/chat/messages";

export type ChatPanelEntry = {
  conversationId?: string;
  initialMessages: ChatUIMessage[];
};

type Register = (entry: ChatPanelEntry) => () => void;

export const ChatPanelSlotContext = createContext<Register | null>(null);

/** The chat's panel, above the pages, so a new conversation's own page does not replace it (R8). */
export function ChatPanelHost({
  maxLength,
  children,
}: {
  maxLength: number;
  children: ReactNode;
}) {
  const [shown, setShown] = useState<{
    entry: ChatPanelEntry;
    key: number;
  } | null>(null);
  const panelRef = useRef({ key: 0, heldId: undefined as string | undefined });

  const register = useCallback<Register>((entry) => {
    const panel = panelRef.current;
    if (entry.conversationId !== panel.heldId) {
      panelRef.current = { key: panel.key + 1, heldId: entry.conversationId };
    }
    const next = { entry, key: panelRef.current.key };
    setShown(next);
    return () => setShown((current) => (current === next ? null : current));
  }, []);

  const conversationStarted = useCallback((id: string) => {
    panelRef.current.heldId = id;
  }, []);

  return (
    <ChatPanelSlotContext value={register}>
      {shown && (
        <ChatPanel
          key={shown.key}
          conversationId={shown.entry.conversationId}
          initialMessages={shown.entry.initialMessages}
          maxLength={maxLength}
          onConversationStarted={conversationStarted}
        />
      )}
      {children}
    </ChatPanelSlotContext>
  );
}
