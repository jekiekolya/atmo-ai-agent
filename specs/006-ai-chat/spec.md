# Feature Specification: AI Chat for Signed-In Users

**Feature Branch**: `006-ai-chat`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "AI chat for signed-in users — the first version of the support agent. WHY: Atmo's primary support channel will be an AI chat agent for end customers of partner companies; customers, partners and tenants do not exist yet, so this feature delivers the chat for signed-in users (today ADMIN and SUPER_ADMIN staff) and establishes the conversation model, streaming, persistence, limits and test harness the customer-facing chat will reuse; minimal — best practice, least code, nothing speculative. WHO: any signed-in, active user, any role; a conversation belongs to the user who started it and is visible only to them; another user's conversation and a non-existent one are indistinguishable — both 404, never 403. BEHAVIOR: (1) chat page at /dashboard/chat (new) and /dashboard/chat/[id] (existing), linked as \"Chat\" in the private header next to Home / Account / Users for all roles; (2) the reply streams token by token; the conversation is created on the first message, no empty conversations ever exist, and the URL then becomes /dashboard/chat/[id]; (3) reload or return shows the full history exactly as seen, interrupted replies included; (4) a sidebar lists the user's conversations, most recently active first, titled by the first user message truncated; open, start new, delete (confirmation dialog, permanent, removes its messages); no rename, archive or AI-generated titles; (5) Stop during streaming keeps the partial reply marked as interrupted; Copy on assistant messages; no regenerate, no editing — history is append-only; (6) on model failure (provider down, provider rate limit, timeout) a localized generic error — provider details to the server log only — and \"Try again\", which answers the already-saved question without duplicating it, and is still offered for an unanswered question after reload; (7) replies render as Markdown; an empty conversation shows a localized greeting; no attachments, feedback or suggestions; (8) limits, each with its own localized message: message length max CHAT_MAX_MESSAGE_LENGTH (default 4000), empty messages cannot be sent, enforced in UI and server; rate max CHAT_RATE_LIMIT_PER_MINUTE requests per user per minute (default 10) → 429 \"wait a moment\"; cost CHAT_DAILY_TOKEN_BUDGET input+output tokens per user per rolling 24 h (default 500000) → 429 \"daily limit reached\", a soft budget checked before the call; the model is not called when either limit is hit; context: the model receives only the last CHAT_HISTORY_LIMIT messages (default 50) while the database and UI keep the whole conversation; (9) all copy through next-intl in en and uk. AGENT: system prompt in the repository — Atmo's support assistant for solar energy, answers general questions about solar systems, has no access to customer data, contracts or systems and says so plainly, never invents facts about a customer's system, contract or entitlements, includes the current date; replies in the language of the user's latest message, else the page locale, which the client sends with each request and the server validates; no tools. DATA: Conversation (id, owner userId, title, createdAt, updatedAt driving list order); Message (server-generated id, conversationId, role USER | ASSISTANT, parts — the AI SDK UIMessage parts as JSONB — createdAt; for assistant messages model id, inputTokens, outputTokens, finishReason recording stop/interruption and errors); every query scoped to the owner; rate and token limits computed from Message, no new storage. CONFIGURATION: Google Generative AI API key (required, fail fast), the four CHAT_* limits (optional, defaults as stated), AI_FAKE_MODEL replacing the real model with a deterministic fake for e2e and UI work without a key; Config refuses to start with AI_FAKE_MODEL enabled when APP_ENV=production. TESTING: test-first Vitest for owner scoping incl. cross-user → not found, creation on first message, title derivation, history trimming, both limits incl. boundaries, retry without duplication, message validation, Config incl. the production guard, with the AI SDK mock model; Playwright on a production build with the fake model for streaming send/receive, history after reload, list/switch/new, delete, Stop keeps partial, error then Try again, rate-limit message, another user's URL → not found, locale switching. TECHNICAL DIRECTION (decided in design review, every API to be verified against node_modules): packages ai, @ai-sdk/react, @assistant-ui/react, @assistant-ui/react-ai-sdk, @assistant-ui/react-markdown, assistant-ui registry components in Base UI variants via the shadcn CLI, plus @ai-sdk/google justified as a new recipient of customer data; a Gemini Flash-Lite class model pinned in code from Google's official list at plan time; the free tier trains on prompts — dev and test data only, paid tier before real customer data; Vercel AI Gateway rejected; the agent defined once in one server module (ToolLoopAgent), so switching provider is that module plus one Config variable and a move to @mastra/core replaces only that module; one POST chat endpoint in the routes module — client sends only the new message, conversationId and locale → session and owner-scoped conversation check → limits → history from the DB → validateUIMessages → user message saved before the call → toUIMessageStreamResponse with server-generated ids → assistant message saved in onFinish → consumeStream() so the reply is saved even if the client disconnects; retry is the regenerate trigger, allowed only when the last stored message is an unanswered user message; server-rendered data for list and history instead of extra GET endpoints; deletion gets its own endpoint. CONSTITUTION CHECK ITEMS FOR THE PLAN: Principle VII (\"responds in the customer's locale\") vs replying in the message's language — interpretation or PATCH amendment; Principles IV/VI — escalation and its e2e deferred, users are staff, escalation ships with the customer-facing chat, and this chat must not be opened to customers before then. OUT OF SCOPE: customers, partners, tenants; escalation and tickets; agent tools; Mastra; regenerate and edit; rename and archive; attachments; feedback; resumable streams; operator view of other users' conversations; LLM-generated titles; showing model reasoning." (Condensed from the full request in the `/speckit-specify` invocation; nothing above adds to or departs from it.)

## Overview

Atmo's main support channel will be an AI assistant that answers the end customers of partner
companies. Those customers, the partners, and the tenant boundary between them do not exist in the
product yet. What does exist is a signed-in area used by our own staff. This feature gives every one
of those staff members a chat with the assistant, and in doing so builds the parts the customer-facing
chat will stand on: how a conversation is started, streamed, stored, limited, and tested.

A person opens Chat from the header, types a question, and watches the answer being written. The
conversation is kept: they can reload, leave, come back tomorrow, and find it exactly as they left it,
listed with their other conversations. They can stop an answer that is going nowhere, copy a useful
one, and delete a conversation they no longer want. When the model is unavailable they are told so in
plain words and can try again without retyping anything.

Every conversation is private to the person who started it. No role — not even the super admin — sees
anyone else's, and the product never reveals whether a conversation it refuses to show exists at all.

