import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ConflictError } from "@/server/errors";

const getSessionUser = vi.fn();
vi.mock("@/auth/dal", () => ({ getSessionUser: () => getSessionUser() }));

const { defineRoute } = await import("@/lib/http/define-route");
const { noContent, ok } = await import("@/lib/http/route-response");

const actor = {
  id: "u-1",
  email: "a@b.co",
  role: "ADMIN",
  firstName: "A",
  lastName: "B",
};
const schema = z.object({
  name: z.string().min(1, "validation.firstName.required"),
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://atmo.example/api/x", {
    method: "POST",
    headers: {
      host: "atmo.example",
      origin: "http://atmo.example",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "t-1" }) };

beforeEach(() => {
  getSessionUser.mockReset();
  getSessionUser.mockResolvedValue(actor);
});

describe("defineRoute", () => {
  it("passes the parsed body, the actor and the awaited params to the handler", async () => {
    const handler = vi.fn(async () => ok({ done: true }));
    const route = defineRoute({ schema, session: "required", handler });

    const response = await route(post({ name: "Olena" }), context);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith({
      body: { name: "Olena" },
      actor,
      params: { id: "t-1" },
    });
  });

  it("checks the origin before anything else", async () => {
    getSessionUser.mockResolvedValue(null);
    const route = defineRoute({
      schema,
      session: "required",
      handler: async () => noContent(),
    });

    const response = await route(
      post("not json", { origin: "https://evil.example" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "forbidden_origin" },
    });
  });

  it("validates the body before resolving the session", async () => {
    getSessionUser.mockResolvedValue(null);
    const route = defineRoute({
      schema,
      session: "required",
      handler: async () => noContent(),
    });

    const response = await route(post({ name: "" }), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "validation_failed",
        fields: { name: ["validation.firstName.required"] },
      },
    });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("treats unparseable JSON as a validation failure", async () => {
    const route = defineRoute({
      schema,
      session: "required",
      handler: async () => noContent(),
    });

    const response = await route(post("{nope"), context);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("validation_failed");
  });

  it("answers 401 when a session is required and there is none", async () => {
    getSessionUser.mockResolvedValue(null);
    const route = defineRoute({
      schema,
      session: "required",
      handler: async () => noContent(),
    });

    const response = await route(post({ name: "Olena" }), context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated" },
    });
  });

  it("never looks up the session for a public route", async () => {
    const handler = vi.fn(async () => noContent());
    const route = defineRoute({ schema, session: "none", handler });

    await route(post({ name: "Olena" }), context);

    expect(getSessionUser).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith({
      body: { name: "Olena" },
      actor: null,
      params: { id: "t-1" },
    });
  });

  it("maps a domain error through the shared mapper", async () => {
    const route = defineRoute({
      schema,
      session: "required",
      handler: async () => {
        throw new ConflictError("email_in_use", "deactivated");
      },
    });

    const response = await route(post({ name: "Olena" }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "email_in_use", detail: "deactivated" },
    });
  });

  it("answers a bare 500 that leaks nothing for an unexpected error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const route = defineRoute({
      schema,
      session: "required",
      handler: async () => {
        throw new Error("secret detail");
      },
    });

    const response = await route(post({ name: "Olena" }), context);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("secret detail");
    expect(text).not.toContain("at ");
    consoleError.mockRestore();
  });

  it("accepts a bodiless route without a schema", async () => {
    const handler = vi.fn(async () => noContent());
    const route = defineRoute({ session: "required", handler });

    const response = await route(post(""), context);

    expect(response.status).toBe(204);
    expect(handler).toHaveBeenCalledWith({
      body: undefined,
      actor,
      params: { id: "t-1" },
    });
  });

  it("skips the origin check for GET", async () => {
    const route = defineRoute({
      session: "required",
      handler: async () => ok({}),
    });
    const request = new Request("http://atmo.example/api/x", {
      headers: { host: "atmo.example", origin: "https://evil.example" },
    });

    expect((await route(request, context)).status).toBe(200);
  });
});
