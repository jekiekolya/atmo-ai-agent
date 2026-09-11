import { expect, test } from "@playwright/test";

// US1: a visitor is served a language they can read, without touching a
// setting. Everything here is about the address and the copy that arrives —
// no switcher involved (FR-006, FR-026).

test.describe("with a Ukrainian browser", () => {
  test.use({
    locale: "uk-UA",
    extraHTTPHeaders: { "accept-language": "uk-UA,uk;q=0.9" },
  });

  test("the site root serves Ukrainian", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/uk$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Чим можемо допомогти?",
    );
  });

  test("an English address still serves English", async ({ page }) => {
    // The URL outranks every other signal, so a shared link reads the same for
    // everyone who opens it (FR-006).
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "How can we help?",
    );
  });
});

test.describe("with an unsupported browser language", () => {
  test.use({ extraHTTPHeaders: { "accept-language": "de-DE,de;q=0.9" } });

  test("the site root falls back to the default locale", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("with a stored preference", () => {
  test.use({ extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } });

  test("the cookie outranks the browser's language", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "uk", url: "http://localhost:3100" },
    ]);

    await page.goto("/");

    await expect(page).toHaveURL(/\/uk$/);
  });

  test("an unrecognised cookie value is ignored, not fatal", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "de", url: "http://localhost:3100" },
    ]);

    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
  });
});

test("a deep unprefixed path keeps its segments and query", async ({
  page,
}) => {
  await page.goto("/demo/42?tab=notes");

  await expect(page).toHaveURL(/\/(en|uk)\/demo\/42\?tab=notes$/);
});

test("the negotiation redirect is never cached", async ({ request }) => {
  // A cached redirect would pin a visitor to one language for good (FR-031).
  const response = await request.get("/", {
    maxRedirects: 0,
    headers: { "accept-language": "uk" },
  });

  expect(response.status()).toBe(307);
  expect(response.headers()["cache-control"]).toBe("no-store");
});

// A path that matches no route still has to be a localized page: the spec
// treats not-found as a page like any other, and the switcher has to work from
// it (FR-010, spec Edge Cases).
// Browser-only: the 404 body is client-rendered, so `lang` appears on hydration.
test.describe("an unmatched path inside a locale", () => {
  for (const [locale, heading] of [
    ["uk", "Сторінку не знайдено"],
    ["en", "Page not found"],
  ] as const) {
    test(`renders the not-found page in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}/demo`);

      expect(response?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      // The switcher must still be reachable from a not-found page.
      await expect(page.getByRole("combobox")).toBeVisible();
    });
  }

  test("the switcher still works from a not-found page", async ({ page }) => {
    await page.goto("/uk/whatever");

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page).toHaveURL(/\/en\/whatever$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
  });
});
