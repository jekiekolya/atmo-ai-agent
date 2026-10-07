import { describe, expect, it } from "vitest";

import { Role } from "@generated/client";
import { CHAT_ACCESS, CHAT_ROLES, canUseChat } from "@/server/chat/access";
import {
  deleteConversation,
  finishReply,
  getOwnConversation,
  listConversations,
  startChatTurn,
} from "@/server/chat/chat-service";
import { db } from "@/server/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from "@/server/errors";
import {
  actorOf,
  createSuperAdminRow,
  createUserRow,
} from "@/server/testing/fixtures";

const T0 = new Date("2026-10-04T12:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

const limits = {
  rateLimitPerMinute: 100,
  dailyTokenBudget: 1_000_000,
  historyLimit: 50,
};

const send = (text: string, conversationId?: string) => ({
  trigger: "submit-message" as const,
  locale: "en" as const,
  text,
  ...(conversationId && { conversationId }),
});

const completed = {
  outcome: "COMPLETED" as const,
  parts: [
    { type: "reasoning" as const, text: "Thinking." },
    { type: "text" as const, text: "An answer." },
  ],
  usage: { inputTokens: 10, outputTokens: 20 },
  model: "fake-model",
};

async function rowsOf(conversationId: string) {
  return db.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { role: "asc" }],
  });
}

async function conversationWithEndedReply(
  actor: ReturnType<typeof actorOf>,
  now = at(0),
) {
  const turn = await startChatTurn(actor, send("First question"), now, limits);
  await finishReply(turn.replyId, completed, now);
  return turn.conversationId;
}

describe("startChatTurn — a new conversation (FR-006, FR-008)", () => {
  it("stores the conversation, its title, the question, and one reply in progress", async () => {
    const user = await createUserRow();

    const turn = await startChatTurn(
      actorOf(user),
      send("  How   does an\ninverter work?  "),
      at(0),
      limits,
    );

    expect(turn.isNew).toBe(true);
    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id: turn.conversationId },
    });
    expect(conversation).toMatchObject({
      userId: user.id,
      title: "How does an inverter work?",
      createdAt: at(0),
      updatedAt: at(0),
    });

    const rows = await rowsOf(turn.conversationId);
    expect(rows).toMatchObject([
      {
        role: "USER",
        parts: [{ type: "text", text: "  How   does an\ninverter work?  " }],
        finishReason: null,
        createdAt: at(0),
      },
      {
        id: turn.replyId,
        role: "ASSISTANT",
        parts: [],
        finishReason: "IN_PROGRESS",
        createdAt: at(0),
      },
    ]);
  });

  it("returns the model history: the question only", async () => {
    const user = await createUserRow();

    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    const [question] = await rowsOf(turn.conversationId);
    expect(turn.history).toEqual([
      { id: question.id, role: "user", parts: [{ type: "text", text: "Hi" }] },
    ]);
  });
});

describe("startChatTurn — an existing conversation", () => {
  it("appends the question and a reply, and touches the conversation", async () => {
    const user = await createUserRow();
    const id = await conversationWithEndedReply(actorOf(user));

    const turn = await startChatTurn(
      actorOf(user),
      send("Second", id),
      at(30),
      limits,
    );

    expect(turn).toMatchObject({ conversationId: id, isNew: false });
    const rows = await rowsOf(id);
    expect(rows.map((row) => [row.role, row.finishReason])).toEqual([
      ["USER", null],
      ["ASSISTANT", "COMPLETED"],
      ["USER", null],
      ["ASSISTANT", "IN_PROGRESS"],
    ]);
    expect(rows[3].id).toBe(turn.replyId);
    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id },
    });
    expect(conversation.updatedAt).toEqual(at(30));
    expect(conversation.title).toBe("First question");
  });

  it("returns the history without reasoning and without the reply being written", async () => {
    const user = await createUserRow();
    const id = await conversationWithEndedReply(actorOf(user));

    const turn = await startChatTurn(
      actorOf(user),
      send("Second", id),
      at(30),
      limits,
    );

    expect(
      turn.history.map((message) => [message.role, message.parts]),
    ).toEqual([
      ["user", [{ type: "text", text: "First question" }]],
      ["assistant", [{ type: "text", text: "An answer." }]],
      ["user", [{ type: "text", text: "Second" }]],
    ]);
  });
});

