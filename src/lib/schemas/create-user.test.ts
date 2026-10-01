import { describe, expect, it } from "vitest";

import { createUserSchema } from "@/lib/schemas/create-user";

const valid = {
  email: " New@Example.com ",
  firstName: "Taras",
  lastName: "Shevchenko",
  role: "ADMIN",
};

const fieldErrors = (input: unknown) => {
  const result = createUserSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((i) => [i.path[0], i.message]),
      );
};

describe("createUserSchema (FR-048, FR-074)", () => {
  it("accepts an admin and normalizes the email", () => {
    expect(createUserSchema.parse(valid)).toEqual({
      ...valid,
      email: "new@example.com",
    });
  });

  it("refuses the super-admin role as a field error on role", () => {
    expect(fieldErrors({ ...valid, role: "SUPER_ADMIN" })).toEqual({
      role: "validation.role.notAssignable",
    });
  });

  it("requires both names", () => {
    expect(fieldErrors({ ...valid, firstName: " ", lastName: "" })).toEqual({
      firstName: "validation.firstName.required",
      lastName: "validation.lastName.required",
    });
  });
});
