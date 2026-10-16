# Quickstart: AI Chat for Signed-In Users

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run the chat and prove it works. Contracts: [http-api](./contracts/http-api.md),
[agent](./contracts/agent.md), [ui](./contracts/ui.md); tables: [data-model](./data-model.md).

## Prerequisites

- The setup from features 003–005: local Postgres (`npm run services:up`), migrations applied
  (`npm run db:migrate`), a super admin (`npm run bootstrap`).
- `.env` from `.env.example`, and one of:
  - **Real model**: `GOOGLE_GENERATIVE_AI_API_KEY=<key>` — create it at
    https://aistudio.google.com/apikey. A key on a project without billing is the free tier: Google may
    use and human reviewers may read everything sent, so **test data only** (spec Known Boundaries,
    research R18).
  - **No key**: `AI_FAKE_MODEL=true` — the deterministic test model (contracts/agent.md). Refused when
    `APP_ENV=production`.
- Optional limits: `CHAT_MAX_MESSAGE_LENGTH`, `CHAT_RATE_LIMIT_PER_MINUTE`, `CHAT_DAILY_TOKEN_BUDGET`,
  `CHAT_HISTORY_LIMIT` (defaults 4000 / 10 / 500000 / 50).

## Run it

```bash
npm run dev
# sign in → header "Chat" → /en/dashboard/chat
```

## Check by hand

1. **Send** "How does a string inverter work?" — the question appears at once, a "Thinking…" block
   may open, the reply streams, the address becomes `/en/dashboard/chat/<id>`, the conversation tops the
   sidebar. Reload: identical, reasoning collapsed.
2. **Stop** a long answer ("Explain every component of a home PV system in detail") — partial text
   stays, marked stopped; reload shows the same.
3. **Copy** a reply — clipboard holds the Markdown text, not the reasoning.
4. **Delete** a conversation — confirm; it disappears; its address shows the not-found page.
5. **Another user**: sign in as a second admin, open the first user's conversation address → not-found
   page; DevTools → Network shows status **404** (FR-004, R7).
6. **Language**: switch to Українська on a conversation — same conversation, Ukrainian labels. Write
   in Ukrainian on the English page — the reply is Ukrainian.
7. **Limits** (set `CHAT_RATE_LIMIT_PER_MINUTE=2`, restart): the third message within a minute shows
   "wait a moment" and keeps the text in the box.
8. **Failure** (test model): send "check [fail]" → error + Try again; "check [fail-once]" → error, then
   Try again answers below the failed attempt; reload shows both.

## Live model check (once, with a real key)

Before the first merge, with the real model:

- SC-002: the thinking block or the first words appear within 3 s of sending.
- Reasoning: note how many of ~10 typical questions show a reasoning block at `medium` effort, and
  that no reply's text opens with the model's plan or a paraphrase of its instructions (R1).
- R6: send a message, force a failure (temporarily set an invalid key and restart), restore the key,
  send another message — the model must accept two consecutive user turns. If it rejects them, join
  consecutive user turns in `toModelHistory` before merging.
- The server log shows the provider error for the failure; the browser shows only the generic message.

## Automated checks

```bash
npm run typecheck && npm run lint
npm run test:run          # unit + ui + integration (needs Postgres: atmo_test)
npm run e2e               # production build, test model, atmo_e2e
```

## What the e2e suite proves (`e2e/chat.spec.ts`, test model)

Each test signs in as its own fresh admin (`createAdmin`), so the per-minute limit of 5 set in
`playwright.config.ts` only bites in the limit test.

| Test                                  | Proves                      |
| ------------------------------------- | --------------------------- |
| send and receive, streaming           | US1, FR-007, FR-013, SC-001 |
| reasoning block opens, then collapses | FR-028, FR-053              |
| history after reload                  | FR-010, SC-003              |
| list, switch, new conversation        | US3, FR-029 – FR-031        |
| delete                                | FR-032, SC-010              |
| Stop keeps the partial reply          | US4, FR-018                 |
| error, then Try again                 | US5, FR-021, FR-022, SC-006 |
| rate-limit message, text kept         | FR-038, FR-041              |
| another user's address → 404          | US2, FR-004, SC-004         |
| locale switching on the chat page     | US7, FR-050                 |