describe("startChatTurn — ownership (FR-004)", () => {
  it.each([
    ["another user's conversation", "other"],
    ["a random id", "random"],
    ["a malformed id", "malformed"],
  ] as const)("answers %s as not found and stores nothing", async (_, kind) => {
    const owner = await createUserRow();
    const stranger = await createUserRow();
    const ownersId = await conversationWithEndedReply(actorOf(owner));
    const id = {
      other: ownersId,
      random: crypto.randomUUID(),
      malformed: "nope",
    }[kind];
    const before = await db.message.count();

    await expect(
      startChatTurn(actorOf(stranger), send("Hi", id), at(30), limits),
    ).rejects.toThrow(NotFoundError);

    expect(await db.message.count()).toBe(before);
    expect(await db.conversation.count()).toBe(1);
  });

  it("gives the super admin no access to an admin's conversation", async () => {
    const admin = await createUserRow();
    const owner = await createSuperAdminRow();
    const id = await conversationWithEndedReply(actorOf(admin));

    await expect(
      startChatTurn(actorOf(owner), send("Hi", id), at(30), limits),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("chat access (FR-001)", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)("lets %s use the chat", (role) => {
    expect(canUseChat(role)).toBe(true);
  });

  it("decides every role there is, so a new role gets no chat by accident", () => {
    expect(Object.keys(CHAT_ACCESS).sort()).toEqual(Object.values(Role).sort());
    expect([...CHAT_ROLES].sort()).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  it("refuses a role it does not know", () => {
    expect(canUseChat("CUSTOMER" as Role)).toBe(false);
  });

  it("refuses a role that is not a staff role in every function", async () => {
    const user = await createUserRow();
    const customer = { id: user.id, role: "CUSTOMER" as Role };

    await expect(
      startChatTurn(customer, send("Hi"), at(0), limits),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      getOwnConversation(customer, crypto.randomUUID(), at(0)),
    ).rejects.toThrow(ForbiddenError);
    expect(await db.conversation.count()).toBe(0);
  });
});

describe("startChatTurn — turn state", () => {
  it("refuses a question while a reply is being written (FR-012)", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    await expect(
      startChatTurn(
        actorOf(user),
        send("Again", turn.conversationId),
        at(30),
        limits,
      ),
    ).rejects.toThrow(new ConflictError("reply_in_progress"));
    expect(await rowsOf(turn.conversationId)).toHaveLength(2);
  });

  it("fails a reply left in progress past the timeout and accepts the question (FR-015)", async () => {
    const user = await createUserRow();
    const stale = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    await startChatTurn(
      actorOf(user),
      send("Again", stale.conversationId),
      at(60.001),
      limits,
    );

    const reply = await db.message.findUniqueOrThrow({
      where: { id: stale.replyId },
    });
    expect(reply.finishReason).toBe("FAILED");
  });

  it("starts exactly one reply when two questions arrive at once (FR-023)", async () => {
    const user = await createUserRow();
    const id = await conversationWithEndedReply(actorOf(user));

    const results = await Promise.allSettled([
      startChatTurn(actorOf(user), send("One", id), at(30), limits),
      startChatTurn(actorOf(user), send("Two", id), at(30), limits),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toEqual(
      new ConflictError("reply_in_progress"),
    );
    expect(
      await db.message.count({
        where: { conversationId: id, finishReason: "IN_PROGRESS" },
      }),
    ).toBe(1);
  });
});

describe("finishReply", () => {
  it("stores the outcome, the parts with reasoning, the usage, and the model, and touches the conversation", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    await finishReply(turn.replyId, completed, at(5));

    const reply = await db.message.findUniqueOrThrow({
      where: { id: turn.replyId },
    });
    expect(reply).toMatchObject({
      finishReason: "COMPLETED",
      parts: completed.parts,
      inputTokens: 10,
      outputTokens: 20,
      model: "fake-model",
    });
    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id: turn.conversationId },
    });
    expect(conversation.updatedAt).toEqual(at(5));
  });

  it("keeps only reasoning and text parts", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    await finishReply(
      turn.replyId,
      {
        ...completed,
        parts: [{ type: "step-start" }, ...completed.parts],
      },
      at(5),
    );

    const reply = await db.message.findUniqueOrThrow({
      where: { id: turn.replyId },
    });
    expect(reply.parts).toEqual(completed.parts);
  });

  it("does nothing the second time", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);
    await finishReply(turn.replyId, completed, at(5));

    await finishReply(
      turn.replyId,
      { ...completed, outcome: "FAILED", parts: [] },
      at(9),
    );

    const reply = await db.message.findUniqueOrThrow({
      where: { id: turn.replyId },
    });
    expect(reply.finishReason).toBe("COMPLETED");
    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id: turn.conversationId },
    });
    expect(conversation.updatedAt).toEqual(at(5));
  });

  it("stores usage the provider never reported as null", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    await finishReply(
      turn.replyId,
      {
        ...completed,
        usage: { inputTokens: undefined, outputTokens: undefined },
      },
      at(5),
    );

    const reply = await db.message.findUniqueOrThrow({
      where: { id: turn.replyId },
    });
    expect(reply).toMatchObject({ inputTokens: null, outputTokens: null });
  });
});