The assistant in this feature knows only what any general model knows about solar energy. It has no
tools and no access to any customer's data, and it says so instead of guessing. Because it cannot hand
a conversation to a human yet, it is for staff only: it must not be opened to customers until
escalation exists.

Costs are bounded from the first day: each message has a maximum length, each person a per-minute
request limit and a daily token budget, and the model only ever sees the recent part of a long
conversation.

## Clarifications

### Session 2026-10-04

- Q: When the page is closed or the connection lost while a reply is being written, is the reply
  finished and stored in full, or cut off there? → A: Cut off where the connection ended and stored as
  stopped, exactly like Stop (FR-016). The server cannot tell Stop from a closed tab, so one rule covers
  both: history always matches what was seen, no tokens are spent on a reply nobody reads, and a reload
  mid-reply never shows a question as unanswered while its reply is still being written. Accepted cost:
  a brief network drop leaves the reply truncated, and the user continues with a new message. Finishing
  in full on the server was presented and declined: Stop would then need its own signal to the server,
  and a reload mid-reply would invite a second, concurrent reply.
- Q: When the model fails, is the failure stored as a reply, or is nothing stored? → A: Stored as a
  failed reply, holding whatever text arrived before the failure (possibly none), its token use where the
  provider reported it, and a failed outcome. Try again adds a new reply below it; the failed one stays in
  the history with its marker (FR-021, FR-022). This keeps the history as seen, makes every model call
  traceable in our database (Principle VI), and lets the limits, counted from stored messages, include
  failed calls. It widens the design review's retry rule from "the last stored message is an unanswered
  user message" to "the latest question has no completed or stopped reply". Storing nothing, and storing
  only failures that carried text, were presented and declined.
- Q: Principle VII said "the agent responds in the customer's locale", while FR-045 replies in the
  language of the latest message with the page locale as fallback. Interpretation or amendment? → A:
  PATCH amendment, constitution 1.6.0 → 1.6.1: "the agent replies in the language the customer writes
  in, and in the customer's locale when that is unclear". FR-045 now follows the rule as written.
  Recording an interpretation in this spec only, and replying always in the page locale, were presented
  and declined.
- Q: Should the server know that a reply is being written right now, so that a Try again or a new
  message from another tab can be refused? → A: Yes. A reply is stored when it starts, as being written,
  and updated when it ends. While a conversation has a reply being written, a new message and Try again
  are refused with a localized message; one being written for longer than the timeout (FR-017) counts as
  failed, which also covers a server that stopped mid-reply (FR-012, FR-015, FR-022, FR-023). The
  per-minute limit then counts requests still in flight. Not tracking it (allowing a rare second reply)
  and holding a database lock for the reply's duration were presented and declined.
- Q: Should one reply's length be capped, and should a cut reply say so? → A: Capped at 2 048 output
  tokens, a setting fixed in the repository with the model (FR-052). The cap is a hard stop, not
  guidance: the model is not told about it, so a reply that reaches it ends mid-text, and it is stored as
  cut and shown with a localized "reply cut short" marker. The instructions do not ask for brevity: a
  number there would be a second copy of the cap to keep in step. Showing a cut reply as complete,
  relying on the model's own limit, and making the cap configurable were presented and declined.
- Q: The request put showing model reasoning out of scope. Should it be shown after all? → A: Yes,
  reversing that line of the request. Reasoning appears above the reply in a block that is expanded and
  marked as thinking while it arrives, then collapses, marked as reasoning, once the text starts; it is
  stored and shown collapsed after a reload; no duration is shown; and it has its own limit, separate
  from the 2 048-token reply limit (FR-028, FR-053, FR-054). Status only without the text, an always
  expanded block, showing it only live, showing a duration, and sharing the 2 048 tokens were presented
  and declined.
- Q: How should a screen reader announce a reply that arrives in pieces? → A: As assistant-ui's chat
  components announce it; this feature adds no requirement of its own. The plan records what they do.
  Announcing the state changes and the finished reply, and announcing the state only, were presented
  and declined.
- Q: When the daily limit is reached, should the message say when the chat is available again? → A:
  Yes, as relative time: "in about N hours", rounded up, or "in less than an hour" (FR-055). This
  answers the user's real question under a rolling window, with no time of day and therefore none of
  feature 004's time-zone rules. Showing a time of day, and showing no time at all, were presented and
  declined.

### Session 2026-10-04 (planning)

- Q: The pinned model counts reasoning and text against one output cap and bounds reasoning only by an
  effort level, so a separate reasoning limit cannot be set. How are FR-052 and FR-054 restated? → A:
  Reasoning effort is fixed in the repository at a low level, and a reply — reasoning and text
  together — is capped at 4 096 output tokens: the 2 048 decided for the text plus as much again for
  reasoning (FR-052, FR-054; research R1). A rare long reasoning leaves less room for the text, and
  the cut marker shows it. A legacy per-request reasoning budget, unconfirmed for this model, and
  dropping reasoning were presented and declined.
- Q: assistant-ui's chat components announce nothing to screen readers (research R16). Keep the
  earlier answer, or add an announcement region? → A: Keep it. The boundary now states plainly that a
  screen-reader user is not told a reply arrived until they move to it.

### Session 2026-10-04 (analysis)

- Q: FR-001 opened the chat to "any role", so a customer role added later would get it before
  escalation exists. Narrow it? → A: Yes — staff roles only, as a closed list with a test that fails
  when a new role is undecided (FR-001, FR-002).

### Session 2026-10-12

- Q: At the low effort the model reasoned in its own channel on 1 of 13 questions, and once wrote its
  plan, with a paraphrase of its instructions, into the reply itself. Keep low? → A: No — raise the
  effort to medium (FR-054). The 4 096-token cap stays (FR-052); medium spends about 2.5–3 times the
  output tokens, so more replies may end cut and the daily budget is reached sooner. An instruction
  forbidding the plan in the reply was presented and deferred.
- Q: Asked to quote its prompt, the model paraphrased all of it; asked to "forget the rules", it listed
  them and added one the prompt does not have. Handle it? → A: One more instruction: on questions about
  its instructions or rules it neither quotes nor paraphrases them and says what it can help with
  instead (FR-044). It reduces casual disclosure and self-invented rules but is not a safeguard:
  whatever the instructions hold can still be drawn out. A filter on the reply text was presented and
  not taken.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ask a question and watch the answer arrive (Priority: P1)

