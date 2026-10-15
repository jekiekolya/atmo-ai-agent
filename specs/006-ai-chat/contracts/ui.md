# Contract: Chat UI

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

## Pages and layouts (`src/app/[locale]/(private)/dashboard/`)

| File                                 | Renders                                                                                      | Awaits before streaming        |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------ |
| `(home)/page.tsx`, `loading.tsx`     | the dashboard home — **moved** from `dashboard/` unchanged (R7)                              | —                              |
| `chat/layout.tsx`                    | sidebar (`ConversationList`) + main column; `verifySession()`, `listConversations`           | session, list                  |
| `chat/(new)/page.tsx`, `loading.tsx` | `ChatPanel` with no conversation and no messages                                             | —                              |
| `chat/[id]/layout.tsx`               | children; `conversationIdFrom(params)` and `findOwnConversation` → `notFound()` (FR-004, R7) | ownership check — **real 404** |
| `chat/[id]/page.tsx`, `loading.tsx`  | `ChatPanel` keyed by id, with the stored messages folded (R10)                               | history                        |

No `loading.tsx` in `dashboard/` or `dashboard/chat/` — enforced by
`src/conventions/loading-boundaries.test.ts`. Page titles: `chat.metaTitle` (new), the conversation's
title (existing).

Header (`(private)/layout.tsx`): `Home`, **`Chat`** (`shell.chat`, `PAGES.chat`), `Account`, `Users`
(super admin only) — FR-002.

## Components (`src/components/chat/`, one folder each, test beside)

| Component                    | Kind   | Responsibility                                                                                                                                                                         |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat-panel`                 | client | `useChat` + `DefaultChatTransport` (`chatFetch`, last-message body) + `useAISDKRuntime` + `AssistantRuntimeProvider`; URL change (R8); refusal handling (R11); Try again folding (R10) |
| `chat-thread`                | client | composed from assistant-ui primitives (R9): messages, greeting, composer, Stop, Copy, Try again, markers, reasoning                                                                    |
| `reply-marker`               | client | localized marker for `stopped` / `cut` / `failed` / `in_progress`, from status or metadata                                                                                             |
| `conversation-list`          | client | links to `PAGES.chatConversation`, active by `usePathname`, New chat, Delete; collapsible on narrow screens (FR-034)                                                                   |
| `delete-conversation-dialog` | client | `AlertDialog` as in `user-row-actions`: pending state, `apiRequest("DELETE")`, toast, `router.push(PAGES.chat)` if it was open, else `router.refresh()`                                |

Vendored (flat, via the shadcn CLI, Base UI style — R9): `src/components/assistant-ui/elements/
markdown-text.tsx` (images off), `reasoning.tsx` + `reasoning.aui.tsx` (labels as props, no duration,
`animate-pulse`), `tooltip-icon-button.tsx`, `src/hooks/use-copy-to-clipboard.ts`; shadcn
`ui/tooltip.tsx`, `ui/collapsible.tsx`.

## Message rendering

| Element                   | Behaviour                                                                                                                                    | FR             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Question                  | plain text, whitespace-preserving (`whitespace-pre-wrap`); failed attempts below it, each with its text and failed marker                    | FR-025, FR-021 |
| Reasoning                 | above the reply text; open and labelled "Thinking…" while `part.status` is running; closed, labelled "Reasoning" after; no block when absent | FR-028, FR-053 |
| Reply text                | Markdown via `markdown-text`; raw HTML inert; images not fetched                                                                             | FR-024         |
| Being written (other tab) | empty reply with the in-progress marker; no Copy, no Try again                                                                               | Edge Cases     |
| Copy                      | `ActionBarPrimitive.Copy` — text parts only, never reasoning; tooltip + icon change confirm                                                  | FR-026         |
| Try again                 | only on the last message, only when its outcome or status is failed                                                                          | FR-022         |
| Greeting                  | `chat.greeting` on an empty thread                                                                                                           | FR-027         |

## Composer

- `ComposerPrimitive.Input`; Enter sends, Shift+Enter new line (Assumptions).
- Send disabled when `text.trim()` is empty, when `text.length > maxLength` (and the too-long message
  shows), while a reply runs in this tab, and for one second after a Stop or a lost connection, while
  the server stores the reply (FR-013, FR-036, FR-037). A reply another tab is writing does not disable
  Send: the server refuses the question with `reply_in_progress` (FR-012).
- `ComposerPrimitive.Cancel` = Stop while running; it, and Escape in the message box, are disabled until
  the reply's first chunk, which names a new conversation (FR-013, FR-018).
- A lost connection ends the reply as Stop does: shown as stopped, no error, no Try again (FR-016).
- Refusals render in a `FormAlert` above the composer, the typed text restored (FR-041):
  `chat.errors.tooLong`, `chat.errors.rateLimited`, `chat.errors.dailyLimit` (with
  `chat.errors.dailyLimitHours`, plural, or `chat.errors.dailyLimitUnderHour`), `chat.errors.inProgress`,
  `chat.errors.notFound`, `errors.unexpected`.
- Model failure: `ErrorPrimitive.Root` (`role="alert"`) with translated `chat.errors.modelFailed` as
  children — never the raw `errorText` (FR-020).

## Catalog keys (namespace `chat`, plus `shell.chat` and `errors.codes.*`) — en and uk

`metaTitle`, `greeting`, `composer.label`, `composer.placeholder`, `composer.send`, `composer.stop`,
`actions.copy`, `actions.copied`, `actions.tryAgain`, `markers.stopped`, `markers.cut`, `markers.failed`,
`markers.inProgress`, `reasoning.thinking`, `reasoning.label`, `list.label`, `list.newChat`,
`list.delete`, `list.toggle`, `list.empty`, `delete.title`, `delete.description`, `delete.confirm`,
`delete.cancel`, `delete.done`, `errors.tooLong` (`{max}`), `errors.empty`, `errors.rateLimited`,
`errors.dailyLimitHours` (`{hours, plural, …}`), `errors.dailyLimitUnderHour`, `errors.inProgress`,
`errors.nothingToRetry`, `errors.notFound`, `errors.modelFailed`, `errors.invalidLocale`; plus every
string that survives in the vendored files (`tooltip-icon-button` labels, `markdown-text` copy button).
`errors.dailyLimitHours` is the product's first plural, giving feature 001's plural rule its first test.

## Accessibility

Primitives keep Base UI semantics. The sidebar is a `<nav aria-label>` list of links with
`aria-current="page"` on the open one; delete buttons are labelled with the conversation's title. No
live region is added for streaming (spec Known Boundaries, R16); the model-failure alert is
`role="alert"`.
