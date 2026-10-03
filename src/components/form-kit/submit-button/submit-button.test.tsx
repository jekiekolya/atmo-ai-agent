import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  it("submits its form and shows its label while idle", () => {
    render(
      <SubmitButton pending={false} pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
    expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
  });

  it("is disabled with a spinner and the pending label while pending (FR-059)", () => {
    render(
      <SubmitButton pending pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );

    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });

  it("passes other button props through", () => {
    render(
      <SubmitButton pending={false} pendingLabel="Saving…" className="w-full">
        Save
      </SubmitButton>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("w-full");
  });
});