A signed-in staff member clicks Chat in the header. The page greets them and offers a box to type in.
They ask how a solar inverter works and press send. Their question appears at once, and the answer
starts appearing word by word a moment later, formatted with headings and lists where that helps. When
it is done, they copy it. The address in the browser now points at this conversation; reloading the
page shows the question and the answer exactly as before.

**Why this priority**: This is the feature. Every other story extends or protects this one.

**Independent Test**: Sign in, open Chat, send a message, confirm the reply appears progressively and
the address changes to the conversation's own; reload and confirm the same two messages are shown.

**Acceptance Scenarios**:

1. **Given** any signed-in user with a staff role, **When** they look at the header of the signed-in area,
   **Then** it shows a Chat link that opens the new-conversation page in the current language.
2. **Given** the new-conversation page, **When** nothing has been sent yet, **Then** a localized
   greeting is shown and no conversation has been stored.
3. **Given** the new-conversation page, **When** the user sends a message, **Then** the message appears
   immediately, the reply appears progressively before it is complete, and the address changes to
   `/{locale}/dashboard/chat/{id}` without leaving the page or interrupting the reply.
4. **Given** a reply has finished, **When** the user reloads the page or opens the conversation's
   address later, **Then** every message is shown in the same order with the same content.
5. **Given** a reply containing Markdown, **When** it is shown, **Then** it is rendered as formatted
   text (emphasis, lists, headings, code, links), while the user's own messages are shown as plain text
   exactly as typed.
6. **Given** a finished reply, **When** the user activates its Copy action, **Then** its text is placed
   on the clipboard and the action visibly confirms it.
7. **Given** an existing conversation, **When** the user sends another message, **Then** the reply
   takes the earlier messages into account and the conversation moves to the top of the list.
8. **Given** a reply is being written, **When** the user looks at the message box, **Then** it cannot
   send another message until the reply ends.
9. **Given** the model thinks before answering, **When** its reasoning arrives, **Then** an expanded
   block marked as thinking shows it progressively; **when** the reply's text starts, the block collapses
   and is marked as reasoning, and the user can expand it again.
10. **Given** a finished reply with reasoning, **When** the page is reloaded, **Then** the reasoning is
    shown in a collapsed block above the reply, with the same content.

---

### User Story 2 - A conversation is visible only to its owner (Priority: P1)

Two staff members both use the chat. Neither can open, continue, retry in, or delete the other's
conversations, even with the exact address. The product answers such an attempt exactly as it answers
an address that never existed.

**Why this priority**: Conversations will hold customer questions. Isolation that is added later is
isolation that was missing; it ships with the first stored conversation.

**Independent Test**: As user A, start a conversation and note its address; sign in as user B, open
that address, and confirm the not-found page; call each chat endpoint with A's conversation as B and
confirm the same not-found response as for a random identifier.

**Acceptance Scenarios**:

1. **Given** user B and a conversation owned by user A, **When** B opens its address, **Then** B sees
   the product's not-found page, identical to the one for an address that never existed.
2. **Given** user B, **When** B sends a message, tries again, or deletes, naming A's conversation,
   **Then** the response is a not-found response identical in status and body to the one for a
   non-existent conversation, nothing is stored or deleted, and the model is not called.
3. **Given** the super admin, **When** they open another user's conversation, **Then** they get the same
   not-found result — ownership, not role, decides.
4. **Given** user B's conversation list, **When** it is shown, **Then** it contains only B's own
   conversations.
5. **Given** an address whose conversation identifier is malformed, **When** it is opened or sent to an
   endpoint, **Then** the result is the same not-found result.

---

### User Story 3 - Find, start, and delete conversations (Priority: P2)

A staff member has used the chat all week. A sidebar lists their conversations by the first question
they asked, most recently active on top. They open last Tuesday's, then start a fresh one, then delete
an old one they no longer need after confirming they really mean it.

**Why this priority**: Persistence without a way to get back to a conversation is half a feature, and
deletion is how a person removes what they no longer want stored.

**Independent Test**: Create three conversations, confirm their order and titles, open the oldest and
send a message, confirm it moves to the top; start a new one from the list; delete one, confirm it is
gone from the list and its address is not found.

**Acceptance Scenarios**:

1. **Given** a user with several conversations, **When** any chat page is shown, **Then** the sidebar
   lists all of them, most recently active first, each titled by its first message, and marks the open
   one.
2. **Given** a first message longer than the title limit, **When** its conversation is listed,
   **Then** the title is that message cut at the limit and marked as shortened.
3. **Given** the sidebar, **When** the user activates New chat, **Then** the new-conversation page opens
   with its greeting and nothing is stored.
4. **Given** a new conversation's first message has been sent, **When** the reply ends, **Then** the
   conversation appears at the top of the sidebar without a reload.
5. **Given** the user chooses Delete on a conversation, **When** the confirmation dialog appears and they
   cancel, **Then** nothing changes.
6. **Given** the confirmation dialog, **When** they confirm, **Then** the conversation and all its
   messages are permanently removed, it disappears from the sidebar, and its address shows the
   not-found page.
7. **Given** the conversation being deleted is the one open, **When** the deletion completes, **Then**
   the user is taken to the new-conversation page.
8. **Given** a narrow screen, **When** a chat page is shown, **Then** the conversation list is still
   reachable.

---

### User Story 4 - Stop an answer that is going nowhere (Priority: P2)

The assistant has misread the question and is writing a long answer about the wrong thing. The staff
member presses Stop. Writing ends at once; what was written stays on screen, marked as stopped, and is
still there, still marked, after a reload. They rephrase and send a new question.

**Why this priority**: Stopping saves the person's time and our tokens. It also forces the stored
history to match what was seen even when a reply did not end on its own.

**Independent Test**: With the test model writing slowly, send a message, press Stop part-way, confirm
the partial text stays with a stopped marker; reload and confirm the same partial text and marker.

**Acceptance Scenarios**:

1. **Given** a reply being written, **When** the user presses Stop, **Then** writing ends, the text
   that had arrived stays, and the reply is marked as stopped in the current language.
2. **Given** a stopped reply, **When** the page is reloaded, **Then** the same partial text and the
   same marker are shown — no more text than the user saw.
3. **Given** a stopped reply, **When** the user looks at it, **Then** it offers Copy but not Try again,
   and the user can send a new message.

---

### User Story 5 - Recover when the model fails (Priority: P2)

The model provider is down. The staff member's question is shown, and below it a short message in
their language says the assistant could not answer, with a Try again action. They try again a minute
later and get the answer under the same question — the question is not repeated. If they had closed
the tab instead, the unanswered question would still offer Try again when they came back.

