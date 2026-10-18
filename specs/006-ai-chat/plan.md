# Implementation Plan: AI Chat for Signed-In Users

**Branch**: `006-ai-chat` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ai-chat/spec.md`

## Summary

Every signed-in user gets a private chat with an AI support assistant for solar energy at
`/{l}/dashboard/chat`. Replies stream token by token, show the model's reasoning in a collapsible block,
and are stored in our own database as the system of record. Users can stop a reply, copy it, try again
after a failure, and list and delete their conversations. Each user is held to a message length, a
per-minute request limit, and a soft daily token budget, and the model sees only the recent part of a
long conversation.

The technical spine:

1. **One agent module.** A `ToolLoopAgent` on `gemini-3.5-flash-lite` with medium reasoning effort and one
   4 096-token cap. A per-call `prepareCall` injects the date and the page locale into instructions that
   are reviewed like code (R1, R2).
2. **One streaming endpoint.** `POST /api/chat` runs one transaction under a lock on the user's row:
   ownership, turn state, limits, the user message, and a reply row marked `IN_PROGRESS`. It then streams
   with `createAgentUIStreamResponse`, with the reply's row id as its message id. `onEnd` records how the
   reply ended: completed, stopped, cut, or failed (R3, R4).
3. **The browser.** `useChat` with a last-message-only transport feeds `useAISDKRuntime` and a thread
   composed from assistant-ui primitives, plus two Base UI registry items: Markdown and reasoning (R9).
   Markers come from stored outcomes, and failed attempts fold under their question, so the live view and
   the reloaded view match (R10).

Research changed the spec before this plan in four places, each marked _amended during planning_. It also
forced one structural change the spec had not foreseen: a `loading.tsx` above a page turns `notFound()`
into a 200. To keep FR-004's real 404, the dashboard home moves into a route group, and the ownership
check runs in a layout (R7). Three constitution PATCH amendments happened on this branch: 1.6.1, the
language of replies; 1.6.2, the `@assistant-ui/ai-sdk` package name; and 1.6.3, which states that the
agent's instructions are model input, not copy.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node ≥ 22.12

**Primary Dependencies**:

- Already present: Next.js 16.3, React 19.2, next-intl 4.13.7, Prisma 7.10 with `@prisma/adapter-pg`,
  zod 4.4.3, `@base-ui/react` 1.7, `tw-animate-css`.
- **New, exempt by the constitution**: `ai@7.0.127`, `@ai-sdk/react@4.0.130`,
  `@assistant-ui/react@0.15.23`, `@assistant-ui/ai-sdk@0.0.9`, `@assistant-ui/react-markdown@0.14.18`.
- **New, justified** ([research R17](./research.md#r17-dependency-justifications-constitution-technology-constraints)):
  `@ai-sdk/google@4.0.87`, a provider and a new recipient of customer data; `remark-gfm`, which arrives
  with the registry's `markdown-text`. Added 2026-10-12 for formulas (FR-024, R19): `remark-math@6.0.0`,
  `rehype-katex@7.0.1`, and `katex@^0.19.0`, the last through an npm override (R19).
- Via the shadcn CLI:
  - assistant-ui registry items `markdown-text` and `reasoning`, Base UI style;
  - shadcn `tooltip` and `collapsible`.
- **Refused**: `tw-shimmer`, `zustand`, `@assistant-ui/react-ai-sdk` (R9, R17).

**Storage**: PostgreSQL 18 through Prisma: two tables (`conversations`, `messages`), two enums, one
partial unique index, and one committed migration. See [data-model.md](./data-model.md).

**Testing**:

- Vitest `unit`, `ui`, and `integration` against `atmo_test`. Model calls go through `MockLanguageModelV4`.
- Playwright on a production build against `atmo_e2e`, with `AI_FAKE_MODEL=true` and
  `CHAT_RATE_LIMIT_PER_MINUTE=5`.

**Target Platform**: The same self-hosted Node server behind a reverse proxy. Client disconnects abort
`request.signal` on this runtime (R3).

**Project Type**: A single Next.js application.

**Performance Goals**:

- The thinking block or the first words appear within 3 s (SC-002, checked live).
- Starting a turn costs one transaction of a few indexed queries.
- The conversation list is one query per chat page.

**Constraints**:

- The model is fixed in code, with no runtime choice (FR-047).
- No `process.env` outside Config.
- Nothing in `src/server/` imports Next or React (lint).
- The proxy never touches the database.
- No `loading.tsx` above the conversation's ownership check (R7).
- The free-tier key carries test data only (R18).

**Scale/Scope**:

- Tens of staff users.
- Pages and layouts: 3 pages, 2 new layouts, 1 page moved into a route group.
- Endpoints: 2.
- About 40 catalog keys per locale.
- Models: 2.

## Constitution Check

_GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design. Both passes recorded._

| Principle                               | Verdict                          | How this plan satisfies it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I. Type-Safe by Default**             | PASS                             | All new code is TypeScript. Request bodies are `unknown` until `chatRequestSchema` narrows them, and message metadata is validated by one zod schema on both sides (`messageMetadataSchema`). Prisma rows map to `ChatUIMessage` and `ConversationSummary` DTOs at the service boundary. No `any` is planned. JSONB `parts` are parsed through the AI SDK's own validation (`createAgentUIStreamResponse` validates `uiMessages`, R3).                                                                                                                 |
| **II. Simple, Modular, Readable**       | PASS with tracked deviations     | Pages render, handlers adapt HTTP, and services in `src/server/chat/` hold the rules and import nothing from Next. Prisma stays in `chat-repository.ts`. The agent is one module. No thread-list runtime, no remote adapter, no state library. Four deviations, each forced by research, are listed in Complexity Tracking.                                                                                                                                                                                                                            |
| **III. Spec-First Delivery**            | PASS                             | The spec was written, clarified in two sessions, and **amended before this plan** where research overturned it: FR-052 and FR-054, MC-001, MC-002, MC-004, MC-007, and Known Boundaries. Each amendment is marked in the spec and argued in research.md.                                                                                                                                                                                                                                                                                               |
| **IV. Tested Business Logic**           | PASS with one recorded deviation | Every module has a regime below. Chat send and receive and locale switching are covered by Playwright. **Deviation**: "escalation to a human" Playwright coverage is deferred with escalation itself (spec Known Boundaries). The users are our own staff, and the chat MUST NOT be opened to customers before escalation exists.                                                                                                                                                                                                                      |
| **V. Centralized Config, Zero Secrets** | PASS                             | Six variables go through `src/config` with two cross-field rules (R14). Each has an `.env.example` entry. The provider key is passed to the provider explicitly from Config. The e2e and Vitest environments are set in tooling configs, which are exempt. No key appears in the repository.                                                                                                                                                                                                                                                           |
| **VI. Accountable AI Agents**           | PASS with one recorded deviation | The instructions, model id, and settings live in the repository (FR-044, FR-047). Our tables record every question, reply, model, token count, and outcome (FR-048); no framework keeps a copy. The agent has no tools, so tenant scoping of tools does not arise, and every query is scoped to the owner in the data layer. Customer data sent to the model is limited to the conversation's recent messages (FR-042). **Deviation**: there is no path to a human. Recorded in the spec's Known Boundaries, it blocks opening this chat to customers. |
| **VII. Localized by Default**           | PASS                             | All copy is in `en` and `uk`, enforced by the parity test. The API returns codes, and the browser translates them. FR-055's hour count uses an ICU plural. The agent replies in the customer's language, with the locale as fallback (1.6.1). The model's instructions are English model input, reviewed like code, as 1.6.3 states (R15).                                                                                                                                                                                                             |
| **VIII. Addresses Have One Owner**      | PASS                             | Two pages and two endpoints are added to `src/lib/routes.ts`. `routes.test.ts` already ignores route groups. The browser builds conversation addresses with `pathTo` and next-intl's `getPathname`, never as literals. e2e specs keep literals.                                                                                                                                                                                                                                                                                                        |
| **Technology Constraints**              | PASS                             | Postgres is reached through Prisma, with a committed migration and the partial index declared in the schema. One raw `$queryRaw` tagged template (`FOR UPDATE`) is used where the query API cannot express it (R4). The AI SDK and assistant-ui are used as the constitution names them (1.6.2). The registry gives Base UI variants only. The provider package and `remark-gfm` are justified (R17). Library fidelity: every API named here was read from the pinned versions (research preamble).                                                    |

### Test regime per module (Principle IV)

| Module                                                                                                                                                                                                                                                                                                                                  | Regime         | Where                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- |
| `src/config/schema.ts` additions: defaults, coercion, key required unless fake, fake refused in production, the declared-keys list                                                                                                                                                                                                      | **Test-first** | `schema.test.ts` (unit) |
| `src/lib/schemas/chat.ts`: empty, length boundary at max and max+1 in UTF-16 units, locale, trigger rules                                                                                                                                                                                                                               | **Test-first** | unit                    |
| `src/lib/chat/messages.ts`: `foldFailedReplies`, `effectiveOutcome`, metadata schema                                                                                                                                                                                                                                                    | **Test-first** | unit                    |
| `src/lib/chat/availability.ts`: seconds → hours rounding, below one hour                                                                                                                                                                                                                                                                | **Test-first** | unit                    |
| `src/server/chat/title.ts` (FR-008), `history.ts` (`toModelHistory`, FR-042, R6), `outcome.ts` (`decideOutcome`, R4), `limits.ts` (`secondsUntilBudgetFrees`, R5)                                                                                                                                                                       | **Test-first** | unit                    |
| `src/server/chat/instructions.ts`: role, no-access statement, no-invention rule, language fallback, date (FR-044, FR-045)                                                                                                                                                                                                               | **Test-first** | unit                    |
| `src/server/chat/chat-service.ts`: owner scoping and cross-user → `NotFoundError`; creation on the first message; turn-state rules (FR-012, FR-022); Try again without a duplicate question; concurrent turns → one reply (FR-023); stale sweep; both limits at their boundaries, daily first; `finishReply` after deletion; list order | **Test-first** | integration             |
| `src/server/chat/respond.ts`: stored outcome for completed, cut, error, timeout, and client abort; reasoning stored; usage recorded; `errorText` never carries provider detail (`MockLanguageModelV4`)                                                                                                                                  | **Test-first** | integration             |
| `src/server/errors.ts` and `src/lib/http/server/route-response.ts`: `RateLimitError` → 429, `retryAfterSeconds`, `Retry-After`; new codes ↔ catalog                                                                                                                                                                                     | **Test-first** | unit                    |
| `src/server/chat/fake-model.ts`: markers behave as contracted                                                                                                                                                                                                                                                                           | Test-together  | unit                    |
| Route handlers `api/chat`, `api/chat/[id]`, joining the authorization matrix                                                                                                                                                                                                                                                            | Test-together  | integration             |
| `chat-panel`, `chat-thread`, `reply-marker`, `conversation-list`, `delete-conversation-dialog`                                                                                                                                                                                                                                          | Test-together  | `ui` (jsdom)            |
| Loading-boundary convention (R7)                                                                                                                                                                                                                                                                                                        | Test-together  | `src/conventions/`      |
| Chat flows ([quickstart](./quickstart.md#what-the-e2e-suite-proves-e2echatspects-test-model))                                                                                                                                                                                                                                           | Test-together  | Playwright              |

The commit order shows each failing test before its implementation, as in features 001 and 003.

**Post-design re-check (after Phase 1)**: still PASS. The design added no layer or dependency beyond
the rows below. The design itself settled one point: the chat client needs no endpoint of its own for
reads, because both pages render from the data layer and `router.refresh()` updates the sidebar (R8).

## Project Structure

### Documentation (this feature)

```text
specs/006-ai-chat/
├── plan.md                 # This file
├── research.md             # Phase 0 — 18 decisions with evidence
├── data-model.md           # Phase 1 — conversations, messages, lifecycles, derived values
├── quickstart.md           # Phase 1 — run, check by hand, live model check, e2e map
├── contracts/
│   ├── http-api.md         # POST /api/chat stream and refusals, DELETE, matrix
│   ├── agent.md            # agent module, instructions, respond flow, test model
│   └── ui.md               # pages, components, markers, composer, catalog keys
├── checklists/requirements.md
└── tasks.md                # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                          # UPDATED — MessageRole, ReplyFinish, Conversation, Message
└── migrations/<ts>_chat_conversations/    # NEW — generated, committed

