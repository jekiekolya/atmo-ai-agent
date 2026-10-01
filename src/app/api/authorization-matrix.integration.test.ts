import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { issueInviteFor } from "@/server/invites/invite-service";
import { createSuperAdminRow, createUserRow } from "@/server/testing/fixtures";

// SC-009: every administration endpoint refuses anonymous (401) and admin (403) callers.

const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/auth/dal", () => ({ getSessionUser: async () => session.user }));
vi.mock("@/auth/auth", () => ({ signOut: vi.fn(async () => undefined) }));

const signOutRoute = await import("@/app/api/session/sign-out/route");
const usersRoute = await import("@/app/api/users/route");
const deactivateRoute = await import("@/app/api/users/[id]/deactivate/route");
const reactivateRoute = await import("@/app/api/users/[id]/reactivate/route");
const inviteRoute = await import("@/app/api/users/[id]/invite/route");
const acceptRoute = await import("@/app/api/invites/accept/route");
const passwordRoute = await import("@/app/api/account/password/route");
const { hashPassword } = await import("@/server/auth/password");

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
