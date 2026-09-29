import { expect, type Page, test } from "@playwright/test";

import { createAdmin, sql } from "./support/db";
import { SUPER_ADMIN } from "./support/env";
import { signedInPage, signOut } from "./support/sign-in";

const sessionCookie = async (page: Page) =>
  (await page.context().cookies()).find((c) =>
    c.name.includes("session-token"),
  );

const expectSignIn = async (page: Page) => {
  await expect(page).toHaveURL(/\/en\/sign-in/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
};

test("deactivation ends access on the very next request (FR-023)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await sql(`UPDATE users SET "isActive" = false WHERE id = $1`, [admin.id]);
  await page.reload();

  await expectSignIn(page);
});

test("a password change ends every earlier session, on every device (FR-025)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const deviceA = await signedInPage(browser, admin.email, admin.password);
  const deviceB = await signedInPage(browser, admin.email, admin.password);

  await sql(`UPDATE users SET "passwordChangedAt" = now() WHERE id = $1`, [
    admin.id,
  ]);
  await deviceA.reload();
  await deviceB.reload();

  await expectSignIn(deviceA);
  await expectSignIn(deviceB);
});

test("a session whose account no longer exists is refused", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  // Only to simulate US2 scenario 4 — the product itself never deletes.
  await sql(`DELETE FROM users WHERE id = $1`, [admin.id]);
  await page.reload();

  await expectSignIn(page);
});

test("a revoked session opening sign-in sees the form, not a redirect loop (FR-027)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await sql(`UPDATE users SET "isActive" = false WHERE id = $1`, [admin.id]);
  // A fresh tab with the same cookie: the open one may already be leaving for sign-in on its own.
  const fresh = await page.context().newPage();
  const response = await fresh.goto("/en/sign-in");

  expect(response?.status()).toBe(200);
  await expectSignIn(fresh);
});

test("activity renews the rolling window (FR-026)", async ({ browser }) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);
  const sessionCookie = async () =>
    (await page.context().cookies()).find((c) =>
      c.name.includes("session-token"),
    );

  const before = (await sessionCookie())!.expires;
  // Cookie expiry has one-second resolution.
  await page.waitForTimeout(1_500);

  const renewed = page.waitForResponse((r) =>
    r.url().includes("/api/auth/session"),
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await renewed;

  expect((await sessionCookie())!.expires).toBeGreaterThan(before);
});

test("work on one page renews the rolling window, without navigating (FR-026)", async ({
  browser,
}) => {
  const target = await createAdmin();
  const owner = await signedInPage(
    browser,
    SUPER_ADMIN.email,
    SUPER_ADMIN.password,
  );
  await owner.goto("/en/dashboard/users");

  const loaded = (await sessionCookie(owner))!.expires;
  // Cookie expiry has one-second resolution.
  await owner.waitForTimeout(1_500);
  const row = owner.getByRole("row").filter({ hasText: target.email });
  await row.getByRole("button", { name: /^Actions for/ }).click();
  const issued = owner.waitForResponse((r) =>
    r.url().endsWith(`/api/users/${target.id}/invite`),
  );
  await owner.getByRole("menuitem", { name: "Issue new link" }).click();
  await issued;
  const afterAction = (await sessionCookie(owner))!.expires;
  expect(afterAction).toBeGreaterThan(loaded);

  await owner.waitForTimeout(1_500);
  const renewed = owner.waitForResponse((r) =>
    r.url().includes("/api/auth/session"),
  );
  await owner.reload();
  await renewed;
  expect((await sessionCookie(owner))!.expires).toBeGreaterThan(afterAction);
});

test("a session refused when the tab returns sends the visitor to sign-in at once (FR-071)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await sql(`UPDATE users SET "isActive" = false WHERE id = $1`, [admin.id]);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );

  await expect(page).toHaveURL(/\/en\/sign-in\?callbackUrl=%2Fen%2Fdashboard$/);
});

test("signing out leaves no session cookie behind", async ({ browser }) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await signOut(page);
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  expect(await sessionCookie(page)).toBeUndefined();
});
