import { expect, type Page, test } from "@playwright/test";

import { createAdmin } from "./support/db";
import { signedInPage } from "./support/sign-in";

// Spec 006: the AI chat, against the deterministic test model (AI_FAKE_MODEL).

const CONVERSATION_URL = /\/en\/dashboard\/chat\/[0-9a-f-]{36}$/;

async function signedInAdmin(browser: Parameters<typeof signedInPage>[0]) {
  const admin = await createAdmin();
  return signedInPage(browser, admin.email, admin.password);
}

/** Records every reasoning label and reply text the page shows, so short-lived states are not missed. */
async function recordStream(page: Page) {
  await page.evaluate(() => {
    const seen = { labels: new Set<string>(), replies: new Set<string>() };
    (window as unknown as { seen: typeof seen }).seen = seen;
    new MutationObserver(() => {
      for (const trigger of document.querySelectorAll(
        '[data-slot="reasoning-trigger-label"]',
      )) {
        seen.labels.add(trigger.textContent ?? "");
      }
      const reply = [
        ...document.querySelectorAll('[data-role="assistant"] .aui-md'),
      ].at(-1);
      if (reply?.textContent) seen.replies.add(reply.textContent);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}

async function recorded(page: Page) {
  return page.evaluate(() => {
    const { seen } = window as unknown as {
      seen: { labels: Set<string>; replies: Set<string> };
    };
    return { labels: [...seen.labels], replies: [...seen.replies] };
  });
}

async function send(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Message" });
  // Text typed before hydration shows in the box but never reaches the composer; type it again until Send accepts it.
  await expect(async () => {
    await box.fill(text);
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({
      timeout: 1_000,
    });
  }).toPass();
  await box.press("Enter");
}

const lastReply = (page: Page) =>
  page.locator('[data-role="assistant"]').last();

/** Copy appears only once a reply has ended, so a reload or navigation after this cannot cut it short. */
async function replyEnded(page: Page) {
  await expect(
    lastReply(page).getByRole("button", { name: "Copy" }),
  ).toBeVisible();
}

test("a question gets a streamed reply with its reasoning, at the conversation's own address (US1, SC-001)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);

  await page.getByRole("link", { name: "Chat" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/chat$/);
  await expect(page.getByText(/^Hello! Ask me anything/)).toBeVisible();

  await recordStream(page);
  await send(page, "How does an inverter work?");

  await expect(
    page.locator('[data-role="user"]').getByText("How does an inverter work?"),
  ).toBeVisible();
  await expect(lastReply(page)).toContainText(
    'Test reply: you wrote "How does an inverter work?".',
  );
  await expect(page).toHaveURL(CONVERSATION_URL);

  const reasoning = lastReply(page).getByRole("button", { name: "Reasoning" });
  await expect(reasoning).toHaveAttribute("aria-expanded", "false");

  const { labels, replies } = await recorded(page);
  expect(labels).toContain("Thinking…");
  // The reply arrived in more than one step.
  expect(replies.length).toBeGreaterThan(1);
});

test("a conversation reads the same after a reload (FR-010, SC-003)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");
  await send(page, "What does a battery add?");
  await replyEnded(page);
  await expect(page).toHaveURL(CONVERSATION_URL);
  const address = page.url();

  await page.reload();

  expect(page.url()).toBe(address);
  await expect(
    page.locator('[data-role="user"]').getByText("What does a battery add?"),
  ).toBeVisible();
  await expect(lastReply(page)).toContainText(
    'Test reply: you wrote "What does a battery add?".',
  );
  const reasoning = lastReply(page).getByRole("button", { name: "Reasoning" });
  await expect(reasoning).toHaveAttribute("aria-expanded", "false");
  await reasoning.click();
  await expect(lastReply(page)).toContainText(
    'Thinking about "What does a battery add?".',
  );
});

test("a reloaded conversation is never painted scrolled anywhere but its end (FR-010)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.setViewportSize({ width: 1280, height: 600 });
  const question = Array.from(
    { length: 40 },
    (_, index) => `Line ${index + 1}`,
  ).join("\n");
  await newConversation(page, question);

  await page.addInitScript(() => {
    const gaps: number[] = [];
    (window as unknown as { gaps: number[] }).gaps = gaps;
    const sample = () => {
      const message = document.querySelector('[data-role="user"]');
      if (message?.checkVisibility()) {
        let viewport = message.parentElement;
        while (viewport && getComputedStyle(viewport).overflowY !== "auto") {
          viewport = viewport.parentElement;
        }
        if (viewport) {
          gaps.push(
            viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
          );
        }
      }
    };
    // A new observer reports in this frame after every animation-frame callback, just before the paint.
    const eachFrame = () =>
      requestAnimationFrame(() => {
        const observer = new ResizeObserver(() => {
          observer.disconnect();
          sample();
          eachFrame();
        });
        observer.observe(document.documentElement);
      });
    eachFrame();
  });
  await page.reload();
  await replyEnded(page);
  await page.waitForTimeout(500);

  const gaps = await page.evaluate(
    () => (window as unknown as { gaps: number[] }).gaps,
  );
  expect(gaps.length).toBeGreaterThan(0);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(1);
});

test("a reply that reached the token cap is marked cut, also after a reload (FR-052)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");

  await send(page, "Explain everything [cut]");

  await expect(lastReply(page).getByText("Reply cut short")).toBeVisible();
  await expect(page).toHaveURL(CONVERSATION_URL);
  await replyEnded(page);
  await page.reload();
  await expect(lastReply(page).getByText("Reply cut short")).toBeVisible();
});

