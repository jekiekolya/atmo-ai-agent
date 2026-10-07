import type { ChatPart, StoredFinish } from "@/lib/chat/messages";
import type { UsageRow } from "@/server/chat/limits";
import { type Db, db } from "@/server/db";
import type { Prisma } from "@generated/client";

export type ConversationSummary = { id: string; title: string };

export type MessageRow = {
  id: string;
  role: "USER" | "ASSISTANT";
  parts: ChatPart[];
  finishReason: StoredFinish | null;
  createdAt: Date;
};

// A question and its first reply share one instant; the enum puts USER before ASSISTANT.
const MESSAGE_ORDER = [
  { createdAt: "asc" },
  { role: "asc" },
  { id: "asc" },
] satisfies Prisma.MessageOrderByWithRelationInput[];

const toJson = (parts: ChatPart[]) => parts as Prisma.InputJsonValue;

/** Serialises one user's turns, so counting and inserting cannot interleave (research R4). */
export async function lockUser(userId: string, client: Db = db): Promise<void> {
  await client.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
}

export function findOwnConversation(
  userId: string,
  id: string,
  client: Db = db,
): Promise<ConversationSummary | null> {
  return client.conversation.findFirst({
    where: { id, userId },
    select: { id: true, title: true },
  });
}

export async function createConversationWithMessage(
  data: { userId: string; title: string; parts: ChatPart[]; now: Date },
  client: Db = db,
): Promise<string> {
  const conversation = await client.conversation.create({
    data: {
      userId: data.userId,
      title: data.title,
      createdAt: data.now,
      updatedAt: data.now,
      messages: {
        create: {
          role: "USER",
          parts: toJson(data.parts),
          createdAt: data.now,
        },
      },
    },
    select: { id: true },
  });
  return conversation.id;
}

export async function createMessage(
  conversationId: string,
  parts: ChatPart[],
  now: Date,
  client: Db = db,
): Promise<void> {
  await client.message.create({
    data: {
      conversationId,
      role: "USER",
      parts: toJson(parts),
      createdAt: now,
    },
  });
}

export async function createReply(
  conversationId: string,
  now: Date,
  client: Db = db,
): Promise<string> {
  const reply = await client.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      parts: [],
      finishReason: "IN_PROGRESS",
      createdAt: now,
    },
    select: { id: true },
  });
  return reply.id;
}

/** A reply left in progress by a crash or a lost request ends as failed (FR-015). */
export async function failStaleReplies(
  userId: string,
  before: Date,
  client: Db = db,
): Promise<void> {
  await client.message.updateMany({
    where: {
      finishReason: "IN_PROGRESS",
      createdAt: { lt: before },
      conversation: { userId },
    },
    data: { finishReason: "FAILED" },
  });
}

export function latestReply(
  conversationId: string,
  client: Db = db,
): Promise<{ id: string; finishReason: StoredFinish | null } | null> {
  return client.message.findFirst({
    where: { conversationId, role: "ASSISTANT" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, finishReason: true },
  });
}

export async function listMessages(
  conversationId: string,
  client: Db = db,
): Promise<MessageRow[]> {
  const rows = await client.message.findMany({
    where: { conversationId },
    orderBy: MESSAGE_ORDER,
    select: {
      id: true,
      role: true,
      parts: true,
      finishReason: true,
      createdAt: true,
    },
  });
  // Stored by this module as UIMessage parts; the stream validates them again before the model (R3).
  return rows.map((row) => ({ ...row, parts: row.parts as ChatPart[] }));
}

/** Writes only while the reply is still in progress: a deleted or swept reply stays as it is (FR-033). */
export async function finishReply(
  replyId: string,
  data: {
    finishReason: Exclude<StoredFinish, "IN_PROGRESS">;
    parts: ChatPart[];
    inputTokens: number | null;
    outputTokens: number | null;
    model: string;
  },
  client: Db = db,
): Promise<boolean> {
  const { count } = await client.message.updateMany({
    where: { id: replyId, finishReason: "IN_PROGRESS" },
    data: { ...data, parts: toJson(data.parts) },
  });
  return count > 0;
}

export async function touchConversation(
  where: { id: string } | { replyId: string },
  now: Date,
  client: Db = db,
): Promise<void> {
  await client.conversation.updateMany({
    where:
      "id" in where
        ? { id: where.id }
        : { messages: { some: { id: where.replyId } } },
    data: { updatedAt: now },
  });
}

export function listConversations(
  userId: string,
  client: Db = db,
): Promise<ConversationSummary[]> {
  return client.conversation.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, title: true },
  });
}

/** Scoped by owner; the messages go with it (FR-032). */
export async function deleteConversation(
  userId: string,
  id: string,
  client: Db = db,
): Promise<boolean> {
  const { count } = await client.conversation.deleteMany({
    where: { id, userId },
  });
  return count > 0;
}

/** The user's ended replies created after `since`, with their usage (R5). */
export function endedRepliesSince(
  userId: string,
  since: Date,
  client: Db = db,
): Promise<UsageRow[]> {
  return client.message.findMany({
    where: {
      role: "ASSISTANT",
      createdAt: { gt: since },
      finishReason: { not: "IN_PROGRESS" },
      conversation: { userId },
    },
    select: { createdAt: true, inputTokens: true, outputTokens: true },
  });
}

/** Every reply the user started after `since`, in progress included: each is one accepted request (R5). */
export async function requestTimesSince(
  userId: string,
  since: Date,
  client: Db = db,
): Promise<Date[]> {
  const rows = await client.message.findMany({
    where: {
      role: "ASSISTANT",
      createdAt: { gt: since },
      conversation: { userId },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return rows.map((row) => row.createdAt);
}
