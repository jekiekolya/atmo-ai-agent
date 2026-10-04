# Phase 0 Research: AI Chat for Signed-In Users

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-04

None of the AI or chat packages are installed yet. Every claim about them was read from the exact
versions this plan pins, unpacked into a scratch directory outside the repository with `npm pack`:
`ai` 7.0.127, `@ai-sdk/react` 4.0.130, `@ai-sdk/google` 4.0.87, `@assistant-ui/react` 0.15.23,
`@assistant-ui/react-ai-sdk` 1.4.14 → `@assistant-ui/ai-sdk` 0.0.9, `@assistant-ui/core` 0.3.22,
`@assistant-ui/react-markdown` 0.14.18 (→ `react-markdown` 10.1.0). Paths below are relative to each
package's root. Next.js claims come from the installed 16.3.0 docs in `node_modules/next/dist/docs/`
(cited from `01-app/`) and its source. Gemini facts come from Google's official pages, fetched on
2026-10-04 and cited by URL. The assistant-ui registry was fetched as JSON from
`r.assistant-ui.com`.

Four findings changed the spec before this plan, each marked _amended during planning_ there: the model
has one output cap shared by reasoning and text (R1); `toUIMessageStreamResponse` and `onFinish` are
deprecated in `ai` 7 (R3); `@assistant-ui/react-ai-sdk` is only a re-export now (R9); and the
components announce nothing to screen readers (R16). One finding forced a structural change the spec
did not foresee: a `loading.tsx` above a page turns its `notFound()` into a 200 (R7).

---

## R1. The model: `gemini-3.5-flash-lite`, low reasoning effort, one 4 096-token cap

**Decision**: `google("gemini-3.5-flash-lite")` with
`providerOptions.google.thinkingConfig = { thinkingLevel: "low", includeThoughts: true }` and
`maxOutputTokens: 4096`. No `temperature`, `topP`, or `topK`. Earlier replies' reasoning is not sent
back as context (R6).

**Rationale**:

