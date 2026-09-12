<!--
Version change: template (unversioned) → 1.0.0
Rationale: First ratification. The file previously contained only placeholder tokens, so this is
the initial adoption of concrete governance rather than an amendment.

Principles defined (all new — template slots had no content):
  - [PRINCIPLE_1_NAME] → I. Type-Safe by Default
  - [PRINCIPLE_2_NAME] → II. Simple, Modular, Readable
  - [PRINCIPLE_3_NAME] → III. Spec-First Delivery
  - [PRINCIPLE_4_NAME] → IV. Tested Business Logic (NON-NEGOTIABLE)
  - [PRINCIPLE_5_NAME] → V. Centralized Config, Zero Secrets in Git
  - (added beyond template) VI. Accountable AI Agents
  - (added beyond template) VII. Localized by Default

Sections defined:
  - [SECTION_2_NAME] → Technology Constraints
  - [SECTION_3_NAME] → Development Workflow & Quality Gates
  - Governance → filled

Removed sections: none.
Deferred / follow-up TODOs: none. All placeholders resolved.
-->

# Atmo AI Agent Constitution

Atmo AI Agent is a customer-support platform: our company operates it to support the end customers
of partner companies in the solar-energy field, with an AI chat agent as the primary support
channel. Every rule below exists to keep that platform trustworthy for people who are not our own
users.

## Core Principles

### I. Type-Safe by Default

TypeScript is the only implementation language for application code. Every new component, route,
service, hook, agent tool, and test MUST be TypeScript with explicit types at module boundaries
(exported functions, API handlers, agent tool schemas, Prisma-derived DTOs).

`any` is forbidden unless justified. A permitted `any` MUST carry an inline comment stating why no
narrower type works, and MUST be contained at the boundary — never propagated into business logic.
Prefer `unknown` plus a runtime narrowing/validation step over `any`. Type errors and lint errors
are build failures, not warnings; suppressions (`@ts-ignore`, `@ts-expect-error`, eslint-disable)
require the same inline justification as `any`.

*Rationale*: The agent consumes untrusted model output and partner data. Types are the cheapest
place to catch a malformed payload before it reaches a customer conversation or the database.

### II. Simple, Modular, Readable

Choose the simplest implementation that satisfies the spec. Prefer clear procedural code over
premature abstraction; introduce an abstraction only on the second real caller, not in
anticipation of one. Modules own one responsibility and expose a narrow public surface: UI
components render, services hold business rules, data access stays behind Prisma-facing modules,
and agent tools are thin adapters over services. No business logic in React components; no direct
database access from components or route handlers.

UI is composed, not reinvented. New interface elements are built from the project's shadcn/ui
primitives in `src/components/ui` and composed into feature components; hand-rolling a control that
an existing primitive already covers requires a stated reason in the feature plan. Those primitives
are owned code — customize them in place instead of wrapping them in adapter layers, preserve the
Base UI accessibility semantics (roles, ARIA attributes, keyboard and focus behavior) when editing
them, and route any user-facing string inside them through next-intl like all other copy.

Readability is a review criterion: intention-revealing names, early returns over deep nesting, and
comments that explain *why* rather than restate *what*. YAGNI — unused options, dead flags, and
speculative extension points are removed rather than kept "just in case".

*Rationale*: Support platforms are edited under time pressure during incidents. Code that reads
plainly is code that can be safely changed at 2am, and accessible, consistent controls are cheaper
to inherit than to re-derive per screen.

### III. Spec-First Delivery

Every feature follows specification → plan → tasks → implementation, in that order. Work starts
from a written spec (`/speckit-specify`) that states user-visible behavior and acceptance criteria;
the plan (`/speckit-plan`) records the technical approach and its constitution check; tasks
(`/speckit-tasks`) make the work reviewable in increments.

No feature branch may introduce user-visible behavior that has no corresponding spec. If
implementation reveals the spec was wrong, the spec is amended first and the change is recorded
there — the code is never the sole source of truth for intended behavior. Bug fixes and mechanical
chores (dependency bumps, renames, formatting) are exempt from the full flow.

*Rationale*: Behavior we agreed to in writing is behavior we can test, localize, and explain to
the partner whose customers we serve.

### IV. Tested Business Logic (NON-NEGOTIABLE)

Automated tests are required for all new and changed behavior. Two regimes apply, and every module
a feature touches MUST be assigned to one of them explicitly in that feature's plan:

**Test-first (mandatory)** — domain services, business rules, agent tools, the Config module, and
validation/narrowing helpers. Write the failing Vitest test first, confirm it fails, then
implement, then refactor. The failing test MUST precede the implementation, and the pull request
makes that order visible (commit order or an explicit note in the PR description).

**Test-together (mandatory)** — UI components and end-to-end flows. Tests ship in the same pull
request as the change; the order of writing is not mandated. Playwright MUST cover chat
send/receive, authentication, escalation to a human, and locale switching.

In both regimes tests assert behavior and edge cases — empty, error, unauthorized, cross-tenant —
not implementation details. A pull request that touches business logic with no test delta is
rejected. The full suite MUST pass before merge; a skipped or quarantined test requires a linked
issue and an owner.

*Rationale*: Test-first pays for itself where a bug is expensive and the contract is knowable up
front — money, entitlements, data access, tenant isolation. It gets in the way for layout and
visual flows, where the expected result is only clear once something renders. Splitting the rule by
layer keeps the strictness where it earns its cost.

### V. Centralized Config, Zero Secrets in Git

No secret is ever committed: no API keys, database URLs, tokens, partner credentials, or customer
data in the repository, in fixtures, or in test snapshots. `.env` and `.env.*` stay ignored
(`.env.example` excepted). A leaked secret is rotated first, then removed from history.

