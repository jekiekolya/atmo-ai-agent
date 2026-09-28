import { expect, type Page, test } from "@playwright/test";

import { createAdmin, sql } from "./support/db";
import { signedInPage } from "./support/sign-in";

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
  const response = await page.goto("/en/sign-in");

  expect(response?.status()).toBe(200);
  await expectSignIn(page);
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
