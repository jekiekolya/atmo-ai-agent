---
description: "Task list for the AI chat for signed-in users feature"
---

# Tasks: AI Chat for Signed-In Users

**Input**: Design documents from `/specs/006-ai-chat/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required, not optional. Constitution Principle IV makes test-first mandatory for Config,
validation helpers, business rules, and the agent's instructions (plan § Test regime per module), and
names chat send/receive and locale switching as mandatory Playwright coverage. In every test-first
pair the test task comes first: run it, **confirm it fails**, and commit it before the implementation
task, so the commit order shows it.

**Organization**: Grouped by the seven user stories of spec.md, in priority order: US1 and US2 (P1),
US3–US6 (P2), US7 (P3). Each phase ends at a checkpoint where its story works and can be shown on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US7, mapping to the user stories in spec.md
- Every task names its exact file path

## Path Conventions

Single Next.js application. Application code in `src/`, e2e in `e2e/`, tooling configs at the
repository root. Import alias `@/*` → `./src/*`, `@generated/*` → `./prisma/generated/*`. Unit tests are
colocated `*.test.ts`, UI tests `*.test.tsx` (jsdom), database-backed tests `*.integration.test.ts` (the
Vitest `integration` project against `atmo_test`).

Rules that apply to every task:

- Check the installed package before writing against it (CLAUDE.md). Research cites the exact file
  and line for every AI SDK and assistant-ui API this list names; if the installed version disagrees,
  the installed version wins and the plan's "Amendments Made During Implementation" records it.
- Nothing under `src/server/` imports `next`, `next/*`, `next-auth`, `react`, `react-dom`, or
  `server-only` (lint-enforced). `ai`, `ai/test`, and `@ai-sdk/google` are allowed there.
- No user-facing literal. Every new key goes into **both** `src/messages/en.json` and
  `src/messages/uk.json` in the same task that first renders it.
- No page or API path literal outside `src/lib/routes.ts` (tests and e2e excepted).
- Every `DateTime` field is `@db.Timestamptz(3)`; instants come from the application's clock, passed
  in as `now` where a rule depends on time, so tests can fix it.
- Comments are rare and one line (CLAUDE.md); decisions live in research.md, not above the code.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Packages, registry components, and test environments the rest of the work stands on

- [x] T001 Add `ai@7.0.127`, `@ai-sdk/react@4.0.130`, `@ai-sdk/google@4.0.87`, `@assistant-ui/react@^0.15.23`, `@assistant-ui/ai-sdk@^0.0.9`, and `@assistant-ui/react-markdown@^0.14.18` to `dependencies` in `package.json` and install them. Confirm `npm ls react next` shows no peer conflict with React 19.2 / Next 16.3, and that `@assistant-ui/react-ai-sdk` is **not** installed (research R9, R17)
- [x] T002 Add `"registries": { "@assistant-ui": "https://r.assistant-ui.com/styles/{style}/{name}.json" }` to `components.json` (research R9)
- [x] T003 Vendor the assistant-ui registry items (research R9, R17). Steps:
  1. Run `npx shadcn add @assistant-ui/markdown-text @assistant-ui/reasoning --dry-run` and read what it would write. It should pull Base UI files (no `radix-ui` import), the shadcn `tooltip` and `collapsible`, `tooltip-icon-button`, `use-copy-to-clipboard`, and `elements-reasoning`, plus the npm packages `remark-gfm` and `tw-shimmer`.
  2. Run it for real. **Decline** any overwrite of existing `src/components/ui/*` files.
  3. Apply the 003 R16 post-pull step: rewrite `import { cn } from "cn"` to `@/lib/utils` if it appears.
  4. Remove `tw-shimmer` from `package.json`, along with its `@import` in `src/app/globals.css`. Keep the `data-open`/`data-closed` variants and the collapsible keyframes the item adds.
  5. Record the written files in the plan's amendment table only if they differ from the plan's source tree.
- [x] T004 [P] Set `AI_FAKE_MODEL: "true"` in the env of the `unit` and `integration` projects in `vitest.config.mts`, so modules that load Config need no provider key (research R14)
- [x] T005 [P] Add `AI_FAKE_MODEL: "true"` and `CHAT_RATE_LIMIT_PER_MINUTE: "5"` to `webServer.env` in `playwright.config.ts` (research R14, quickstart § e2e)
- [x] T006 [P] Document the six new variables in `.env.example`, each with a one-line description and a non-secret placeholder. They are `GOOGLE_GENERATIVE_AI_API_KEY` (required unless `AI_FAKE_MODEL`; free tier = test data only), `AI_FAKE_MODEL=false` (refused in production), `CHAT_MAX_MESSAGE_LENGTH=4000`, `CHAT_RATE_LIMIT_PER_MINUTE=10`, `CHAT_DAILY_TOKEN_BUDGET=500000`, and `CHAT_HISTORY_LIMIT=50`. Add a line saying `NEXT_PUBLIC_ASSISTANT_BASE_URL` must never be set (research R9, R14)

**Checkpoint**: `npm run typecheck && npm run lint && npm run test:run` still green; nothing uses the new packages yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, the data model, HTTP plumbing, shared validation, and the agent module — every story needs them

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Configuration

- [x] T007 Write failing tests in `src/config/schema.test.ts`. They cover:
  - defaults 4000 / 10 / 500000 / 50 for the four `CHAT_*` variables;
  - rejection of `0`, `-1`, `1.5`, and `soon` for each, with a message naming the variable;
  - `AI_FAKE_MODEL` parsed by `z.stringbool()` (`true`/`false`/absent → false);
  - a missing `GOOGLE_GENERATIVE_AI_API_KEY` fails naming the variable when `AI_FAKE_MODEL` is false, and passes when it is true;
  - `AI_FAKE_MODEL=true` with `APP_ENV=production` fails;
  - the shape `config.ai = { googleApiKey, fakeModel }` and `config.chat = { maxMessageLength, rateLimitPerMinute, dailyTokenBudget, historyLimit }`;
  - the "drops variables it does not declare" key list extended with the six names (research R14).
- [x] T008 Implement T007 in `src/config/schema.ts`: the six variables, the two cross-field `refine`s (key required unless fake; fake refused in production), and the mapping into `Config`. Depends on T007

### Data model

- [x] T009 Add to `prisma/schema.prisma` exactly as [data-model.md](./data-model.md) specifies:
  - the enums `MessageRole` and `ReplyFinish`;
  - the models `Conversation` (`conversations`) and `Message` (`messages`);
  - `User.conversations` as the back-relation;
  - `onDelete: Restrict` from conversation to user and `onDelete: Cascade` from message to conversation;
  - `@@index([userId, updatedAt(sort: Desc)])` and `@@index([conversationId, createdAt])`;
  - `@@unique([conversationId], map: "messages_one_reply_in_progress", where: { finishReason: "IN_PROGRESS" })`.
- [x] T010 Generate the committed migration `prisma/migrations/<timestamp>_chat_conversations/migration.sql` and apply it to `atmo_test`. If `migrate dev` offers to reset `atmo_dev`, generate it with `prisma migrate diff` instead, as 003 amendment A1 did. Then confirm that `migrate diff` from the applied database to the schema is empty and that the SQL contains the partial unique index. Depends on T009

### Errors and HTTP plumbing

- [x] T011 [P] Write failing tests in `src/lib/http/server/route-response.test.ts`:
  - `RateLimitError("rate_limited", 42)` and `RateLimitError("daily_limit_reached", 7260)` answer 429 with `{ error: { code, retryAfterSeconds } }` and a `Retry-After` header equal to the seconds;
  - `reply_in_progress` and `nothing_to_retry` answer 409;
  - every other envelope is unchanged (contracts/http-api.md).
- [x] T012 Implement T011:
  - add `reply_in_progress`, `nothing_to_retry`, `rate_limited`, `daily_limit_reached`, and `model_failed` to `ERROR_CODES` in `src/server/errors.ts`;
  - add `RateLimitError(code, retryAfterSeconds)` there;
  - widen `ConflictError`'s code union to the two new 409 codes;
  - map `RateLimitError` to 429 plus `Retry-After` in `src/lib/http/server/route-response.ts`;
  - add `errors.codes.<code>` for all five codes to `src/messages/en.json` and `src/messages/uk.json`, so `src/lib/http/client/error-codes.test.ts` stays green.

  Depends on T011

- [x] T013 [P] Extend the failing tests in `src/lib/http/server/define-route.test.ts`: the handler receives the original `request` alongside `body`, `actor`, and `params` (research R3)
- [x] T014 Implement T013 in `src/lib/http/server/define-route.ts` (pass `request` into the handler). Depends on T013
- [x] T015 [P] Extend the failing tests in `src/lib/http/server/params.test.ts`: `conversationIdFrom(params)` returns a valid UUID and throws `NotFoundError` for a missing or malformed `id`, exactly like `userIdFrom`
- [x] T016 Implement T015 in `src/lib/http/server/params.ts`: `conversationIdFrom`, sharing one private UUID parse with `userIdFrom`, and leaving `userIdFrom`'s callers untouched. Depends on T015
- [x] T017 [P] Write failing tests in `src/lib/http/client/chat-fetch.test.ts`, with `fetch` and `window.location` stubbed:
  - a 401 calls `hardNavigate(signInUrlFor(location))` and never resolves;
  - any other response is returned unchanged;
  - every response triggers one `GET` of `API_ROUTES.session` with `cache: "no-store"` (research R11).
- [x] T018 Implement T017 in `src/lib/http/client/chat-fetch.ts`. Extract the two behaviours `apiRequest` already has — `redirectToSignIn()` and the keep-alive `renewSession()` — into exported functions of `src/lib/http/client/api-client.ts`, used by both, so `api-client.test.ts` stays green unchanged. Depends on T017

### Shared validation and message shape

- [x] T019 [P] Write failing tests in `src/lib/schemas/chat.test.ts` for `chatRequestSchema(maxLength)` ([data-model.md § Validation](./data-model.md#validation-shared-by-browser-and-server-srclibschemaschatts)):
  - text of exactly `maxLength` UTF-16 units passes and `maxLength + 1` fails with the catalog key `validation.chat.tooLong`;
  - `""`, `"   "`, and `"\n\t"` fail with `validation.chat.empty`;
  - a 2-unit emoji counts as 2;
  - `locale` accepts only `en` and `uk`;
  - `trigger` accepts only `submit-message` or `regenerate-message`;
  - `submit-message` requires `text`;
  - `regenerate-message` requires `conversationId` and rejects `text`;
  - a malformed `conversationId` fails.
- [x] T020 Implement T019 in `src/lib/schemas/chat.ts` with zod, reading the locales from `routing.locales` (`src/i18n/routing.ts`). Add `validation.chat.tooLong` (with `{max}`) and `validation.chat.empty` to both catalogs. Depends on T019
- [x] T021 [P] Write failing tests in `src/lib/chat/messages.test.ts`:
  - `chatMessageMetadataSchema` accepts `{ conversationId, outcome, failedAttempts }` and rejects an unknown outcome;
  - `effectiveOutcome({ finishReason, createdAt }, now)` maps the four ended states;
  - a row `IN_PROGRESS` reads as `in_progress` at 59 999 ms old and as `failed` at 60 001 ms (FR-015, research R10).
- [x] T022 Implement T021 in `src/lib/chat/messages.ts`: the `ChatOutcome`, `ChatMessageMetadata`, and `ChatUIMessage` types, the schema, `REPLY_TIMEOUT_MS = 60_000`, and `effectiveOutcome`. Depends on T021

### The agent module

- [x] T023 [P] Write failing tests in `src/server/chat/instructions.test.ts` for `buildInstructions({ locale, today })` ([contracts/agent.md](./contracts/agent.md#instructionsts--buildinstructions-locale-today--r15-test-first)). The text must:
  - contain `today` verbatim;
  - name English for `en` and Ukrainian for `uk` as the fallback language;
  - say to reply in the language of the user's latest message;
  - present Atmo's solar-energy support role;
  - state no access to customer data, contracts, or systems;
  - forbid inventing facts about a customer's system, contract, or entitlements;
  - be identical for identical input.
- [x] T024 Implement T023 in `src/server/chat/instructions.ts` (English text, research R15). Depends on T023
- [x] T025 [P] Write tests in `src/server/chat/fake-model.test.ts`. Drive the model through `streamText` from `ai`, and assert:
  - default text gives reasoning then text, then finish `stop` with usage 12/34;
  - `[slow]` gives at least 30 text chunks;
  - `[fail]` gives an error part;
  - `[fail-once]` fails once per distinct text, then succeeds;
  - `[cut]` gives finish reason `length`;
  - the model id is `fake-model`.

  Test-together (research R13, contracts/agent.md § fake-model)

- [x] T026 Implement `src/server/chat/fake-model.ts`: `createFakeModel()` returning a `MockLanguageModelV4` from `ai/test` whose `doStream` reads the latest user text from the prompt and returns `simulateReadableStream` (from `ai`) chunks, as T025 describes
- [x] T027 Implement `src/server/chat/agent.ts` per [contracts/agent.md](./contracts/agent.md#agentts--the-single-agent-module-mc-003-r2):
  - export `GEMINI_MODEL_ID = "gemini-3.5-flash-lite"`, `MAX_OUTPUT_TOKENS = 4096`, and `getChatAgent()`, which returns `{ agent, modelId }` with `modelId` read from the built model's `modelId` (FR-048);
  - `getChatAgent()` caches one `ToolLoopAgent`: the Google model via `createGoogleGenerativeAI({ apiKey: config.ai.googleApiKey })`, or `(await import("./fake-model")).createFakeModel()` when `config.ai.fakeModel`;
  - `maxOutputTokens`;
  - `providerOptions.google.thinkingConfig = { thinkingLevel: "low", includeThoughts: true }` typed with `satisfies GoogleGenerativeAIProviderOptions`;
  - `callOptionsSchema` `{ locale, today }`;
  - `prepareCall` returning `instructions: buildInstructions(options)`;
  - no tools and no `temperature`.

  Depends on T008, T024, T026

**Checkpoint**: Config, migration, plumbing, and the agent are in place and the full Vitest suite is green.

---

## Phase 3: User Story 1 - Ask a question and watch the answer arrive (Priority: P1) 🎯 MVP

**Goal**: A signed-in user opens Chat, sends a message, watches a streamed reply (reasoning first, then
Markdown text), lands on `/{l}/dashboard/chat/{id}`, and sees the same history after a reload.

**Independent Test**: Sign in, open Chat, send a message, confirm the reply streams and the address
changes; reload and confirm identical messages (spec US1).

### Tests for User Story 1 (test-first) ⚠️

- [x] T028 [P] [US1] Write failing tests in `src/server/chat/title.test.ts` for `deriveTitle(text)`:
  - runs of whitespace collapse to one space and the ends are trimmed;
  - 80 characters stays as is;
  - 81 becomes the first 80 plus `…`;
  - a text of only line breaks around one word gives that word (FR-008).
- [x] T029 [P] [US1] Write failing tests in `src/server/chat/history.test.ts` for `toModelHistory(rows, limit)`:
  - keeps order;
  - drops assistant rows whose outcome is `FAILED` or `IN_PROGRESS`;
  - removes `reasoning` parts but keeps `text`;
  - keeps only the last `limit` messages after dropping, the new question included;
  - returns `UIMessage`s with the stored ids (FR-042, research R6).
- [x] T030 [P] [US1] Write failing tests in `src/server/chat/outcome.test.ts` for `decideOutcome({ errored, isAborted, clientAborted, finishReason })` — every row of research R4's outcome table, including `content-filter` → `FAILED` and `other` → `COMPLETED`
- [x] T031 [US1] Write failing integration tests in `src/server/chat/chat-service.integration.test.ts`. Use `createUserRow`/`actorOf` fixtures and a fixed `now`. They cover:
  - **new conversations (FR-006, FR-008):** `startChatTurn` without `conversationId` creates the conversation, its title, the user message, and one `IN_PROGRESS` reply in one transaction;
  - **existing conversations:** with the owner's `conversationId` it appends a user message and a reply, and touches `updatedAt`;
  - **ownership (FR-004):** another user's id, a random id, and the super admin acting on an admin's conversation each throw `NotFoundError`, and nothing is stored;
  - **staff roles only (FR-001):** `canUseChat(role)` is true for `ADMIN` and `SUPER_ADMIN`; a test walks every value of the Prisma `Role` enum and fails for any value that is not explicitly allowed or denied, so a new role (a future customer role) cannot get the chat without a decision; every service function refuses a role outside `CHAT_ROLES` with `ForbiddenError`;
  - **turn state:**
    - a send while the latest reply is `IN_PROGRESS` throws `ConflictError("reply_in_progress")` (FR-012);
    - a reply `IN_PROGRESS` older than 60 s is rewritten `FAILED` and the send proceeds;
    - two concurrent `startChatTurn` calls on one conversation yield exactly one `IN_PROGRESS` reply, and the other call throws `reply_in_progress` (FR-023);
  - **returned history:** the result's `history` is `toModelHistory` of the stored rows, and `replyId` is the new row's id;
  - **`finishReply`:**
    - writes outcome, parts (reasoning included), tokens, and model, only while `IN_PROGRESS`, and touches `updatedAt`;
    - a second call is a no-op;
  - **`getOwnConversation(actor, id, now)`** returns title and `ChatUIMessage[]` with `metadata.outcome` from `effectiveOutcome`, or throws `NotFoundError` for anyone else.
- [x] T032 [US1] Write failing integration tests in `src/server/chat/respond.integration.test.ts`. Call `respondToChat` with `getChatAgent` mocked to an agent on a `MockLanguageModelV4`, and read the response body to the end. They cover:
  - the `start` chunk carries the stored reply id and `conversationId`;
  - reasoning and text chunks are streamed;
  - the row ends `COMPLETED` with the reasoning and text parts, usage, and the `modelId` of the mock model that answered — not a hard-coded name (FR-048);
  - a `length` finish ends `CUT` with `outcome: "cut"` in the finish metadata;
  - `sendReasoning` is on.

  Depends on T031

### Implementation for User Story 1

- [x] T033 [P] [US1] Implement T028 in `src/server/chat/title.ts`. Depends on T028
- [x] T034 [P] [US1] Implement T029 in `src/server/chat/history.ts`. Depends on T029
- [x] T035 [P] [US1] Implement T030 in `src/server/chat/outcome.ts`. Depends on T030
- [x] T036 [US1] Implement `src/server/chat/chat-repository.ts`. It holds the Prisma calls behind the service, each taking an optional `client: Db = db`:
  - `lockUser(userId)` — a `$queryRaw` tagged template `SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE` (research R4);
  - `findOwnConversation`;
  - `createConversationWithMessage`;
  - `createMessage`;
  - `createReply`;
  - `failStaleReplies(userId, before)`;
  - `latestReply(conversationId)`;
  - `listMessages(conversationId)`;
  - `finishReply`, as an `updateMany` filtered on `IN_PROGRESS`;
  - `touchConversation`.

  Map the partial-index violation through `isUniqueViolation(error, "messages_one_reply_in_progress")`. Every write sets `createdAt` (and the conversation's `updatedAt` on touch) explicitly from the `now` the service passes in, never from a database default, so the limit windows in tests match the fixed clock.

- [x] T037 [US1] Implement `CHAT_ROLES`, `canUseChat(role)`, and `assertChatAccess(actor)` in `src/server/chat/access.ts`, called first by every function in `chat-service.ts` (FR-001). Implement `startChatTurn(actor, input, now)`, `finishReply(...)`, and `getOwnConversation(actor, id, now)` in `src/server/chat/chat-service.ts`. This covers steps 1–4, 6 and 7 of research R4 for `submit-message`; limits and Try again come in US6 and US5. It returns `{ conversationId, isNew, replyId, history }`. Depends on T031, T033, T034, T036
- [x] T038 [US1] Implement `respondToChat(actor, input, signal)` in `src/server/chat/respond.ts` per [contracts/agent.md § respond.ts](./contracts/agent.md#respondts--respondtochatactor-input-signal-promiseresponse). It uses:
  - `createAgentUIStreamResponse` with `abortSignal: signal` and `timeout: REPLY_TIMEOUT_MS`;
  - `generateMessageId: () => turn.replyId`;
  - `options: { locale, today: now.toISOString().slice(0, 10) }`;
  - `messageMetadata`, which captures usage and finish reason;
  - `onEnd`, which calls `finishReply` with `decideOutcome`;
  - `consumeSseStream: consumeStream`;
  - `onError`, which logs and returns `"model_failed"`.

  Depends on T027, T032, T035, T037

- [x] T039 [US1] Add `PAGES.chat = "/dashboard/chat"`, `PAGES.chatConversation = "/dashboard/chat/[id]"`, and `API_ROUTES.chat = "/api/chat"` to `src/lib/routes.ts`. Create `src/app/api/chat/route.ts`: `POST = defineRoute({ schema: chatRequestSchema(config.chat.maxMessageLength), session: "required", handler: ({ body, actor, request }) => respondToChat(actor, body, request.signal) })`. Depends on T014, T020, T038
- [x] T040 [US1] Create the chat pages (contracts/ui.md § Pages):
  - `src/app/[locale]/(private)/dashboard/chat/layout.tsx` — a two-column shell: an empty sidebar slot that US3 fills, plus the main column, after `verifySession()`; a user whose role fails `canUseChat` gets `<NotPermitted />` instead (FR-001);
  - `chat/(new)/page.tsx` + `loading.tsx` — `ChatPanel` with no id, no messages, and `maxLength` from Config, plus `generateMetadata` with `chat.metaTitle`;
  - `chat/[id]/page.tsx` + `loading.tsx` — `conversationIdFrom(await params)`, then `getOwnConversation`, then `notFound()` on `NotFoundError`, then `ChatPanel key={id}` with the stored messages; the metadata title is the conversation's title.

  `src/lib/routes.test.ts` and `src/conventions/loading-boundaries.test.ts` must stay green. Depends on T039

- [x] T041 [US1] Add the Chat link after Home in the nav of `src/app/[locale]/(private)/layout.tsx` (`PAGES.chat`, key `shell.chat` in both catalogs), shown only when `canUseChat(user.role)`, and update its test if one asserts the nav items (FR-002)
- [x] T042 [US1] Edit the vendored registry files in place (research R9, FR-024, FR-028, FR-049):
  - in `src/components/assistant-ui/elements/markdown-text.tsx`, add `img: () => null` to the components map and take the copy button's label from a prop;
  - in `reasoning.tsx` / `reasoning.aui.tsx`, take the "Thinking…" and "Reasoning" labels from props, remove the duration suffix, and replace the shimmer class with `animate-pulse`;
  - in `tooltip-icon-button.tsx`, keep the sr-only label from the `tooltip` prop.

  No English literal may remain in these files.

- [x] T043 [US1] Create `src/components/chat/reply-marker/reply-marker.tsx` and its test. It renders the localized marker for `stopped`, `cut`, `failed`, and `in_progress` (`chat.markers.*`) from the message's runtime status or `metadata.custom.outcome`, and nothing for a completed reply. Test-together (FR-052 lands here; FR-018 and FR-021 use it later)
- [x] T044 [US1] Create `src/components/chat/chat-thread/chat-thread.tsx` and its test. It is composed from `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`, and `ActionBarPrimitive.Copy`, with the registry `thread.aui.tsx` as reference and no edit, branch, feedback, attachment, voice, or suggestion parts. It renders:
  - the user message as `whitespace-pre-wrap` plain text;
  - the reasoning part through the vendored `reasoning` (open while `part.status.type === "running"`);
  - the text through `markdown-text`;
  - `ReplyMarker`;
  - Copy, on text parts only;
  - the greeting `chat.greeting` on an empty thread;
  - the composer: Enter sends, Shift+Enter makes a new line, Send is disabled while running or for whitespace-only text, and Stop (`ComposerPrimitive.Cancel`) shows while running.

  Add every `chat.*` key it renders to both catalogs (contracts/ui.md § Catalog keys). Test-together, jsdom, with a runtime from `useExternalStoreRuntime` or a mocked runtime

- [x] T045 [US1] Create `src/components/chat/chat-panel/chat-panel.tsx` and its test (contracts/ui.md, research R8, R9, R11). It wires:
  - `useChat({ id: stable client id, messages, messageMetadataSchema: chatMessageMetadataSchema, transport })`, where `transport` is `new DefaultChatTransport({ api: API_ROUTES.chat, fetch: chatFetch, prepareSendMessagesRequest: ({ messages, trigger }) => ({ body: { conversationId: idRef.current ?? undefined, locale, trigger, text: trigger === "submit-message" ? <last user message text> : undefined } }) })` — Try again sends no `text`, because the server already holds the question and the schema rejects one (T019);
  - `useAISDKRuntime(chat)` inside `AssistantRuntimeProvider` around `ChatThread`.

  It changes the address:
  - when metadata with a new `conversationId` arrives, it sets `idRef` and calls `window.history.replaceState(null, "", getPathname({ href: pathTo(PAGES.chatConversation, { id }), locale }))`;
  - in `onFinish`, it calls `router.replace` to that path for a new conversation, or `router.refresh()` otherwise.

  On a refused request (an `APICallError` with a 4xx status), `onError` removes the optimistic user message and the synthetic assistant message, puts the text back in the composer, and shows the code's message in a `FormAlert` above the composer. US5 and US6 add their codes to the map.

  Test-together: the body shape for both triggers (Try again carries no `text`), address replacement, and the refusal restoring the text.

- [x] T046 [US1] Create `e2e/chat.spec.ts` using `createAdmin` and `signedInPage` from `e2e/support/`. Cover:
  - **send and receive:** the header Chat link leads to `/en/dashboard/chat`; sending "How does an inverter work?" shows the question, a "Thinking…" block that collapses to "Reasoning", and the test model's text appearing in more than one step (SC-001); the URL becomes `/en/dashboard/chat/<uuid>`;
  - **reload:** after a reload the same question, reasoning (collapsed), and reply are shown (FR-010, SC-003);
  - **cut marker:** a `[cut]` message shows the cut-short marker, and still does after a reload.

  Depends on T040–T045

**Checkpoint**: US1 works end to end on the test model; `npm run e2e -- chat` is green and the 001–005 specs still are.

---

## Phase 4: User Story 2 - A conversation is visible only to its owner (Priority: P1)

**Goal**: Another user's or a non-existent conversation is a real 404, the same in every way, on the
page and on the endpoint.

**Independent Test**: As user B, open user A's conversation address → not-found page with status
404; call `POST /api/chat` with A's id → 404 identical to a random id (spec US2).

### Tests for User Story 2 ⚠️

- [x] T047 [US2] Add `(private)/dashboard` and `(private)/dashboard/chat` to the "never sit above a check" list in `src/conventions/loading-boundaries.test.ts`, with the test name updated to cover the ownership check that can answer 404 (research R7). Run it; it fails while `dashboard/loading.tsx` exists
- [x] T048 [US2] Add a chat block to `src/app/api/authorization-matrix.integration.test.ts`, with the model mocked (contracts/http-api.md § Authorization matrix). It asserts:
  - `POST /api/chat` answers 401 for an anonymous caller;
  - it answers 200 for an admin and for the super admin on their own new and existing conversations;
  - another user's conversation and a random UUID answer 404 with **byte-identical** bodies, and a malformed id also answers 404;
  - the cross-origin call answers 403;
  - the snapshot around the refused cases includes `conversations` and `messages`;
  - in every refused case the mocked model's `doStreamCalls` stays empty (SC-008);
  - a user whose role fails `canUseChat` gets 403 on both endpoints (FR-001; with no such role in the enum yet, by stubbing `canUseChat`).

### Implementation for User Story 2

- [x] T049 [US2] Move `src/app/[locale]/(private)/dashboard/page.tsx` and `loading.tsx` into `src/app/[locale]/(private)/dashboard/(home)/`, unchanged, with `git mv`. The URL `/{l}/dashboard` stays the same and `routes.test.ts` stays green. T047 now passes. Depends on T047
- [x] T050 [US2] Create `src/app/[locale]/(private)/dashboard/chat/[id]/layout.tsx`. It runs `verifySession()`, then `conversationIdFrom(await params)`, then `findOwnConversation`, and calls `notFound()` when any of them fails, before any Suspense boundary. `chat/[id]/page.tsx` now only loads the history. Depends on T049
- [x] T051 [US2] Add to `e2e/chat.spec.ts`: user A creates a conversation; user B opens its URL and receives a response with status **404** and the not-found page. A random UUID and a malformed id also give 404 (FR-004, SC-004)

**Checkpoint**: US1 + US2 — the P1 slice — is complete.

---

## Phase 5: User Story 3 - Find, start, and delete conversations (Priority: P2)

**Goal**: A sidebar lists the user's conversations by recent activity; New chat and Delete work.

**Independent Test**: Create three conversations, check order and titles, continue the oldest and see
it move to the top, start a new one, delete one and see its address become not found (spec US3).

### Tests for User Story 3 (test-first) ⚠️

- [x] T052 [US3] Extend `src/server/chat/chat-service.integration.test.ts` with failing tests:
  - `listConversations(actor)` returns only the actor's conversations, ordered by `updatedAt` descending, as `{ id, title }`;
  - `deleteConversation(actor, id)` removes the conversation and all its messages;
  - deleting another user's or a random id throws `NotFoundError` and deletes nothing;
  - `finishReply` for a reply whose conversation was deleted mid-stream writes nothing and does not recreate it (FR-033).
- [x] T053 [US3] Add `DELETE /api/chat/{id}` to the chat block of `src/app/api/authorization-matrix.integration.test.ts`: 401 anonymous, 204 owner (admin and super admin), and 404 for another's or random id with byte-identical bodies, nothing deleted

### Implementation for User Story 3

- [x] T054 [US3] Implement `listConversations` and `deleteConversation` in `src/server/chat/chat-service.ts` and `src/server/chat/chat-repository.ts` (`deleteMany` scoped by `userId`; zero rows → `NotFoundError`). Depends on T052
- [x] T055 [US3] Add `API_ROUTES.chatConversation = "/api/chat/[id]"` to `src/lib/routes.ts`, and create `src/app/api/chat/[id]/route.ts`: `DELETE = defineRoute({ session: "required", handler: ({ actor, params }) => deleteConversation(actor, conversationIdFrom(params)).then(noContent) })`. Depends on T053, T054
- [x] T056 [P] [US3] Create `src/components/chat/delete-conversation-dialog/delete-conversation-dialog.tsx` and its test. Follow the `AlertDialog` pattern of `src/components/users/user-row-actions/user-row-actions.tsx`:
  - a pending state with `Spinner`;
  - `apiRequest("DELETE", pathTo(API_ROUTES.chatConversation, { id }))`;
  - a `chat.delete.done` success toast and an error toast through `routeFailure` with `chat.errors.notFound` for `not_found`;
  - `router.push(PAGES.chat)` if the deleted conversation was open, else `router.refresh()`;
  - keys `chat.delete.*` in both catalogs (FR-032).
- [x] T057 [US3] Create `src/components/chat/conversation-list/conversation-list.tsx` and its test. It is a client component that receives `{ id, title }[]` and renders:
  - a `<nav aria-label={t("chat.list.label")}>` with a `Link` per conversation to `pathTo(PAGES.chatConversation, { id })`;
  - `aria-current="page"` on the open one, read from `usePathname()`;
  - a New chat link to `PAGES.chat`;
  - per-row `DeleteConversationDialog` triggers labelled with the title;
  - `chat.list.empty` when there are no conversations;
  - a `collapsible` toggle (`chat.list.toggle`) on narrow screens (FR-029, FR-030, FR-034).

  Depends on T056

- [x] T058 [US3] Render `ConversationList` with `listConversations(user)` in the sidebar slot of `src/app/[locale]/(private)/dashboard/chat/layout.tsx`. Confirm the sidebar updates after a reply through the `router.replace`/`router.refresh` added in T045 (FR-031). Depends on T057
- [x] T059 [US3] Add to `e2e/chat.spec.ts`:
  - **list order:** after three conversations, the list is newest first and titled by first message;
  - **reorder:** continuing the oldest moves it to the top;
  - **New chat:** shows the greeting and an empty thread;
  - **delete:** cancelling changes nothing; confirming removes the conversation from the list, and its URL then shows the not-found page.

**Checkpoint**: US3 works on its own on top of US1.

---

## Phase 6: User Story 4 - Stop an answer that is going nowhere (Priority: P2)

**Goal**: Stop (and a closed or reloaded page) ends the reply where it was; the partial text stays,
marked stopped, also after a reload.

**Independent Test**: With `[slow]`, press Stop mid-reply; the partial text and the stopped marker stay,
and survive a reload (spec US4).

### Tests for User Story 4 (test-first) ⚠️

- [x] T060 [US4] Extend `src/server/chat/respond.integration.test.ts` with failing tests. Abort the signal passed to `respondToChat` after the first text chunk, using a slow `MockLanguageModelV4` stream. The row ends `STOPPED` with exactly the parts produced before the abort, its reasoning included, and the model stops being read. Aborting before any text stores `STOPPED` with reasoning only, or with no parts (FR-016, FR-018, Edge Cases)

### Implementation for User Story 4

- [x] T061 [US4] Make T060 pass in `src/server/chat/respond.ts`. Expected to need only the `request.signal.aborted` branch of `decideOutcome` wired correctly. Record any SDK difference from research R3 in the plan's amendment table. Depends on T060
- [x] T062 [US4] Make sure `src/components/chat/chat-thread/chat-thread.tsx` shows the stopped marker for a runtime status `incomplete/cancelled` and for `metadata.outcome === "stopped"`. A stopped reply shows Copy and no Try again. Extend its test (FR-019)
- [x] T063 [US4] Add to `e2e/chat.spec.ts`: send `Explain [slow]`, wait for some text, then press Stop. The text stops growing and the stopped marker shows. After a reload, the same partial text and the marker remain, and a new message can be sent

**Checkpoint**: US4 works on its own on top of US1.

---

## Phase 7: User Story 5 - Recover when the model fails (Priority: P2)

**Goal**: A failure shows a localized generic error with Try again; Try again answers the same question
without storing it twice; failed attempts stay visible above the answer, live and after a reload.

**Independent Test**: With `[fail-once]`, send, see the error and Try again, retry, see the answer below
the failed attempt; reload and see the same (spec US5).

### Tests for User Story 5 (test-first) ⚠️

- [x] T064 [P] [US5] Extend `src/lib/chat/messages.test.ts` with failing tests for `foldFailedReplies(messages)`:
  - each run of failed replies moves into `metadata.failedAttempts` of the question before it;
  - other replies are untouched;
  - a trailing failed reply with no successor stays a message, so Try again can attach to it;
  - the fold is idempotent (research R10).
- [x] T065 [US5] Extend `src/server/chat/chat-service.integration.test.ts` with failing tests for `regenerate-message`:
  - accepted only when the latest reply is `FAILED`;
  - it inserts a new `IN_PROGRESS` reply and **no** user message (SC-006);
  - refused with `nothing_to_retry` after `COMPLETED`, `STOPPED`, or `CUT`;
  - refused with `reply_in_progress` while one is being written;
  - two concurrent Try agains yield one reply (FR-022, FR-023);
  - after a failure, a new `submit-message` is accepted (US5 scenario 5).
- [x] T066 [US5] Extend `src/server/chat/respond.integration.test.ts` with failing tests:
  - **model error mid-stream:** the row ends `FAILED` with the text produced so far; the client stream carries `errorText: "model_failed"` and no provider message; the provider error reaches `console.error` (FR-020, SC-009);
  - **model throws at call time:** the row ends `FAILED`, and the question's user message is stored (FR-014);
  - **timeout:** a `timeout` shorter than a slow stream ends `FAILED` with `outcome: "failed"` metadata, and is not counted as stopped.

### Implementation for User Story 5

- [x] T067 [US5] Implement `foldFailedReplies` in `src/lib/chat/messages.ts`, and apply it in `getOwnConversation`'s result in `src/server/chat/chat-service.ts`. Depends on T064
- [x] T068 [US5] Implement the `regenerate-message` branch of `startChatTurn` in `src/server/chat/chat-service.ts` (research R4 step 4). Depends on T065
- [x] T069 [US5] Make T066 pass in `src/server/chat/respond.ts` (the failure flag set in `onError`, R3). Depends on T066
- [x] T070 [US5] Extend `src/components/chat/chat-thread/chat-thread.tsx` and its test:
  - **failed attempts** render under their question, each with its text and the failed marker;
  - **failed reply:** the last message, when failed (runtime `incomplete/error` or `metadata.outcome === "failed"`), shows `ErrorPrimitive.Root` with translated `chat.errors.modelFailed` children, never the raw error text, and a Try again button (`chat.actions.tryAgain`), rendered only on the last message;
  - **while running:** no Try again.
- [x] T071 [US5] Implement Try again in `src/components/chat/chat-panel/chat-panel.tsx`: before calling `chat.regenerate()`, move the failed assistant message into its question's `metadata.failedAttempts` with `setMessages` (research R10). Add `reply_in_progress` (`chat.errors.inProgress`) and `nothing_to_retry` (`chat.errors.nothingToRetry`) to the refusal map. Extend its test
- [x] T072 [US5] Add to `e2e/chat.spec.ts`:
  - **error then Try again:** send `Check [fail-once]`; the generic error and Try again show; Try again shows the answer below the failed attempt and the question appears once; after a reload, the failed attempt, its marker, and the answer are shown in the same order (FR-021, FR-022, SC-006);
  - **reload offers Try again:** after `Check [fail]` and a reload, Try again is still offered.

**Checkpoint**: US5 works on its own on top of US1.

---

## Phase 8: User Story 6 - Limits keep cost and abuse bounded (Priority: P2)

**Goal**: Message length, per-minute requests, and the daily token budget are enforced with their own
localized messages; the model sees only the recent part of a long conversation.

**Independent Test**: With small limits, a message at the length limit passes and one character more is
refused in the UI and by the endpoint; the request after the per-minute limit is refused with "wait a
moment"; a day's usage at the budget is refused with the hours until available (spec US6).

### Tests for User Story 6 (test-first) ⚠️

- [x] T073 [P] [US6] Write failing tests in `src/server/chat/limits.test.ts` for `secondsUntilBudgetFrees(replies, budget, now)`:
  - with a total just at the budget, the answer is when the oldest reply leaves the window;
  - when one large old reply carries the excess, it is the first that suffices;
  - `null` tokens count as 0;
  - seconds round up;
  - the result is always > 0 when the total is ≥ budget (FR-055, research R5).
- [x] T074 [P] [US6] Write failing tests in `src/lib/chat/availability.test.ts` for `hoursUntilAvailable(seconds)`: 1 → `{ underHour: true }`, 3 599 → under an hour, 3 600 → 1, 3 601 → 2, 7 260 → 3 (rounded up)
- [x] T075 [US6] Extend `src/server/chat/chat-service.integration.test.ts` with failing tests:
  - **per-minute boundary:** with limit N, the Nth accepted turn in 60 s passes and the (N+1)th throws `RateLimitError("rate_limited")` with `retryAfterSeconds` = oldest + 60 − now; a reply 60 001 ms old no longer counts; Try again counts;
  - **daily boundary:** usage at budget − 1 passes even if the reply would exceed it; usage ≥ budget throws `RateLimitError("daily_limit_reached", secondsUntilBudgetFrees(...))`;
  - **order:** when both are exceeded, the daily error wins (FR-040);
  - **per user:** another user's usage never counts (FR-043);
  - **refusals have no side effects:** a refused turn stores nothing (FR-041), and in `src/server/chat/respond.integration.test.ts` a limit refusal leaves the mocked model's `doStreamCalls` empty (SC-008);
  - **concurrency:** N+1 concurrent turns by one user in different conversations under limit N yield exactly N replies (the row lock, R4);
  - **context limit:** with `historyLimit` 3 and 5 stored messages, `history` has the last 3 (FR-042).

### Implementation for User Story 6

- [x] T076 [P] [US6] Implement T073 in `src/server/chat/limits.ts`. Depends on T073
- [x] T077 [P] [US6] Implement T074 in `src/lib/chat/availability.ts`. Depends on T074
- [x] T078 [US6] Add the limit checks to `startChatTurn` in `src/server/chat/chat-service.ts` and the count/sum/window queries to `src/server/chat/chat-repository.ts`. They run inside the transaction after `lockUser`, daily first, with `config.chat.*` passed in as parameters so tests can set small limits. Pass `config.chat.historyLimit` to `toModelHistory`. Depends on T075, T076
- [x] T079 [US6] Extend `src/components/chat/chat-thread/chat-thread.tsx`, `src/components/chat/chat-panel/chat-panel.tsx`, and their tests:
  - **too long:** typing past `maxLength` shows `chat.errors.tooLong` (with `{max}`) and disables Send, with no native `maxLength` (R12);
  - **refusal codes:** `validation_failed` maps its field key; `rate_limited` maps to `chat.errors.rateLimited`; `daily_limit_reached` maps to `chat.errors.dailyLimitHours` (ICU plural, `{hours}`) or `chat.errors.dailyLimitUnderHour`, using `hoursUntilAvailable(retryAfterSeconds)`.

  Add the keys to both catalogs. The Ukrainian plural must cover `one`/`few`/`many`/`other`. This is the product's first plural (contracts/ui.md).

- [x] T080 [US6] Add to `e2e/chat.spec.ts`, with a fresh user and the e2e server's limit of 5: send 5 messages, then a 6th is refused with "wait a moment" and the typed text is still in the box. Also add a too-long paste (4 001 characters) showing the too-long message with Send disabled

**Checkpoint**: US6 works on its own on top of US1.

---

## Phase 9: User Story 7 - The chat speaks the user's language (Priority: P3)

**Goal**: Every chat string in both languages; switching language keeps the page; the server refuses an
unsupported locale; the agent is told the fallback language.

**Independent Test**: Open a conversation in each language with no untranslated copy; switch language on
a conversation and on the new-chat page and stay there (spec US7).

- [x] T081 [US7] Review `src/messages/uk.json` against `src/messages/en.json` for every `chat.*`, `shell.chat`, `validation.chat.*`, and new `errors.codes.*` key. They must be natural Ukrainian, not English. The parity test already blocks missing keys
- [x] T082 [US7] Add to the chat block of `src/app/api/authorization-matrix.integration.test.ts` or a route test: `locale: "de"` answers 400 `validation_failed`, nothing is stored, and the mocked model's `doStreamCalls` stays empty (FR-045, SC-008)
- [x] T083 [US7] Add to `e2e/chat.spec.ts`:
  - **on a conversation:** switch to Українська; the URL keeps the conversation id under `/uk/`, the history is unchanged, and the labels are Ukrainian;
  - **on the new-chat page:** switching keeps the user on it and nothing is stored (FR-050).

**Checkpoint**: All seven stories are independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, the live check, and the merge gates

- [x] T084 [P] Update `README.md`: the Stack line about the AI SDK and assistant-ui (now installed), the new variables under Getting started, and a short "AI chat" note pointing to `specs/006-ai-chat/quickstart.md` for the key and the free-tier warning
- [x] T085 [P] Update `CLAUDE.md`'s stack table: drop "_not yet installed_" from the Chat UI and AI rows, and name `@ai-sdk/google` as the provider in use
- [x] T086 Run the full merge gates and fix what fails: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:run`, `npm run e2e`, and `npx prisma migrate status` against `atmo_test`
- [x] T087 Run the [quickstart live model check](./quickstart.md#live-model-check-once-with-a-real-key) with the developer's `GOOGLE_GENERATIVE_AI_API_KEY`, in test data only, together with the developer:
  - SC-002 timing;
  - the share of replies showing reasoning at `low`;
  - two consecutive user turns accepted (R6) — if not, implement the join in `src/server/chat/history.ts` test-first;
  - the provider error in the server log only.

  Record the results in the plan's "Amendments Made During Implementation" table.

- [x] T088 Walk the quickstart's "Check by hand" list on `npm run dev` with `AI_FAKE_MODEL=true`, and time SC-012 by hand (header link to a read reply in under 30 s, no instructions). Add a "## Amendments Made During Implementation" section to `plan.md` for every place the build departed from the plan, as feature 003 did

---

## Phase 11: Formulas and links in replies (2026-10-12, FR-024 amended)

- [x] T089 Write failing tests in `src/components/chat/chat-thread/chat-thread.test.tsx`: a reply with inline `$V_{oc}$` and a display `$$` block on its own lines renders KaTeX output; `$120 and $800` stays text; a `\href{https://example.com}{x}` formula renders no link; a Markdown link opens in a new tab with `rel="noopener noreferrer nofollow"` (R19)
- [x] T090 Install `remark-math@6.0.0`, `rehype-katex@7.0.1`, and `katex@^0.19.0` with an npm override past the `^0.16.0` both math packages declare; confirm `npm ls katex` shows one copy and `npm audit` reports no KaTeX advisory (R17, R19)
- [x] T091 In `src/components/assistant-ui/elements/markdown-text.tsx`: add `remarkMath` and `rehypeKatex`, the `preprocess` of `normalizeMathDelimiters` then `escapeCurrencyDollars`, the KaTeX stylesheet, and the link's `target` and `rel` (R19)
- [x] T092 Ask the live model a question that draws formulas (open-circuit voltage against the inverter's limit) and one with prices in dollars; confirm formulas render, prices stay text, and a link opens in a new tab — 2026-10-13: formulas and dollar prices checked on the live model; no reply carried a link, so the new tab rests on T089's component test

---

## Phase 12: The chat's own not-found page (2026-10-15, FR-004 amended)

- [x] T093 Change the e2e tests in `e2e/chat.spec.ts` that open a missing, another user's, a malformed, and a deleted conversation's address: each answers 404 and shows the chat's not-found page beside the conversation list, whose Start a new chat link opens the new-conversation page (FR-004, R7)
- [x] T094 Add `src/app/[locale]/(private)/dashboard/chat/not-found.tsx` and its `chat.notFound` keys in `en` and `uk` (FR-004, R7)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T003 depends on T001 and T002.
- **Foundational (Phase 2)**: depends on Setup, and blocks every user story.
- **US1 (Phase 3)**: depends on Foundational. It is the MVP every other story extends.
- **US2 (Phase 4)**: depends on US1 (the `[id]` page and the POST route).
- **US3 (Phase 5)**: depends on US1 (the chat layout and `finishReply`).
- **US4 (Phase 6)**: depends on US1 (`respond.ts`, `ChatThread`).
- **US5 (Phase 7)**: depends on US1. It shares `chat-service.ts`, `respond.ts`, and `ChatThread` with US4 and US6, so run it after US4 to avoid conflicting edits.
- **US6 (Phase 8)**: depends on US1. It shares `chat-service.ts` with US5; run it after US5.
- **US7 (Phase 9)**: depends on US1; best after US3–US6, so it reviews every key.
- **Polish (Phase 10)**: depends on all stories.

### User Story Dependencies

```text
Setup ──► Foundational ──► US1 ──┬──► US2
                                 ├──► US3
                                 └──► US4 ──► US5 ──► US6 ──► US7 ──► Polish
```

US2, US3, and the US4 → US6 chain touch different files and can proceed in parallel after US1. US5 and
US6 run in sequence only because they edit the same service.

### Within Each User Story

- The failing test task runs before its implementation task and is committed first.
- Pure modules before the repository, the repository before the service, the service before
  `respond.ts` and route handlers, handlers before pages, pages before components, and components before e2e.
- Catalog keys land in the task that first renders them.

### Parallel Opportunities

- **Setup**: T004, T005, and T006 run in parallel after T001.
- **Foundational**: the failing tests T011, T013, T015, T017, T019, T021, T023, and T025 touch disjoint files and can be written together. T009 → T010 runs alongside them.
- **US1**: T028, T029, and T030 are written together; T033, T034, and T035 are implemented together.
- **US6**: T073 and T074 in parallel; T076 and T077 in parallel.
- **After US1**: US2, US3, and US4 in parallel (disjoint files).
- **Polish**: T084 and T085 in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Write the independent failing tests together:
Task: "Write failing tests in src/lib/http/server/route-response.test.ts (RateLimitError → 429)"
Task: "Extend failing tests in src/lib/http/server/define-route.test.ts (request passed to handler)"
Task: "Extend failing tests in src/lib/http/server/params.test.ts (conversationIdFrom)"
Task: "Write failing tests in src/lib/http/client/chat-fetch.test.ts"
Task: "Write failing tests in src/lib/schemas/chat.test.ts"
Task: "Write failing tests in src/lib/chat/messages.test.ts"
Task: "Write failing tests in src/server/chat/instructions.test.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Write failing tests in src/server/chat/title.test.ts"
Task: "Write failing tests in src/server/chat/history.test.ts"
Task: "Write failing tests in src/server/chat/outcome.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup.
2. Phase 2: Foundational. This blocks everything else.
3. Phase 3: US1.
4. **Stop and validate**: `e2e/chat.spec.ts` (US1 tests) is green, and the 001–005 specs still are.
5. The MVP is demonstrable, but **not releasable**: US2 (real 404 and the authorization matrix) is P1 too.
   Every stage of this chat stays staff-only regardless: it must not be opened to customers before
   escalation exists (spec Known Boundaries).

### Incremental Delivery

1. Setup + Foundational → US1 → demo on the test model.
2. US2 → the P1 slice is complete.
3. US3 → conversations can be found and deleted.
4. US4 → US5 → US6 → Stop, recovery, and limits.
5. US7 → language review and switching.
6. Polish → the live model check with a real key, then merge.

### Suggested sessions

One fresh chat per phase, or per two small phases (US2 + US3, US4 + US5), each ending in a commit. The
whole state of the work is in this file's checkboxes and the plan's amendments table.