describe("getOwnConversation", () => {
  it("returns the title and the messages with each reply's outcome", async () => {
    const user = await createUserRow();
    const id = await conversationWithEndedReply(actorOf(user));
    const second = await startChatTurn(
      actorOf(user),
      send("Second", id),
      at(30),
      limits,
    );

    const conversation = await getOwnConversation(actorOf(user), id, at(31));

    expect(conversation.title).toBe("First question");
    expect(
      conversation.messages.map((message) => [
        message.role,
        message.metadata?.outcome,
      ]),
    ).toEqual([
      ["user", undefined],
      ["assistant", "completed"],
      ["user", undefined],
      ["assistant", "in_progress"],
    ]);
    expect(conversation.messages[1]).toMatchObject({
      parts: completed.parts,
    });
    expect(conversation.messages[3].id).toBe(second.replyId);
  });

  it("reads a reply left in progress past the timeout as failed", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    const conversation = await getOwnConversation(
      actorOf(user),
      turn.conversationId,
      at(61),
    );

    expect(conversation.messages[1].metadata?.outcome).toBe("failed");
  });

  it.each(["other", "random", "malformed"] as const)(
    "answers the %s conversation as not found",
    async (kind) => {
      const owner = await createUserRow();
      const stranger = await createUserRow();
      const ownersId = await conversationWithEndedReply(actorOf(owner));
      const id = {
        other: ownersId,
        random: crypto.randomUUID(),
        malformed: "nope",
      }[kind];

      await expect(
        getOwnConversation(actorOf(stranger), id, at(5)),
      ).rejects.toThrow(NotFoundError);
    },
  );
});