**Why this priority**: Providers fail. Without this, a failure means retyping the question and
duplicated history.

**Independent Test**: With the test model set to fail, send a message, confirm the localized error and
Try again; let the next attempt succeed, confirm the reply appears and the question is stored once.
Repeat with a reload between the failure and Try again.

**Acceptance Scenarios**:

1. **Given** the model is unavailable, rate-limited by its provider, or times out, **When** the user
   sends a message, **Then** the message is kept, a localized generic error is shown with a Try again
   action, and no provider detail (name, status, error text) reaches the browser; the detail is written
   to the server log.
2. **Given** a question whose latest reply failed, **When** the user activates Try again and the model
   answers, **Then** the new reply appears below the failed one, the failed reply keeps its marker, and
   the question is stored exactly once.
3. **Given** a question whose latest reply failed, **When** the user reloads the page, **Then** the
   question, the failed reply with any text that had arrived, and its error marker are shown again, with
   Try again offered.
4. **Given** a question that already has a completed or stopped reply, **When** a Try again request for
   it reaches the server anyway, **Then** it is refused, nothing is stored, and the model is not called.
5. **Given** a failed reply, **When** the user sends a new message instead of trying again, **Then** the
   new message is accepted and answered normally.

---

### User Story 6 - Limits keep cost and abuse bounded (Priority: P2)

A staff member pastes a whole document into the box; the product tells them it is too long before they
can send it. Another sends a burst of questions; the eleventh in a minute is refused with "wait a
moment". A third has used the chat heavily all day; their next request is refused with "daily limit
reached". A conversation that has run to hundreds of messages keeps working, because the model only
ever sees its recent part.

**Why this priority**: The model is billed per token and the endpoint is reachable by any signed-in
session. Limits are what make the feature safe to switch on.

**Independent Test**: Configure small limits; confirm a message at the length limit is accepted and one
character more is refused in the interface and by the endpoint; send requests up to the per-minute limit
and confirm the next is refused with its message; seed a day's usage at the budget and confirm the next
request is refused without the model being called.

**Acceptance Scenarios**:

1. **Given** a message at exactly the maximum length, **When** it is sent, **Then** it is accepted.
2. **Given** a message one character over the maximum, **When** the user types it, **Then** the
   interface shows the localized too-long message and cannot send it; **and when** such a message
   reaches the server directly, it is refused with that message, nothing is stored, and the model is not
   called.
3. **Given** an empty or whitespace-only message, **When** the user tries to send it, **Then** the
   interface does not send it, and the server refuses it if it arrives directly.
4. **Given** a user who has made the per-minute maximum of accepted requests in the last 60 seconds,
   **When** they send another message or try again, **Then** it is refused as too many requests, the
   localized "wait a moment" message is shown, the typed text stays in the box, nothing is stored, and
   the model is not called.
5. **Given** a user whose replies in the last 24 hours used at least the daily budget, **When** they send
   a message or try again, **Then** it is refused as too many requests with the localized "daily limit
   reached" message saying roughly how many hours until the chat is available again, the typed text
   stays in the box, nothing is stored, and the model is not called.
6. **Given** a user whose usage is just under the daily budget, **When** they send a message, **Then** it
   is answered in full even if that reply takes them over the budget.
7. **Given** a conversation longer than the context limit, **When** the user sends a message, **Then**
   the model receives only the most recent messages up to the limit, while the page and the stored
   history keep every message.
8. **Given** two users, **When** one reaches a limit, **Then** the other is unaffected.

---

### User Story 7 - The chat speaks the user's language (Priority: P3)

A staff member uses the product in Ukrainian. Every label, button, marker and error on the chat page is
Ukrainian. They switch to English mid-conversation and stay on the same conversation, now with English
labels. They write to the assistant in Ukrainian and it answers in Ukrainian, whatever the page
language; if a message gives no clear language, it answers in the page's language.

**Why this priority**: Localization is a constitutional rule, and the copy is cheap to get right now and
expensive to retrofit. It ranks last only because the stories above must exist for it to apply to.

**Independent Test**: Open a conversation in each supported language and confirm no untranslated copy;
switch language on a conversation page and confirm the same conversation is shown.

**Acceptance Scenarios**:

1. **Given** the chat page in either supported language, **When** any of its copy is shown — greeting,
   header link, message box, Stop, Copy, Try again, the stopped, cut, failed, and being-written markers,
   the thinking and reasoning labels, every error and limit message, the conversation list, the delete
   dialog, accessible names — **Then** it is in that language.
2. **Given** an open conversation, **When** the user switches language, **Then** they stay on the same
   conversation with its history unchanged and the interface in the new language.
3. **Given** the new-conversation page, **When** the user switches language, **Then** they stay on the
   new-conversation page and nothing is stored.
4. **Given** a request whose page language is not a supported one, **When** it reaches the server,
   **Then** it is refused as invalid, nothing is stored, and the model is not called.

---

### Edge Cases

- **First message fails.** The conversation is created with the user's message and the failed reply;
  it appears in the list and offers Try again. An "empty" conversation in the sense of FR-006 — one with
  no messages — still never exists.
- **The model fails part-way through a reply.** The text that arrived stays, marked as failed (FR-021);
  Try again writes a fresh reply below it.
- **Several failures in a row.** Each attempt is stored as its own failed reply, one below another,
  until one succeeds or the user sends a new message.
- **The server stops mid-reply** (crash or restart). The reply stays stored as being written until the
  timeout has passed (FR-017); from then on it counts and is shown as failed, with Try again offered.
- **First message refused by a limit or as invalid.** Nothing is stored; no conversation is created; the
  user stays on the new-conversation page with their text in the box.
- **Stop before any text arrived.** The reply is stored and shown as stopped with no text. It counts as
  the question's answer.
- **A reply reaches the reply limit** (FR-052). It ends mid-text, marked as cut short; the user can ask
  for the rest in a new message.
- **The user closes the tab, reloads, or loses connection while a reply is being written.** The reply
  ends there and is stored as stopped with the text written so far (FR-016); returning shows it so.
- **Delete while a reply is being written** (another tab). The conversation is deleted; the reply that
  later finishes is not stored and does not bring the conversation back.
- **The same conversation open in two tabs.** The other tab does not update live; a reload shows the
  stored truth, including a reply still being written, shown without its text and marked as being
  written. Sending or trying again from the second tab while the first is receiving a reply is refused
  with a localized message (FR-012, FR-022).
