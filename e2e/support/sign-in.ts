import { type Browser, expect, type Page } from "@playwright/test";

import { SUPER_ADMIN } from "./env";

const LABELS = {
  en: { email: "Email", password: "Password", submit: "Sign in" },
  uk: { email: "Електронна пошта", password: "Пароль", submit: "Увійти" },
} as const;

export type Locale = keyof typeof LABELS;

export async function submitSignIn(
  page: Page,
  email: string,
  password: string,
  locale: Locale = "en",
) {
  const labels = LABELS[locale];
  await page.getByLabel(labels.email).fill(email);
  await page.getByLabel(labels.password).fill(password);
  // Wait for the answer, so repeated attempts are each counted (US5).
  await Promise.all([
    page.waitForResponse((r) =>
      r.url().includes("/api/auth/callback/credentials"),
    ),
    page.getByRole("button", { name: labels.submit }).click(),
  ]);
}

/** A fresh browser context, signed in and on the protected home. */
export async function signedInPage(
  browser: Browser,
  email: string,
  password: string,
  locale: Locale = "en",
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/${locale}/sign-in`);
  await submitSignIn(page, email, password, locale);
  await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
  return page;
}

export function signedInAsOwner(browser: Browser, locale: Locale = "en") {
  return signedInPage(browser, SUPER_ADMIN.email, SUPER_ADMIN.password, locale);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
}