src/
├── config/schema.ts / schema.test.ts      # UPDATED — key, AI_FAKE_MODEL, four CHAT_* (R14)
├── lib/
│   ├── routes.ts                          # UPDATED — PAGES.chat, PAGES.chatConversation, API_ROUTES.chat, .chatConversation
│   ├── schemas/chat.ts / .test.ts         # NEW — chatRequestSchema(maxLength)
│   ├── chat/
│   │   ├── messages.ts / .test.ts         # NEW — ChatUIMessage, metadata schema, foldFailedReplies, effectiveOutcome
│   │   └── availability.ts / .test.ts     # NEW — hours until available (FR-055)
│   └── http/
│       ├── server/define-route.ts         # UPDATED — handler also receives `request`
│       ├── server/route-response.ts       # UPDATED — 429 + retryAfterSeconds + Retry-After
│       ├── server/params.ts               # UPDATED — conversationIdFrom(params)
│       ├── client/api-client.ts           # UPDATED — export sign-in redirect and keep-alive helpers
│       └── client/chat-fetch.ts / .test.ts# NEW — transport fetch: 401 → sign-in, keep-alive
├── server/
│   ├── errors.ts                          # UPDATED — 5 codes, RateLimitError
│   └── chat/                              # NEW — imports nothing from Next or React
│       ├── agent.ts                       #   getChatAgent() → { agent, modelId }, limits (R1, R2)
│       ├── instructions.ts / .test.ts     #   buildInstructions (R15)
│       ├── fake-model.ts / .test.ts       #   MockLanguageModelV4, markers (R13)
│       ├── title.ts / .test.ts
│       ├── history.ts / .test.ts          #   toModelHistory (R6)
│       ├── outcome.ts / .test.ts          #   decideOutcome (R4)
│       ├── limits.ts / .test.ts           #   secondsUntilBudgetFrees (R5)
│       ├── chat-repository.ts             #   Prisma; FOR UPDATE; stale sweep
│       ├── chat-service.ts / .integration.test.ts  # startChatTurn, finishReply, list, find, delete
│       └── respond.ts / .integration.test.ts      # createAgentUIStreamResponse wiring (R3)
├── app/
│   ├── api/chat/route.ts                  # NEW — POST
│   ├── api/chat/[id]/route.ts             # NEW — DELETE
│   ├── api/authorization-matrix.integration.test.ts  # UPDATED — chat endpoints
│   └── [locale]/(private)/
│       ├── layout.tsx                     # UPDATED — Chat link
│       └── dashboard/
│           ├── (home)/page.tsx, loading.tsx   # MOVED from dashboard/ (R7)
│           └── chat/
│               ├── layout.tsx             # NEW — sidebar, panel host (R8)
│               ├── (new)/page.tsx, loading.tsx    # panel slot
│               └── [id]/layout.tsx, page.tsx      # panel slot; no loading.tsx (R8)
├── components/
│   ├── chat/                              # NEW group — one folder per component, test beside
│   │   ├── chat-panel/  chat-panel-host/  chat-panel-slot/
│   │   ├── chat-thread/  reply-marker/
│   │   └── conversation-list/  delete-conversation-dialog/
│   ├── assistant-ui/elements/             # NEW via CLI (flat) — markdown-text, reasoning(.aui), tooltip-icon-button
│   └── ui/tooltip.tsx, collapsible.tsx    # NEW via CLI
├── hooks/use-copy-to-clipboard.ts         # NEW via CLI
├── conventions/loading-boundaries.test.ts # UPDATED — no loading.tsx in dashboard/, dashboard/chat/ or chat/[id]/
└── messages/en.json, uk.json              # UPDATED — chat, shell.chat, errors.codes.*

