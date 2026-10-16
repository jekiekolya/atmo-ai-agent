import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { issueInviteFor } from "@/server/invites/invite-service";
import { createSuperAdminRow, createUserRow } from "@/server/testing/fixtures";

// SC-009: every administration endpoint refuses anonymous (401) and admin (403) callers.

const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/auth/dal", () => ({ getSessionUser: async () => session.user }));
vi.mock("@/auth/auth", () => ({ signOut: vi.fn(async () => undefined) }));

const chatAgent = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/server/chat/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/chat/agent")>()),
  getChatAgent: async () => chatAgent.current,
}));

const signOutRoute = await import("@/app/api/session/sign-out/route");
const usersRoute = await import("@/app/api/users/route");
const deactivateRoute = await import("@/app/api/users/[id]/deactivate/route");
const reactivateRoute = await import("@/app/api/users/[id]/reactivate/route");
const inviteRoute = await import("@/app/api/users/[id]/invite/route");
const acceptRoute = await import("@/app/api/invites/accept/route");
const passwordRoute = await import("@/app/api/account/password/route");
const chatRoute = await import("@/app/api/chat/route");
const chatConversationRoute = await import("@/app/api/chat/[id]/route");
const { hashPassword } = await import("@/server/auth/password");
const { createChatAgent } = await import("@/server/chat/agent");
const { finishReply, startChatTurn } =
  await import("@/server/chat/chat-service");

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

