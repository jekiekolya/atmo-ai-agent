import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "@/lib/schemas/chat";

const schema = chatRequestSchema(10);
const conversationId = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

const send = (text: string, extra: Record<string, unknown> = {}) => ({
  locale: "en",
  trigger: "submit-message",
  text,
  ...extra,
});

function messagesOf(input: unknown) {
  const result = schema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
}

describe("chatRequestSchema", () => {
  it("accepts a message of exactly the maximum length", () => {
    expect(schema.safeParse(send("a".repeat(10))).success).toBe(true);
  });

  it("refuses one character more", () => {
    expect(messagesOf(send("a".repeat(11)))).toEqual([
      "validation.chat.tooLong",
    ]);
  });

  it("counts an emoji as two UTF-16 units", () => {
    expect(schema.safeParse(send("😀".repeat(5))).success).toBe(true);
    expect(messagesOf(send(`${"😀".repeat(5)}a`))).toEqual([
      "validation.chat.tooLong",
    ]);
  });

  it.each(["", "   ", "\n\t"])("refuses the blank message %j", (text) => {
    expect(messagesOf(send(text))).toEqual(["validation.chat.empty"]);
  });

  it("keeps the text as typed", () => {
    expect(schema.parse(send("  Hi\n")).text).toBe("  Hi\n");
  });

  it.each(["en", "uk"])("accepts the locale %s", (locale) => {
    expect(schema.safeParse(send("Hi", { locale })).success).toBe(true);
  });

  it.each(["de", "", undefined])("refuses the locale %j", (locale) => {
    expect(messagesOf(send("Hi", { locale }))).toEqual([
      "chat.errors.invalidLocale",
    ]);
  });

  it("starts a new conversation without an id", () => {
    expect(schema.parse(send("Hi"))).toEqual({
      locale: "en",
      trigger: "submit-message",
      text: "Hi",
    });
  });

  it("continues a conversation with an id", () => {
    expect(schema.parse(send("Hi", { conversationId })).conversationId).toBe(
      conversationId,
    );
  });

  // FR-004: a malformed id is answered as not found, so the schema lets it through to the service.
  it("leaves a malformed conversation id to the ownership check", () => {
    expect(
      schema.safeParse(send("Hi", { conversationId: "nope" })).success,
    ).toBe(true);
  });

  it("refuses a conversation id that is not a string", () => {
    expect(schema.safeParse(send("Hi", { conversationId: 42 })).success).toBe(
      false,
    );
  });

  it("requires text for a new message", () => {
    expect(
      schema.safeParse({ locale: "en", trigger: "submit-message" }).success,
    ).toBe(false);
  });

  it("accepts Try again with a conversation and no text", () => {
    expect(
      schema.parse({
        locale: "uk",
        trigger: "regenerate-message",
        conversationId,
      }),
    ).toEqual({ locale: "uk", trigger: "regenerate-message", conversationId });
  });

  it("refuses Try again without a conversation", () => {
    expect(
      schema.safeParse({ locale: "en", trigger: "regenerate-message" }).success,
    ).toBe(false);
  });

  it("refuses Try again that carries text", () => {
    expect(
      schema.safeParse({
        locale: "en",
        trigger: "regenerate-message",
        conversationId,
        text: "Hi",
      }).success,
    ).toBe(false);
  });

  it.each(["edit-message", undefined])("refuses the trigger %j", (trigger) => {
    expect(schema.safeParse(send("Hi", { trigger })).success).toBe(false);
  });
});
