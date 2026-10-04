# Contract: The Chat Agent

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Everything the model is, says, and is allowed to do lives in `src/server/chat/` and is reviewed like
code (Principle VI, FR-044, FR-047). Nothing here imports Next.

## `agent.ts` — the single agent module (MC-003, R2)

```ts
getChatAgent(): Promise<ToolLoopAgent<{ locale: Locale; today: string }>>
```

| Setting             | Value                                                                                                                                 | Source  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `model`             | `createGoogleGenerativeAI({ apiKey: config.ai.googleApiKey })("gemini-3.5-flash-lite")`, or the test model when `config.ai.fakeModel` | R1, R13 |
| `maxOutputTokens`   | `4096` — reasoning and text together                                                                                                  | FR-052  |
| `providerOptions`   | `{ google: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } } }`                                                     | FR-054  |
| `callOptionsSchema` | `{ locale: enum(routing.locales), today: ISO date }`                                                                                  | R2      |
| `prepareCall`       | `({ options, ...rest }) => ({ ...rest, instructions: buildInstructions(options) })`                                                   | R2      |
| tools               | none (FR-046)                                                                                                                         |         |
| `temperature` etc.  | not set — deprecated for this model                                                                                                   | R1      |

`GEMINI_MODEL_ID = "gemini-3.5-flash-lite"` is the one place the model is named (FR-047). `getChatAgent()`
returns `{ agent, modelId }`, where `modelId` is read from the model object actually built —
`gemini-3.5-flash-lite`, or `fake-model` under `AI_FAKE_MODEL` — and `respond.ts` records that on each
reply (FR-048), so a stored reply never names a model that did not write it.

## `instructions.ts` — `buildInstructions({ locale, today })` (R15, test-first)

English text that MUST contain, and a unit test asserts each:

1. The role: Atmo's support assistant for solar energy; it answers general questions about solar
   systems (PV panels, inverters, batteries, installation, maintenance, savings).
2. No access to any customer's data, contracts, or systems — and it says so plainly when asked about
   them.
3. Never to invent facts about a customer's system, contract, or entitlements.
4. Reply in the language of the user's latest message; when that is unclear, in `<English name of
locale>` (FR-045, Principle VII 1.6.1).
5. Today's date, `today` (UTC calendar date).

It contains no product copy, no secrets, and no customer data.

## `respond.ts` — `respondToChat(actor, input, signal): Promise<Response>`

1. `startChatTurn(actor, input, now)` (R4) — throws `DomainError`s, which `defineRoute` maps to 4xx.
2. `createAgentUIStreamResponse({ agent, uiMessages: turn.history, options: { locale, today },
abortSignal: signal, timeout: 60_000, generateMessageId: () => turn.replyId, messageMetadata,
onError, onEnd, consumeSseStream: consumeStream })` (R3).
3. `messageMetadata`: `start` → `{ conversationId }`; `finish` → capture `totalUsage`, `finishReason`,
   return `{ outcome }`; `abort` while `signal` is not aborted → `{ outcome: "failed" }`.
4. `onError(error)`: `console.error` with the provider detail; set the failure flag; return
   `"model_failed"`.
5. `onEnd({ responseMessage, isAborted })` → `finishReply(turn.replyId, decideOutcome(…),
responseMessage.parts, usage, modelId)`; a failed write is logged, never thrown into the stream.

## `fake-model.ts` — the test model (FR-051, R13)

`MockLanguageModelV4` from `ai/test`, imported dynamically only when `AI_FAKE_MODEL` is on. It reads
the latest user text and always streams reasoning first, then text, then `finish` with usage
`{ input: 12, output: 34 }`.

| Text contains | Behaviour                                                        | Used by              |
| ------------- | ---------------------------------------------------------------- | -------------------- |
| —             | ~6 chunks, 60 ms apart: "Thinking about …", then "Test reply: …" | send/receive, reload |
| `[slow]`      | ~40 chunks, 150 ms apart                                         | Stop (FR-018)        |
| `[fail]`      | a little text, then an `error` part                              | failure (FR-020)     |
| `[fail-once]` | fails the first time this exact text is seen in the process      | error then Try again |
| `[cut]`       | finish reason `length`                                           | cut marker (FR-052)  |

Model id reported: `fake-model`.
