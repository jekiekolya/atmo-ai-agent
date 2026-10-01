import { Form } from "@base-ui/react/form";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { NewPasswordFields } from "./new-password-fields";

const PASSWORD = "a brand new password";

function renderFields(currentPasswordName?: string) {
  const onSubmit = vi.fn();
  render(
    <Form onFormSubmit={onSubmit}>
      {currentPasswordName && (
        <Field name={currentPasswordName}>
          <FieldLabel>Current</FieldLabel>
          <Input type="password" />
        </Field>
      )}
      <NewPasswordFields
        name="newPassword"
        label="New"
        hint="Hint"
        confirmLabel="Confirm"
        currentPasswordName={currentPasswordName}
      />
      <button type="submit">Save</button>
    </Form>,
  );
  return onSubmit;
}

describe("NewPasswordFields", () => {
  it("submits a valid, confirmed password under the given name", async () => {
    const user = userEvent.setup();
    const onSubmit = renderFields();

    await user.type(screen.getByLabelText("New"), PASSWORD);
    await user.type(screen.getByLabelText("Confirm"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { newPassword: PASSWORD, confirmPassword: PASSWORD },
      expect.anything(),
    );
  });

  it("applies the password rules and catches a mismatch", async () => {
    const user = userEvent.setup();
    const onSubmit = renderFields();

    await user.type(screen.getByLabelText("New"), "short");
    await user.type(screen.getByLabelText("Confirm"), "other");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("validation.password.tooShort"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("validation.confirmPassword.mismatch"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses the current password as the new one when told which field holds it", async () => {
    const user = userEvent.setup();
    const onSubmit = renderFields("currentPassword");

    await user.type(screen.getByLabelText("Current"), PASSWORD);
    await user.type(screen.getByLabelText("New"), PASSWORD);
    await user.type(screen.getByLabelText("Confirm"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("validation.newPassword.sameAsCurrent"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
