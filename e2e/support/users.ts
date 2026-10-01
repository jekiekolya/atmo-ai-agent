import type { Page } from "@playwright/test";

export async function createUserViaUi(
  owner: Page,
  user: { email: string; firstName: string; lastName: string },
) {
  await owner.goto("/en/dashboard/users");
  await owner.getByRole("button", { name: "Create user" }).click();
  await owner.getByLabel("Email").fill(user.email);
  await owner.getByLabel("First name").fill(user.firstName);
  await owner.getByLabel("Last name").fill(user.lastName);
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Create user" })
    .click();

  return owner.getByRole("textbox", { name: "Invitation link" });
}
