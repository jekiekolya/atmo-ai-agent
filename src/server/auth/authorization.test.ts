import { describe, expect, it } from "vitest";

import { assertSuperAdmin } from "@/server/auth/authorization";
import { ForbiddenError } from "@/server/errors";

const superAdmin = { id: "u-1", role: "SUPER_ADMIN" as const };
const admin = { id: "u-2", role: "ADMIN" as const };

describe("assertSuperAdmin", () => {
  it("passes for the super admin", () => {
    expect(() => assertSuperAdmin(superAdmin)).not.toThrow();
  });

  it("refuses an admin", () => {
    expect(() => assertSuperAdmin(admin)).toThrow(ForbiddenError);
  });
});
