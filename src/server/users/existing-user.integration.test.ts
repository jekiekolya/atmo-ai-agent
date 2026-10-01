import { describe, expect, it } from "vitest";

import { NotFoundError } from "@/server/errors";
import { createUserRow } from "@/server/testing/fixtures";
import { existingUser } from "@/server/users/existing-user";

describe("existingUser", () => {
  it("returns the stored user", async () => {
    const user = await createUserRow();

    expect(await existingUser(user.id)).toMatchObject({
      id: user.id,
      email: user.email,
    });
  });

  it("reports an unknown account as not found", async () => {
    await expect(
      existingUser("00000000-0000-7000-8000-000000000000"),
    ).rejects.toThrow(NotFoundError);
  });
});
