"use client";

import { useChat } from "@ai-sdk/react";
import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { APICallError, DefaultChatTransport } from "ai";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ChatThread } from "@/components/chat/chat-thread/chat-thread";
import { FormAlert } from "@/components/form-kit/form-alert/form-alert";
import { PageLoader } from "@/components/shell/page-loader/page-loader";
import { getPathname, useRouter } from "@/i18n/navigation";
import { chatFetch } from "@/lib/http/client/chat-fetch";
import {
  type ChatUIMessage,
  chatMessageMetadataSchema,
} from "@/lib/chat/messages";
import { hoursUntilAvailable } from "@/lib/chat/availability";
import { API_ROUTES, PAGES, pathTo } from "@/lib/routes";

type Refusal = {
  code: string;
  fields?: Record<string, string[]>;
  retryAfterSeconds?: number;
};

type PendingRequest = { trigger: string; text: string | undefined };

const STOP_SETTLE_MS = 1_000;

const neverChanges = () => () => {};

function refusalOf(error: Error): Refusal | null {
  if (!APICallError.isInstance(error)) return null;
  try {
    const body = JSON.parse(error.responseBody ?? "") as { error?: Refusal };
    if (body.error?.code) return body.error;
  } catch {
    // A body that is not our envelope, such as a bare 500.
  }
  return { code: "unexpected" };
}

const REFUSAL_KEYS: Partial<Record<string, string>> = {
  rate_limited: "chat.errors.rateLimited",
  not_found: "chat.errors.notFound",
  reply_in_progress: "chat.errors.inProgress",
  nothing_to_retry: "chat.errors.nothingToRetry",
};

/** The failed reply moves under its question before Try again, as the reloaded page shows it (R10). */
function foldTrailingFailure(messages: ChatUIMessage[]): ChatUIMessage[] {
  const failed = messages.at(-1);
  const question = messages.at(-2);
  if (failed?.role !== "assistant" || question?.role !== "user") {
    return messages;
  }
  return [
    ...messages.slice(0, -2),
    {
      ...question,
      metadata: {
        ...question.metadata,
        failedAttempts: [
          ...(question.metadata?.failedAttempts ?? []),
          { parts: failed.parts },
        ],
      },
    },
  ];
}

function textOf(message: ChatUIMessage | undefined): string | undefined {
  return message?.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

/** The chat's browser side: useChat over our endpoint, rendered by assistant-ui (R8, R9, R11). */
export function ChatPanel({
  conversationId,
  initialMessages,
  maxLength,
}: {
  conversationId?: string;
  initialMessages: ChatUIMessage[];
  maxLength: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
  const localeRef = useRef(locale);
  const router = useRouter();
  const [alert, setAlert] = useState<string | null>(null);
  const [chatId] = useState(() => conversationId ?? crypto.randomUUID());
  const idRef = useRef(conversationId);
  const pendingRef = useRef<PendingRequest | null>(null);
  const beforeRetryRef = useRef<ChatUIMessage[] | null>(null);
  const handlersRef = useRef<{
    refused: (refusal: Refusal) => void;
    finished: (message: ChatUIMessage) => void;
  }>({ refused: () => {}, finished: () => {} });

  const [transport] = useState(
    // eslint-disable-next-line react-hooks/refs -- the transport reads the refs when a request is sent, never during render
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: API_ROUTES.chat,
        fetch: chatFetch,
        prepareSendMessagesRequest: ({ messages, trigger }) => {
          const text =
            trigger === "submit-message" ? textOf(messages.at(-1)) : undefined;
          pendingRef.current = { trigger, text };
          setAlert(null);
          return {
            body: {
              conversationId: idRef.current,
              locale: localeRef.current,
              trigger,
              text,
            },
          };
        },
      }),
  );

  const chat = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    messageMetadataSchema: chatMessageMetadataSchema,
    transport,
    onError: (error) => {
      const refusal = refusalOf(error);
      // The SDK records the error only after this callback; clearing it must come later.
      if (refusal) queueMicrotask(() => handlersRef.current.refused(refusal));
    },
    onFinish: ({ message, isAbort }) =>
      // After Stop the server learns of the abort only when the connection closes; give it time to store the reply.
      setTimeout(
        () => handlersRef.current.finished(message),
        isAbort ? STOP_SETTLE_MS : 0,
      ),
  });

  const lastMessage = chat.messages.at(-1);
  const isRunning = chat.status === "submitted" || chat.status === "streaming";
  const runtime = useAISDKRuntime(chat, {
    // Another tab's reply is still being written: a question now would be refused (FR-012).
    isSendDisabled:
      isRunning ||
      (lastMessage?.role === "assistant" &&
        lastMessage.metadata?.outcome === "in_progress"),
  });

  const conversationPath = (id: string) =>
    pathTo(PAGES.chatConversation, { id });

  useEffect(() => {
    const id = chat.messages.findLast(
      (message) => message.metadata?.conversationId,
    )?.metadata?.conversationId;
    if (id && !idRef.current) {
      idRef.current = id;
      window.history.replaceState(
        null,
        "",
        getPathname({ href: conversationPath(id), locale }),
      );
    }
  }, [chat.messages, locale]);

  useEffect(() => {
    localeRef.current = locale;
    handlersRef.current = {
      refused: (refusal) => {
        const pending = pendingRef.current;
        chat.clearError();
        if (pending?.trigger === "submit-message") {
          chat.setMessages((messages) =>
            messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages,
          );
          runtime.thread.composer.setText(pending.text ?? "");
        } else if (beforeRetryRef.current) {
          chat.setMessages(beforeRetryRef.current);
        }
        if (refusal.code === "daily_limit_reached") {
          const availability = hoursUntilAvailable(
            refusal.retryAfterSeconds ?? 0,
          );
          setAlert(
            availability.underHour
              ? t("chat.errors.dailyLimitUnderHour")
              : t("chat.errors.dailyLimitHours", { hours: availability.hours }),
          );
          return;
        }
        const key =
          Object.values(refusal.fields ?? {})[0]?.[0] ??
          REFUSAL_KEYS[refusal.code] ??
          (refusal.code === "unexpected"
            ? "errors.unexpected"
            : `errors.codes.${refusal.code}`);
        // Keys known only at runtime; the catalog tests prove each exists.
        setAlert(t(key as Parameters<typeof t>[0], { max: maxLength }));
      },
      finished: (message) => {
        // onFinish can run before the effect above has seen the start chunk.
        const id = idRef.current ?? message.metadata?.conversationId;
        // A navigation keeps the shared layout as it was; the refresh re-renders the sidebar (FR-031).
        if (id && !conversationId) router.replace(conversationPath(id));
        router.refresh();
      },
    };
  });

  function tryAgain() {
    beforeRetryRef.current = chat.messages;
    chat.setMessages(foldTrailingFailure(chat.messages));
    chat.clearError();
    void chat.regenerate();
  }

  // Server HTML paints at the top; only the client can open the thread at its end.
  if (!hydrated) return <PageLoader />;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatThread
        maxLength={maxLength}
        alert={<FormAlert message={alert} />}
        onTryAgain={tryAgain}
      />
    </AssistantRuntimeProvider>
  );
}