function call(
  handler: Handler,
  method: string,
  params: Record<string, string> = {},
  body?: unknown,
) {
  const request = new Request("http://atmo.example/api/x", {
    method,
    headers: {
      host: "atmo.example",
      origin: "http://atmo.example",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handler(request, { params: Promise.resolve(params) });
}

const asSession = (
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  } | null,
) => {
  session.user = user;
};

const snapshot = async () => ({
  users: await db.user.findMany({ orderBy: { id: "asc" } }),
  invites: await db.invite.findMany({ orderBy: { id: "asc" } }),
  conversations: await db.conversation.findMany({ orderBy: { id: "asc" } }),
  messages: await db.message.findMany({ orderBy: { id: "asc" } }),
});

let owner: Awaited<ReturnType<typeof createSuperAdminRow>>;
let admin: Awaited<ReturnType<typeof createUserRow>>;
let target: Awaited<ReturnType<typeof createUserRow>>;

beforeEach(async () => {
  owner = await createSuperAdminRow();
  admin = await createUserRow();
  target = await createUserRow({ passwordHash: null });
  await db.$transaction((tx) => issueInviteFor(target.id, owner.id, tx));
});

const newUser = {
  email: "new@example.com",
  firstName: "Lesya",
  lastName: "Ukrainka",
  role: "ADMIN",
};

const adminEndpoints: [string, () => Promise<Response>, number][] = [
  [
    "POST /api/users",
    () => call(usersRoute.POST as Handler, "POST", {}, newUser),
    201,
  ],
  [
    "POST deactivate",
    () => call(deactivateRoute.POST as Handler, "POST", { id: target.id }),
    200,
  ],
  [
    "POST reactivate",
    () => call(reactivateRoute.POST as Handler, "POST", { id: target.id }),
    200,
  ],
  [
    "POST invite",
    () => call(inviteRoute.POST as Handler, "POST", { id: target.id }),
    201,
  ],
  [
    "DELETE invite",
    () => call(inviteRoute.DELETE as Handler, "DELETE", { id: target.id }),
    204,
  ],
];

describe.each(adminEndpoints)("%s", (_, send, success) => {
  it("answers 401 to an anonymous caller and changes nothing", async () => {
    asSession(null);
    const before = await snapshot();

    expect((await send()).status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });

  it("answers 403 to an admin and changes nothing", async () => {
    asSession(admin);
    const before = await snapshot();

    expect((await send()).status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it(`succeeds for the super admin (${success})`, async () => {
    asSession(owner);

    expect((await send()).status).toBe(success);
  });
});

describe("POST /api/session/sign-out", () => {
  it("answers 401 without a session", async () => {
    asSession(null);
    expect((await call(signOutRoute.POST as Handler, "POST")).status).toBe(401);
  });

  it.each(["admin", "super admin"])("signs out a %s", async (who) => {
    asSession(who === "admin" ? admin : owner);
    expect((await call(signOutRoute.POST as Handler, "POST")).status).toBe(204);
  });
});

describe("POST /api/invites/accept", () => {
  it("is public: an anonymous caller with a valid token succeeds", async () => {
    asSession(null);
    await db.invite.deleteMany();
    const { token } = await db.$transaction((tx) =>
      issueInviteFor(target.id, owner.id, tx),
    );

    const response = await call(
      acceptRoute.POST as Handler,
      "POST",
      {},
      {
        token,
        password: "a brand new password",
        confirmPassword: "a brand new password",
      },
    );

    expect(response.status).toBe(204);
  });
});

describe("request safety (FR-060)", () => {
  it("refuses a cross-site request before anything else, changing nothing", async () => {
    asSession(owner);
    const before = await snapshot();
    const request = new Request("http://atmo.example/api/x", {
      method: "POST",
      headers: { host: "atmo.example", origin: "https://evil.example" },
    });

    const response = await (deactivateRoute.POST as Handler)(request, {
      params: Promise.resolve({ id: target.id }),
    });

    expect(response.status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it("answers 404 for a malformed id", async () => {
    asSession(owner);
    expect(
      (await call(deactivateRoute.POST as Handler, "POST", { id: "nope" }))
        .status,
    ).toBe(404);
  });
});

describe("PUT /api/account/password", () => {
  it("answers 401 without a session", async () => {
    asSession(null);
    const response = await call(
      passwordRoute.PUT as Handler,
      "PUT",
      {},
      {
        currentPassword: "anything",
        newPassword: "a brand new password",
        confirmPassword: "a brand new password",
      },
    );

    expect(response.status).toBe(401);
  });

  it.each(["admin", "super admin"])(
    "lets a %s change their own password",
    async (who) => {
      const self = who === "admin" ? admin : owner;
      await db.user.update({
        where: { id: self.id },
        data: { passwordHash: await hashPassword("the current password") },
      });
      asSession(self);

      const response = await call(
        passwordRoute.PUT as Handler,
        "PUT",
        {},
        {
          currentPassword: "the current password",
          newPassword: "a brand new password",
          confirmPassword: "a brand new password",
        },
      );

      expect(response.status).toBe(204);
    },
  );
});

describe("POST /api/chat (spec 006, SC-004, SC-008)", () => {
  let model: MockLanguageModelV4;

  beforeEach(() => {
    model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Answer." },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 1, text: 1, reasoning: undefined },
              },
            },
          ],
        }),
      }),
    });
    chatAgent.current = {
      agent: createChatAgent(model),
      modelId: "mock-model",
    };
  });

  const ask = (conversationId?: string) =>
    call(
      chatRoute.POST as Handler,
      "POST",
      {},
      {
        trigger: "submit-message",
        locale: "en",
        text: "How does an inverter work?",
        ...(conversationId !== undefined && { conversationId }),
      },
    );

  async function ownConversation(user: {
    id: string;
    role: "ADMIN" | "SUPER_ADMIN";
  }) {
    const now = new Date(Date.now() - 120_000);
    const turn = await startChatTurn(
      user,
      { trigger: "submit-message", locale: "en", text: "Earlier" },
      now,
    );
    await finishReply(
      turn.replyId,
      {
        outcome: "COMPLETED",
        parts: [{ type: "text", text: "Earlier answer." }],
        usage: { inputTokens: 1, outputTokens: 1 },
        model: "mock-model",
      },
      now,
    );
    return turn.conversationId;
  }

  it("answers 401 to an anonymous caller, stores nothing, and never calls the model", async () => {
    asSession(null);
    const before = await snapshot();

    expect((await ask()).status).toBe(401);
    expect(await snapshot()).toEqual(before);
    expect(model.doStreamCalls).toEqual([]);
  });

  it.each(["admin", "super admin"])(
    "streams a reply to a %s on a new and on their own conversation",
    async (who) => {
      const self = who === "admin" ? admin : owner;
      asSession(self);

      const fresh = await ask();
      expect(fresh.status).toBe(200);
      expect(fresh.headers.get("content-type")).toContain("text/event-stream");
      await fresh.text();

      const existing = await ask(await ownConversation(self));
      expect(existing.status).toBe(200);
      await existing.text();
    },
  );

  it("answers another user's conversation exactly as a random or malformed one: 404, nothing stored, no model call (FR-004)", async () => {
    const othersId = await ownConversation(admin);
    asSession(owner);
    const before = await snapshot();

    const responses = await Promise.all([
      ask(othersId),
      ask(crypto.randomUUID()),
      ask("nope"),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404,
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.text()),
    );
    expect(new Set(bodies).size).toBe(1);
    expect(await snapshot()).toEqual(before);
    expect(model.doStreamCalls).toEqual([]);
  });

  it("refuses a cross-site request with 403 and no model call", async () => {
    asSession(admin);
    const before = await snapshot();
    const request = new Request("http://atmo.example/api/chat", {
      method: "POST",
      headers: { host: "atmo.example", origin: "https://evil.example" },
      body: JSON.stringify({
        trigger: "submit-message",
        locale: "en",
        text: "Hi",
      }),
    });

    const response = await (chatRoute.POST as Handler)(request, {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    expect(await snapshot()).toEqual(before);
    expect(model.doStreamCalls).toEqual([]);
  });

  it("refuses an unsupported language with 400, storing nothing and calling no model (FR-045)", async () => {
    asSession(admin);
    const before = await snapshot();

    const response = await call(
      chatRoute.POST as Handler,
      "POST",
      {},
      { trigger: "submit-message", locale: "de", text: "Hallo" },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "validation_failed",
        fields: { locale: ["chat.errors.invalidLocale"] },
      },
    });
    expect(await snapshot()).toEqual(before);
    expect(model.doStreamCalls).toEqual([]);
  });

  it("answers 403 to a role the chat is not granted to (FR-001)", async () => {
    asSession({ ...admin, role: "CUSTOMER" });
    const before = await snapshot();

    expect((await ask()).status).toBe(403);
    expect(await snapshot()).toEqual(before);
    expect(model.doStreamCalls).toEqual([]);
  });
});

