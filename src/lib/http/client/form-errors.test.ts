import { describe, expect, it } from "vitest";

import { z } from "zod";

import {
  errorMessageKey,
  routeFailure,
  toFormErrors,
  validatePair,
  validateWith,
} from "@/lib/http/client/form-errors";
import { confirmsPassword } from "@/lib/schemas/fields";

const t = (key: string) => `T(${key})`;

describe("toFormErrors", () => {
  it("translates the first message of each field", () => {
    expect(
      toFormErrors(
        {
          email: ["validation.email.invalid", "other"],
          firstName: ["validation.firstName.required"],
        },
        t,
      ),
    ).toEqual({
      email: "T(validation.email.invalid)",
      firstName: "T(validation.firstName.required)",
    });
  });

  it("returns a new object on every call, as Base UI re-syncs only on a new reference", () => {
    const fields = { email: ["validation.email.invalid"] };
    expect(toFormErrors(fields, t)).not.toBe(toFormErrors(fields, t));
  });

  it("is empty without fields", () => {
    expect(toFormErrors(undefined, t)).toEqual({});
  });
});

describe("errorMessageKey", () => {
  it("uses the code's key", () => {
    expect(errorMessageKey("invite_used")).toBe("errors.codes.invite_used");
  });

  it("uses a detail-specific key where one exists", () => {
    expect(errorMessageKey("email_in_use", "deactivated")).toBe(
      "errors.details.email_in_use_deactivated",
    );
  });

  it("falls back to the code's key for an unknown detail", () => {
    expect(errorMessageKey("email_in_use", "whatever")).toBe(
      "errors.codes.email_in_use",
    );
  });

  it.each(["network", "unexpected"])(
    "maps the client-only %s code to the generic message",
    (code) => {
      expect(errorMessageKey(code)).toBe("errors.unexpected");
    },
  );
});

describe("routeFailure (contracts/ui.md, form behavior 3–5)", () => {
  it("puts field errors under their fields", () => {
    const fields = { email: ["validation.email.invalid"] };
    expect(routeFailure({ code: "validation_failed", fields })).toEqual({
      kind: "fields",
      fields,
    });
  });

  it("shows an error for the whole form in the alert, not nowhere (FR-068)", () => {
    expect(
      routeFailure({
        code: "validation_failed",
        fields: { _form: ["validation.body.unparseable"] },
      }),
    ).toEqual({
      kind: "fields",
      fields: {},
      alertKey: "validation.body.unparseable",
    });
  });

  it("keeps field errors under their fields next to one for the whole form", () => {
    expect(
      routeFailure({
        code: "validation_failed",
        fields: {
          password: ["validation.password.tooShort"],
          _form: ["validation.body.unparseable"],
        },
      }),
    ).toEqual({
      kind: "fields",
      fields: { password: ["validation.password.tooShort"] },
      alertKey: "validation.body.unparseable",
    });
  });

  it.each([
    ["network", "errors.unexpected"],
    ["unexpected", "errors.unexpected"],
    ["forbidden_origin", "errors.codes.forbidden_origin"],
  ])("reports %s as a toast, never in the form", (code, key) => {
    expect(routeFailure({ code })).toEqual({ kind: "toast", key });
  });

  it("shows any other code in the form's alert, with its detail", () => {
    expect(routeFailure({ code: "invite_used" })).toEqual({
      kind: "alert",
      key: "errors.codes.invite_used",
    });
    expect(
      routeFailure({ code: "email_in_use", detail: "deactivated" }),
    ).toEqual({
      kind: "alert",
      key: "errors.details.email_in_use_deactivated",
    });
  });

  it("lets a form name its own key for a code", () => {
    expect(
      routeFailure(
        { code: "account_locked" },
        { account_locked: "account.locked" },
      ),
    ).toEqual({ kind: "alert", key: "account.locked" });
  });
});

describe("validateWith", () => {
  const validate = validateWith(
    z.string().min(1, "validation.email.invalid"),
    t,
  );

  it("returns null for a valid value", () => {
    expect(validate("a")).toBeNull();
  });

  it("returns the translated first message otherwise", () => {
    expect(validate("")).toBe("T(validation.email.invalid)");
  });
});

describe("validatePair", () => {
  const validate = validatePair(confirmsPassword, "password", t);

  it("returns null when the rule holds against the other field", () => {
    expect(validate("same", { password: "same" })).toBeNull();
  });

  it("returns the rule's translated message otherwise", () => {
    expect(validate("other", { password: "same" })).toBe(
      "T(validation.confirmPassword.mismatch)",
    );
  });
});
