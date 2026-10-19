import { expect, test, type Page } from "@playwright/test";

import { signedInAsOwner } from "./support/sign-in";

const COPY = {
  en: {
    headline: "AI support for your solar system",
    signIn: "Sign in",
    caption: "Example conversation",
    title: "AI support for your solar system — Atmo AI",
    backHome: "Back to the start",
  },
  uk: {
    headline: "ШІ-підтримка для вашої сонячної станції",
    signIn: "Увійти",
    caption: "Приклад розмови",
    title: "ШІ-підтримка для вашої сонячної станції — Atmo AI",
    backHome: "На головну",
  },
} as const;

const LOCALES = ["en", "uk"] as const;

const THEME_TOGGLE = "Switch between light and dark";

test.describe("landing page (US1)", () => {
  for (const locale of LOCALES) {
    const copy = COPY[locale];

    test(`${locale}: shows the header, the hero, four benefits and a footer`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);

      const banner = page.getByRole("banner");
      const logoLink = banner.getByRole("link").first();
      await expect(logoLink).toHaveAccessibleName("Atmo AI");
      await expect(logoLink).toHaveAttribute("href", `/${locale}`);
      await expect(
        banner.getByRole("link", { name: copy.signIn }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.headline,
      );
      await expect(
        page.getByRole("figure", { name: copy.caption }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 2 })).toHaveCount(4);
      await expect(page.getByRole("contentinfo")).toContainText("Atmo AI");
      await expect(page).toHaveTitle(copy.title);
    });

    test(`${locale}: does not scroll sideways at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/${locale}`);

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });

    test(`${locale}: the not-found page leads back here (FR-021)`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/no-such-page`);
      await page.getByRole("link", { name: copy.backHome }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.headline,
      );
    });
  }
});

test.describe("Sign in (US2)", () => {
  for (const locale of LOCALES) {
    const label = COPY[locale].signIn;

    test(`${locale}: both actions reach the sign-in form`, async ({ page }) => {
      const actions = [
        (p: Page) => p.getByRole("banner").getByRole("link", { name: label }),
        (p: Page) => p.getByRole("main").getByRole("link", { name: label }),
      ];

      for (const action of actions) {
        await page.goto(`/${locale}`);
        await action(page).click();

        await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in$`));
        await expect(
          page.getByLabel(/^(Email|Електронна пошта)/),
        ).toBeVisible();
      }
    });
  }

  test("a signed-in visitor sees the same page and each action reaches the dashboard (FR-020)", async ({
    browser,
  }) => {
    const page = await signedInAsOwner(browser);
    const { headline, signIn } = COPY.en;

    await page.goto("/en");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);
    await expect(
      page.getByRole("banner").getByRole("link", { name: signIn }),
    ).toBeVisible();

    for (const scope of ["banner", "main"] as const) {
      await page.goto("/en");
      await page.getByRole(scope).getByRole("link", { name: signIn }).click();
      await expect(page).toHaveURL(/\/en\/dashboard$/);
    }
  });
});

// Colour transitions on the controls also appear in getAnimations(); the sequence is CSS animations only.
const allFinished = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a instanceof CSSAnimation)
      .every((a) => a.playState === "finished"),
  );

test.describe("motion (US3)", () => {
  test("stays still under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");

    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(
      page.getByText("Output usually drops when there is more cloud"),
    ).toHaveCSS("opacity", "1");
    await expect(page.locator("figure [aria-hidden=true]")).toBeHidden();
  });

  test("plays once and ends by 3.5s", async ({ page }) => {
    await page.goto("/en");

    await expect.poll(() => allFinished(page), { timeout: 3_500 }).toBe(true);
    await expect(
      page.getByText("Output usually drops when there is more cloud"),
    ).toHaveCSS("opacity", "1");
    await expect(page.locator("figure [aria-hidden=true]").first()).toHaveCSS(
      "opacity",
      "0",
    );
  });

  test("does not restart when the theme changes (FR-017)", async ({ page }) => {
    await page.goto("/en");
    await expect.poll(() => allFinished(page), { timeout: 3_500 }).toBe(true);

    await page.getByRole("button", { name: THEME_TOGGLE }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    expect(await allFinished(page)).toBe(true);
  });

  test("replays when the visitor comes back through the product (FR-015)", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect.poll(() => allFinished(page), { timeout: 3_500 }).toBe(true);

    // A client navigation: a full one followed by Back is the back-forward-cache case, which FR-015 exempts.
    await page
      .getByRole("banner")
      .getByRole("link", { name: COPY.en.signIn })
      .click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/en$/);

    expect(await allFinished(page)).toBe(false);
    await expect.poll(() => allFinished(page), { timeout: 3_500 }).toBe(true);
  });
});