- **Two requests on one conversation at the same moment** (two tabs, two Try agains). Exactly one starts
  a reply; the other is refused (FR-023).
- **Deleted conversation's address** opened afterwards, from history or a bookmark: not found.
- **A deactivated user.** Loses access on their next request, as feature 003 specifies; their
  conversations stay stored and remain invisible to everyone else.
- **Reply contains raw HTML or a script.** It is shown inert; nothing in it runs or loads.
- **Reply contains an image reference.** The image is not fetched.
- **A message of only whitespace and line breaks.** Counts as empty.
- **A message with leading or trailing spaces.** Stored and shown as typed; the title is derived from
  it with whitespace collapsed.
- **Limits change between requests** (new deployment with other values): the next request is judged by
  the new values; stored history is never altered.
- **Concurrent requests from one user** in different conversations. The per-minute limit counts each
  one from the moment its reply starts; the daily budget sees a reply's tokens only when it ends, so
  simultaneous replies can together exceed it (Known Boundaries).
- **The session ends while a chat page is open.** The next send takes the user to sign-in and back,
  as feature 003 specifies for work in progress; the text in the message box is not kept.
- **A reply with no reasoning.** No reasoning block is shown.
- **Stop or a closed page while the model is still thinking.** The reasoning written so far is kept and
  stored with the stopped reply, which may have no text.

## Requirements _(mandatory)_

### Functional Requirements

**Access and ownership**

- **FR-001**: Every signed-in, active user with a staff role — today `ADMIN` or `SUPER_ADMIN`, which
  are all the roles there are — MUST be able to use the chat: a
  new-conversation page at `/{locale}/dashboard/chat` and each existing conversation at
  `/{locale}/dashboard/chat/{id}`. Anonymous visitors are handled as at any protected address
  (feature 003). A role added later gets no chat until a spec grants it: the allowed roles are a closed
  list, and a test fails when a role exists that the list does not decide (_amended during analysis_).
- **FR-002**: The header of the signed-in area MUST show a localized Chat link to the new-conversation
  page for every staff role, placed after Home.
- **FR-003**: A conversation MUST belong to the user who started it. Only that user can see, list,
  continue, try again in, or delete it; no role grants access to another user's conversation.
- **FR-004**: A conversation that does not exist, belongs to another user, or is named by a malformed
  identifier MUST produce one and the same not-found result: the product's not-found page with a 404
  status for a page, and a 404 response with an identical body for an endpoint. The product MUST never
  answer 403 for a conversation, nor reveal by content or status whether it exists.
- **FR-005**: Ownership MUST be enforced wherever conversation data is read, written, or deleted —
  every endpoint called directly, not only through the interface.

**Conversations and messages**

- **FR-006**: A conversation MUST NOT exist without a message. Opening the new-conversation page stores
  nothing; a conversation is stored together with its first message, so that neither exists without the
  other.
- **FR-007**: Once the first message of a new conversation is accepted, the address MUST change to that
  conversation's own without leaving the page or interrupting the reply; reloading it opens the
  conversation.
- **FR-008**: A conversation's title MUST be its first message with runs of whitespace collapsed to one
  space and ends trimmed, cut at 80 characters and marked as shortened when longer. It never changes.
- **FR-009**: History MUST be append-only: a sent message cannot be edited; a reply cannot be
  regenerated, edited, or removed on its own. The only removal is deleting a whole conversation.
- **FR-010**: Opening a conversation MUST show every stored message in order, exactly as it was shown
  when it was written — reasoning, and stopped, cut, and failed replies with their markers, included.
- **FR-011**: Every message's identifier MUST be assigned by the server; a client cannot choose one.
- **FR-012**: A new message MUST be accepted only when the conversation's latest reply has ended —
  completed, stopped, cut, or failed. While a reply is being written, a new message is refused with a
  localized message. This keeps questions and replies alternating.

**Writing a reply**

- **FR-013**: A reply MUST appear progressively while it is being written, not only once complete.
  While it is being written, the message box cannot send and Stop is offered.
- **FR-014**: The user's message MUST be stored before the model is asked, so it survives any failure of
  the reply.
- **FR-015**: Each reply MUST be stored when it starts, as being written, and updated when it ends with
  the model that produced it, the input and output tokens it used as the provider reported them, and how
  it ended: completed, stopped, cut at the reply limit (FR-052), or failed. A reply still being written
  once the timeout (FR-017) has passed counts and is shown as failed.
- **FR-016**: When the page is closed or reloaded, or the connection lost, while a reply is being
  written, the reply MUST end there as if Stop had been pressed: the model stops writing, and the text
  written so far is stored and shown as stopped (FR-018).
- **FR-017**: A model call that has not finished within 60 seconds of the request MUST end as a failure
  (FR-020).
- **FR-052**: A reply — its reasoning and its text together — MUST NOT exceed 4 096 output tokens, a
  setting fixed in the repository alongside the model (2 048 for the text and as much again for
  reasoning, amended during planning). A reply that reaches the limit ends there,
  is stored as cut, and is shown with a localized "reply cut short" marker, the same after a reload.
  Like a stopped reply, it counts as the question's answer: it offers Copy, not Try again.

**Stop**

- **FR-018**: Stop MUST end the reply: the model stops writing, the reasoning and text that had arrived
  are kept and stored, and the reply is shown marked as stopped, the same after a reload.
- **FR-019**: A stopped reply MUST count as the question's answer: it offers Copy, not Try again, and
  the user continues by sending a new message.

**Failure and Try again**

- **FR-020**: When the model fails — provider unavailable, the provider's own rate limit, timeout, or any
  other error — the user MUST see one localized generic error. No provider name, status, or error text
  may reach the browser; the details MUST be written to the server log.
- **FR-021**: A failure MUST be stored as a failed reply to the question: the text that arrived before
  it (possibly none), its token use where the provider reported it, and a failed outcome. It is shown
  with a localized failed marker, now and after a reload, and stays in the history after a later
  attempt succeeds.
- **FR-022**: Try again MUST answer the latest question without storing it again, adding a new reply
  below any failed ones. It is offered only on the latest question, only while that question's latest
  reply has failed, and it remains offered after a reload. A Try again request in any other state —
  including while a reply is being written — MUST be refused with a localized message, nothing stored,
  and the model not called.
