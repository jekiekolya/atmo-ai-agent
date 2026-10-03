import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `T(${key})`,
}));

import { useFormFailure } from "./use-form-failure";

beforeEach(() => {
  toastAdd.mockReset();
});

function setup() {
  return renderHook(() => useFormFailure());
}

describe("useFormFailure (contracts/ui.md, form behavior 3–5)", () => {
  it("puts field errors under their fields", () => {
    const { result } = setup();

    act(() =>
      result.current.show({
        code: "validation_failed",
        fields: { email: ["validation.email.invalid"] },
      }),
    );

    expect(result.current.errors).toEqual({
      email: "T(validation.email.invalid)",
    });
    expect(result.current.alert).toBeNull();
  });

  it("shows an error for the whole form in the alert (FR-068)", () => {
    const { result } = setup();

    act(() =>
      result.current.show({
        code: "validation_failed",
        fields: { _form: ["validation.body.unparseable"] },
      }),
    );

    expect(result.current.alert).toBe("T(validation.body.unparseable)");
    expect(result.current.errors).toEqual({});
  });

  it("shows a domain error in the alert, with a per-form override", () => {
    const { result } = setup();

    act(() => result.current.show({ code: "invite_used" }));
    expect(result.current.alert).toBe("T(errors.codes.invite_used)");

    act(() =>
      result.current.show(
        { code: "account_locked" },
        { account_locked: "account.locked" },
      ),
    );
    expect(result.current.alert).toBe("T(account.locked)");
  });

  it.each([
    ["network", "errors.unexpected"],
    ["forbidden_origin", "errors.codes.forbidden_origin"],
  ])("reports %s as a notification, not in the form", (code, key) => {
    const { result } = setup();

    act(() => result.current.show({ code }));

    expect(toastAdd).toHaveBeenCalledWith({
      title: `T(${key})`,
      type: "error",
    });
    expect(result.current.alert).toBeNull();
  });

  it("clears the alert alone, or the alert and field errors together", () => {
    const { result } = setup();
    const showBoth = () =>
      act(() =>
        result.current.show({
          code: "validation_failed",
          fields: {
            _form: ["validation.body.unparseable"],
            email: ["validation.email.invalid"],
          },
        }),
      );

    showBoth();
    act(() => result.current.clearAlert());
    expect(result.current.alert).toBeNull();
    expect(result.current.errors).not.toEqual({});

    showBoth();
    act(() => result.current.clear());
    expect(result.current.alert).toBeNull();
    expect(result.current.errors).toEqual({});
  });
});
