import { expect, test, type Page } from "@playwright/test";

import { createAdmin } from "./support/db";
import { signedInAsOwner, signedInPage, signOut } from "./support/sign-in";

const THEME_TOGGLE = "Switch between light and dark";

function backgroundOf(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
}

test.describe("theme and typeface (US1)", () => {
  test("light follows the reference grays, dark mirrors them", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");

    expect(await backgroundOf(page, "body")).toBe("rgb(249, 250, 251)");
    expect(await backgroundOf(page, "[data-slot=card]")).toBe(
      "rgb(255, 255, 255)",
    );

    await page.getByRole("button", { name: THEME_TOGGLE }).click();

    await expect.poll(() => backgroundOf(page, "body")).toBe("rgb(3, 7, 18)");
    expect(await backgroundOf(page, "[data-slot=card]")).toBe(
      "rgb(17, 24, 39)",
    );
  });

  test("sets every page in Roboto, served by the app itself (FR-014, FR-016)", async ({
    page,
  }) => {
    const fontHosts: string[] = [];
    page.on("request", (request) => {
      const { hostname } = new URL(request.url());
      if (/^fonts\.(googleapis|gstatic)\.com$/.test(hostname)) {
        fontHosts.push(hostname);
      }
    });

    for (const path of ["/en/sign-in", "/uk/sign-in"]) {
      await page.goto(path);
      const family = await page.evaluate(
        () => getComputedStyle(document.body).fontFamily,
      );
      expect(family).toMatch(/Roboto/);
    }

    expect(fontHosts).toEqual([]);
  });
});

test.describe("logo and name (US2)", () => {
  test("the signed-in header starts with a logo linking home (FR-021, FR-022)", async ({
    browser,
  }) => {
    const page = await signedInAsOwner(browser);
    await expect(page).toHaveTitle("Home — Atmo AI");

    const firstLink = page.getByRole("banner").getByRole("link").first();
    await expect(firstLink).toHaveAccessibleName("Atmo AI");
    await expect(firstLink).toHaveAttribute("href", "/en/dashboard");

    await page.goto("/en/dashboard/account");
    await page.getByRole("link", { name: "Atmo AI" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  for (const path of ["/en/sign-in", `/en/invite/${"A".repeat(43)}`]) {
    test(`${path.slice(0, 11)}… shows the logo above the card, not in the header (FR-023, FR-024)`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(
        page.getByRole("banner").getByRole("img", { name: "Atmo AI" }),
      ).toHaveCount(0);
      const logo = page.getByRole("img", { name: "Atmo AI" });
      await expect(logo).toHaveCount(1);
      await expect(page.getByRole("link").filter({ has: logo })).toHaveCount(0);
      await expect(logo).not.toHaveAttribute("tabindex");

      const logoBox = await logo.boundingBox();
      const headingBox = await page
        .getByRole("heading", { level: 1 })
        .boundingBox();
      expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(headingBox!.y);

      for (let press = 0; press < 8; press++) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () => document.activeElement?.closest("svg[role=img]") != null,
          ),
        ).toBe(false);
      }
    });
  }

  test("every title names the product Atmo AI (FR-025)", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page).toHaveTitle("Sign in — Atmo AI");
    await page.goto("/uk/sign-in");
    await expect(page).toHaveTitle("Вхід — Atmo AI");
  });

  test("the pill follows the product's theme, not the system's (FR-019)", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    const logo = page.getByRole("img", { name: "Atmo AI" });
    const colour = () =>
      logo.evaluate((element) => getComputedStyle(element).color);

    expect(await colour()).toBe("rgb(17, 24, 39)");
    await page.getByRole("button", { name: THEME_TOGGLE }).click();
    await expect.poll(colour).toBe("rgb(249, 250, 251)");
  });
});

test.describe("tab and touch icons (US3)", () => {
  test("declares the Atmo mark and serves it without a language prefix (FR-027 – FR-029)", async ({
    page,
    request,
  }) => {
    await page.goto("/en/sign-in");

    const icons = await page.locator('link[rel="icon"]').evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href") ?? "",
        type: link.getAttribute("type"),
      })),
    );
    const svgIcon = icons.find(({ href }) => href.startsWith("/icon.svg"));
    expect(svgIcon?.type).toBe("image/svg+xml");
    const favicon = icons.find(({ href }) => href.startsWith("/favicon.ico"));
    expect(favicon).toBeDefined();

    const touch = page.locator('link[rel="apple-touch-icon"]');
    await expect(touch).toHaveAttribute("href", /^\/apple-icon\.png/);
    await expect(touch).toHaveAttribute("sizes", "180x180");

    const served = [
      [svgIcon!.href, /^image\/svg\+xml/],
      [favicon!.href, /^image\/(x-icon|vnd\.microsoft\.icon)/],
      [(await touch.getAttribute("href"))!, /^image\/png/],
    ] as const;
    for (const [href, type] of served) {
      const response = await request.get(href, { maxRedirects: 0 });
      expect(response.status(), href).toBe(200);
      expect(response.headers()["content-type"], href).toMatch(type);
    }
  });
});

test.describe("page loader (US4)", () => {
  async function delayUsersNavigation(page: Page) {
    await page.route("**/en/dashboard/users**", async (route) => {
      const headers = route.request().headers();
      const isNavigation =
        headers["rsc"] === "1" &&
        !headers["next-router-prefetch"] &&
        !headers["next-router-segment-prefetch"];
      if (isNavigation) await new Promise((done) => setTimeout(done, 1500));
      await route.continue();
    });
    // The router shows a loading state only once the link's prefetch has told it one exists.
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Users" })
      .click();
  }

  test("a slow page shows the mark under a header that stays (FR-030, FR-032, FR-035)", async ({
    browser,
  }) => {
    const page = await signedInAsOwner(browser);
    await delayUsersNavigation(page);

    const status = page.getByRole("status");
    await expect(status).toHaveText("Loading…");
    await expect(page.getByRole("link", { name: "Atmo AI" })).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: "Users" }),
    ).toBeVisible();
    await expect(status).toHaveCount(0);
  });

  test("holds the mark still under reduced motion (FR-034)", async ({
    browser,
  }) => {
    const page = await signedInAsOwner(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await delayUsersNavigation(page);

    const paths = page.getByRole("status").locator("svg path");
    await expect(paths).toHaveCount(2);
    expect(
      await paths.evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).animationName),
      ),
    ).toEqual(["none", "none"]);
  });

  test("a revoked session still gets a real redirect, not a loader (FR-036)", async ({
    browser,
  }) => {
    // Its own account: signing out ends every session of that user, and other specs share the owner (FR-066).
    const admin = await createAdmin();
    const page = await signedInPage(browser, admin.email, admin.password);
    const copied = await page.context().cookies();
    await signOut(page);
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    const replay = await browser.newContext();
    await replay.addCookies(copied);
    const response = await replay.request.get("/en/dashboard/users", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(
      new URL(response.headers()["location"], "http://base.invalid").pathname,
    ).toBe("/en/sign-in");
    await replay.close();
  });

  test("sign-in still redirects a signed-in visitor before sending anything (FR-038)", async ({
    browser,
  }) => {
    const page = await signedInAsOwner(browser);
    const response = await page.context().request.get("/en/sign-in", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(
      new URL(response.headers()["location"], "http://base.invalid").pathname,
    ).toBe("/en/dashboard");
  });
});