- **FR-023**: A conversation MUST have at most one reply being written at any moment, including when two
  requests for it arrive at once: exactly one starts a reply and the other is refused. As a result, a
  question never has more than one completed or stopped reply.

**Display**

- **FR-024**: Replies MUST be rendered as Markdown. Raw HTML in a reply MUST NOT be interpreted, no
  script in it may run, and no embedded content (such as an image) may be fetched.
- **FR-025**: The user's own messages MUST be shown as plain text exactly as typed, line breaks kept.
- **FR-026**: Each reply MUST offer a Copy action that puts its text — not its reasoning — on the
  clipboard and visibly confirms it.
- **FR-027**: The new-conversation page MUST show a localized greeting. There are no suggested prompts,
  attachments, or feedback controls.
- **FR-028**: When the model reasons before answering, its reasoning MUST be shown above the reply in a
  block that can be collapsed and expanded: expanded and marked as thinking (localized) while reasoning
  arrives, progressively; collapsed and marked as reasoning (localized) once the reply's text starts or
  the reply ends. No duration is shown.
- **FR-053**: Reasoning MUST be stored with its reply and shown after a reload in a collapsed block with
  the same content (FR-010). Deleting the conversation deletes it.
- **FR-054**: The model's reasoning effort MUST be fixed in the repository alongside the model, at a
  medium level. _Amended during planning:_ the model bounds reasoning only by this level, not by a
  separate token limit, so reasoning and text share FR-052's limit. _Amended 2026-10-12:_ low → medium,
  after low left most replies without reasoning and once put the model's plan into the reply.

**Conversation list**

- **FR-029**: Every chat page MUST show a list of the user's own conversations, by title, ordered by
  latest activity (the most recently stored message) with the most recent first, the open one marked.
  The list shows all of them; there is no search, filter, or paging.
- **FR-030**: The list MUST offer a New chat action that opens the new-conversation page.
- **FR-031**: A newly created conversation MUST appear in the list, and a continued one move to the top,
  by the time its reply ends, without a reload.
- **FR-032**: Each listed conversation MUST offer Delete behind a localized confirmation dialog stating
  that deletion is permanent. Confirming removes the conversation and all its messages for good; it
  leaves the list, and its address becomes not found. Cancelling changes nothing. Deleting the open
  conversation takes the user to the new-conversation page.
- **FR-033**: A reply still being written when its conversation is deleted MUST NOT be stored and MUST
  NOT bring the conversation back.
- **FR-034**: On narrow screens the conversation list MUST remain reachable.
- **FR-035**: Conversations cannot be renamed or archived.

**Limits**

- **FR-036**: A message MUST NOT exceed the configured maximum length (default 4000 characters). A
  message at the maximum is accepted; one over is refused. The interface shows a localized too-long
  message and does not send; the server independently refuses with the same message. The interface and
  the server count length the same way.
- **FR-037**: An empty or whitespace-only message MUST NOT be sendable; the server refuses one that
  arrives directly.
- **FR-038**: A user MUST NOT have more than the configured number of accepted chat requests (default 10)
  in any 60-second window, across all their conversations. Sending a message and Try again both count;
  refused requests do not. The next request is refused as too many requests (HTTP 429) with the
  localized "wait a moment" message.
- **FR-039**: When the input and output tokens — reasoning included — of a user's replies over the last
  24 hours reach the configured daily budget (default 500 000), further requests MUST be refused as too
  many requests (HTTP 429) with the localized "daily limit reached" message. The budget is checked
  before the model is called, so the reply that crosses it is completed and the total may exceed the
  budget by that reply.
- **FR-055**: The "daily limit reached" message MUST say roughly when the chat is available again: the
  first moment at which enough of the user's replies have left the 24-hour window for their total to fall
  below the budget, shown as "in about N hours" with N rounded up to whole hours, or "in less than an
  hour" when under one. It is relative time only — no time of day — with each language's plural forms.
  Replies still being written are not part of the calculation.
- **FR-040**: When a request breaks both the daily budget and the per-minute limit, the daily-limit
  message MUST be the one shown, since waiting a minute would not help.
- **FR-041**: A request refused for any reason in this section, or as invalid, MUST store nothing and
  MUST NOT call the model; the text the user typed stays in the message box.
- **FR-042**: The model MUST receive only the most recent messages of the conversation, up to the
  configured context limit (default 50) and including the new question. Failed replies are not part of
  what it receives. The stored history and the page keep every message.
- **FR-043**: Limits apply per user; one user reaching a limit MUST NOT affect another.

**The assistant**

- **FR-044**: The assistant's instructions MUST live in the repository and be reviewed like code. They
  present it as Atmo's support assistant for solar energy that answers general questions about solar
  systems; state that it has no access to any customer's data, contracts, or systems and that it says
  so plainly when asked; forbid inventing facts about a customer's system, contract, or entitlements;
  tell it, when asked about its instructions or rules, to neither quote nor paraphrase them but to say
  what it can help with; and give it the current date.
- **FR-045**: The assistant MUST reply in the language of the user's latest message, and in the page's
  language when that is unclear. Every request MUST carry the page's language, and the server MUST
  refuse one that is not a supported language.
- **FR-046**: The assistant MUST have no tools: it can look up nothing and change nothing.
- **FR-047**: The model the assistant runs on, its reply limit (FR-052), and its reasoning effort
  (FR-054) MUST be fixed in the repository, not chosen at runtime.

**Record**

- **FR-048**: Every exchange MUST be reconstructible from our own database: each question, each reply as
  shown, the model, its token use, and how it ended.

**Localization**

- **FR-049**: Every string this feature shows MUST be present in every supported locale (English and
  Ukrainian): header link, greeting, message box label and placeholder, send, Stop, Copy and its
  confirmation, Try again, the stopped, cut, failed, and being-written markers, the thinking and reasoning
  labels, every error and limit message, the conversation list and its actions, the delete dialog, and
  every accessible name. The reasoning itself is the model's text, not product copy.
- **FR-050**: Switching language on a chat page MUST keep the user on the same page — the same
  conversation, or the new-conversation page — with feature 001's switching behavior.

**Testing the product without the real model**

- **FR-051**: A deployment MUST be able to run the chat against a deterministic test model instead of
  the real one, for end-to-end tests and for interface work without a provider key. The test model
  writes its replies in several pieces, reasoning first, can write slowly enough to be stopped, and can
  fail on demand. It MUST be impossible to enable in production: the application refuses to start.

### Mandated Implementation Constraints

