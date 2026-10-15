import type { UIMessage } from "ai";
import { z } from "zod";

import { config } from "@/config";
import {
  type ChatPart,
  type ChatUIMessage,
  effectiveOutcome,
  foldFailedReplies,
  STALE_REPLY_MS,
  type StoredFinish,
} from "@/lib/chat/messages";
import type { ChatRequest } from "@/lib/schemas/chat";
import type { Actor } from "@/server/auth/authorization";
import { assertChatAccess } from "@/server/chat/access";
import * as repository from "@/server/chat/chat-repository";
import { toModelHistory } from "@/server/chat/history";
import { secondsUntilBudgetFrees } from "@/server/chat/limits";
import { deriveTitle } from "@/server/chat/title";
import { type Db, db } from "@/server/db";
import { ConflictError, NotFoundError, RateLimitError } from "@/server/errors";
import { isUniqueViolation } from "@/server/prisma-errors";

export type ChatLimits = Pick<
  typeof config.chat,
  "rateLimitPerMinute" | "dailyTokenBudget" | "historyLimit"
>;

export type ChatTurn = {
  conversationId: string;
  isNew: boolean;
  replyId: string;
  history: UIMessage[];
};

export type ReplyResult = {
  outcome: Exclude<StoredFinish, "IN_PROGRESS">;
  parts: ChatPart[];
  usage: { inputTokens: number | undefined; outputTokens: number | undefined };
  model: string;
};

const conversationIdSchema = z.uuid();

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Daily first: waiting a minute would not help (FR-040). Runs under the user's row lock (R4, R5). */
async function assertWithinLimits(
  userId: string,
  limits: ChatLimits,
  now: Date,
  client: Db,
): Promise<void> {
  const usage = await repository.endedRepliesSince(
    userId,
    new Date(now.getTime() - DAY_MS),
    client,
  );
  const used = usage.reduce(
    (sum, row) => sum + (row.inputTokens ?? 0) + (row.outputTokens ?? 0),
    0,
  );
  if (used >= limits.dailyTokenBudget) {
    throw new RateLimitError(
      "daily_limit_reached",
      secondsUntilBudgetFrees(usage, limits.dailyTokenBudget, now),
    );
  }

  const recent = await repository.requestTimesSince(
    userId,
    new Date(now.getTime() - MINUTE_MS),
    client,
  );
  if (recent.length >= limits.rateLimitPerMinute) {
    const freesAt = recent[0].getTime() + MINUTE_MS;
    throw new RateLimitError(
      "rate_limited",
      Math.max(1, Math.ceil((freesAt - now.getTime()) / 1000)),
    );
  }
}

/** Missing, another user's, and malformed all read the same (FR-004). */
async function ownConversation(
  actor: Actor,
  id: string,
  client: Db = db,
): Promise<repository.ConversationSummary> {
  if (!conversationIdSchema.safeParse(id).success) throw new NotFoundError();
  const conversation = await repository.findOwnConversation(
    actor.id,
    id,
    client,
  );
  if (!conversation) throw new NotFoundError();
  return conversation;
}

function assertTurnAllowed(
  trigger: ChatRequest["trigger"],
  latest: { finishReason: StoredFinish | null } | null,
): void {
  if (latest?.finishReason === "IN_PROGRESS") {
    throw new ConflictError("reply_in_progress");
  }
  if (trigger === "regenerate-message" && latest?.finishReason !== "FAILED") {
    throw new ConflictError("nothing_to_retry");
  }
}

/** One transaction under the user's row lock: ownership, turn state, the question, and the reply row (R4). */
export async function startChatTurn(
  actor: Actor,
  input: ChatRequest,
  now: Date,
  limits: ChatLimits = config.chat,
): Promise<ChatTurn> {
  assertChatAccess(actor);

  try {
    return await db.$transaction(async (tx) => {
      await repository.lockUser(actor.id, tx);

      const existing =
        input.conversationId === undefined
          ? null
          : await ownConversation(actor, input.conversationId, tx);

      await repository.failStaleReplies(
        actor.id,
        new Date(now.getTime() - STALE_REPLY_MS),
        tx,
      );

      if (existing) {
        assertTurnAllowed(
          input.trigger,
          await repository.latestReply(existing.id, tx),
        );
      }

      await assertWithinLimits(actor.id, limits, now, tx);

      let conversationId: string;
      if (input.trigger === "submit-message") {
        const parts: ChatPart[] = [{ type: "text", text: input.text }];
        if (existing) {
          conversationId = existing.id;
          await repository.createMessage(conversationId, parts, now, tx);
        } else {
          conversationId = await repository.createConversationWithMessage(
            {
              userId: actor.id,
              title: deriveTitle(input.text),
              parts,
              now,
            },
            tx,
          );
        }
      } else {
        if (!existing) throw new NotFoundError();
        conversationId = existing.id;
      }

      const replyId = await repository.createReply(conversationId, now, tx);
      await repository.touchConversation({ id: conversationId }, now, tx);

      const rows = await repository.listMessages(conversationId, tx);
      return {
        conversationId,
        isNew: existing === null,
        replyId,
        history: toModelHistory(rows, limits.historyLimit),
      };
    });
  } catch (error) {
    // The partial unique index is the last guard of FR-023.
    if (isUniqueViolation(error, "messages_one_reply_in_progress")) {
      throw new ConflictError("reply_in_progress");
    }
    throw error;
  }
}

const STORED_PART_TYPES = new Set<ChatPart["type"]>(["reasoning", "text"]);

/** Records how a reply ended; does nothing once it has ended or its conversation is gone (FR-033). */
export async function finishReply(
  replyId: string,
  result: ReplyResult,
  now: Date,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const written = await repository.finishReply(
      replyId,
      {
        finishReason: result.outcome,
        parts: result.parts.filter((part) => STORED_PART_TYPES.has(part.type)),
        inputTokens: result.usage.inputTokens ?? null,
        outputTokens: result.usage.outputTokens ?? null,
        model: result.model,
      },
      tx,
    );
    if (written) await repository.touchConversation({ replyId }, now, tx);
  });
}

export async function getOwnConversation(
  actor: Actor,
  id: string,
  now: Date,
): Promise<{ id: string; title: string; messages: ChatUIMessage[] }> {
  assertChatAccess(actor);
  const conversation = await ownConversation(actor, id);
  const rows = await repository.listMessages(conversation.id);

  const messages = rows.map((row): ChatUIMessage =>
    row.role === "USER"
      ? { id: row.id, role: "user", parts: row.parts }
      : {
          id: row.id,
          role: "assistant",
          parts: row.parts,
          metadata: {
            outcome: effectiveOutcome(
              {
                finishReason: row.finishReason ?? "FAILED",
                createdAt: row.createdAt,
              },
              now,
            ),
          },
        },
  );

  return {
    id: conversation.id,
    title: conversation.title,
    messages: foldFailedReplies(messages),
  };
}

/** The ownership check alone, for the conversation page's layout (R7). */
export async function findOwnConversation(
  actor: Actor,
  id: string,
): Promise<repository.ConversationSummary> {
  assertChatAccess(actor);
  return ownConversation(actor, id);
}

export async function listConversations(
  actor: Actor,
): Promise<repository.ConversationSummary[]> {
  assertChatAccess(actor);
  return repository.listConversations(actor.id);
}

export async function deleteConversation(
  actor: Actor,
  id: string,
): Promise<void> {
  assertChatAccess(actor);
  if (!conversationIdSchema.safeParse(id).success) throw new NotFoundError();
  if (!(await repository.deleteConversation(actor.id, id))) {
    throw new NotFoundError();
  }
}
