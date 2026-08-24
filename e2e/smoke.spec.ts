import { expect, test } from "@playwright/test";

// Console errors that come from the environment rather than from a defect.
// The list starts empty on purpose; every entry added needs its reason here.
const IGNORED_CONSOLE_ERRORS: RegExp[] = [];

test("the home page renders without errors", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));

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
