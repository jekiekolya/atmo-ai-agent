import { expect, test } from "@playwright/test";

// US2: the visitor changes language and the product remembers. This is the
// acceptance coverage FR-025 requires, plus the shared-link case from FR-030.

const BASE = "http://localhost:3100";

async function switchTo(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: label }).click();
}

test("switching keeps the visitor on the same page, in the other language", async ({
  page,
}) => {
  await page.goto("/uk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Чим можемо допомогти?",
  );

  await switchTo(page, "English");

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How can we help?",
  );
});

test("the choice survives a reload", async ({ page }) => {
  await page.goto("/uk");
  await switchTo(page, "English");
  await expect(page).toHaveURL(/\/en$/);

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How can we help?",
  );
});

test("the choice survives a later visit to the site root", async ({
  page,
  context,
}) => {
  await page.goto("/uk");
  await switchTo(page, "English");
  await expect(page).toHaveURL(/\/en$/);

  // The switch must have stored the preference — that is the only thing that
  // can carry the choice to an unprefixed address (FR-014, FR-015).
  const cookie = (await context.cookies(BASE)).find(
    (c) => c.name === "NEXT_LOCALE",
  );
  expect(cookie?.value).toBe("en");

  await page.goto("/");

  await expect(page).toHaveURL(/\/en$/);
});

test("a shared link does not overwrite the recipient's own choice", async ({
  page,
  context,
}) => {
  // Clarification 3: the recipient reads the shared page in its language, but
  // their own preference survives for the next unprefixed visit (FR-030).
  await page.goto("/en");
  await switchTo(page, "Українська");
  await expect(page).toHaveURL(/\/uk$/);

  await switchTo(page, "English");
  await expect(page).toHaveURL(/\/en$/);

  await page.goto("/uk/invite/shared-token");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");

  const cookie = (await context.cookies(BASE)).find(
    (c) => c.name === "NEXT_LOCALE",
  );
  expect(cookie?.value).toBe("en");

  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("switching preserves a dynamic segment and the query string", async ({
  page,
}) => {
  // FR-013.
  await page.goto("/uk/invite/abc?tab=notes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Встановіть пароль",
  );

  await switchTo(page, "English");

  await expect(page).toHaveURL(/\/en\/invite\/abc\?tab=notes$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Set your password",
  );
});

test("the switcher is operable by keyboard alone", async ({ page }) => {
  // FR-016 / SC-010 against a real browser, where focus and roles are real.
  await page.goto("/uk");

  await page.getByRole("combobox").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/en$/);
});
