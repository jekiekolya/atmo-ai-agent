import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import { ToolLoopAgent } from "ai";
import { z } from "zod";

import { config } from "@/config";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import {
  buildInstructions,
  type InstructionOptions,
} from "@/server/chat/instructions";

/** The one place the model is named (FR-047). */
export const GEMINI_MODEL_ID = "gemini-3.5-flash-lite";

/** Reasoning and text together (FR-052, R1). */
export const MAX_OUTPUT_TOKENS = 4096;

export type ChatAgent = ToolLoopAgent<InstructionOptions>;

const callOptionsSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  today: z.iso.date(),
});

async function buildModel() {
  if (config.ai.fakeModel) {
    return (await import("./fake-model")).createFakeModel();
  }
  const google = createGoogleGenerativeAI({ apiKey: config.ai.googleApiKey });
  return google(GEMINI_MODEL_ID);
}

type ChatModel = Awaited<ReturnType<typeof buildModel>>;

/** The agent's whole configuration around a given model; tests pass a mock model. */
export function createChatAgent(model: ChatModel): ChatAgent {
  return new ToolLoopAgent<InstructionOptions>({
    model,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    providerOptions: {
      google: {
        thinkingConfig: { thinkingLevel: "medium", includeThoughts: true },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    callOptionsSchema,
    prepareCall: ({ options, ...rest }) => ({
      ...rest,
      instructions: buildInstructions(options),
    }),
  });
}

async function buildAgent(): Promise<{ agent: ChatAgent; modelId: string }> {
  const model = await buildModel();
  return { agent: createChatAgent(model), modelId: model.modelId };
}

let cached: Promise<{ agent: ChatAgent; modelId: string }> | undefined;

/** One agent per process, built on first use so the test model loads only when enabled (R2, R13). */
export function getChatAgent(): Promise<{ agent: ChatAgent; modelId: string }> {
  // A failed build is not kept: the next request tries again.
  cached ??= buildAgent().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
