import {
  consumeStream,
  createAgentUIStreamResponse,
  type FinishReason,
  type LanguageModelUsage,
} from "ai";

import {
  type ChatMessageMetadata,
  type ChatPart,
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
  const turn = await startChatTurn(actor, input, now);
  const { agent, modelId } = await getChatAgent();

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
    await record(turn.replyId, {
      outcome: "FAILED",
      parts: [],
      usage: { inputTokens: undefined, outputTokens: undefined },
      model: modelId,
    });
    throw error;
  }
}
