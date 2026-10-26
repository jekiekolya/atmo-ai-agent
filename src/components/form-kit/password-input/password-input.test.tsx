import { Form } from "@base-ui/react/form";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { PasswordInput } from "./password-input";

function renderField(props: { disabled?: boolean } = {}) {
  render(
    <Field name="password">
      <FieldLabel>Password</FieldLabel>
      <PasswordInput autoComplete="current-password" {...props} />
    </Field>,
  );
  return screen.getByLabelText("Password");
}

describe("PasswordInput", () => {
  it("starts masked, offering to show the password (FR-004, FR-010)", () => {
    const input = renderField();

    expect(input).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "passwordInput.show" }),
    ).toBeInTheDocument();
  });

  it("reveals and masks again, keeping the value (FR-003, FR-006)", async () => {
    const user = userEvent.setup();
    const input = renderField();
    await user.type(input, "secret");

    await user.click(
      screen.getByRole("button", { name: "passwordInput.show" }),
    );
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("secret");

    await user.click(
      screen.getByRole("button", { name: "passwordInput.hide" }),
    );
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("secret");
  });

  it("keeps what it tells the browser about the field in both states (FR-006)", async () => {
    const user = userEvent.setup();
    const input = renderField();
    expect(input).toHaveAttribute("autocomplete", "current-password");

    await user.click(
      screen.getByRole("button", { name: "passwordInput.show" }),
    );
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Password")).toBe(input);
  });

  it("reveals only its own field (FR-003)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Field name="newPassword">
          <FieldLabel>New</FieldLabel>
          <PasswordInput />
        </Field>
        <Field name="confirmPassword">
          <FieldLabel>Confirm</FieldLabel>
          <PasswordInput />
        </Field>
      </>,
    );

    await user.click(
      screen.getAllByRole("button", { name: "passwordInput.show" })[0],
    );

    expect(screen.getByLabelText("New")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("disables its button with its field (FR-011)", () => {
    const input = renderField({ disabled: true });

    expect(input).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "passwordInput.show" }),
    ).toBeDisabled();
  });
});

function renderForm({ invalid = false } = {}) {
  const typeAtSubmit: string[] = [];
  const onSubmit = vi.fn(() => {
    typeAtSubmit.push(screen.getByLabelText("Password").getAttribute("type")!);
  });
  render(
    <Form onFormSubmit={onSubmit}>
      <Field name="password" validate={() => (invalid ? "Too short" : null)}>
        <FieldLabel>Password</FieldLabel>
        <PasswordInput />
        <FieldError />
      </Field>
      <input aria-label="Next" />
      <button type="submit">Send</button>
    </Form>,
  );
  return { input: screen.getByLabelText("Password"), onSubmit, typeAtSubmit };
}

describe("PasswordInput by keyboard", () => {
  it("follows its field in the Tab order (FR-009)", async () => {
    const user = userEvent.setup();
    const { input } = renderForm();

    input.focus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "passwordInput.show" }),
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Next")).toHaveFocus();
  });

  it("toggles with Enter and Space, and never submits (FR-009, FR-010)", async () => {
    const user = userEvent.setup();
    const { input, onSubmit } = renderForm();
    const button = screen.getByRole("button", { name: "passwordInput.show" });

    button.focus();
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("type", "text");
    expect(button).toHaveAccessibleName("passwordInput.hide");

    await user.keyboard(" ");
    expect(input).toHaveAttribute("type", "password");
    expect(button).toHaveAccessibleName("passwordInput.show");

    await user.click(button);
    expect(button).toHaveAttribute("type", "button");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("PasswordInput on submit", () => {
  it("is masked before the form's submit handler runs (FR-005)", async () => {
    const user = userEvent.setup();
    const { input, onSubmit, typeAtSubmit } = renderForm();
    await user.type(input, "secret");
    await user.click(
      screen.getByRole("button", { name: "passwordInput.show" }),
    );

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(typeAtSubmit).toEqual(["password"]);
    expect(input).toHaveAttribute("type", "password");
  });

  it("is masked when the form's own checks stop the submission (FR-005)", async () => {
    const user = userEvent.setup();
    const { input, onSubmit } = renderForm({ invalid: true });
    await user.type(input, "secret");
    await user.click(
      screen.getByRole("button", { name: "passwordInput.show" }),
    );

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");

    await user.click(
      screen.getByRole("button", { name: "passwordInput.show" }),
    );
    expect(input).toHaveAttribute("type", "text");
  });

  it("works outside a form", async () => {
    const user = userEvent.setup();
    const input = renderField();

    await user.click(
      screen.getByRole("button", { name: "passwordInput.show" }),
    );
    expect(input).toHaveAttribute("type", "text");
  });
});