test("another user's conversation is a real 404, exactly like one that does not exist (US2, FR-004, SC-004)", async ({
  browser,
}) => {
  const owner = await signedInAdmin(browser);
  await owner.goto("/en/dashboard/chat");
  await send(owner, "Private question");
  await expect(owner).toHaveURL(CONVERSATION_URL);
  const address = new URL(owner.url()).pathname;

  const stranger = await signedInAdmin(browser);
  for (const path of [
    address,
    `/en/dashboard/chat/${crypto.randomUUID()}`,
    "/en/dashboard/chat/not-a-uuid",
  ]) {
    const response = await stranger.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(
      stranger.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(stranger.getByText("Private question")).toHaveCount(0);
  }
});

const conversationLinks = (page: Page) =>
  page.getByRole("navigation", { name: "Conversations" }).getByRole("link");

async function newConversation(page: Page, text: string) {
  await page.goto("/en/dashboard/chat");
  await send(page, text);
  await replyEnded(page);
  await expect(page).toHaveURL(CONVERSATION_URL);
  return new URL(page.url()).pathname;
}

test("the list shows conversations by latest activity, and a new chat starts empty (US3, FR-029 – FR-031)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);

  await newConversation(page, "First about panels");
  await expect(conversationLinks(page)).toHaveText(["First about panels"]);
  await newConversation(page, "Second about inverters");
  await newConversation(page, "Third about batteries");

  await expect(conversationLinks(page)).toHaveText([
    "Third about batteries",
    "Second about inverters",
    "First about panels",
  ]);
  await expect(
    page.getByRole("link", { name: "Third about batteries" }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "First about panels" }).click();
  await expect(
    page.locator('[data-role="user"]').getByText("First about panels"),
  ).toBeVisible();
  await send(page, "And their lifetime?");
  await expect(lastReply(page)).toContainText("And their lifetime?");
  await expect(conversationLinks(page)).toHaveText([
    "First about panels",
    "Third about batteries",
    "Second about inverters",
  ]);

  await page.getByRole("link", { name: "New chat" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/chat$/);
  await expect(page.getByText(/^Hello! Ask me anything/)).toBeVisible();
  await expect(page.locator("[data-role]")).toHaveCount(0);
});

test("deleting a conversation asks first, then removes it for good (US3, FR-032, SC-010)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  const kept = await newConversation(page, "Keep this one");
  const doomed = await newConversation(page, "Delete this one");

  await page.getByRole("button", { name: "Delete “Delete this one”" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("deleted permanently");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(conversationLinks(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Delete “Delete this one”" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(page).toHaveURL(/\/en\/dashboard\/chat$/);
  await expect(page.getByText("Conversation deleted.")).toBeVisible();
  await expect(conversationLinks(page)).toHaveText(["Keep this one"]);

  const response = await page.goto(doomed);
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  expect((await page.goto(kept))?.status()).toBe(200);
});

test("Stop ends a reply where it was; the partial text stays, marked stopped, after a reload (US4, FR-018)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");

  await send(page, "Explain [slow]");
  await expect(lastReply(page)).toContainText("Test reply, slowly.");
  await page.getByRole("button", { name: "Stop" }).click();

  await expect(lastReply(page).getByText("Stopped")).toBeVisible();
  await expect(page).toHaveURL(CONVERSATION_URL);
  // The panel moves to the stored conversation a moment after Stop.
  await page.waitForTimeout(2_000);
  await expect(lastReply(page).getByText("Stopped")).toBeVisible();
  const stopped = await lastReply(page).locator(".aui-md").innerText();
  await page.waitForTimeout(1_000);
  expect(await lastReply(page).locator(".aui-md").innerText()).toBe(stopped);
  expect(stopped).toContain("Test reply, slowly.");
  expect(stopped.match(/Test reply, slowly\./g)?.length ?? 0).toBeLessThan(40);

  await page.reload();
  await expect(lastReply(page).getByText("Stopped")).toBeVisible();
  expect(await lastReply(page).locator(".aui-md").innerText()).toBe(stopped);

  await send(page, "Shorter, please");
  await expect(lastReply(page)).toContainText('you wrote "Shorter, please".');
});

test("a failed reply shows a generic error and Try again; the answer lands below the failed attempt, also after a reload (US5, SC-006)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");
  const question = `Check [fail-once] ${Date.now()}`;

  await send(page, question);
  await expect(lastReply(page).getByRole("alert")).toContainText(
    "The assistant could not answer this time.",
  );
  await expect(lastReply(page).getByRole("alert")).not.toContainText(
    "Fake model failure",
  );
  await expect(page).toHaveURL(CONVERSATION_URL);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(lastReply(page)).toContainText(`you wrote "${question}".`);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);

  const order = async () =>
    page
      .locator('[data-role="user"], [data-role="assistant"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
  const expectOrder = async () => {
    const shown = await order();
    expect(shown).toHaveLength(2);
    expect(shown[0]).toContain(question);
    expect(shown[0]).toContain("Test reply:");
    expect(shown[0]).toContain("Failed");
    expect(shown[1]).toContain(`you wrote "${question}".`);
    // Once in the thread; the sidebar shows it as the title too.
    expect(
      await page
        .locator('[data-role="user"]')
        .getByText(question, { exact: true })
        .count(),
    ).toBe(1);
  };
  await page.waitForTimeout(500);
  await expectOrder();

  await page.reload();
  await expect(lastReply(page)).toContainText(`you wrote "${question}".`);
  await expectOrder();
});

