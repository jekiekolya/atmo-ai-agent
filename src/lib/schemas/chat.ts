import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/i18n/locales";

const MALFORMED = "validation.body.unparseable";

const locale = z.enum(SUPPORTED_LOCALES, {
  error: "chat.errors.invalidLocale",
});

// Not z.uuid(): FR-004 answers a malformed id as not found, which the service decides.
const conversationId = z.string({ error: MALFORMED });

/** One schema for the composer and POST /api/chat, so both count length the same way (R12). */
export function chatRequestSchema(maxLength: number) {
  return z.discriminatedUnion(
    "trigger",
    [
      z.object({
        trigger: z.literal("submit-message"),
        conversationId: conversationId.optional(),
        locale,
        text: z
          .string({ error: MALFORMED })
          .refine((text) => text.trim() !== "", {
            error: "validation.chat.empty",
            abort: true,
          })
          .refine((text) => text.length <= maxLength, {
            error: "validation.chat.tooLong",
          }),
      }),
      z.object({
        trigger: z.literal("regenerate-message"),
        conversationId,
        locale,
        text: z.never({ error: MALFORMED }).optional(),
      }),
    ],
    { error: MALFORMED },
  );
}

export type ChatRequest = z.infer<ReturnType<typeof chatRequestSchema>>;
