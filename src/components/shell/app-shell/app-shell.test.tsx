import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/theme-toggle/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}));
vi.mock("@/components/shell/locale-switcher/locale-switcher", () => ({
  LocaleSwitcher: () => <button type="button">locale</button>,
}));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders one header holding the logo, the nav, the preferences and the account slot", () => {
    render(
      <AppShell
        logo={<a href="#home">logo</a>}
        nav={<nav aria-label="Main">links</nav>}
        account={<button type="button">account</button>}
      >
        <p>content</p>
      </AppShell>,
    );

    const headers = screen.getAllByRole("banner");
    expect(headers).toHaveLength(1);
    // The logo comes first (spec 005, FR-021).
    expect(headers[0].firstElementChild).toContainElement(
      screen.getByRole("link", { name: "logo" }),
    );
    const header = within(headers[0]);
    expect(
      header.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
    expect(header.getByRole("button", { name: "theme" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "locale" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "account" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByText("content"),
    ).toBeInTheDocument();
  });

  it("renders only the preferences when there is no logo, nav or account", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getAllByRole("button"),
    ).toHaveLength(2);
  });
});
