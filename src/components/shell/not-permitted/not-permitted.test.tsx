import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

import { NotPermitted } from "./not-permitted";

describe("NotPermitted", () => {
  it("says the page is not available to this account (FR-037)", async () => {
    render(await NotPermitted());

    expect(
      screen.getByRole("heading", { level: 1, name: "notPermitted.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("notPermitted.description")).toBeInTheDocument();
  });
});
