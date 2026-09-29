import { expect, test } from "@playwright/test";

import { createAdmin, sql } from "./support/db";
import { signedInPage, signOut, submitSignIn } from "./support/sign-in";

// Each test signs in as its own admin: signing out ends every session of that user.

test("a successful sign-in reaches the protected home and shows the full name", async ({
  page,
}) => {
  const admin = await createAdmin();

  await page.goto("/en/sign-in");
  await submitSignIn(page, admin.email, admin.password);

  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome, Taras",
  );
  await expect(
    page.getByRole("button", { name: "Account menu: Taras Shevchenko" }),
  ).toHaveText("Taras Shevchenko");
});

test("a failed sign-in shows one uniform message, whatever the cause (FR-015)", async ({
  page,
}) => {
  const admin = await createAdmin();
  const messages: string[] = [];

  for (const [email, password] of [
    [admin.email, "wrong password entirely"],
    ["nobody@e2e.test", admin.password],
  ]) {
    await page.goto("/en/sign-in");
    await submitSignIn(page, email, password);
    const alert = page.locator('[data-slot="alert"]');
    await expect(alert).toBeVisible();
    messages.push((await alert.textContent()) ?? "");
  }

  expect(messages[0]).toBe(messages[1]);
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("an anonymous visitor at a prefixed protected address signs in and lands where they were going", async ({
  page,
}) => {
  const admin = await createAdmin();

  await page.goto("/uk/dashboard");
  await expect(page).toHaveURL(/\/uk\/sign-in\?callbackUrl=%2Fuk%2Fdashboard$/);

  await submitSignIn(page, admin.email, admin.password, "uk");
  await expect(page).toHaveURL(/\/uk\/dashboard$/);
});

test.describe("an unprefixed protected address", () => {
  test.use({
    locale: "uk-UA",
    extraHTTPHeaders: { "accept-language": "uk" },
  });

  test("takes two no-store hops, writes no language cookie, and returns after sign-in (FR-029, FR-030)", async ({
    page,
    request,
  }) => {
    const first = await request.get("/dashboard", { maxRedirects: 0 });
    expect(first.status()).toBe(307);
    expect(
      new URL(first.headers()["location"], "http://base.invalid").pathname,
    ).toBe("/uk/dashboard");
    expect(first.headers()["cache-control"]).toBe("no-store");
    expect(first.headers()["set-cookie"]).toBeUndefined();

    const second = await request.get("/uk/dashboard", { maxRedirects: 0 });
    expect(second.status()).toBe(307);
    const location = new URL(
      second.headers()["location"],
      "http://base.invalid",
    );
    expect(location.pathname).toBe("/uk/sign-in");
    expect(location.searchParams.get("callbackUrl")).toBe("/uk/dashboard");
    expect(second.headers()["cache-control"]).toBe("no-store");
    expect(second.headers()["set-cookie"]).toBeUndefined();

    const admin = await createAdmin();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/uk\/sign-in/);
    await submitSignIn(page, admin.email, admin.password, "uk");
    await expect(page).toHaveURL(/\/uk\/dashboard$/);
  });
});

test("a signed-in visitor opening sign-in is sent to the protected home (FR-031)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await page.goto("/en/sign-in");

  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("sign-in shows only the notices it knows, whatever the address says", async ({
  page,
}) => {
  const alert = page.locator('[data-slot="alert"]');

  for (const notice of ["constructor", "__proto__", "toString"]) {
    await page.goto(`/en/sign-in?notice=${notice}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(alert).toHaveCount(0);
  }

  await page.goto("/en/sign-in?notice=password-set");
  await expect(alert).toBeVisible();
});

test("signing out on one device ends the session on the other (FR-066)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const deviceA = await signedInPage(browser, admin.email, admin.password);
  const deviceB = await signedInPage(browser, admin.email, admin.password);

  await signOut(deviceA);
  await expect(deviceA).toHaveURL(/\/en\/sign-in$/);

  await deviceB.reload();
  await expect(deviceB).toHaveURL(/\/en\/sign-in(\?|$)/);
  await expect(deviceB.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("a session cookie copied before sign-out is refused afterwards", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);
  const copied = await page.context().cookies();

  await signOut(page);
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  const replay = await browser.newContext();
  await replay.addCookies(copied);
  const replayPage = await replay.newPage();
  await replayPage.goto("/en/dashboard");

  // The revoked cookie also proves there is no redirect loop (FR-027).
  await expect(replayPage).toHaveURL(/\/en\/sign-in$/);
  await expect(
    replayPage.getByRole("button", { name: "Sign in" }),
  ).toBeVisible();
});

test("Back after signing out does not show the protected page (FR-067)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await signOut(page);
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.goBack();

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome, Taras" }),
  ).toHaveCount(0);
});

test("five wrong passwords lock the account, uniformly, until the lock passes (US5)", async ({
  page,
}) => {
  const admin = await createAdmin();
  const messages = new Set<string>();

  await page.goto("/en/sign-in");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await submitSignIn(page, admin.email, "wrong password entirely");
    const alert = page.locator('[data-slot="alert"]');
    await expect(alert).toBeVisible();
    messages.add((await alert.textContent()) ?? "");
  }

  // Locked: even the right password gets the same message (FR-019).
  await submitSignIn(page, admin.email, admin.password);
  await expect(page.locator('[data-slot="alert"]')).toBeVisible();
  messages.add((await page.locator('[data-slot="alert"]').textContent()) ?? "");
  expect(messages.size).toBe(1);
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await sql(
    `UPDATE users SET "lockedUntil" = now() - interval '1 second' WHERE id = $1`,
    [admin.id],
  );
  await submitSignIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("changing the password signs out everywhere; only the new one works (US6)", async ({
  browser,
  page,
}) => {
  const admin = await createAdmin();
  const other = await signedInPage(browser, admin.email, admin.password);
  const self = await signedInPage(browser, admin.email, admin.password);
  const NEW = "a completely new password";

  await self.getByRole("link", { name: "Account" }).click();
  await self.getByLabel("Current password").fill(admin.password);
  await self.getByLabel("New password", { exact: true }).fill(NEW);
  await self.getByLabel("Repeat the new password").fill(NEW);
  await self.getByRole("button", { name: "Change password" }).click();

  await expect(self).toHaveURL(/\/en\/sign-in\?notice=password-changed$/);
  await expect(self.getByText("Your password was changed.")).toBeVisible();

  await other.reload();
  await expect(other).toHaveURL(/\/en\/sign-in/);

  await page.goto("/en/sign-in");
  await submitSignIn(page, admin.email, admin.password);
  await expect(page.locator('[data-slot="alert"]')).toBeVisible();
  await submitSignIn(page, admin.email, NEW);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
});
