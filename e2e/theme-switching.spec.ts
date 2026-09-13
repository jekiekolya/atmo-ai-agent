import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "@/lib/theme";

// `attribute="class"` also writes an inert `light` class — never match the whole list.
const DARK = /(^|\s)dark(\s|$)/;

const LABEL_EN = "Switch between light and dark";
const LABEL_UK = "Перемкнути світлу й темну тему";

function html(page: Page) {
  return page.locator("html");
}

function toggle(page: Page, name = LABEL_EN) {
  return page.getByRole("button", { name });
}

function colorScheme(page: Page) {
  return page.evaluate(() => document.documentElement.style.colorScheme);
}

function seedPreference(context: BrowserContext, value: string) {
  return context.addInitScript(
    ([key, stored]) => window.localStorage.setItem(key, stored),
    [THEME_STORAGE_KEY, value],
  );
}

test.describe("a visitor with no stored preference (US1)", () => {
  test.describe("on a device that prefers dark", () => {
    test.use({ colorScheme: "dark" });

    test("is served dark on first load", async ({ page }) => {
      await page.goto("/en");

      await expect(html(page)).toHaveClass(DARK);
      expect(await colorScheme(page)).toBe("dark");
    });
  });

  test.describe("on a device that prefers light", () => {
    test.use({ colorScheme: "light" });

    test("is served light on first load", async ({ page }) => {
      await page.goto("/en");

      await expect(html(page)).not.toHaveClass(DARK);
      expect(await colorScheme(page)).toBe("light");
    });
  });

  test("follows a device change made while the page is open", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await expect(html(page)).not.toHaveClass(DARK);

    await page.emulateMedia({ colorScheme: "dark" });

    await expect(html(page)).toHaveClass(DARK);
    expect(await colorScheme(page)).toBe("dark");
  });
});

test.describe("a visitor who pins an appearance (US2)", () => {
  test("flips the appearance without a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");

    await toggle(page).click();

    await expect(html(page)).toHaveClass(DARK);
  });

  test("keeps the choice across a reload and a navigation", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await toggle(page).click();
    await expect(html(page)).toHaveClass(DARK);

    await page.reload();
    await expect(html(page)).toHaveClass(DARK);

    await page.goto("/en/demo/42");
    await expect(html(page)).toHaveClass(DARK);
  });

  test("keeps a stored choice over a conflicting device setting", async ({
    page,
    context,
  }) => {
    await seedPreference(context, "dark");
    await page.emulateMedia({ colorScheme: "light" });

    await page.goto("/en");

    await expect(html(page)).toHaveClass(DARK);
  });

  test("converges two open tabs on one preference", async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");

    const other = await context.newPage();
    await other.emulateMedia({ colorScheme: "light" });
    await other.goto("/en");

    await toggle(page).click();
    await expect(html(page)).toHaveClass(DARK);

    // The storage event crosses pages asynchronously, so wait rather than race.
    await expect.poll(() => html(other).getAttribute("class")).toMatch(DARK);
  });

  test("never sends the preference to the server", async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    const before = page.url();

    await toggle(page).click();
    await expect(html(page)).toHaveClass(DARK);

    // FR-016: local storage only — never a cookie, never the address.
    const cookies = await context.cookies();
    expect(cookies.map((c) => c.name)).not.toContain(THEME_STORAGE_KEY);
    expect(cookies.every((c) => !/theme/i.test(c.name))).toBe(true);
    expect(page.url()).toBe(before);
  });
});

test.describe("a visitor whose storage cannot be trusted (US2)", () => {
  test("still gets a working page when storage is blocked", async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("blocked");
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");

    // FR-018: no throw, and the product falls back to following the device.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(toggle(page)).toBeVisible();
    await expect(html(page)).toHaveClass(DARK);
    expect(errors).toEqual([]);
  });

  test("stays usable and recoverable after an unrecognised stored value", async ({
    page,
    context,
  }) => {
    // Wrong appearance on this load is accepted; see Decision 7 in research.md.
    await seedPreference(context, "lite");
    await page.emulateMedia({ colorScheme: "dark" });

    await page.goto("/en");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(toggle(page)).toBeVisible();

    await toggle(page).click();

    // No reload here: addInitScript re-seeds on every navigation.
    await expect(html(page)).toHaveClass(DARK);
    expect(
      await page.evaluate(
        (key) => window.localStorage.getItem(key),
        THEME_STORAGE_KEY,
      ),
    ).toBe("dark");
  });
});

test.describe("the control itself (US3)", () => {
  test("is operable by keyboard alone", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");

    await toggle(page).focus();
    await expect(toggle(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(html(page)).toHaveClass(DARK);
  });

  test("carries the same accessible name in both appearances", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await expect(toggle(page)).toBeVisible();

    await toggle(page).click();
    await expect(html(page)).toHaveClass(DARK);

    // FR-011: the name must not have changed with the appearance.
    await expect(toggle(page)).toBeVisible();
  });
});

test.describe("appearance and language are independent (US4)", () => {
  test("switching language leaves the appearance alone", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await toggle(page).click();
    await expect(html(page)).toHaveClass(DARK);

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Українська" }).click();

    await expect(page).toHaveURL(/\/uk$/);
    await expect(html(page)).toHaveClass(DARK);
    await expect(toggle(page, LABEL_UK)).toBeVisible();
  });

  test("switching language leaves a device-following visitor following", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");
    await expect(html(page)).toHaveClass(DARK);

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Українська" }).click();

    await expect(page).toHaveURL(/\/uk$/);
    await expect(html(page)).toHaveClass(DARK);
  });

  test("switching appearance leaves the language and the page alone", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/uk/demo/42?tab=notes");
    const heading = await page.getByRole("heading", { level: 1 }).textContent();

    await toggle(page, LABEL_UK).click();

    await expect(html(page)).toHaveClass(DARK);
    await expect(html(page)).toHaveAttribute("lang", "uk");
    await expect(page).toHaveURL(/\/uk\/demo\/42\?tab=notes$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      heading ?? "",
    );
  });
});
