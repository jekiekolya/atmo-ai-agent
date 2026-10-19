import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props} />
  ),
}));

import { LandingHero } from "./landing-hero";

describe("LandingHero", () => {
  it("has the page's one h1", () => {
    render(<LandingHero />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "landing.headline",
    );
  });

  it("leads to the sign-in page", () => {
    render(<LandingHero />);

    expect(
      screen.getByRole("link", { name: "landing.signIn" }),
    ).toHaveAttribute("href", "/sign-in");
  });

  it("hides the glow from assistive technology", () => {
    const { container } = render(<LandingHero />);

    expect(container.querySelector(".bg-brand-mark\\/10")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows the example conversation", () => {
    render(<LandingHero />);

    expect(screen.getByRole("figure")).toBeInTheDocument();
  });
});
