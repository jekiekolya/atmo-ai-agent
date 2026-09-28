import { expect, type Page, test } from "@playwright/test";

import { createAdmin } from "./support/db";
import { SUPER_ADMIN } from "./support/env";
import { signedInPage, submitSignIn } from "./support/sign-in";

// US4: the super admin manages who has access.

async function rowAction(owner: Page, email: string, action: string) {
  await owner.goto("/en/dashboard/users");
  const row = owner.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: /^Actions for/ }).click();
  await owner.getByRole("menuitem", { name: action }).click();
}

test("deactivating a signed-in admin ends their access on the very next request (FR-064)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const adminPage = await signedInPage(browser, admin.email, admin.password);
  const owner = await signedInPage(
    browser,
    SUPER_ADMIN.email,
    SUPER_ADMIN.password,
  );

  await rowAction(owner, admin.email, "Deactivate");
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(
    owner.getByText("Taras Shevchenko was deactivated."),
  ).toBeVisible();
  await expect(
    owner.getByRole("row").filter({ hasText: admin.email }),
  ).toContainText("Deactivated");

  await adminPage.getByRole("link", { name: "Account" }).click();
  await expect(adminPage).toHaveURL(/\/en\/sign-in/);
});

test("a deactivated admin cannot sign in, and can again once reactivated", async ({
  browser,
  page,
}) => {
  const admin = await createAdmin();
  const owner = await signedInPage(
    browser,
    SUPER_ADMIN.email,
    SUPER_ADMIN.password,
  );

  await rowAction(owner, admin.email, "Deactivate");
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(
    owner.getByRole("row").filter({ hasText: admin.email }),
  ).toContainText("Deactivated");

  await page.goto("/en/sign-in");
  await submitSignIn(page, admin.email, admin.password);
  await expect(page.locator('[data-slot="alert"]')).toBeVisible();

  await rowAction(owner, admin.email, "Reactivate");
  await expect(
    owner.getByRole("row").filter({ hasText: admin.email }),
  ).toContainText("Active");

  await submitSignIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("row actions are on screen without scrolling the table, on desktop and phone", async ({
  browser,
}) => {
  await createAdmin();
  const owner = await signedInPage(
    browser,
    SUPER_ADMIN.email,
    SUPER_ADMIN.password,
  );
  await owner.goto("/en/dashboard/users");
  const actions = owner.getByRole("button", { name: /^Actions for/ }).first();

  await expect(actions).toBeInViewport({ ratio: 1 });
  await owner.setViewportSize({ width: 375, height: 740 });
  await expect(actions).toBeInViewport({ ratio: 1 });
});

test("an admin sees 'not permitted' on the users page (FR-037)", async ({
  browser,
}) => {
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.goto("/en/dashboard/users");

  await expect(
    page.getByRole("heading", { name: "Not permitted" }),
  ).toBeVisible();
  await expect(page.getByText(SUPER_ADMIN.email)).toHaveCount(0);
});

test("a revoked link is no longer valid (FR-052)", async ({
  browser,
  page,
}) => {
  const email = `revoked-${Date.now()}@e2e.test`;
  const owner = await signedInPage(
    browser,
    SUPER_ADMIN.email,
    SUPER_ADMIN.password,
  );

  await owner.goto("/en/dashboard/users");
  await owner.getByRole("button", { name: "Create user" }).click();
  await owner.getByLabel("Email").fill(email);
  await owner.getByLabel("First name").fill("Ivan");
  await owner.getByLabel("Last name").fill("Franko");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Create user" })
    .click();
  const link = new URL(
    await owner.getByRole("textbox", { name: "Invitation link" }).inputValue(),
  );
  await owner.getByRole("button", { name: "Done" }).click();

  await rowAction(owner, email, "Revoke link");
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Revoke link" })
    .click();
  await expect(
    owner.getByText("The invitation link for Ivan Franko was revoked."),
  ).toBeVisible();

  await page.goto(`/en${link.pathname}`);
  await expect(
    page.getByText("This invitation link is not valid."),
  ).toBeVisible();
});
