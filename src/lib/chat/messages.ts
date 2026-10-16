import type { UIMessage } from "ai";
import { z } from "zod";

/** After this long a reply still being written counts as failed (FR-015, FR-017). */
export const REPLY_TIMEOUT_MS = 60_000;

/** A reply still in progress this long after its row was created has failed; the grace covers the stream starting after the row and its end being written. */
export const STALE_REPLY_MS = REPLY_TIMEOUT_MS + 15_000;

export const CHAT_OUTCOMES = [
  "in_progress",
  "completed",
  "stopped",
  "cut",
  "failed",
] as const;

export type ChatOutcome = (typeof CHAT_OUTCOMES)[number];

export type ChatPart = UIMessage["parts"][number];

export const chatMessageMetadataSchema = z.object({
  conversationId: z.string().optional(),
  outcome: z.enum(CHAT_OUTCOMES).optional(),
  failedAttempts: z
    .array(z.object({ parts: z.array(z.custom<ChatPart>()) }))
    .optional(),
});

export type ChatMessageMetadata = z.infer<typeof chatMessageMetadataSchema>;

export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

/** The stored finish reason, as the `ReplyFinish` enum spells it. */
export type StoredFinish =
  "IN_PROGRESS" | "COMPLETED" | "STOPPED" | "CUT" | "FAILED";

export const OUTCOME_OF: Record<
  Exclude<StoredFinish, "IN_PROGRESS">,
  ChatOutcome
> = {
  COMPLETED: "completed",
  STOPPED: "stopped",
  CUT: "cut",
  FAILED: "failed",
};

export function effectiveOutcome(
  reply: { finishReason: StoredFinish; createdAt: Date },
  now: Date,
): ChatOutcome {
  if (reply.finishReason !== "IN_PROGRESS") {
    return OUTCOME_OF[reply.finishReason];
  }
  const age = now.getTime() - reply.createdAt.getTime();
  return age > STALE_REPLY_MS ? "failed" : "in_progress";
}

/** Failed replies that a later reply answered move under their question, as on screen before a reload (R10). */
export function foldFailedReplies(messages: ChatUIMessage[]): ChatUIMessage[] {
  const folded: ChatUIMessage[] = [];

  messages.forEach((message, index) => {
    const next = messages[index + 1];
    const answeredLater =
      message.role === "assistant" &&
      message.metadata?.outcome === "failed" &&
      next?.role === "assistant";
    const question = folded.at(-1);

    if (answeredLater && question?.role === "user") {
      folded[folded.length - 1] = {
        ...question,
        metadata: {
          ...question.metadata,
          failedAttempts: [
            ...(question.metadata?.failedAttempts ?? []),
            { parts: message.parts },
          ],
        },
      };
      return;
    }
    folded.push(message);
  });

  return folded;
}
