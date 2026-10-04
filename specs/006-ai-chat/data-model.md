# Data Model: AI Chat for Signed-In Users

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

The feature adds two tables and two enums, and follows the conventions feature 003 set: `timestamptz(3)`
instants written from the application's clock, UUIDv7 ids, plural snake_case table names, and business
invariants declared as (partial) unique indexes in the schema. This feature makes one deliberate
exception: a conversation's messages are deleted with it (`onDelete: Cascade`), because the spec makes
deletion permanent (FR-032). A conversation's owner is still `Restrict` — users are never deleted.

## Enum `MessageRole`

| Value       | Meaning                    |
| ----------- | -------------------------- |
| `USER`      | The signed-in user's turn. |
| `ASSISTANT` | A reply from the model.    |

## Enum `ReplyFinish` — the spec's "finish reason"

| Value         | Meaning                                                                                 | Set by                     |
| ------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `IN_PROGRESS` | Being written. At most one per conversation (index below).                              | `startChatTurn` (R4)       |
| `COMPLETED`   | Ended on its own.                                                                       | `finishReply`              |
| `STOPPED`     | Ended by Stop, a closed or reloaded page, or a lost connection (FR-016, FR-018).        | `finishReply`              |
| `CUT`         | Reached the 4 096-token cap (FR-052).                                                   | `finishReply`              |
| `FAILED`      | Provider error, timeout, or a row left `IN_PROGRESS` past the timeout (FR-015, FR-021). | `finishReply`, stale sweep |

`null` on `USER` rows.

## `Conversation` → table `conversations`

| Field       | Type                                     | Notes                                                                                        |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`        | `String @id @default(uuid(7)) @db.Uuid`  | In the page address.                                                                         |
| `userId`    | `String @db.Uuid` → `User`, `Restrict`   | The owner. Every query filters on it (FR-003, FR-005).                                       |
| `title`     | `String`                                 | First message, whitespace collapsed and trimmed, cut at 80 with `…` (FR-008). Never updated. |
| `createdAt` | `DateTime @db.Timestamptz(3)`            | Application clock.                                                                           |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(3)` | Touched whenever a message is stored or a reply ends; orders the list (FR-029).              |

Indexes: `@@index([userId, updatedAt(sort: Desc)])` for the list.

## `Message` → table `messages`

| Field            | Type                                          | Notes                                                                                                                           |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `String @id @default(uuid(7)) @db.Uuid`       | Assigned by the server; the reply's id is also its stream message id (FR-011, R3).                                              |
| `conversationId` | `String @db.Uuid` → `Conversation`, `Cascade` | Deleting a conversation deletes its messages (FR-032).                                                                          |
| `role`           | `MessageRole`                                 |                                                                                                                                 |
| `parts`          | `Json` (JSONB)                                | AI SDK `UIMessage` parts as shown: `text` for questions; `reasoning` and `text` for replies (FR-053). `[]` while `IN_PROGRESS`. |
| `createdAt`      | `DateTime @db.Timestamptz(3)`                 | Application clock. Orders the conversation; windows both limits (R5).                                                           |
| `model`          | `String?`                                     | Model id, on replies — `gemini-3.5-flash-lite`, or the test model's (FR-048).                                                   |
| `inputTokens`    | `Int?`                                        | As the provider reported, on replies; `null` if never reported.                                                                 |
| `outputTokens`   | `Int?`                                        | Includes reasoning tokens (R1).                                                                                                 |
| `finishReason`   | `ReplyFinish?`                                | On replies only.                                                                                                                |

Indexes:

- `@@index([conversationId, createdAt])` — history in order.
- `@@unique([conversationId], map: "messages_one_reply_in_progress", where: { finishReason: "IN_PROGRESS" })`
  — **FR-023 as a database invariant**: two concurrent requests cannot both start a reply.

A check that `role = USER ⇔ finishReason IS NULL` is enforced in the repository, not as a database
`CHECK`: Prisma cannot declare one, and a hand-edited migration is dropped as drift (003 R10).

## Lifecycles

### Conversation

```text
(none) ──first accepted send──▶ exists ──Delete (owner)──▶ (gone, with its messages)
```

Created in the same transaction as its first user message and that message's reply row (FR-006).

### Reply

```text
            startChatTurn
(none) ───────────────────▶ IN_PROGRESS ──finishReply──▶ COMPLETED | STOPPED | CUT | FAILED
                                │
                                └── older than 60 s at the next turn, or when read ──▶ FAILED
```

`finishReply` updates only `WHERE id = … AND finishReason = 'IN_PROGRESS'`: a reply whose conversation
was deleted, or which a later turn already swept as stale, is left alone (FR-033).

### A question and its replies

A question has zero or more `FAILED` replies, followed by at most one reply that is `IN_PROGRESS`,
`COMPLETED`, `STOPPED`, or `CUT`. A new question is accepted only once the latest reply has ended
(FR-012). Try again is accepted only while the latest reply is `FAILED` (FR-022).

## Derived values (no storage)

| Value                       | Computed from                                                                                    | Where                          |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| Requests in the last minute | count of the user's `ASSISTANT` rows with `createdAt > now − 60 s`                               | `limits` query (R5)            |
| Tokens in the last 24 h     | sum of `inputTokens + outputTokens` of the user's `ASSISTANT` rows with `createdAt > now − 24 h` | `limits` query (R5)            |
| Seconds until budget frees  | the same rows, oldest first                                                                      | `secondsUntilBudgetFrees` (R5) |
| Effective outcome           | `finishReason`, with `IN_PROGRESS` older than 60 s read as `FAILED`                              | `effectiveOutcome` (R10)       |

## Browser-side message shape (`src/lib/chat/messages.ts`)

```ts
type ChatOutcome = "in_progress" | "completed" | "stopped" | "cut" | "failed";

type ChatMessageMetadata = {
  conversationId?: string; // on the first reply of a new conversation, at stream start (R8)
  outcome?: ChatOutcome; // replies: stored outcome on load; finish/abort metadata live (R10)
  failedAttempts?: { parts: ChatPart[] }[]; // on questions: failed replies folded under them (R10)
};

type ChatUIMessage = UIMessage<ChatMessageMetadata>;
```

One zod schema validates this metadata in the browser (`messageMetadataSchema`) and is the type the
server's loader produces.

## Validation shared by browser and server (`src/lib/schemas/chat.ts`)

`chatRequestSchema(maxLength)`:

| Field            | Rule                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversationId` | UUID, or absent for a new conversation                                                                                                               |
| `locale`         | one of `routing.locales` (`en`, `uk`) — otherwise 400 (FR-045)                                                                                       |
| `trigger`        | `"submit-message"` or `"regenerate-message"`                                                                                                         |
| `text`           | required for `submit-message`: `trim()` non-empty (FR-037), `length ≤ maxLength` in UTF-16 code units (FR-036, R12); absent for `regenerate-message` |

A `regenerate-message` without `conversationId` is invalid. Error messages are catalog keys, as in
feature 003.