- It is the current stable Flash-Lite, generally available since 2026-07-21, with no shutdown date
  announced (https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite,
  https://ai.google.dev/gemini-api/docs/deprecations). `gemini-3.1-flash-lite` shuts down on
  2027-05-07 and is not in the provider's id union; `gemini-2.5-flash-lite` is closed to new projects.
  `gemini-flash-lite-latest` is hot-swapped with every release, previews included, so it is not
  pinned (models page, "Model version name patterns").
- The id is in `GoogleModelId` (`@ai-sdk/google` `dist/index.d.ts:16`).
- Thinking on this model is on at level `minimal` by default, which "does not guarantee that thinking
  is off" and usually yields no summary. `low` is "best for simple instruction following, chat"
  (https://ai.google.dev/gemini-api/docs/thinking). `thinkingBudget` is legacy for Gemini 3, has no
  published range for 3.x, and sending it together with `thinkingLevel` is a 400
  (https://ai.google.dev/gemini-api/docs/gemini-3).
- `includeThoughts: true` must be set explicitly. The SDK's top-level `reasoning` setting maps to
  `thinkingLevel` but never sets it (`@ai-sdk/google` `dist/index.js:2113-2163`; `ai`
  `docs/03-ai-sdk-core/26-reasoning.mdx:153-162`). Thoughts arrive as `reasoning-start`,
  `reasoning-delta`, `reasoning-end` stream parts (`@ai-sdk/google` `dist/index.js:1862-1890`).
- **`maxOutputTokens` includes thinking**: "sets the maximum number of tokens a response can generate,
  including thought tokens" (thinking docs). The provider forwards it unchanged
  (`dist/index.js:1518`). Hence the spec amendment: 2 048 for the text, as much again for reasoning,
  one cap of 4 096 (FR-052, FR-054).
- Thinking is billed as output, and `usage.outputTokens` already includes it
  (`outputTokens.total = candidatesTokenCount + thoughtsTokenCount`, `dist/index.js:213-216`), so the
  daily budget counts it without extra work (FR-039).
- `temperature`, `top_p`, and `top_k` are deprecated for this model
  (https://ai.google.dev/gemini-api/docs/changelog, 2026-07-21).
- `MAX_TOKENS` maps to finish reason `length` (`dist/index.js:1350-1363`), which is how a cut reply is
  recognised (FR-052).

**Alternatives considered**: a legacy `thinkingBudget` of 1 024 to keep reasoning off the text's 2 048 —
unconfirmed for 3.x and possibly removed with a model update; the user chose the documented level.
`gemini-3.1-flash-lite` — cheaper ($0.25 / $1.50 per 1M against $0.30 / $2.50) but shuts down in seven
months. Medium effort — more reliable summaries, at more latency and output cost; revisit if `low`
leaves most replies without a reasoning block.

## R2. One agent module: a `ToolLoopAgent` with per-call options for date and locale

**Decision**: `src/server/chat/agent.ts` exports `getChatAgent()`, which builds one `ToolLoopAgent` per
process: the model (R1, or the test model of R13), `maxOutputTokens`, `providerOptions`, an
`instructions` placeholder, a `callOptionsSchema` of `{ locale, today }`, and `prepareCall` that
returns `{ ...rest, instructions: buildInstructions(options) }`. The instructions text lives in
`src/server/chat/instructions.ts` (R15).

**Rationale**: `instructions` is static — `string | SystemModelMessage | SystemModelMessage[]`
(`ai` `dist/index.d.ts:816`) — and `AgentCallParameters` has no `system` field (`d.ts:4981-5087`). The
documented way to vary it per request is `callOptionsSchema` plus `prepareCall`
(`d.ts:5628-5646`; `docs/03-agents/05-configuring-call-options.mdx:38-64`). With no tools the loop stops
after one step; the default `stopWhen` of 20 steps (`d.ts:5466`) never matters. Swapping the provider or
moving to Mastra touches this module and the key variable only (MC-003).

**Alternatives considered**: `streamText` directly — loses the agent shape the request fixed for later
tools. A module-level agent built at import — would load the test model's code (R13) in every
process; the getter builds it on first use.

## R3. The endpoint answers with `createAgentUIStreamResponse`

**Decision**: `POST /api/chat` resolves the turn (R4), then returns

```ts
createAgentUIStreamResponse({
  agent,
  uiMessages: history,
  options: { locale, today },
  abortSignal: request.signal,
  timeout: REPLY_TIMEOUT_MS, // 60 000, FR-017
  generateMessageId: () => replyId, // the row inserted in R4
  sendReasoning: true, // the default, stated
  messageMetadata,
  onError,
  onEnd,
  consumeSseStream: consumeStream,
});
```

The stream plumbing lives in `src/server/chat/respond.ts`, which imports nothing from Next. The route
handler stays thin. `defineRoute` passes the raw `request` to handlers, so the handler can hand over
`request.signal`. That is a one-line addition to `src/lib/http/server/define-route.ts`.

**Rationale**:

- `result.toUIMessageStreamResponse()` and `onFinish` are deprecated in `ai` 7. The agent variant
  validates `uiMessages` itself (the spec's `validateUIMessages` step), converts them, and streams them
  (`dist/index.js:11265-11323`; options `d.ts:5744, 2776-2843`).
- **Message ids.** When the last original message is a user message, `generateMessageId()` names the
  reply (`js:6191-6195, 7422`). The id is written into the `start` chunk, so browser and database share
  it.
- **`onEnd`.** It receives `{ responseMessage, isAborted, isCancelled?, outcome, finishReason? }`, with
  no usage (`d.ts:2690-2726`). Usage and the finish reason are captured in `messageMetadata({ part })`,
  which runs for every part. The `finish` part carries `totalUsage` and `finishReason`; the `abort` part
  carries a `reason` (`d.ts:3205-3214`; `js:7395-7410`).
- **Client abort.** Next aborts `request.signal` when the client disconnects
  (`next/dist/server/web/spec-extension/adapters/next-request.js:44-63`). The docs say nothing on this;
  it was read from source. The model call then emits `abort`, and `onEnd` gets `isAborted: true` with
  the partial message. `consumeSseStream: consumeStream` keeps `onEnd` running after the client is gone
  (`docs/09-troubleshooting/14-stream-abort-handling.mdx:47-81`). This is FR-016's "ends like Stop", not
  a full reply after disconnect.
- **Timeout.** `timeout` is built in, and on expiry it aborts exactly like a signal (`js:2527-2636`).
  `onEnd` does not say which of the two happened, so `respond.ts` reads `request.signal.aborted`: aborted
  means stopped by the client, otherwise it was the timeout (R4's outcome table).
- **Errors.** Errors become `error` parts. `onError` sets the `errorText` the browser receives, which
  defaults to `"An error occurred."` (`js:7341, 7244`). Ours logs the provider error and returns the
  code `model_failed` (FR-020). `onEnd` still runs, but `outcome` can flip from `failed` to `completed`
  when a `finish` part follows (`js:7344-7346`). `respond.ts` therefore keeps its own "an error occurred"
  flag.

**Alternatives considered**: `streamText` + `toUIMessageStream` + `createUIMessageStreamResponse` — the
same mechanics without the agent (R2). Generating after disconnect with `result.consumeStream()` —
declined in the spec's clarifications (FR-016). `after()` for the final write — it runs after the
response closes but does not keep generation alive (`04-functions/after.md:50-54`); on a long-lived
Node server the `onEnd` promise completes anyway, and `consumeStream` is what keeps `onEnd` reachable.

## R4. A reply is a row from its first moment; one transaction starts a turn

**Decision**: `startChatTurn(actor, input, now)` runs one transaction:

1. `SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE` — a `$queryRaw` tagged template.
   It serialises one user's turns, so the per-minute count and the insert cannot interleave.
2. Load the conversation scoped to the owner, or throw `NotFoundError` (FR-004). A missing
   `conversationId` means a new conversation.
3. Mark the user's replies still `IN_PROGRESS` and older than the timeout as `FAILED` (FR-015).
4. Check the turn's state.
   - A send needs the latest reply to have ended, else `reply_in_progress` (FR-012).
   - A Try again needs the latest reply to be `FAILED`, else `nothing_to_retry`, or `reply_in_progress`
     while one is being written (FR-022).
5. Check the limits, daily first (FR-040, R5).
6. Insert:
   - a send to a new conversation inserts the conversation and the user message;
   - a send to an existing conversation inserts the user message;
   - a Try again inserts nothing here.

   Then insert the reply row `IN_PROGRESS` and touch `conversations.updatedAt`.

7. Load the model history (R6).

The partial unique index `messages_one_reply_in_progress` is the final guard of FR-023. A violation
there becomes `reply_in_progress`.

`finishReply(replyId, outcome, parts, usage, model)` updates the row
`WHERE id = $1 AND finishReason = 'IN_PROGRESS'` and touches the conversation. If the conversation was
deleted meanwhile, nothing matches and nothing is written (FR-033).

**Outcome table** (`decideOutcome`, pure, test-first):

| Signal                                                       | Stored as   |
| ------------------------------------------------------------ | ----------- |
| `onError` fired, or finish reason `error` / `content-filter` | `FAILED`    |
| aborted and `request.signal.aborted` (Stop, closed page)     | `STOPPED`   |
| aborted and not `request.signal.aborted` (timeout)           | `FAILED`    |
| finish reason `length`                                       | `CUT`       |
| anything else                                                | `COMPLETED` |

**Rationale**: The reply row exists before the model is called, so:

- the per-minute limit counts requests in flight;
- a second tab sees "being written";
- a crash leaves a row the timeout turns into a failure instead of a question that looks unanswered
  (spec clarification B).

The row lock and the insert share one transaction, which makes the per-minute check exact. That keeps
the spec's claim that only the daily budget has a concurrency gap. Postgres's `FOR UPDATE` is not
expressible in Prisma's query API, so raw SQL is allowed here under the constitution's tagged-template
rule. The stale rewrite and the "read as failed" view (R10) together settle the spec's open question:
both happen.

**Alternatives considered**:

- An advisory lock. It is raw SQL too, with no row to anchor it.
- `SERIALIZABLE` isolation. It retries under contention, and Prisma surfaces that as an error to handle.
- A per-user counter row. That is new storage the request ruled out.

## R5. Limits: a count and a sum over the user's replies, and the time until the budget frees

**Decision**: Both limits run inside R4's transaction, over the user's assistant rows reached through
`conversation.userId`.

- **Daily** (first, FR-040): sum `inputTokens + outputTokens` over replies with
  `createdAt > now − 24 h`; `null` counts as 0. If the sum is ≥ budget, throw
  `RateLimitError("daily_limit_reached", retryAfterSeconds)`.
- **Per minute**: count replies with `createdAt > now − 60 s`. If the count is ≥ limit, throw
  `RateLimitError("rate_limited", retryAfterSeconds)`. The wait is the oldest reply in the window plus
  60 s, minus now.
- **Time until the budget frees** (FR-055): `secondsUntilBudgetFrees(replies, budget, now)` is pure and
  test-first.
  - Walk the window's replies oldest first and take the first one whose leaving drops the total below
    the budget.
  - The answer is its `createdAt + 24 h − now`, rounded up to whole seconds.
  - The browser shows `ceil(seconds / 3600)` hours, or "less than an hour" below 3 600.
- **The 429 response** carries both the header `Retry-After: <seconds>` and
  `{ "error": { "code", "retryAfterSeconds" } }`. The envelope gains that one optional field
  ([contracts/http-api.md](./contracts/http-api.md)).

**Rationale**:

- Every accepted request stores exactly one reply, from its start (R4). Counting replies is therefore
  counting accepted requests, Try agains included (spec Assumptions), with no new storage.
- The body field exists because the browser reads a refusal through the AI SDK's `APICallError`, whose
  message is the response body (`ai` `js:19343, 19363-19367`). Headers are not part of what it
  surfaces.
- **Finding:** deleting a conversation deletes its messages, and with them their usage. A user can lower
  their own counts by deleting conversations. The spec now records this as a Known Boundary.

**Alternatives considered**:

- A usage ledger that survives deletion. It is new storage, and the request ruled it out for this
  feature. The customer-facing chat will need one.
- Reserving an estimated token count at the start of each reply, to close the daily concurrency gap.
  More machinery than a handful of staff users justify.

## R6. What the model sees

**Decision**: `toModelHistory(rows, limit)` is pure and test-first.

- Keep the conversation's messages in order, dropping assistant rows that are `FAILED` or still
  `IN_PROGRESS`.
- Remove `reasoning` parts.
- Keep the last `CHAT_HISTORY_LIMIT` messages, the new question included (FR-042).

**Rationale**:

- `convertToModelMessages` has no option to drop reasoning (`ai` `d.ts:5718-5722`). It would send
  reasoning back to Gemini as `thought: true` parts (`@ai-sdk/google` `js:430-434`), which costs input
  tokens and is no use to a model that thinks afresh each turn.
- Failed replies are not context (FR-042). After a failure followed by a new message, two user turns
  sit next to each other. The live check in [quickstart.md](./quickstart.md) confirms Gemini accepts
  that. If it does not, the fallback is to join consecutive user turns in `toModelHistory`.

## R7. A real 404 needs no `loading.tsx` above the ownership check

**Decision**:

- The ownership check for `/{l}/dashboard/chat/{id}` runs in `chat/[id]/layout.tsx`. A segment's layout
  renders outside its own `loading.tsx`.
- No `loading.tsx` sits above it:
  - the dashboard home moves into a route group, `dashboard/(home)/page.tsx` + `loading.tsx`;
  - the new-conversation page lives in `chat/(new)/`.
- URLs do not change, because groups are not part of the address. `src/lib/routes.test.ts` already
  strips them.
- `src/conventions/loading-boundaries.test.ts` adds `(private)/dashboard` and `(private)/dashboard/chat`
  to its list of folders that must not hold a `loading.tsx`. The e2e test asserts status 404.

**Rationale**: "Next.js will return a `200` HTTP status code for streamed responses" and the body starts
streaming when a Suspense fallback such as `loading.tsx` renders. "If you need a 404 status … ensure the
resource exists before the response body is streamed" (`03-api-reference/03-file-conventions/
not-found.md:13`, `loading.md:101-120`). Today `dashboard/loading.tsx` would wrap the new page, so its
`notFound()` would answer 200. Indistinguishable still, but not FR-004's 404. The user chose the real 404. `notFound()` in the `[id]` layout renders `src/app/[locale]/not-found.tsx`, the product's only
not-found page.

**Alternatives considered**:

- A soft 404 — status 200 plus `noindex`, with FR-004 amended. The user declined it.
- The check in `src/proxy.ts`. The proxy never touches the database (feature 003, FR-032).

## R8. The address changes with `history.replaceState`; the `[id]` page takes over after the reply

**Decision**:

- When the `start` chunk of a new conversation's first reply carries `conversationId` in its metadata,
  the chat client calls `window.history.replaceState(null, "", path)`. `path` comes from
  `getPathname({ href: pathTo(PAGES.chatConversation, { id }), locale })` (FR-007).
- When that reply ends, the client calls `router.replace(path)`. The real `[id]` page renders from the
  database, and the sidebar lists the new conversation (FR-031).
- When a reply ends in an existing conversation, the client calls `router.refresh()`, which reorders the
  sidebar.

**Rationale**:

- `pushState` and `replaceState` "integrate into the Next.js Router" and keep `usePathname` in sync
  without a remount (`01-getting-started/04-linking-and-navigating.md:343-347`). That means the language
  switcher, which builds its links from `usePathname`, keeps the user on the conversation (FR-050).
- `useParams` is not updated, and the history entry keeps the `/chat` route tree
  (`next/dist/client/components/app-router.js:233-298`). The `router.replace` once the stream has ended
  therefore puts the real `[id]` tree into history before anyone can press Back.
- Navigating between `/chat` and `/chat/[id]` always remounts the page, whether through two routes or
  one optional catch-all (`layout-router.js:547-549, 666-688`). That is harmless once the reply has ended
  and the `[id]` page shows the same stored messages.

**Alternatives considered**:

- `router.replace` at the first chunk. It would remount mid-stream and abort the reply.
- `[[...id]]`. It gives the same remounts, needs an optional-segment entry the routes module cannot
  express today, and leaves no place for a layout check that only applies with an id (R7).

## R9. assistant-ui: our own `useChat`, the Base UI registry, and a thread composed from primitives

**Decision**:

- **Packages.** Install `@assistant-ui/react`, `@assistant-ui/ai-sdk`, and `@assistant-ui/react-markdown`.
  `@assistant-ui/react-ai-sdk` 1.4.14 is only `export * from "@assistant-ui/ai-sdk"`
  (`src/index.ts:1`), and its README says new code should depend on `@assistant-ui/ai-sdk` directly.
  Constitution 1.6.2 renames the exemption accordingly.
- **Runtime.**
  `const chat = useChat({ id, messages, transport, messageMetadataSchema, onError, onFinish });
const runtime = useAISDKRuntime(chat);` inside `AssistantRuntimeProvider`.
  - `useChatRuntime` always wraps a thread-list runtime with an in-memory or cloud adapter, overrides
    the chat id, and creates an Assistant Cloud client whenever `NEXT_PUBLIC_ASSISTANT_BASE_URL` is set
    (`@assistant-ui/ai-sdk` `runtime/useChatRuntime.ts:40-54`; `@assistant-ui/core`
    `createCloudThreadListAdapter.ts:33-38, 115-122`). That variable is never defined here.
- **Transport.** `DefaultChatTransport` with `prepareSendMessagesRequest` sends only the new message's
  text, `conversationId`, `locale`, and `trigger` (`ai` `d.ts:6124-6142`). It does not use
  `AssistantChatTransport`, which adds client-side `system`, `tools`, and `config` to the body
  (`transport/AssistantChatTransport.ts:78-106`), and which a server would have to distrust.
- **Registry.**
  - `components.json` gains `"registries": { "@assistant-ui":
"https://r.assistant-ui.com/styles/{style}/{name}.json" }`. The public-index namespace resolves to
    the Radix flavour; a `base-*` style gets the Base UI one (https://www.assistant-ui.com/docs/base-ui.md).
  - Pulled: `markdown-text` and `reasoning`. They bring `tooltip-icon-button`, `use-copy-to-clipboard`,
    `elements-reasoning`, and the shadcn `tooltip` and `collapsible`.
  - The base items import no Radix. `@assistant-ui/react` itself depends on `radix-ui` for internals
    (`ActionBarCopy.tsx:5`). That is a library implementation detail, not a component library we compose.
- **Thread.** Not pulled. `thread` brings attachments, voice input, follow-up suggestions, tool
  displays, feedback, edit, and branch picking — all excluded by the spec — plus `zustand`, `avatar`,
  `textarea`, and `skeleton`. `src/components/chat/chat-thread/` composes `ThreadPrimitive`,
  `MessagePrimitive`, `ComposerPrimitive`, `ActionBarPrimitive` (Copy), and `ErrorPrimitive`, with the
  registry's `thread.aui.tsx` as the reference. CLAUDE.md now says that future chat elements (tools,
  attachments) come from the registry first and plug into this thread.
- **Edits in place.**
  - `markdown-text.tsx`: `img` renders nothing (FR-024).
  - `reasoning.tsx`: labels come from props, translated by the caller (FR-049); there is no duration
    (FR-028); the `tw-shimmer` animation becomes the existing `animate-pulse` from `tw-animate-css`.
  - Every hardcoded English string that survives in a vendored file becomes a prop or a translation.

**Rationale**: This is the least code that keeps our database as the system of record and the server
in control of the prompt. Raw HTML in replies is already inert: `react-markdown` turns `raw` nodes into
text and blanks unsafe URL protocols (`react-markdown` `lib/index.js:360-366, 421-443`).

**Alternatives considered**:

- The registry `thread`, pulled and then stripped. The user declined it: a large diff of deletions, and
  `zustand` added only for attachments that would be removed.
- An assistant-ui thread list with a remote adapter. It means implementing
  list / rename / archive / delete / initialize / generateTitle / fetch for features the spec excludes.
  A server-rendered list of links does the job (FR-029).

## R10. Markers come from stored outcomes; failed attempts fold under their question

**Decision**: Message metadata is `{ conversationId?, outcome?, failedAttempts? }`, validated on both
sides by one zod schema in `src/lib/chat/messages.ts`.

- **On load**, the server maps each stored reply's effective outcome into `metadata.outcome`. A row still
  `IN_PROGRESS` past the timeout reads as `failed`. Each run of failed replies folds into
  `metadata.failedAttempts` of the question it answered: `foldFailedReplies`, pure and test-first.
- **Live**:
  - `messageMetadata` sends `outcome` with the `finish` part (`cut` / `completed` / `failed`) and with the
    `abort` part on a timeout (`failed`).
  - A Stop shows as `incomplete / cancelled` in the runtime's status.
  - A model failure shows as `incomplete / error`.
- **Try again.** Before it calls `regenerate()`, the chat client moves the failed reply into its
  question's `failedAttempts`. The same fold the loader applies keeps the live view identical to the
  reloaded one.
- **Visibility.** Try again appears only on the last message, when its outcome or status is a failure:
  `AuiIf` over `s.message.isLast` and the status or metadata (`@assistant-ui/core`
  `store/scopes/message.ts:12`).

**Rationale**:

- The runtime derives only `running`, `incomplete/cancelled`, `incomplete/error`, and `complete`, and
  only from client memory. `length` is never derived, and after a reload every message looks complete
  (`@assistant-ui/core` `runtime/utils/auto-status.ts:74-105`). The markers must therefore come from
  data we store and send.
- `regenerate()` removes the assistant message it replaces (`ai` `src/ui/chat.ts:487-519`), while the
  spec keeps failed replies visible above the new one (FR-021, FR-022).
- Folding the failed reply into its question gives the same picture on both paths. It needs no fight
  with the SDK's message list.
- Unknown metadata keys arrive under `metadata.custom` (`converters/convertMessage.ts:38-61`).

**Alternatives considered**:

- Re-inserting the failed message after `regenerate()` starts. That races the stream's append logic.
- `sendMessage()` with no message. It continues the last assistant message instead of starting a new one.

## R11. The browser side of a request: sign-in, keep-alive, and refusals

**Decision**:

- **`fetch` wrapper.** The transport's `fetch` option wraps the browser fetch in `chatFetch`
  (`src/lib/http/client/chat-fetch.ts`):
  - a 401 sends the browser to sign-in, exactly as `apiRequest` does;
  - every response triggers the session keep-alive request that `apiRequest` already makes, which
    renews the sliding session (feature 003, R3).
  - The helpers it needs are exported from `api-client.ts` rather than copied.
- **Refusals** (4xx before any stream). `useChat`'s `onError` parses the body (R5) and then:
  - drops the optimistic user message and the empty assistant message the runtime added;
  - puts the text back into the composer;
  - shows the localized message — the too-long, rate-limit, daily-limit with hours, or in-progress text —
    in a `FormAlert` above the composer (FR-041). A refused Try again only shows the message.
- **Deletion** goes through `apiRequest("DELETE", pathTo(API_ROUTES.chatConversation, { id }))`, as the
  user list does.

**Rationale**: `apiRequest` parses JSON, so it cannot read a stream. `DefaultChatTransport` accepts a
custom `fetch` (`ai` `d.ts:6167-6219`). A non-2xx response surfaces as an `APICallError` whose message is
the body text (`js:19343-19367`).

## R12. Message length counts UTF-16 code units

**Decision**: Length is `text.length`, in the browser and on the server, with one shared zod schema
factory `chatRequestSchema(maxLength)` in `src/lib/schemas/chat.ts`. Emptiness is `text.trim() === ""`.
The composer carries no native `maxLength`. It shows the too-long message and disables Send while the
text is over the limit.

**Rationale**: `text.length` is the unit the browser itself uses for text-field length. It is also the
one JavaScript gives without extra code, so both sides agree by construction (FR-036). A native
`maxLength` silently truncates a paste, and the user would send a cut-off document without knowing.
The server receives the limit from Config; the page passes it to the client as a prop.

**Alternatives considered**: grapheme clusters via `Intl.Segmenter` — closer to what a person calls a
character, but more code on both sides for a limit that exists to bound cost.

## R13. The test model: `MockLanguageModelV4` from `ai/test`, imported only when enabled

**Decision**: When `AI_FAKE_MODEL` is on, `getChatAgent()` dynamically imports
`src/server/chat/fake-model.ts`, which builds a `MockLanguageModelV4`.

- **Stream.** Its `doStream` reads the last user text from the prompt and returns
  `simulateReadableStream` chunks:
  - reasoning first, then text, then finish with fixed usage;
  - roughly 400 ms in total.
- **Markers in the message text** steer it:

  | Marker        | Behaviour                                                                     |
  | ------------- | ----------------------------------------------------------------------------- |
  | `[slow]`      | about 40 chunks, 150 ms apart, so Stop can be pressed mid-reply               |
  | `[fail]`      | some text, then an error part                                                 |
  | `[fail-once]` | fails the first time a given text is seen in the process, succeeds afterwards |
  | `[cut]`       | finish reason `length`                                                        |

**Rationale**:

- `ai/test` is a public `exports` entry, and its only imports are `ai`'s own dependencies (`test` `js:1-3`).
- `MockLanguageModelV4` takes a `doStream` function and records calls (`test/index.d.ts:131`;
  `test js:134-157`). Chunk shapes as in `docs/03-ai-sdk-core/55-testing.mdx:62-99`.
- A dynamic import keeps it out of the server bundle's main path. Config refuses the flag in production
  (FR-051).
- `[fail-once]` keeps per-process state. That is deterministic for an e2e run, which serves each test's
  unique text from one server.

**Alternatives considered**:

- Our own implementation of the provider interface. More code, and it would import
  `@ai-sdk/provider` directly, a transitive package we would then have to declare.
- `customProvider` or middleware. Neither is a fake by itself.

## R14. Configuration

**Decision**: New variables in `src/config/schema.ts`:

| Variable                       | Type             | Default |
| ------------------------------ | ---------------- | ------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | non-empty string | —       |
| `AI_FAKE_MODEL`                | `z.stringbool()` | false   |
| `CHAT_MAX_MESSAGE_LENGTH`      | positive int     | 4000    |
| `CHAT_RATE_LIMIT_PER_MINUTE`   | positive int     | 10      |
| `CHAT_DAILY_TOKEN_BUDGET`      | positive int     | 500000  |
| `CHAT_HISTORY_LIMIT`           | positive int     | 50      |

The variables come with two cross-field rules:

- The key is required unless `AI_FAKE_MODEL` is true, and a missing key fails with the variable's name.
- `AI_FAKE_MODEL` with `APP_ENV=production` fails.

They are exposed as `config.ai = { googleApiKey, fakeModel }` and `config.chat = { maxMessageLength,
rateLimitPerMinute, dailyTokenBudget, historyLimit }`. The agent passes the key explicitly through
`createGoogleGenerativeAI({ apiKey })`.

Tooling settings:

- `vitest.config.mts` sets `AI_FAKE_MODEL=true` for the `unit` and `integration` projects, so modules
  that load Config need no key.
- `playwright.config.ts` sets `AI_FAKE_MODEL=true` and `CHAT_RATE_LIMIT_PER_MINUTE=5` for the e2e server.

**Rationale**:

- The name `GOOGLE_GENERATIVE_AI_API_KEY` was agreed during specification. The provider also falls back
  to it if no key is passed (`@ai-sdk/google` `js:7951`). Passing the key explicitly keeps Config the
  only reader, as `AUTH_SECRET` is in feature 003.
- `z.stringbool` exists in the installed zod 4.4.3 (`v4/classic/schemas.d.ts:749`) and is the first
  boolean variable in the repository.
- The `drops variables it does not declare` test lists every key and is updated with them.

## R15. The instructions, in English (Principle VII, 1.6.3)

**Decision**: `buildInstructions({ locale, today })` returns English text, reviewed like code. It
states:

- the role: Atmo's support assistant for solar energy, answering general questions;
- no access to any customer's data, contracts, or systems, said plainly when asked;
- never to invent facts about a customer's system, contract, or entitlements;
- to reply in the language of the user's latest message, and otherwise in `{locale's English name}`;
- the date `today`, as the UTC calendar date.

A test-first unit test asserts that the date and the language fallback are present and that each rule
appears.

**Rationale**: Principle VII routes the text the agent shows to people through next-intl; the agent's
instructions are model input and may be written in one language (constitution 1.6.3, which settled the
earlier wording "agent-visible text" during analysis). The model is told which language to answer in
(Principle VII, 1.6.1).

## R16. Screen readers: nothing is announced

**Finding**: `@assistant-ui/react` and `@assistant-ui/core` contain no `aria-live`, `role="log"`, or
`role="status"`. The registry adds `role="status"` only to loading skeletons (`thread.aui.tsx:153, 327`).
A streamed reply is therefore announced to no one. The user kept the earlier decision to add nothing of
our own, and the spec's Known Boundary now says so plainly. Text smoothing honours
`prefers-reduced-motion` (`useSmooth.ts:161`). The error root carries `role="alert"` (`ErrorRoot.tsx:19`),
which means a model failure is announced.

## R17. Dependency justifications (constitution, Technology Constraints)

| Package                 | Kind                                            | What it does                                                                             | Cost of building it ourselves                                                                                                            | Cost of the dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ai-sdk/google@4.0.87` | runtime, provider                               | Gemini API client for the AI SDK. It maps streaming, thinking, usage, and finish reasons | The Gemini REST and SSE protocol, the thought-part mapping, and usage accounting. All of it is behind the `ai` interfaces we already use | **A new recipient of customer data.** Every question and the conversation history go to Google. On the free tier Google uses them to improve its products, and human reviewers may read them. That is why the tier is limited to development and test data, and why the paid tier, which does not use them, is required before any real customer data and for any user in the EEA, Switzerland, or the UK (R18). The client itself has no dependencies beyond the AI SDK's own and pins one model id (R1) |
| `remark-gfm`            | runtime (via the `markdown-text` registry item) | GitHub-flavoured Markdown: tables, strikethrough, task lists, autolinks                  | A Markdown extension for `react-markdown`. Model replies use tables often, and without it they render as rows of pipes                   | One small, widely used unified plugin. It ships with the vendored registry item                                                                                                                                                                                                                                                                                                                                                                                                                           |

- **Exempt**, named by the constitution: `ai`, `@ai-sdk/react`, `@assistant-ui/react`,
  `@assistant-ui/ai-sdk` (1.6.2), `@assistant-ui/react-markdown`, and every shadcn component pulled
  through the CLI (`tooltip`, `collapsible`).
- **Refused**:
  - `tw-shimmer`: one animation, replaced by `animate-pulse` (R9);
  - `zustand`: only the registry thread's attachments need it (R9);
  - `@assistant-ui/react-ai-sdk`: superseded (R9).

## R18. Provider terms that bind the deployment

Source: Gemini API Additional Terms (https://ai.google.dev/gemini-api/terms, effective 2026-03-23).

- **Unpaid use.** Google uses submitted content and responses to improve its products. Human reviewers
  may read them. "Do not submit sensitive, confidential, or personal information."
- **Paid use.** Prompts and responses are not used to improve products, but they are logged for a
  limited time to detect abuse. The API counts as paid only "through a Cloud Project associated with an
  active billing account".
- **Regional rule.** "You may use only Paid Services when making API Clients available to users in the
  European Economic Area, Switzerland, or the United Kingdom."

The spec's Known Boundaries carry the first and last points. The pricing page puts
`gemini-3.5-flash-lite` at $0.30 per 1M input tokens and $2.50 per 1M output tokens, thinking included
(https://ai.google.dev/gemini-api/pricing). At the 4 096-token cap, one reply costs at most about
$0.01 in output. The default daily budget of 500 000 tokens is at most about $1.25 per user per day,
if every token were output. Google publishes no time-to-first-token figure. Its only speed figure,
attributed to a third party, is 350 output tokens per second. The quickstart's live check measures
SC-002 by hand.
