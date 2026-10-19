import { expect, test, type Page } from "@playwright/test";

// Console errors that come from the environment rather than from a defect.
// The list starts empty on purpose; every entry added needs its reason here.
const IGNORED_CONSOLE_ERRORS: RegExp[] = [];

function collectErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));

  return errors;
}

test("the home page renders without errors", async ({ page }) => {
  const errors = collectErrors(page);

  // "/" carries no locale, so it negotiates and redirects; the assertion is on
  // where the visitor lands, not on the redirect itself.
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/(en|uk)$/);

  // Warnings are ignored, so what is left is worth waiting for: React reports
  // hydration failures through console.error after the initial load.
  await page.waitForLoadState("networkidle");

  expect(errors).toEqual([]);
});

for (const locale of ["en", "uk"]) {
  test(`the ${locale} landing page renders without errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page);

    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });
}
