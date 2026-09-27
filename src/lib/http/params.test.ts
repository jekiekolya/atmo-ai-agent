import { describe, expect, it } from "vitest";

import { userIdFrom } from "@/lib/http/params";
import { NotFoundError } from "@/server/errors";

describe("userIdFrom", () => {
  it("returns a well-formed id", () => {
    const id = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    expect(userIdFrom({ id })).toBe(id);
  });

  it.each<Record<string, string | string[]>>([
    { id: "nope" },
    { id: ["a", "b"] },
    {},
  ])("treats %j as an account that does not exist", (params) => {
    expect(() => userIdFrom(params)).toThrow(NotFoundError);
  });
});
