"use client";

import { useContext, useLayoutEffect, useSyncExternalStore } from "react";

import {
  type ChatPanelEntry,
  ChatPanelSlotContext,
} from "@/components/chat/chat-panel-host/chat-panel-host";
import { PageLoader } from "@/components/shell/page-loader/page-loader";

const neverChanges = () => () => {};

/** Tells the chat layout's panel which conversation this page shows (R8). */
export function ChatPanelSlot({
  conversationId,
  initialMessages,
}: ChatPanelEntry) {
  const register = useContext(ChatPanelSlotContext);
  if (!register) throw new Error("ChatPanelSlot needs a ChatPanelHost above");
  const hydrated = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  // Before paint, so a page that takes over never shows a frame without the panel.
  useLayoutEffect(
    () => register({ conversationId, initialMessages }),
    [register, conversationId, initialMessages],
  );

  // Server HTML paints at the top; only the client can open the thread at its end.
  return hydrated ? null : <PageLoader />;
}