e2e/chat.spec.ts                           # NEW
components.json                            # UPDATED — @assistant-ui registry, Base UI style URL
vitest.config.mts                          # UPDATED — AI_FAKE_MODEL=true for unit and integration
playwright.config.ts                       # UPDATED — AI_FAKE_MODEL=true, CHAT_RATE_LIMIT_PER_MINUTE=5
.env.example                               # UPDATED — 6 variables
package.json                               # UPDATED — 7 packages
README.md, CLAUDE.md                       # UPDATED — stack rows no longer "not yet installed"; README Stack line
```

The integration and e2e setups already truncate `users … CASCADE`, which reaches `conversations` and
`messages` through their foreign keys, so neither needs a change.

**Structure Decision**: a single Next.js application, extending feature 003's layering. Four decisions
follow from the research:

1. **`src/server/chat/` holds the whole agent side**, from the stream wiring to the model, because none of
   it needs Next. The route handlers only adapt HTTP, so a later move of the agent to a worker or to
   Mastra replaces only this folder (MC-003).
2. **`src/lib/chat/` holds what both sides share.** The metadata schema, the fold of failed replies, and
   the hours display are imported by the server loader and the browser. Code under `src/server/` must
   not reach the client bundle (feature 003, structure decision 3).
3. **Route groups shape the loading boundaries**, not the URLs (R7). `(home)` and `(new)` exist only to
   keep `loading.tsx` from wrapping the ownership check.
4. **The sidebar lives in `chat/layout.tsx`**, so it persists across conversations. It is refreshed
   explicitly after each reply (R8). The panel lives there too, so a new conversation's own page does
   not replace it; a page tells it which conversation to show (R8).

## Complexity Tracking

| Deviation                                                                        | Why needed                                                                                                                                  | Simpler alternative rejected because                                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The dashboard home moves into `(home)/`, and the new-chat page lives in `(new)/` | A `loading.tsx` above a page makes `notFound()` answer 200. FR-004 requires 404 (R7)                                                        | A soft 404: the user chose the real status. A check in the proxy: the proxy never touches the database                                           |
| A `FOR UPDATE` raw query on the user's row in each turn                          | The per-minute limit must count requests still in flight, exactly (R4)                                                                      | Check-then-insert races across tabs. A counter table is new storage the request ruled out                                                        |
| A thread composed from primitives instead of the registry `thread`               | The registry `thread` brings attachments, voice, suggestions, tools, feedback, edit, branches, and `zustand`, all excluded by the spec (R9) | Pulling and stripping it: the user chose composition. CLAUDE.md now sends future chat elements to the registry first                             |
| Failed replies fold under their question in the browser's message list           | `regenerate()` removes the message it replaces, while the spec keeps failed replies visible above the new one (R10)                         | Re-inserting after `regenerate()`: races the stream. `sendMessage()` without a message: continues the failed reply instead of starting a new one |

## Amendments Made During Implementation

Recorded here because Principle III forbids the code being the only record of intended behaviour.

| #   | Planned                                                                                            | Built                                                                                                                                                                                                                                                                          | Why the plan could not stand                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `zod` stays at 4.4.3                                                                               | `zod` 4.6.5, still within `^4.4.3`                                                                                                                                                                                                                                             | `@assistant-ui/react` 0.15.23 depends on `zod ^4.6.5`, so npm lifted the shared copy. `z.stringbool` and every API this feature uses are unchanged                                                                                                                                                                                                   |
| A2  | `shadcn add` with the `button.tsx` overwrite declined                                              | Ran with `--overwrite` and restored `button.tsx` from a copy; `cn` and `tw-shimmer` removed as R16 and R9 say                                                                                                                                                                  | The CLI offers no non-interactive "no" to its overwrite prompt; a closed stdin aborted it halfway                                                                                                                                                                                                                                                    |
| A3  | Vendored `markdown-text.tsx` used as pulled                                                        | Its `useShallowStable` hook keeps the previous value in `useState` instead of reading a ref during render                                                                                                                                                                      | The React Compiler lint rule `react-hooks/refs` fails the merge gate on the registry version; the behaviour is the same                                                                                                                                                                                                                              |
| A4  | Migration from `prisma migrate dev`                                                                | Generated with `prisma migrate diff` from the schema at `HEAD` to the new one, applied to `atmo_test`, diffed back to empty                                                                                                                                                    | As 003 A1: `migrate dev` against `atmo_dev` may offer a reset. The SQL is unedited                                                                                                                                                                                                                                                                   |
| A5  | `chatRequestSchema` refuses a malformed `conversationId` (T019)                                    | The schema accepts any string; the service answers a malformed id with `NotFoundError`                                                                                                                                                                                         | FR-004 and contracts/http-api.md require a malformed id to answer 404 exactly like a random one; a schema failure is a 400. Locales come from `SUPPORTED_LOCALES`, the list `routing.locales` is built from, so `src/server` loads no next-intl. A bad locale carries `chat.errors.invalidLocale`; any other bad shape `validation.body.unparseable` |
| A6  | Vendored reasoning files keep all their exports                                                    | The deprecated `ReasoningGroup` wrapper in `reasoning.aui.tsx` is removed; the code-block Copy label comes through a `MarkdownTextLabels` provider                                                                                                                             | `ReasoningTrigger` now requires a translated label (FR-049), which the wrapper had no way to receive; the provider lets `reasoning.aui`'s own `MarkdownText` stay prop-free                                                                                                                                                                          |
| A7  | R8: `router.replace` to the new conversation lists it in the sidebar                               | `router.refresh()` follows `router.replace`, and follows `router.push` after deleting the open conversation                                                                                                                                                                    | A navigation keeps the shared `chat/layout.tsx` as rendered, so the list did not change. Found by the US3 e2e test                                                                                                                                                                                                                                   |
| A8  | The list folds away with the shadcn `collapsible`                                                  | Its own toggle button with `aria-expanded` and `aria-controls`                                                                                                                                                                                                                 | Base UI's closed panel carries `hidden`, which Tailwind v4's preflight makes `display: none !important`, so the list could not stay open on wide screens                                                                                                                                                                                             |
| A9  | The panel navigates as soon as a reply ends                                                        | After a Stop it waits one second (`STOP_SETTLE_MS`) first                                                                                                                                                                                                                      | The server stores `STOPPED` only once it notices the closed connection; navigating at once rendered the reply as still being written, with no text. Found by the US4 e2e test                                                                                                                                                                        |
| A10 | Refusals handled in `useChat`'s `onError`                                                          | Handled one microtask later                                                                                                                                                                                                                                                    | The SDK calls `onError` before it records the error, so clearing it there was undone                                                                                                                                                                                                                                                                 |
| A11 | Try again (T068), Stop (T061), and the failure paths (T069) built in their own stories             | Written with US1's service and stream wiring, which their failing tests then passed; T069 added only a `timeoutMs` parameter to `respondToChat`, so the timeout test need not wait 60 s                                                                                        | They are steps of the same transaction and the same `onEnd` (R4), so US1 could not be built without them                                                                                                                                                                                                                                             |
| A12 | —                                                                                                  | `toModelHistory` also drops a reply left with no parts once its reasoning is removed; `finishReply` stores only `reasoning` and `text` parts                                                                                                                                   | A reply stopped during its reasoning would otherwise reach Gemini as an empty assistant turn; the SDK's `step-start` parts carry nothing the page shows                                                                                                                                                                                              |
| A13 | Catalog key `chat.errors.empty`                                                                    | Not added                                                                                                                                                                                                                                                                      | Send is simply disabled for a blank message, so the composer never shows it; a blank message that reaches the server shows `validation.chat.empty`                                                                                                                                                                                                   |
| A14 | —                                                                                                  | `requireChatAccess()` in `src/auth/dal.ts`, `findOwnConversation` in the service, and `createChatAgent(model)` exported from `agent.ts`                                                                                                                                        | Pages need the role check as `requireSuperAdmin` provides it; the `[id]` layout needs the ownership check alone; integration tests need the real agent configuration around a mock model                                                                                                                                                             |
| A15 | The agent is fetched after the turn's transaction                                                  | `getChatAgent()` runs before `startChatTurn`, and a failed build is not cached                                                                                                                                                                                                 | Found in review: a build failure after the commit left a stored question and a reply stuck in progress, and the cached rejection would have failed every later request                                                                                                                                                                               |
| A16 | A stream that fails to start after the turn answers 500                                            | It answers 200 with a stream of `start` and `errorText: "model_failed"`, the reply stored `FAILED`                                                                                                                                                                             | Found in review: the browser read the 500 as a refusal, removed the stored question, and a resend duplicated it. Any 5xx now means nothing was stored                                                                                                                                                                                                |
| A17 | A reply in progress for longer than the 60 s timeout is failed at the next turn and read as failed | Only after a further 15 s (`STALE_REPLY_MS`); the stream's own timeout stays 60 s                                                                                                                                                                                              | Found in review: the stream's timeout starts after the row is created, so a reply ending near the limit could be swept as failed, with no parts, after the browser had shown it                                                                                                                                                                      |
| A18 | A request the server never answers is not handled                                                  | The question goes back into the box with `chat.errors.network`, as for a refusal; a drop after the response started is left to `onFinish`                                                                                                                                      | Found in review: offline, the question stayed on screen with no reply and the text was lost                                                                                                                                                                                                                                                          |
| A19 | —                                                                                                  | The panel does not navigate once it is unmounted; it still refreshes, so the list beside the page the user went to shows the new conversation                                                                                                                                  | Found in review: `useChat` stops the reply on unmount, so leaving a new chat while it streamed brought the user back to it a second later                                                                                                                                                                                                            |
| A20 | A lost connection shows as the SDK reports it, an error                                            | It is shown as stopped, with no error and no Try again, after the same one-second settle as Stop. A lost connection is any error after the response began that is not `model_failed`: the SDK's own `isDisconnect` recognises only Chrome's wording, not Safari's or Firefox's | Found in review: FR-016 makes a lost connection end the reply as Stop does; the server stored `STOPPED` and refused the Try again the browser offered                                                                                                                                                                                                |
| A21 | Send disabled while the latest reply is in progress                                                | Disabled only while this tab's reply runs, and during the settle after Stop                                                                                                                                                                                                    | Found in review: a reply another tab was writing kept Send disabled until a reload, as this tab's copy never updates; the server's `reply_in_progress` refusal enforces FR-012                                                                                                                                                                       |
| A22 | Send enabled as soon as Stop is pressed                                                            | Disabled for `STOP_SETTLE_MS` after a Stop or a lost connection; until A24, in a new conversation also until its own page replaced the panel                                                                                                                                   | Found in review: the server stores `STOPPED` only once it notices the closed connection, so a question sent at once was refused as `reply_in_progress`                                                                                                                                                                                               |
| A23 | Stop offered as soon as a question is sent                                                         | Stop, and Escape in the message box, disabled until the reply's first chunk, which carries the conversation's id                                                                                                                                                               | Found in review: a Stop before it left the browser without the new conversation's id, so the next question opened a second conversation                                                                                                                                                                                                              |
| A24 | `ChatPanel` rendered by each page, keyed by conversation                                           | `ChatPanelHost` in `chat/layout.tsx` renders it; each page renders a `ChatPanelSlot` with its conversation and messages                                                                                                                                                        | Found after PR #20: the `[id]` page replacing the new chat's panel cut off the reveal of the reply's text and emptied the message box (R8, FR-007)                                                                                                                                                                                                   |

### Live model check (T087, 2026-10-04, free-tier key, test questions only)

- **SC-002**: first reasoning or text from the model after 0.6–1.4 s across 13 questions, well inside 3 s (measured at the model; the page adds one transaction).
- **R6**: Gemini accepted two consecutive user turns; `toModelHistory` needs no join.
- **FR-020**: with an invalid key the browser received only `errorText: "model_failed"`; the provider's message reached the server log only. The AI SDK's own default error logging also prints the failed request, conversation included, to the server log.
- **Reasoning at `low` (R1, FR-054)**: the model reasoned on 1 of 13 questions; the others arrived with no reasoning block. At `medium` it reasoned on 3 of 3, with the first output after 1.3–1.6 s and about 2.5–3 times the output tokens. R1 names this as the trigger to revisit the level; FR-054 fixes it at low, so the choice is left to the developer. On 2026-10-12, after a reply at `low` carried the model's plan in its text, the developer chose `medium` and FR-054 was amended.

## Phase Status

- [x] Phase 0 — research complete → [research.md](./research.md)
- [x] Phase 1 — design complete → [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)
- [x] Constitution check re-evaluated after design — still PASS, deviations recorded
- [ ] Phase 2 — `/speckit-tasks` (not this command)
