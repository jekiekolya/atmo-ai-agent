import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { BenefitCards } from "./benefit-cards";

const IDS = ["allHours", "language", "history", "solar"];

describe("BenefitCards", () => {
  it("gives four titled cards, in order", () => {
    render(<BenefitCards />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(IDS.map((id) => `landing.benefits.${id}.title`));
  });

  it("gives each card its sentence", () => {
    render(<BenefitCards />);

    for (const id of IDS) {
      expect(
        screen.getByText(`landing.benefits.${id}.body`),
      ).toBeInTheDocument();
    }
  });

  it("hides the icons from assistive technology", () => {
    const { container } = render(<BenefitCards />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelectorAll("svg[aria-hidden=true]")).toHaveLength(4);
  });
});