Stated by the requester (design review) and by the constitution rather than derived from the behavior
above. Recorded here, as in features 001 and 003, because they constrain the plan and are deliberate.
Every library API named here is verified against the installed package during planning.

- **MC-001 — Packages.** `ai`, `@ai-sdk/react`, `@assistant-ui/react`, `@assistant-ui/ai-sdk`,
  `@assistant-ui/react-markdown`, and the assistant-ui registry components in their Base UI variants
  through the shadcn CLI — all pre-approved by the constitution. `@ai-sdk/google` is a provider package:
  the plan justifies it as a new recipient of customer data. No other runtime dependency without a
  stated reason. _Amended during planning (research R9):_ `@assistant-ui/react-ai-sdk` is now only a
  re-export of `@assistant-ui/ai-sdk`; constitution 1.6.2 names the latter.
- **MC-002 — Model.** A Gemini Flash-Lite class model, its exact identifier pinned in code from Google's
  official model list at plan time (FR-047) — `gemini-3.5-flash-lite`, the current stable one (research
  R1). Vercel AI Gateway was considered and rejected: it adds a
  data recipient for little gain, since the model lives in one module anyway.
- **MC-003 — One agent module.** The agent — model, instructions, settings, and later its tools — is
  defined once in a single server module as a `ToolLoopAgent`. Switching provider changes that module
  and one Config variable. A later move to `@mastra/core` replaces only that module; any memory Mastra
  keeps sits alongside our tables and is reached by deletion (Principle VI).
- **MC-004 — One chat endpoint.** One POST endpoint, defined in the routes module. The client sends only
  the new message, the conversation identifier, and the page locale — never the history. The server:
  resolves the session → loads the conversation scoped to the owner → checks the limits → loads the
  history from the database → validates it with `validateUIMessages` → stores the user message → streams
  with `toUIMessageStreamResponse`, message identifiers generated on the server → stores the reply in
  `onFinish` → `consumeStream()` so the reply is stored even if the client disconnects. _Amended during
  planning (research R3):_ in `ai` 7 the agent's stream is answered with `createAgentUIStreamResponse`,
  which validates the messages itself and takes `onEnd` (`onFinish` and the result's
  `toUIMessageStreamResponse` are deprecated), with `consumeStream` as its `consumeSseStream`. _Amended by
  clarification (2026-10-04):_ a disconnect ends the model call like Stop (FR-016), so `consumeStream()`
  guarantees that the partial reply is stored, not that it is finished; a failure is stored as a reply
  too (FR-021). The reply is stored as being written before the model is called and updated in
  `onFinish` (FR-015), where the design review stored it only in `onFinish`. Try again is the client's
  regenerate trigger against the same endpoint, accepted only under FR-022 — changed from the design
  review's "the last stored message is an unanswered user message" to "the latest reply has failed".
- **MC-005 — Reads and deletion.** The conversation list and a conversation's history are rendered on
  the server through the data layer, not served by extra GET endpoints. Deletion has its own endpoint in
  the routes module.