describe("listConversations (FR-029)", () => {
  it("lists only the actor's conversations, most recent activity first, by title", async () => {
    const user = await createUserRow();
    const other = await createUserRow();
    const first = await startChatTurn(
      actorOf(user),
      send("First"),
      at(0),
      limits,
    );
    await finishReply(first.replyId, completed, at(1));
    const second = await startChatTurn(
      actorOf(user),
      send("Second"),
      at(10),
      limits,
    );
    await finishReply(second.replyId, completed, at(11));
    await conversationWithEndedReply(actorOf(other), at(20));

    expect(await listConversations(actorOf(user))).toEqual([
      { id: second.conversationId, title: "Second" },
      { id: first.conversationId, title: "First" },
    ]);

    const again = await startChatTurn(
      actorOf(user),
      send("More", first.conversationId),
      at(30),
      limits,
    );
    await finishReply(again.replyId, completed, at(31));

    expect(
      (await listConversations(actorOf(user))).map(
        (conversation) => conversation.title,
      ),
    ).toEqual(["First", "Second"]);
  });

  it("refuses a role without the chat", async () => {
    const user = await createUserRow();
    await expect(
      listConversations({ id: user.id, role: "CUSTOMER" as Role }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("deleteConversation (FR-032, FR-033)", () => {
  it("removes the conversation and all its messages", async () => {
    const user = await createUserRow();
    const id = await conversationWithEndedReply(actorOf(user));

    await deleteConversation(actorOf(user), id);

    expect(await db.conversation.count({ where: { id } })).toBe(0);
    expect(await db.message.count({ where: { conversationId: id } })).toBe(0);
  });

  it.each(["other", "random", "malformed"] as const)(
    "answers the %s conversation as not found and deletes nothing",
    async (kind) => {
      const owner = await createUserRow();
      const stranger = await createUserRow();
      const ownersId = await conversationWithEndedReply(actorOf(owner));
      const id = {
        other: ownersId,
        random: crypto.randomUUID(),
        malformed: "nope",
      }[kind];

      await expect(deleteConversation(actorOf(stranger), id)).rejects.toThrow(
        NotFoundError,
      );
      expect(await db.conversation.count()).toBe(1);
      expect(await db.message.count()).toBe(2);
    },
  );

  it("stores nothing, and brings nothing back, for a reply that ends after its conversation is deleted", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);

    await deleteConversation(actorOf(user), turn.conversationId);
    await finishReply(turn.replyId, completed, at(5));

    expect(await db.conversation.count()).toBe(0);
    expect(await db.message.count()).toBe(0);
  });
});

describe("startChatTurn — Try again (FR-022, SC-006)", () => {
  const retry = (conversationId: string) => ({
    trigger: "regenerate-message" as const,
    locale: "en" as const,
    conversationId,
  });

  async function conversationEndingWith(
    outcome: "FAILED" | "COMPLETED" | "STOPPED" | "CUT",
  ) {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);
    await finishReply(
      turn.replyId,
      { ...completed, outcome, parts: [{ type: "text", text: "Partial" }] },
      at(1),
    );
    return { actor: actorOf(user), id: turn.conversationId };
  }

  it("answers the question again after a failure, storing a new reply and no second question", async () => {
    const { actor, id } = await conversationEndingWith("FAILED");

    const turn = await startChatTurn(actor, retry(id), at(10), limits);

    const rows = await rowsOf(id);
    expect(rows.map((row) => [row.role, row.finishReason])).toEqual([
      ["USER", null],
      ["ASSISTANT", "FAILED"],
      ["ASSISTANT", "IN_PROGRESS"],
    ]);
    expect(rows[2].id).toBe(turn.replyId);
    expect(turn.isNew).toBe(false);
    expect(turn.history.map((message) => message.role)).toEqual(["user"]);
  });

  it.each(["COMPLETED", "STOPPED", "CUT"] as const)(
    "refuses Try again after a reply that is %s",
    async (outcome) => {
      const { actor, id } = await conversationEndingWith(outcome);

      await expect(
        startChatTurn(actor, retry(id), at(10), limits),
      ).rejects.toThrow(new ConflictError("nothing_to_retry"));
      expect(await rowsOf(id)).toHaveLength(2);
    },
  );

  it("refuses Try again while a reply is being written", async () => {
    const { actor, id } = await conversationEndingWith("FAILED");
    await startChatTurn(actor, retry(id), at(10), limits);

    await expect(
      startChatTurn(actor, retry(id), at(20), limits),
    ).rejects.toThrow(new ConflictError("reply_in_progress"));
  });

  it("starts one reply when two Try agains arrive at once (FR-023)", async () => {
    const { actor, id } = await conversationEndingWith("FAILED");

    const results = await Promise.allSettled([
      startChatTurn(actor, retry(id), at(10), limits),
      startChatTurn(actor, retry(id), at(10), limits),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.message.count({
        where: { conversationId: id, finishReason: "IN_PROGRESS" },
      }),
    ).toBe(1);
  });

  it("accepts a new question after a failure instead of Try again", async () => {
    const { actor, id } = await conversationEndingWith("FAILED");

    await startChatTurn(actor, send("Rephrased", id), at(10), limits);

    expect((await rowsOf(id)).map((row) => row.role)).toEqual([
      "USER",
      "ASSISTANT",
      "USER",
      "ASSISTANT",
    ]);
  });

  it("answers Try again on another user's conversation as not found", async () => {
    const { id } = await conversationEndingWith("FAILED");
    const stranger = await createUserRow();

    await expect(
      startChatTurn(actorOf(stranger), retry(id), at(10), limits),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("getOwnConversation — failed attempts (FR-021)", () => {
  it("folds failed replies under their question once a later reply answered it", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), limits);
    await finishReply(
      turn.replyId,
      {
        ...completed,
        outcome: "FAILED",
        parts: [{ type: "text", text: "Half" }],
      },
      at(1),
    );
    const retried = await startChatTurn(
      actorOf(user),
      {
        trigger: "regenerate-message",
        locale: "en",
        conversationId: turn.conversationId,
      },
      at(10),
      limits,
    );
    await finishReply(retried.replyId, completed, at(11));

    const { messages } = await getOwnConversation(
      actorOf(user),
      turn.conversationId,
      at(20),
    );

    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(messages[0].metadata?.failedAttempts).toEqual([
      { parts: [{ type: "text", text: "Half" }] },
    ]);
    expect(messages[1].metadata?.outcome).toBe("completed");
  });
});

describe("startChatTurn — limits (FR-038 – FR-043, FR-055)", () => {
  async function seedReplies(
    userId: string,
    replies: { secondsAgo: number; tokens: number | null }[],
    now: Date,
  ) {
    const conversation = await db.conversation.create({
      data: { userId, title: "Seeded", createdAt: now, updatedAt: now },
    });
    for (const { secondsAgo, tokens } of replies) {
      const createdAt = new Date(now.getTime() - secondsAgo * 1000);
      await db.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            role: "USER",
            parts: [],
            createdAt,
          },
          {
            conversationId: conversation.id,
            role: "ASSISTANT",
            parts: [],
            createdAt,
            finishReason: "COMPLETED",
            inputTokens: tokens,
            outputTokens: tokens === null ? null : 0,
          },
        ],
      });
    }
    return conversation.id;
  }

  const small = {
    rateLimitPerMinute: 3,
    dailyTokenBudget: 1000,
    historyLimit: 50,
  };

  it("accepts the Nth request in a minute and refuses the next, saying how long to wait", async () => {
    const user = await createUserRow();
    await seedReplies(
      user.id,
      [
        { secondsAgo: 45, tokens: 1 },
        { secondsAgo: 30, tokens: 1 },
      ],
      at(0),
    );

    await startChatTurn(actorOf(user), send("Third"), at(0), small);
    const refusal = await startChatTurn(
      actorOf(user),
      send("Fourth"),
      at(0),
      small,
    ).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(RateLimitError);
    expect(refusal).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 15,
    });
  });

  it("no longer counts a request older than a minute", async () => {
    const user = await createUserRow();
    await seedReplies(
      user.id,
      [
        { secondsAgo: 60.001, tokens: 1 },
        { secondsAgo: 30, tokens: 1 },
        { secondsAgo: 20, tokens: 1 },
      ],
      at(0),
    );

    await expect(
      startChatTurn(actorOf(user), send("Fits"), at(0), small),
    ).resolves.toBeDefined();
  });

  it("counts Try again as a request", async () => {
    const user = await createUserRow();
    const turn = await startChatTurn(actorOf(user), send("Hi"), at(0), small);
    await finishReply(turn.replyId, { ...completed, outcome: "FAILED" }, at(1));
    const retry = {
      trigger: "regenerate-message" as const,
      locale: "en" as const,
      conversationId: turn.conversationId,
    };
    const second = await startChatTurn(actorOf(user), retry, at(2), small);
    await finishReply(
      second.replyId,
      { ...completed, outcome: "FAILED" },
      at(3),
    );
    const third = await startChatTurn(actorOf(user), retry, at(4), small);
    await finishReply(
      third.replyId,
      { ...completed, outcome: "FAILED" },
      at(5),
    );

    await expect(
      startChatTurn(actorOf(user), retry, at(6), small),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("accepts a request at one token under the budget, even if its reply will cross it", async () => {
    const user = await createUserRow();
    await seedReplies(user.id, [{ secondsAgo: 3600, tokens: 999 }], at(0));

    await expect(
      startChatTurn(actorOf(user), send("One more"), at(0), small),
    ).resolves.toBeDefined();
  });

  it("refuses at the budget, saying when enough usage has left the 24 hours", async () => {
    const user = await createUserRow();
    await seedReplies(
      user.id,
      [
        { secondsAgo: 20 * 3600, tokens: 600 },
        { secondsAgo: 3600, tokens: 400 },
      ],
      at(0),
    );

    await expect(
      startChatTurn(actorOf(user), send("Over"), at(0), small),
    ).rejects.toMatchObject({
      code: "daily_limit_reached",
      retryAfterSeconds: 4 * 3600,
    });
  });

  it("ignores usage older than 24 hours", async () => {
    const user = await createUserRow();
    await seedReplies(
      user.id,
      [{ secondsAgo: 24 * 3600 + 1, tokens: 5000 }],
      at(0),
    );

    await expect(
      startChatTurn(actorOf(user), send("Fresh day"), at(0), small),
    ).resolves.toBeDefined();
  });

  it("names the daily limit when both are reached, as waiting a minute would not help (FR-040)", async () => {
    const user = await createUserRow();
    await seedReplies(
      user.id,
      [
        { secondsAgo: 30, tokens: 400 },
        { secondsAgo: 20, tokens: 400 },
        { secondsAgo: 10, tokens: 400 },
      ],
      at(0),
    );

    await expect(
      startChatTurn(actorOf(user), send("Both"), at(0), small),
    ).rejects.toMatchObject({ code: "daily_limit_reached" });
  });

  it("never counts another user's usage (FR-043)", async () => {
    const busy = await createUserRow();
    const user = await createUserRow();
    await seedReplies(
      busy.id,
      [
        { secondsAgo: 30, tokens: 400 },
        { secondsAgo: 20, tokens: 400 },
        { secondsAgo: 10, tokens: 400 },
      ],
      at(0),
    );

    await expect(
      startChatTurn(actorOf(user), send("Mine"), at(0), small),
    ).resolves.toBeDefined();
  });

  it("stores nothing for a refused request (FR-041)", async () => {
    const user = await createUserRow();
    const id = await seedReplies(
      user.id,
      [
        { secondsAgo: 30, tokens: 1 },
        { secondsAgo: 20, tokens: 1 },
        { secondsAgo: 10, tokens: 1 },
      ],
      at(0),
    );
    const before = await db.message.count();

    await expect(
      startChatTurn(actorOf(user), send("Refused"), at(0), small),
    ).rejects.toBeInstanceOf(RateLimitError);
    await expect(
      startChatTurn(actorOf(user), send("Refused", id), at(0), small),
    ).rejects.toBeInstanceOf(RateLimitError);

    expect(await db.message.count()).toBe(before);
    expect(await db.conversation.count()).toBe(1);
  });

  it("accepts exactly N of N+1 requests sent at once across conversations", async () => {
    const user = await createUserRow();

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) =>
        startChatTurn(actorOf(user), send(`Parallel ${index}`), at(0), small),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await db.message.count({ where: { role: "ASSISTANT" } })).toBe(3);
  });

  it("sends the model only the last messages up to the context limit (FR-042)", async () => {
    const user = await createUserRow();
    const first = await startChatTurn(
      actorOf(user),
      send("One"),
      at(0),
      limits,
    );
    await finishReply(first.replyId, completed, at(1));
    const second = await startChatTurn(
      actorOf(user),
      send("Two", first.conversationId),
      at(10),
      limits,
    );
    await finishReply(second.replyId, completed, at(11));

    const third = await startChatTurn(
      actorOf(user),
      send("Three", first.conversationId),
      at(20),
      { ...limits, historyLimit: 3 },
    );

    expect(
      third.history.map((message) => [message.role, message.parts[0]]),
    ).toEqual([
      ["user", { type: "text", text: "Two" }],
      ["assistant", { type: "text", text: "An answer." }],
      ["user", { type: "text", text: "Three" }],
    ]);
  });
});
