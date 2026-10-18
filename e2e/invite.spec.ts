import { expect, test } from "@playwright/test";

import { createAdmin } from "./support/db";
import { signedInAsOwner, signedInPage, submitSignIn } from "./support/sign-in";
import { createUserViaUi } from "./support/users";

// US3 / FR-064: create a user, accept the invite, sign in with the new password.

const NEW_PASSWORD = "an invitee's own password";

test("an invited person sets their own password and signs in with it", async ({
  browser,
}) => {
  const email = `invitee-${Date.now()}@e2e.test`;
  const owner = await signedInAsOwner(browser);

  const linkField = await createUserViaUi(owner, {
    email,
    firstName: "Lesya",
    lastName: "Ukrainka",
  });
  await expect(linkField).toBeVisible();
  const link = new URL(await linkField.inputValue());
  // No language segment: the invitee's own browser decides (FR-043).
  expect(link.pathname).toMatch(/^\/invite\/[A-Za-z0-9_-]{43}$/);

  await owner.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await owner.getByRole("button", { name: "Copy link" }).click();
  const copied = owner.getByText("Link copied.");
  await expect(copied).toBeVisible();
  // Above the dialog's backdrop, not merely rendered under it.
  await expect
    .poll(() =>
      copied.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return node.closest("[data-slot=toast]")?.contains(hit) ?? false;
      }),
    )
    .toBe(true);

  await owner.getByRole("button", { name: "Done" }).click();
  await expect(linkField).toHaveCount(0);

  const invitee = await (
    await browser.newContext({ locale: "uk-UA" })
  ).newPage();
  await invitee.goto(link.pathname);
  await expect(invitee).toHaveURL(new RegExp(`/uk${link.pathname}$`));
  await expect(invitee.getByText(email)).toBeVisible();

  await invitee.getByLabel("Новий пароль").fill(NEW_PASSWORD);
  await invitee.getByLabel("Повторіть пароль").fill(NEW_PASSWORD);
  await invitee.getByRole("button", { name: "Встановити пароль" }).click();

  await expect(invitee).toHaveURL(/\/uk\/sign-in\?notice=password-set$/);
  await expect(invitee.getByText("Пароль встановлено")).toBeVisible();

  await submitSignIn(invitee, email, NEW_PASSWORD, "uk");
  await expect(invitee).toHaveURL(/\/uk\/dashboard$/);
  await expect(invitee.getByRole("heading", { level: 1 })).toHaveText(
    "Вітаємо, Lesya",
  );

  // The same link again: used, and no form (FR-045).
  await invitee.goto(`/uk${link.pathname}`);
  await expect(
    invitee.getByText("Це посилання-запрошення вже використано."),
  ).toBeVisible();
  await expect(invitee.getByLabel("Новий пароль")).toHaveCount(0);
});

test("a signed-in user who opens an invite link is asked to sign out first", async ({
  browser,
}) => {
  const email = `invitee-signed-in-${Date.now()}@e2e.test`;
  const owner = await signedInAsOwner(browser);

  const linkField = await createUserViaUi(owner, {
    email,
    firstName: "Ivan",
    lastName: "Franko",
  });
  const link = new URL(await linkField.inputValue());

  // Its own account: signing out ends every session of that user, and other specs share the owner (FR-066).
  const admin = await createAdmin();
  const page = await signedInPage(browser, admin.email, admin.password);

  await page.goto(`/en${link.pathname}`);
  await expect(
    page.getByText(`You're signed in as ${admin.email}.`),
  ).toBeVisible();
  await expect(page.getByLabel("New password")).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new RegExp(`/en${link.pathname}$`));
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByLabel("Repeat the password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Set password" }).click();

  await expect(page).toHaveURL(/\/en\/sign-in\?notice=password-set$/);
  await expect(page.getByText("Your password is set.")).toBeVisible();
});

test("the invite page does not leak its address to other sites (FR-043)", async ({
  page,
}) => {
  await page.goto("/en/invite/not-a-real-token");

  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
    "content",
    "no-referrer",
  );
  await expect(
    page.getByText("This invitation link is not valid."),
  ).toBeVisible();
});