All configuration comes from environment variables, read in exactly one place. A single Config
module (`src/config/index.ts` or equivalent) reads `process.env`, validates and coerces every
value at startup, and exports one typed frozen config object. Every other file — including tests
and instrumentation — imports that object. `process.env` access outside the Config module is a
review-blocking violation.

This principle governs application configuration. Tooling files that never reach the application
bundle — configuration at the repository root (`next.config.ts`, `playwright.config.ts`,
`vitest.config.mts`), build scripts, and CI scripts — MAY read `process.env` directly: they run
before and outside the application, and cannot depend on a Config module that fails fast on
application variables. Application code, including the tests that exercise it, still receives its
configuration only from the Config module.

Every variable the Config module reads MUST be documented in `.env.example` with a non-secret
placeholder and a one-line description. Missing or malformed required variables MUST fail fast at
startup with a message naming the variable, never fall back to a silent default.

*Rationale*: One typed, validated entry point means a misconfiguration surfaces at boot on our
machines instead of as a broken chat for a partner's customer.

### VI. Accountable AI Agents

The support agent is product code, not runtime configuration:

- Prompts, tool definitions, model IDs, and agent settings live in the repository and are reviewed
  like any other code. Model and prompt changes are never made only in a dashboard.
- Every agent run is traceable: the conversation, the tool calls with their inputs and outcomes,
  and the final response are persisted so any answer given to a customer can be reconstructed.
- Agent tools are typed, least-privilege, and scoped to a single tenant. A tool MUST NOT be able
  to read or write data across the customer/partner boundary; tenant scoping is enforced in the
  data layer, not by prompt instruction.
- Customer personal data sent to the model is limited to what the current task requires.
- A path to a human is always reachable: the agent MUST NOT be the only way a customer can get
  help, and it MUST hand off rather than guess when it is outside its competence.
- The agent never invents facts about a customer's system, contract, or entitlements; unknown
  values are looked up through a tool or escalated.

*Rationale*: We answer on behalf of a partner to their customers. Every answer must be
attributable, reproducible, and confined to the right tenant.

### VII. Localized by Default

No user-facing string is hardcoded. All copy — UI, emails, error messages, and agent-visible text
— resolves through next-intl message catalogs.

Adding a string means adding its key to **every** supported locale. A key missing from any
supported locale is a build failure: merge is blocked until the translation exists. A silent
fallback that ships untranslated text as though it were correct is forbidden.

Locale-dependent formatting (dates, numbers, currency, units) uses locale-aware formatters, never
manual string assembly. The agent responds in the customer's locale.

*Rationale*: Solar customers are supported across markets, and a half-translated support interface
reads as a broken one. Enforcing completeness at build time is the only version of this rule that
holds under deadline pressure.

## Technology Constraints

The following stack is fixed. Replacing or adding a component at this layer is a constitution
amendment, not a feature decision:

- **Framework**: Next.js (App Router) with TypeScript in `strict` mode.
- **Database**: PostgreSQL, accessed exclusively through Prisma. Schema changes ship as committed
  migrations — never `db push` against a shared environment, never hand-edited SQL out of band.
- **AI**: OpenAI Agents SDK for agent orchestration and tool calling.
- **Styling**: Tailwind CSS. No parallel styling system (CSS-in-JS, ad-hoc global stylesheets).
- **UI components**: shadcn/ui (Base UI primitives, vendored into the repo under
  `src/components/ui` via its CLI) is the single component baseline. No second component library —
  no MUI, Chakra, Ant Design, or equivalent. Design tokens live in the Tailwind config and the
  shadcn theme, never as hardcoded colors, spacings, or radii inside components.
- **i18n**: next-intl.
- **Testing**: Vitest for unit/integration, Playwright for end-to-end.

Adding a runtime dependency requires a stated reason in the feature plan: what it does, what
building it ourselves would cost, and what the dependency costs. Prefer the platform and existing
dependencies first. Pulling in a shadcn/ui component through its CLI is expected and exempt from
this rule — the Base UI packages it brings along are part of the baseline above.

## Development Workflow & Quality Gates

- **Branching**: feature work happens on a branch, never directly on `main` or `dev`.
- **Pull requests**: every change is reviewed. The review explicitly checks constitution
  compliance — types, test regime, Config usage, localization, tenant scoping, and spec alignment.
- **Merge gates**, all required to pass: TypeScript compiles with no errors, lint clean, Vitest
  suite green, Playwright suite green for affected flows, message-catalog completeness check green
  for every supported locale, Prisma migrations present and applying cleanly, `.env.example`
  updated when configuration changed.
- **Justified complexity**: any deviation from Principle II (extra layer, new abstraction,
  additional dependency) is recorded in the feature plan's complexity-tracking section with its
  rationale and the simpler alternative that was rejected.
- **Secrets**: any suspected exposure stops other work — rotate, purge, then continue.

## Governance

This constitution supersedes ad-hoc practice, prior conventions, and individual preference. Where
a tool default or a habit conflicts with a rule here, this document wins.

**Amendments** are made by pull request that changes this file, states the motivation, and — where
existing code would violate the new rule — includes a migration note describing how and by when
that code is brought into compliance. Amendments take effect on merge.

**Versioning** follows semantic versioning of governance impact:
- **MAJOR**: a principle is removed or redefined in a backward-incompatible way.
- **MINOR**: a principle or section is added, or existing guidance is materially expanded.
- **PATCH**: clarification, wording, or typo fixes that do not change what is required.

**Compliance review**: reviewers verify compliance on every pull request; an unjustified violation
blocks merge. The constitution is re-read at the start of each feature's planning step, and the
resulting plan records its constitution check. Runtime development guidance for agents lives in
`CLAUDE.md` and the `.specify/templates/` templates, which must not contradict this file.

**Version**: 1.3.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-09-12
