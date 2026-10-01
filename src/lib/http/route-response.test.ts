import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  created,
  errorResponse,
  fromZodError,
  noContent,
  ok,
} from "@/lib/http/route-response";
import {
  ConflictError,
  ForbiddenError,
  GoneError,
  InvalidInviteError,
  LockedError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";

describe("errorResponse", () => {
  it.each([
    [new ForbiddenError(), 403, "forbidden"],
    [new NotFoundError(), 404, "not_found"],
    [new InvalidInviteError(), 404, "invite_invalid"],
    [new ConflictError("email_in_use"), 409, "email_in_use"],
    [new GoneError("invite_expired"), 410, "invite_expired"],
    [new LockedError(), 423, "account_locked"],
  ])("maps %s to %i", async (error, status, code) => {
    const response = errorResponse(error);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
  });

  it("carries a detail when the error has one", async () => {
    const response = errorResponse(
      new ConflictError("email_in_use", "deactivated"),
    );

    expect(await response.json()).toEqual({
      error: { code: "email_in_use", detail: "deactivated" },
    });
  });

  it("carries fields for a validation error", async () => {
    const response = errorResponse(
      new ValidationError({
        currentPassword: ["account.currentPasswordWrong"],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "validation_failed",
        fields: { currentPassword: ["account.currentPasswordWrong"] },
      },
    });
  });

  it.each([
    ["unauthenticated", 401],
    ["forbidden_origin", 403],
  ] as const)("builds a bare %s response", async (code, status) => {
    const response = errorResponse(code);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
  });
});

describe("fromZodError", () => {
  it("turns field issues into catalog-key fields", () => {
    const schema = z.object({
      email: z.string().min(1, "validation.email.invalid"),
      name: z.string().min(1, "validation.firstName.required"),
    });
    const result = schema.safeParse({ email: "", name: "" });

    expect(result.success).toBe(false);
    expect(fromZodError(result.error!).fields).toEqual({
      email: ["validation.email.invalid"],
      name: ["validation.firstName.required"],
    });
  });
});

describe("success helpers", () => {
  it("sets 200, 201 and 204", async () => {
    expect(ok({ a: 1 }).status).toBe(200);
    expect(await ok({ a: 1 }).json()).toEqual({ a: 1 });
    expect(created({ b: 2 }).status).toBe(201);
    expect(noContent().status).toBe(204);
  });
});
