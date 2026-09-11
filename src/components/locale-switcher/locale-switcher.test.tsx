import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
const currentLocale = vi.hoisted(() => ({ value: "uk" }));
const currentPathname = vi.hoisted(() => ({ value: "/demo/42" }));

vi.mock("next-intl", () => ({
  useLocale: () => currentLocale.value,
  useTranslations: () => (key: string) => (key === "label" ? "Мова" : key),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => currentPathname.value,
  useRouter: () => ({ replace }),
}));

import { LocaleSwitcher } from "./locale-switcher";

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox"));
  return await screen.findByRole("listbox");
}

beforeEach(() => {
  replace.mockClear();
  currentLocale.value = "uk";
  currentPathname.value = "/demo/42";
  window.history.replaceState({}, "", "/uk/demo/42");
});

describe("LocaleSwitcher", () => {
  it("names itself so the control is identifiable without sighted context", () => {
    render(<LocaleSwitcher />);

    expect(screen.getByRole("combobox", { name: "Мова" })).toBeInTheDocument();
  });

  it("shows the active locale on the trigger", () => {
    render(<LocaleSwitcher />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Українська");
  });

  it("offers every supported locale, each named in its own language", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    const list = await openList(user);

    expect(
      within(list).getByRole("option", { name: "English" }),
    ).toBeInTheDocument();
    expect(
      within(list).getByRole("option", { name: "Українська" }),
    ).toBeInTheDocument();
    expect(within(list).getAllByRole("option")).toHaveLength(2);
  });

  it("marks which locale is currently selected", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    const list = await openList(user);

    expect(
      within(list).getByRole("option", { name: "Українська" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(list).getByRole("option", { name: "English" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("navigates to the same path under the chosen locale", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    const list = await openList(user);
    await user.click(within(list).getByRole("option", { name: "English" }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/demo/42", { locale: "en" }),
    );
  });

  it("keeps the query string across the switch", async () => {
    window.history.replaceState({}, "", "/uk/demo/42?tab=notes&x=1");
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    const list = await openList(user);
    await user.click(within(list).getByRole("option", { name: "English" }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/demo/42?tab=notes&x=1", {
        locale: "en",
      }),
    );
  });

  it("does nothing when the active locale is chosen again", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    const list = await openList(user);
    await user.click(within(list).getByRole("option", { name: "Українська" }));

    expect(replace).not.toHaveBeenCalled();
  });
});

// FR-016 / SC-010. The behaviour comes from Base UI; these prove it survived
// vendoring and customization, which is the part that can actually regress.
describe("LocaleSwitcher keyboard and assistive technology", () => {
  it("opens the list from the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.tab();
    expect(screen.getByRole("combobox")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("moves between options and chooses one without a pointer", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowUp}{Enter}");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/demo/42", { locale: "en" }),
    );
  });

  it("dismisses without choosing and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });
});

// FR-017. Storage can be blocked entirely (private mode, a strict policy). The
// switch is a navigation and must not depend on the preference being writable.
describe("LocaleSwitcher when the preference cannot be stored", () => {
  it("still navigates, and surfaces nothing to the visitor", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie",
    );
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        throw new Error("cookies are blocked");
      },
    });

    try {
      const user = userEvent.setup();
      render(<LocaleSwitcher />);

      const list = await openList(user);
      await user.click(within(list).getByRole("option", { name: "English" }));

      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("/demo/42", { locale: "en" }),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      if (descriptor) Object.defineProperty(document, "cookie", descriptor);
    }
  });
});
