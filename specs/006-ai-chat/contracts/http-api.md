# Contract: Chat HTTP API

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Two endpoints, both defined in `src/lib/routes.ts` and served through feature 003's `defineRoute`:

1. same-origin check,
2. zod body,
3. session (`required`),
4. handler.

The error envelope and the `ErrorCode` rules of
[003's http-api.md](../../003-auth-user-admin/contracts/http-api.md) apply unchanged, plus one optional
field for 429 responses. Reads are not endpoints: the list and the history are rendered on the server
(MC-005).

## Routes module additions

```ts
PAGES.chat = "/dashboard/chat";
PAGES.chatConversation = "/dashboard/chat/[id]";
API_ROUTES.chat = "/api/chat";
API_ROUTES.chatConversation = "/api/chat/[id]";
```

## `POST /api/chat` — send a message or try again

**Request** (`application/json`, `chatRequestSchema(config.chat.maxMessageLength)`, see
[data-model.md](../data-model.md#validation-shared-by-browser-and-server-srclibschemaschatts)):

```json
{ "conversationId": "0192…", "locale": "uk", "trigger": "submit-message", "text": "Як працює інвертор?" }
{ "conversationId": "0192…", "locale": "uk", "trigger": "regenerate-message" }
```

`conversationId` absent ⇒ a new conversation (FR-006).

**Success**: `200`, `text/event-stream` — the AI SDK UI message stream (`createAgentUIStreamResponse`,
R3). Parts in order:

| Chunk              | Content                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `start`            | `messageId` = the stored reply's id; `messageMetadata.conversationId` (always) |
| `reasoning-*`      | reasoning summary, when the model returns one (FR-028)                         |
| `text-*`           | the reply                                                                      |
| `message-metadata` | `{ outcome: "failed" }` on a timeout (sent with the `abort` part)              |
| `error`            | `errorText: "model_failed"` — never provider detail (FR-020)                   |
| `finish`           | `messageMetadata.outcome`: `completed` \| `cut` \| `failed`                    |

Whatever the stream's ending, the reply row is updated once (R4's outcome table). A client that
disconnects ends the reply as `STOPPED` (FR-016).

**Refusals** (before any stream; nothing stored, model not called — FR-041):

| Status | `code`                | When                                                                   | Extra                        |
| ------ | --------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| 400    | `validation_failed`   | schema fails: empty, too long, unsupported locale, bad shape           | `fields` (catalog keys)      |
| 401    | `unauthenticated`     | no valid session                                                       |                              |
| 403    | `forbidden_origin`    | cross-origin                                                           |                              |
| 403    | `forbidden`           | the user's role is not a staff role (FR-001; none exists yet)          |                              |
| 404    | `not_found`           | conversation missing, another user's, or malformed id (FR-004)         |                              |
| 409    | `reply_in_progress`   | a reply is being written in this conversation (FR-012, FR-022, FR-023) |                              |
| 409    | `nothing_to_retry`    | Try again when the latest reply did not fail (FR-022)                  |                              |
| 429    | `daily_limit_reached` | daily token budget reached (FR-039) — checked first (FR-040)           | `retryAfterSeconds` (FR-055) |
| 429    | `rate_limited`        | per-minute limit reached (FR-038)                                      | `retryAfterSeconds`          |

429 responses also carry `Retry-After: <seconds>`. The 404 body is byte-identical for every cause.

```json
{ "error": { "code": "daily_limit_reached", "retryAfterSeconds": 7260 } }
```

## `DELETE /api/chat/{id}` — delete a conversation

No body. `204` on success: the conversation and its messages are gone (FR-032). A reply still being
written in it is not stored afterwards (FR-033).

| Status | `code`             | When                                                 |
| ------ | ------------------ | ---------------------------------------------------- |
| 401    | `unauthenticated`  | no valid session                                     |
| 403    | `forbidden_origin` | cross-origin                                         |
| 404    | `not_found`        | missing, another user's, or malformed id — identical |

## Error codes added to `ERROR_CODES`

`reply_in_progress`, `nothing_to_retry`, `rate_limited`, `daily_limit_reached`, `model_failed`. Each gets
`errors.codes.<code>` in every catalog; the existing completeness test enforces it. `model_failed` never
appears in an HTTP envelope — it is the stream's `errorText` — but lives in the same closed set so its
message is checked the same way. `not_found` keeps its account-oriented message; the chat client
overrides it per code through `routeFailure`'s `messages` argument with `chat.errors.notFound`.

New error class: `RateLimitError(code: "rate_limited" | "daily_limit_reached", retryAfterSeconds)` →
429 in `route-response.ts`, which also sets `Retry-After`.

## Authorization matrix (joins `src/app/api/authorization-matrix.integration.test.ts`)

| Endpoint                    | Anonymous | Admin, own conversation | Super admin, own | Any user, another's conversation |
| --------------------------- | --------- | ----------------------- | ---------------- | -------------------------------- |
| `POST /api/chat` (new)      | 401       | 200 stream              | 200 stream       | —                                |
| `POST /api/chat` (existing) | 401       | 200 stream              | 200 stream       | 404, identical to a random id    |
| `DELETE /api/chat/{id}`     | 401       | 204                     | 204              | 404, identical to a random id    |

Every cell is an integration test with the model mocked (SC-004); the snapshot taken around the 401 and
404 cases includes `conversations` and `messages` and must be unchanged.
