import { expect, type Page, test } from "@playwright/test";

import { sql } from "./support/db";
import { SUPER_ADMIN } from "./support/env";
import { signedInPage } from "./support/sign-in";

// Spec 004: every date is shown on the reader's own clock (FR-020).

const CREATED_AT = "2026-03-14T23:30:00Z";
const EXPIRES_AT = "2026-03-14T09:30:00Z";

const EXPECTED = {
  "Europe/Kyiv": {
    created: "Mar 15, 2026",
    expires: /Mar 14, 2026, 11:30\sAM/,
  },
  "America/New_York": {
    created: "Mar 14, 2026",
    expires: /Mar 14, 2026, 05:30\sAM/,
  },
};

// Messages that come from the environment rather than from a defect.
// The list starts empty on purpose; every entry added needs its reason here.
const IGNORED_CONSOLE_MESSAGES: RegExp[] = [];

/** Warnings count too, unlike smoke.spec.ts: FR-006 forbids a mismatch warning as well. */
function collectIssues(page: Page) {
  const issues: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (IGNORED_CONSOLE_MESSAGES.some((pattern) => pattern.test(text))) return;
    issues.push(`${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));

  return issues;
}

/** Creates an invited user and leaves the invitation link dialog open. */
async function createInvitedUser(owner: Page) {
  const email = `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;

  await owner.goto("/en/dashboard/users");
  await owner.getByRole("button", { name: "Create user" }).click();
  await owner.getByLabel("Email").fill(email);
  await owner.getByLabel("First name").fill("Ivan");
  await owner.getByLabel("Last name").fill("Franko");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Create user" })
    .click();
  await expect(
    owner.getByRole("textbox", { name: "Invitation link" }),
  ).toBeVisible();

  return email;
}

for (const [zone, expected] of Object.entries(EXPECTED)) {
  test.describe(`read in ${zone}`, () => {
    test.use({ timezoneId: zone });

    test("the users table shows the reader's own time, unlabelled (SC-001, SC-002)", async ({
      browser,
    }) => {
      const owner = await signedInPage(
        browser,
        SUPER_ADMIN.email,
        SUPER_ADMIN.password,
      );
      const email = await createInvitedUser(owner);
      await owner.getByRole("button", { name: "Done" }).click();
      await sql(`UPDATE users SET "createdAt" = $2 WHERE email = $1`, [
        email,
        CREATED_AT,
      ]);
      await sql(
        `UPDATE invites SET "expiresAt" = $2
         WHERE "userId" = (SELECT id FROM users WHERE email = $1)
           AND "consumedAt" IS NULL AND "revokedAt" IS NULL`,
        [email, EXPIRES_AT],
      );

      const issues = collectIssues(owner);
      await owner.reload();
      await owner.waitForLoadState("networkidle");

      const row = owner.getByRole("row").filter({ hasText: email });
      await expect(row).toContainText(expected.created);
      await expect(row).toContainText(expected.expires);
      await expect(row).not.toContainText("UTC");
      expect(issues).toEqual([]);
    });
  });
}

test.describe("read in Europe/Kyiv", () => {
  test.use({ timezoneId: "Europe/Kyiv" });

  test("the invitation link dialog states the expiry in the reader's time (FR-003)", async ({
    browser,
  }) => {
    const owner = await signedInPage(
      browser,
      SUPER_ADMIN.email,
      SUPER_ADMIN.password,
    );
    const issues = collectIssues(owner);
    const email = await createInvitedUser(owner);

    const { rows } = await sql(
      `SELECT i."expiresAt" FROM invites i JOIN users u ON u.id = i."userId"
       WHERE u.email = $1`,
      [email],
    );
    // Parts, not the whole string: Node and Chromium differ in the space before AM/PM.
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en", {
        timeZone: "Europe/Kyiv",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(rows[0].expiresAt as Date)
        .map((part) => [part.type, part.value]),
    );

    const dialog = owner.getByRole("dialog", { name: "Invitation link" });
    await expect(dialog).toContainText(
      new RegExp(`${parts.hour}:${parts.minute}\\s*${parts.dayPeriod}`),
    );
    await expect(dialog).not.toContainText("UTC");
    expect(issues).toEqual([]);
  });
});
