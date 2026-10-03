import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setTheme = vi.hoisted(() => vi.fn());
const resolved = vi.hoisted(() => ({
  value: "light" as string | undefined,
}));

const LABEL = "Switch between light and dark";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "label" ? LABEL : key),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: resolved.value, setTheme }),
}));

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  setTheme.mockClear();
  resolved.value = "light";
});

describe("ThemeToggle", () => {
  it("renders exactly one interactive element", () => {
    render(<ThemeToggle />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("names itself identically whichever appearance is active", () => {
    const { unmount } = render(<ThemeToggle />);
    const inLight = screen.getByRole("button").getAttribute("aria-label");
    unmount();

    resolved.value = "dark";
    render(<ThemeToggle />);
    const inDark = screen.getByRole("button").getAttribute("aria-label");

    expect(inLight).toBe(LABEL);
    expect(inDark).toBe(inLight);
  });

  it("renders the same control before the theme is known, so there is no placeholder", () => {
    // What the server renders: next-themes has no resolved value there.
    resolved.value = undefined;
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: LABEL })).toBeInTheDocument();
  });

  it("ships both icons so CSS decides which is visible, not a render branch", () => {
    const { container, unmount } = render(<ThemeToggle />);
    const inLight = [...container.querySelectorAll("svg")].map((i) =>
      i.getAttribute("class"),
    );
    unmount();

    resolved.value = "dark";
    const { container: darkContainer } = render(<ThemeToggle />);
    const inDark = [...darkContainer.querySelectorAll("svg")].map((i) =>
      i.getAttribute("class"),
    );

    expect(inLight).toHaveLength(2);
    expect(inDark).toEqual(inLight);
    expect(inLight.join(" ")).toContain("dark:hidden");
    expect(inLight.join(" ")).toContain("hidden dark:block");
  });

  it("pins dark when the page is light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));

    expect(setTheme).toHaveBeenCalledExactlyOnceWith("dark");
  });

  it("pins light when the page is dark", async () => {
    const user = userEvent.setup();
    resolved.value = "dark";
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));

    expect(setTheme).toHaveBeenCalledExactlyOnceWith("light");
  });

  it("offers no way back to following the system", async () => {
    // Two-state by decision (FR-009) — argue with this test, not around it.
    const user = userEvent.setup();

    for (const value of ["light", "dark", undefined]) {
      resolved.value = value;
      const { unmount } = render(<ThemeToggle />);
      await user.click(screen.getByRole("button"));
      unmount();
    }

    expect(setTheme).not.toHaveBeenCalledWith("system");
  });
});
