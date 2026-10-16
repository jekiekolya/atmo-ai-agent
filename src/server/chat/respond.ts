import {
  consumeStream,
  createAgentUIStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  type LanguageModelUsage,
} from "ai";

import {
  type ChatMessageMetadata,
  type ChatPart,
  type ChatUIMessage,
  OUTCOME_OF,
  REPLY_TIMEOUT_MS,
} from "@/lib/chat/messages";
import type { ChatRequest } from "@/lib/schemas/chat";
import type { Actor } from "@/server/auth/authorization";
import { getChatAgent } from "@/server/chat/agent";
import {
  finishReply,
  type ReplyResult,
  startChatTurn,
} from "@/server/chat/chat-service";
import { decideOutcome } from "@/server/chat/outcome";

async function record(replyId: string, result: ReplyResult): Promise<void> {
  try {
    await finishReply(replyId, result, new Date());
  } catch (error) {
    // The stream has already ended for the user; a failed write is the stale sweep's to clean up.
    console.error(error);
  }
}

/** Starts the turn, then streams the agent's reply; the reply row records how it ended (R3, R4). */
export async function respondToChat(
  actor: Actor,
  input: ChatRequest,
  signal: AbortSignal,
  now: Date = new Date(),
  timeoutMs: number = REPLY_TIMEOUT_MS,
): Promise<Response> {
  // Before the turn: a build failure must leave nothing stored.
  const { agent, modelId } = await getChatAgent();
  const turn = await startChatTurn(actor, input, now);

  let errored = false;
  let finishReason: FinishReason | undefined;
  let usage: LanguageModelUsage | undefined;

  try {
    return await createAgentUIStreamResponse({
      agent,
      uiMessages: turn.history,
      options: { locale: input.locale, today: now.toISOString().slice(0, 10) },
      abortSignal: signal,
      timeout: timeoutMs,
      generateMessageId: () => turn.replyId,
      sendReasoning: true,
      messageMetadata: ({ part }): ChatMessageMetadata | undefined => {
        if (part.type === "start") {
          return { conversationId: turn.conversationId };
        }
        if (part.type === "finish") {
          finishReason = part.finishReason;
          usage = part.totalUsage;
          const outcome = decideOutcome({
            errored,
            isAborted: false,
            clientAborted: false,
            finishReason,
          });
          return { outcome: OUTCOME_OF[outcome] };
        }
        // An abort the client did not cause is the timeout (R4).
        if (part.type === "abort" && !signal.aborted) {
          return { outcome: "failed" };
        }
        return undefined;
      },
      onError: (error) => {
        errored = true;
        console.error(error);
        return "model_failed";
      },
      onEnd: ({ responseMessage, isAborted }) =>
        record(turn.replyId, {
          outcome: decideOutcome({
            errored,
            isAborted,
            clientAborted: signal.aborted,
            finishReason,
          }),
          parts: responseMessage.parts as ChatPart[],
          usage: {
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
          },
          model: modelId,
        }),
      consumeSseStream: consumeStream,
    });
  } catch (error) {
    console.error(error);
    await record(turn.replyId, {
      outcome: "FAILED",
      parts: [],
      usage: { inputTokens: undefined, outputTokens: undefined },
      model: modelId,
    });
    // The question is stored, so the browser gets a failed reply it can try again, not a 500.
    return createUIMessageStreamResponse({
      stream: createUIMessageStream<ChatUIMessage>({
        execute: ({ writer }) => {
          writer.write({
            type: "start",
            messageId: turn.replyId,
            messageMetadata: { conversationId: turn.conversationId },
          });
          writer.write({ type: "error", errorText: "model_failed" });
        },
      }),
    });
  }
}
