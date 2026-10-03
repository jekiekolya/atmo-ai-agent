import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormAlert } from "./form-alert";

describe("FormAlert", () => {
  it("announces the message as an alert", () => {
    render(<FormAlert message="Something went wrong" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("renders nothing without a message", () => {
    const { container } = render(<FormAlert message={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