- **MC-006 — Data.** Conversation: identifier, owner, title, created and updated moments (updated drives
  the list order). Message: server-generated identifier, conversation, role (USER or ASSISTANT), the AI
  SDK `UIMessage` parts stored as JSONB (reasoning parts included, by clarification 2026-10-04), created
  moment; for assistant messages also the model identifier, input tokens, output tokens, and finish reason, which records stop, interruption, and
  errors — and, by clarification (2026-10-04), that the reply is still being written (FR-015). Every
  data-layer query is scoped to the owner. The per-minute and daily limits are computed from
  stored messages (a count and a sum over the user's messages in the window); no new storage is added
  for them. Committed Prisma migration.
- **MC-007 — Configuration.** Through the Config module and documented in `.env.example`: the Google
  Generative AI API key, as `GOOGLE_GENERATIVE_AI_API_KEY` (research R14); `CHAT_MAX_MESSAGE_LENGTH`
  (default 4000), `CHAT_RATE_LIMIT_PER_MINUTE` (default 10), `CHAT_DAILY_TOKEN_BUDGET` (default 500000), `CHAT_HISTORY_LIMIT` (default 50), each an
  optional positive integer; and `AI_FAKE_MODEL`, which selects the test model of FR-051. Config refuses
  to start when `AI_FAKE_MODEL` is enabled and `APP_ENV` is `production`. The key is required — missing,
  the application fails at startup naming it — except while `AI_FAKE_MODEL` is enabled (Assumptions).
- **MC-008 — Test regimes.** Test-first (Vitest, model calls through the AI SDK mock model): owner
  scoping including cross-user → not found; conversation creation on the first message; title
  derivation; history trimming; the per-minute and daily-token limits including their boundaries; Try
  again without duplication; message validation; the time until the daily budget frees up (FR-055),
  including the rounding boundaries; the Config additions including the production guard. FR-055's
  hour count is the product's first real plural, so its catalog keys also give feature 001's plural
  rules (its FR-024) their first test.
  Test-together: UI. Playwright, on a production build with the test model: send and receive with
  streaming; the reasoning block expanding while thinking, collapsing when the text starts, and staying
  collapsed after reload; history after reload; list, switch, and new conversation; delete; Stop keeps
  the partial reply; error then Try again; the rate-limit message (a small limit set through the
  environment); another user's conversation address → not found; locale switching on the chat page.

### Known Boundaries

Accepted limitations, recorded so they are found here rather than discovered later.

- **No path to a human.** Principle VI requires one and Principle IV requires its end-to-end test.
  Escalation and its test ship with the customer-facing chat. The people using this chat are our own
  staff, who have other ways to reach a human. **This chat MUST NOT be opened to customers before
  escalation exists.**
- **Free-tier provider data use.** Gemini's free tier uses prompts for training. It may carry
  development and test data only; the paid tier is required before any real customer data is entered,
  and staff must not paste customer personal data into the chat until then.
- **Soft daily budget.** Checked before each call, so the reply that crosses the budget is completed in
  full (FR-039) — at most 4 096 output tokens plus its input (FR-052, FR-042).
- **Deleting a conversation also deletes its usage.** Limits are computed from stored messages, so
  deleting conversations lowers the counts they are judged by, and a user can reset their own daily
  budget that way. Accepted for staff, as the request keeps limits free of new storage; the
  customer-facing chat needs a usage record that survives deletion. _Added during planning._
- **Provider terms beyond the free tier.** Google allows only paid use of the API for people in the
  European Economic Area, Switzerland, or the United Kingdom, which the customer-facing chat will have to
  meet in any case (research R18). _Added during planning._
- **Reasoning is a summary.** The provider returns a summary of the model's reasoning, not all of it;
  its language is the model's choice, and it is not checked for accuracy. Thinking also costs tokens
  and delays the reply's first words.
- **Daily budget under concurrency.** A reply's tokens are known only when it ends, so replies being
  written at the same moment in different conversations can all pass the daily check and together
  exceed the budget by their size. The per-minute limit has no such gap, since a reply is stored when it
  starts (FR-015). With a handful of staff users this is accepted over a separate reservation.
- **No live sync between tabs.** A conversation open in two tabs does not update in the other; a reload
  shows the stored truth.
- **No resumable streams.** A reload, a closed tab, or a dropped connection ends the reply in progress
  (FR-016); even a brief network drop leaves it truncated, and the user continues with a new message.
- **Reply language is the model's judgment.** FR-045 is an instruction to the model, not a guarantee;
  the end-to-end suite cannot assert it, because it runs on the test model.
- **General answers can be wrong.** The assistant has no tools and no knowledge of any customer's
  installation; FR-044 tells it to say so, but its general statements about solar energy are not
  verified.
- **Screen readers are not told a reply arrived.** assistant-ui's chat components announce nothing
  while a reply arrives or when it ends (research R16), and this feature adds no announcement of its
  own. A screen-reader user finds the reply by moving to it.
- **No retention rule.** Conversations are kept until their owner deletes them. A deactivated user's
  conversations stay stored and invisible to everyone.

### Key Entities

- **Conversation**: One exchange between one user and the assistant. Belongs to exactly one user, who
  alone can see it. Has a title fixed from its first message, the moment it was created, and the moment
  of its latest message, which orders the list. Never exists without at least one message. Deleting it
  deletes its messages.
- **Message**: One turn in a conversation — either the user's question or the assistant's reply — with
  its content as shown — for a reply, its reasoning too — and the moment it was stored. A reply also
  records the model that wrote it, the input and output tokens it used, and how it ended — or that it is
  still being written. A reply is completed once, when it ends; after that, no message ever changes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In every end-to-end run, the first part of a reply — its reasoning or its text — is
  visible on screen before the reply is complete.
- **SC-002**: With the production model under normal provider conditions, the first sign of a reply —
  the thinking block or the first words — appears within 3 seconds of sending (checked by hand at
  review).
- **SC-003**: After a reload, 100% of a conversation's messages are shown with the same content, order,
  and markers as before it.
- **SC-004**: For every chat page and endpoint, naming another user's conversation produces a response
  identical in status and body to naming one that does not exist — zero exceptions, the super admin
  included.
- **SC-005**: Zero conversations without messages are ever stored, across every tested path including
  refused and failed first messages.
- **SC-006**: Zero questions are stored twice, across every Try again path including a reload in between
  and two simultaneous attempts.
- **SC-007**: At each limit's boundary the outcome is exact: a message of exactly the maximum length is
  accepted and one character longer is refused; the configured number of requests in a minute is
  accepted and the next refused.
- **SC-008**: The model is called zero times for a request refused by a limit, by validation, or by
  ownership.
- **SC-009**: Zero client responses contain provider error details.
- **SC-010**: After a conversation is deleted, zero of its messages remain stored and its address is not
  found.
- **SC-011**: Every string this feature introduces is present in English and Ukrainian — zero gaps.
- **SC-012**: A signed-in user can go from the header link to reading a reply to their first question
  without any instruction, in under 30 seconds with the test model.

## Assumptions

- **Provider key and the test model.** The request makes the key required and fail-fast, and also makes
  the test model usable "without a key". Both hold if the key is required unless the test model is
  enabled. Since the test model is refused in production, production always requires the key.
- **Numbers chosen.** Title cut at 80 characters; a model call times out after 60 seconds (FR-017). Both
  are product rules in code, not configuration.
- **Characters** are counted the same way in the interface and on the server; the plan chooses the
  unit.
- **"Requests" for the per-minute limit** are accepted sends and accepted Try agains. Refused requests are
  free, so a user who hits a limit is not pushed further into it by retrying.
- **The rolling 24 hours** are the 24 hours before the request, not a calendar day.
- **Copy** copies the reply's text as written, Markdown included.
- **Sending** uses the common chat convention: Enter sends, Shift+Enter starts a new line.
- **No timestamps** are shown on messages or in the list; titles only. This keeps feature 004's
  time-zone rules out of the feature.
- **The current date** given to the assistant is the UTC calendar date.
- **Header order**: Home, Chat, Account, Users (the last for the super admin only, as today).
- **Scale.** Staff users number in the tens; a person's conversation list needs no paging, and a
  conversation's full history is loaded when it is opened.
- **4 096 output tokens** (FR-052) leave the text roughly 1 500 English words after low-effort
  reasoning — ample for a support answer, and written well within the 60-second timeout.
- **Supported languages** are those of feature 001: English and Ukrainian.

## Out of Scope

- Customers, partners, and tenants, and the tenant scoping that depends on them.
- Escalation to a human, and tickets.
- Agent tools of any kind.
- Mastra.
- Regenerating a completed reply; editing a sent message.
- Renaming or archiving a conversation; titles written by the model.
- Attachments, message feedback, suggested prompts.
- Resumable streams.
- Any view of another user's conversations, including an operator or super-admin view.
- A retention or automatic-deletion policy.

## Open for Planning

All settled in the plan; see [research.md](./research.md).

- **Principles IV and VI** — escalation and its end-to-end test are recorded as a justified deviation in
  the plan's constitution check.
- **The model** — `gemini-3.5-flash-lite`, medium reasoning effort with summaries, a 4 096-token cap (R1);
  the provider justified as a new data recipient (R17).
- **The provider key's variable name** — `GOOGLE_GENERATIVE_AI_API_KEY`, passed explicitly from Config
  (R14).
- **The test model** — our own small model behind `AI_FAKE_MODEL`, driven by markers in the message
  text (R13).
- **Counting the limits** — a count and a sum over the user's replies, under a lock on the user's row so
  the per-minute limit is exact; a reply left being written past the timeout is rewritten as failed by
  the next request and read as failed until then (R4, R5).
- **The unit of message length** — UTF-16 code units, the unit of the browser's own text length (R12).
- **Model reasoning** — requested as summaries; earlier replies' reasoning is not sent back (R1, R6).
- **Screen-reader behavior of the chat components** — none (R16).
