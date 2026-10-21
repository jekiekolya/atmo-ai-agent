import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { ExampleConversation } from "./example-conversation";

describe("ExampleConversation", () => {
  // dom-accessibility-api does not name a figure from its figcaption; e2e checks the name in a browser.
  it("is a figure introduced by its caption", () => {
    render(<ExampleConversation />);

    expect(screen.getByRole("figure").firstElementChild).toHaveTextContent(
      "landing.example.caption",
    );
    expect(screen.getByText("landing.example.caption").tagName).toBe(
      "FIGCAPTION",
    );
  });

  it("holds the question and the answer, each behind a hidden speaker label", () => {
    render(<ExampleConversation />);
    const figure = screen.getByRole("figure");

    expect(figure).toHaveTextContent("landing.example.question");
    expect(figure).toHaveTextContent("landing.example.answer");
    const labels = figure.querySelectorAll(".sr-only");
    expect(labels).toHaveLength(2);
    labels.forEach((label) =>
      expect(label).toHaveTextContent("landing.example.speaker"),
    );
  });

  it("holds nothing to focus or press", () => {
    render(<ExampleConversation />);

    expect(
      screen
        .getByRole("figure")
        .querySelectorAll("a,button,input,textarea,select,[tabindex]"),
    ).toHaveLength(0);
  });

  it("announces nothing on its own", () => {
    const { container } = render(<ExampleConversation />);

    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("hides the typing indicator from assistive technology and under reduced motion", () => {
    const { container } = render(<ExampleConversation />);
    const indicator = container.querySelector(".animate-typing-indicator");

    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).toHaveClass("motion-reduce:hidden");
  });

  it("lets the pointer through the typing indicator to the answer beneath it", () => {
    const { container } = render(<ExampleConversation />);

    expect(container.querySelector(".animate-typing-indicator")).toHaveClass(
      "pointer-events-none",
    );
  });

  it("stills every animated element under reduced motion", () => {
    const { container } = render(<ExampleConversation />);
    const indicator = container.querySelector(".animate-typing-indicator")!;
    const animated = [...container.querySelectorAll("[class*='animate-']")]
      .filter((element) => !indicator.contains(element))
      .filter((element) => element !== indicator);

    expect(animated).not.toHaveLength(0);
    animated.forEach((element) =>
      expect(element).toHaveClass("motion-reduce:animate-none"),
    );
  });

  it("has the answer in the document from the first render", () => {
    render(<ExampleConversation />);

    expect(screen.getByText("landing.example.answer")).toBeInTheDocument();
  });
});
