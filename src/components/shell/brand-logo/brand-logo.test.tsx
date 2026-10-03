import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { BrandLogo } from "./brand-logo";
import logoAsset from "./atmo-ai-logo.svg";

describe("BrandLogo", () => {
  it("is one image named after the product (FR-022, FR-024)", () => {
    render(<BrandLogo />);

    expect(
      screen.getByRole("img", { name: "common.appName" }),
    ).toBeInTheDocument();
  });

  it("takes its aspect ratio and drawing from the asset (FR-020)", () => {
    render(<BrandLogo />);
    const logo = screen.getByRole("img");

    // Read from the asset, not written here: a designer's file of any size must pass unchanged (SC-009).
    expect(logo).toHaveAttribute(
      "viewBox",
      `0 0 ${logoAsset.width} ${logoAsset.height}`,
    );
    expect(logo.querySelector("use")?.getAttribute("href")).toMatch(
      /atmo-ai-logo\.svg#logo$/,
    );
  });

  it("follows the theme's foreground and keeps the caller's size", () => {
    render(<BrandLogo className="h-6 w-auto" />);

    expect(screen.getByRole("img")).toHaveClass(
      "text-foreground",
      "h-6",
      "w-auto",
    );
  });
});