describe("DELETE /api/chat/{id} (spec 006, FR-032, SC-004)", () => {
  async function ownConversation(user: {
    id: string;
    role: "ADMIN" | "SUPER_ADMIN";
  }) {
    const turn = await startChatTurn(
      user,
      { trigger: "submit-message", locale: "en", text: "Earlier" },
      new Date(Date.now() - 120_000),
    );
    return turn.conversationId;
  }

  const remove = (id: string) =>
    call(chatConversationRoute.DELETE as Handler, "DELETE", { id });

  it("answers 401 to an anonymous caller and deletes nothing", async () => {
    const id = await ownConversation(admin);
    asSession(null);
    const before = await snapshot();

    expect((await remove(id)).status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });

  it.each(["admin", "super admin"])(
    "deletes a %s's own conversation with 204",
    async (who) => {
      const self = who === "admin" ? admin : owner;
      const id = await ownConversation(self);
      asSession(self);

      expect((await remove(id)).status).toBe(204);
      expect(await db.conversation.count({ where: { id } })).toBe(0);
    },
  );

  it("answers another user's conversation exactly as a random or malformed one, deleting nothing", async () => {
    const othersId = await ownConversation(admin);
    asSession(owner);
    const before = await snapshot();

    const responses = await Promise.all([
      remove(othersId),
      remove(crypto.randomUUID()),
      remove("nope"),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404,
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.text()),
    );
    expect(new Set(bodies).size).toBe(1);
    expect(await snapshot()).toEqual(before);
  });
});