test("Try again is still offered after a reload (FR-022)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");

  await send(page, "Check [fail]");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page).toHaveURL(CONVERSATION_URL);

  await page.reload();
  await expect(lastReply(page).getByText("Failed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("the request after the per-minute limit is refused with 'wait a moment', and the text stays in the box (US6, FR-038, FR-041)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");

  // The e2e server allows 5 requests a minute (playwright.config.ts).
  for (let index = 1; index <= 5; index += 1) {
    await send(page, `Question ${index}`);
    await expect(lastReply(page)).toContainText(
      `you wrote "Question ${index}".`,
    );
  }
  await send(page, "One too many");

  await expect(
    page.getByText(
      "You are sending messages too quickly. Wait a moment and try again.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
    "One too many",
  );
  await expect(
    page.locator('[data-role="user"]').getByText("One too many"),
  ).toHaveCount(0);
});

test("a message over the length limit says so and cannot be sent (FR-036)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");
  const box = page.getByRole("textbox", { name: "Message" });

  await expect(async () => {
    await box.fill("a".repeat(4_000));
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({
      timeout: 1_000,
    });
  }).toPass();
  await box.fill("a".repeat(4_001));

  await expect(
    page.getByText("This message is too long. Use at most 4000 characters."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await box.press("Enter");
  await expect(page.locator('[data-role="user"]')).toHaveCount(0);
});

async function switchToUkrainian(page: Page) {
  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Українська" }).click();
}

test("switching language keeps the conversation and speaks Ukrainian (US7, FR-049, FR-050)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  const address = await newConversation(page, "How long do panels last?");
  const id = address.split("/").at(-1);

  await switchToUkrainian(page);

  await expect(page).toHaveURL(new RegExp(`/uk/dashboard/chat/${id}$`));
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(
    page.locator('[data-role="user"]').getByText("How long do panels last?"),
  ).toBeVisible();
  await expect(lastReply(page)).toContainText(
    'you wrote "How long do panels last?".',
  );
  await expect(
    page.getByRole("link", { name: "Чат", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Повідомлення" }),
  ).toBeVisible();
  await expect(
    lastReply(page).getByRole("button", { name: "Міркування" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Розмови" })).toBeVisible();
});

test("switching language on the new-chat page stays there and stores nothing (FR-050)", async ({
  browser,
}) => {
  const page = await signedInAdmin(browser);
  await page.goto("/en/dashboard/chat");

  await switchToUkrainian(page);

  await expect(page).toHaveURL(/\/uk\/dashboard\/chat$/);
  await expect(page.getByText(/^Вітаю! Запитайте мене/)).toBeVisible();
  await expect(page.getByText("Розмов ще немає.")).toBeAttached();
});
