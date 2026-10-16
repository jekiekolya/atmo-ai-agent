"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  type TextMessagePartComponent,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { ArrowUpIcon, CheckIcon, CopyIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useId } from "react";

import {
  MarkdownText,
  MarkdownTextLabels,
} from "@/components/assistant-ui/elements/markdown-text";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/elements/reasoning.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import {
  markedOutcome,
  MessageReplyMarker,
  ReplyMarker,
} from "@/components/chat/reply-marker/reply-marker";
import { Button } from "@/components/ui/button";
import type { ChatMessageMetadata, ChatPart } from "@/lib/chat/messages";

const TryAgainContext = createContext<(() => void) | undefined>(undefined);

const groupBy = groupPartByType({ reasoning: ["group-reasoning"] });

const PlainText: TextMessagePartComponent = ({ text }) => <>{text}</>;

const textOf = (parts: ChatPart[]) =>
  parts.map((part) => (part.type === "text" ? part.text : "")).join("");

/** Earlier replies to this question that failed, kept in the history above the answer (FR-021). */
function FailedAttempts() {
  const attempts = useAuiState(
    (s) =>
      s.message.metadata.custom
        .failedAttempts as ChatMessageMetadata["failedAttempts"],
  );
  if (!attempts?.length) return null;

  return attempts.map((attempt, index) => (
    <div
      key={index}
      className="flex flex-col gap-1 self-stretch border-s-2 border-destructive/40 ps-3 text-sm text-muted-foreground"
    >
      {textOf(attempt.parts) && (
        <p className="whitespace-pre-wrap">{textOf(attempt.parts)}</p>
      )}
      <ReplyMarker outcome="failed" />
    </div>
  ));
}

function FailedReplyAlert() {
  const t = useTranslations("chat");
  const onTryAgain = useContext(TryAgainContext);

  return (
    <ErrorPrimitive.Root className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {t("errors.modelFailed")}
      {onTryAgain && (
        <Button size="sm" variant="outline" onClick={onTryAgain}>
          {t("actions.tryAgain")}
        </Button>
      )}
    </ErrorPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root
      data-role="user"
      className="flex flex-col items-end gap-2"
    >
      <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2 wrap-break-word whitespace-pre-wrap">
        <MessagePrimitive.Parts components={{ Text: PlainText }} />
      </div>
      <FailedAttempts />
    </MessagePrimitive.Root>
  );
}

function CopyAction() {
  const t = useTranslations("chat");
  const isCopied = useAuiState((s) => s.message.isCopied);

  return (
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton
        tooltip={isCopied ? t("actions.copied") : t("actions.copy")}
        side="bottom"
      >
        {isCopied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
  );
}

function AssistantMessage() {
  const t = useTranslations("chat");

  return (
    <MessagePrimitive.Root
      data-role="assistant"
      className="flex flex-col gap-2"
    >
      <div className="leading-relaxed wrap-break-word">
        <MessagePrimitive.GroupedParts groupBy={groupBy}>
          {({ part, children }) => {
            switch (part.type) {
              case "group-reasoning": {
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger
                      active={running}
                      label={
                        running ? t("reasoning.thinking") : t("reasoning.label")
                      }
                    />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "reasoning":
                return <Reasoning {...part} />;
              case "text":
                return <MarkdownText />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
      </div>
      <MessageReplyMarker />
      <AuiIf
        condition={(s) =>
          s.message.isLast &&
          !s.thread.isRunning &&
          markedOutcome(s.message.status, s.message.metadata.custom.outcome) ===
            "failed"
        }
      >
        <FailedReplyAlert />
      </AuiIf>
      <AuiIf
        condition={(s) =>
          s.message.status?.type !== "running" &&
          s.message.parts.some((part) => part.type === "text" && part.text)
        }
      >
        <ActionBarPrimitive.Root className="-ms-1 flex gap-1 text-muted-foreground">
          <CopyAction />
        </ActionBarPrimitive.Root>
      </AuiIf>
    </MessagePrimitive.Root>
  );
}

function ChatMessage() {
  const role = useAuiState((s) => s.message.role);
  return role === "user" ? <UserMessage /> : <AssistantMessage />;
}

function Composer({
  maxLength,
  stopDisabled,
}: {
  maxLength: number;
  stopDisabled?: boolean;
}) {
  const t = useTranslations("chat");
  const tooLongId = useId();
  // No native maxLength: it would silently cut a pasted text (R12).
  const tooLong = useAuiState((s) => s.composer.text.length > maxLength);
  const sendButton = (disabled?: true) => (
    <TooltipIconButton
      tooltip={t("composer.send")}
      variant="default"
      className="size-8 rounded-full"
      {...(disabled && { disabled })}
    >
      <ArrowUpIcon aria-hidden />
    </TooltipIconButton>
  );

  return (
    <ComposerPrimitive.Root className="flex w-full flex-col gap-2 rounded-2xl border bg-background p-2 focus-within:border-ring">
      <ComposerPrimitive.Input
        aria-label={t("composer.label")}
        aria-invalid={tooLong || undefined}
        aria-describedby={tooLong ? tooLongId : undefined}
        placeholder={t("composer.placeholder")}
        rows={1}
        autoFocus
        submitMode={tooLong ? "none" : "enter"}
        cancelOnEscape={!stopDisabled}
        className="max-h-48 min-h-10 w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted-foreground"
      />
      {tooLong && (
        <p id={tooLongId} className="px-2 text-sm text-destructive">
          {t("errors.tooLong", { max: maxLength })}
        </p>
      )}
      <div className="flex justify-end">
        <AuiIf condition={(s) => !s.thread.isRunning}>
          {tooLong ? (
            sendButton(true)
          ) : (
            <ComposerPrimitive.Send asChild>
              {sendButton()}
            </ComposerPrimitive.Send>
          )}
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <TooltipIconButton
              tooltip={t("composer.stop")}
              variant="default"
              className="size-8 rounded-full"
              {...(stopDisabled && { disabled: true })}
            >
              <SquareIcon aria-hidden className="fill-current" />
            </TooltipIconButton>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
}

/** The conversation and its composer, composed from assistant-ui primitives (R9). */
export function ChatThread({
  maxLength,
  stopDisabled,
  alert,
  onTryAgain,
}: {
  maxLength: number;
  stopDisabled?: boolean;
  alert?: ReactNode;
  onTryAgain?: () => void;
}) {
  const t = useTranslations("chat");

  return (
    <TryAgainContext value={onTryAgain}>
      <MarkdownTextLabels copy={t("actions.copy")}>
        <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
          <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6">
              <AuiIf condition={(s) => s.thread.messages.length === 0}>
                <p className="text-xl font-medium">{t("greeting")}</p>
              </AuiIf>
              <ThreadPrimitive.Messages>
                {() => <ChatMessage />}
              </ThreadPrimitive.Messages>
              <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-background pb-4">
                {alert}
                <Composer maxLength={maxLength} stopDisabled={stopDisabled} />
              </ThreadPrimitive.ViewportFooter>
            </div>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MarkdownTextLabels>
    </TryAgainContext>
  );
}
