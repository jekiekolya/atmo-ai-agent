---
description: "Task list for Product Landing Page"
---

# Tasks: Product Landing Page

**Input**: Design documents from `/specs/007-landing-page/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui.md](./contracts/ui.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The spec asks for them (FR-032), and so does the constitution (Principle IV). Every
module here is test-together (plan.md § Test regime): a test ships in the same task as what it covers.

**Organization**: Tasks are grouped by the spec's user stories:

- US1 — a visitor learns what the product is (P1): the page, its copy, header, cards, and footer;
- US2 — Sign in from the landing page (P1);
- US3 — the example conversation plays once (P2);
- US4 — back to the landing page through the logo (P2).

US1 builds the example conversation in its final, still state. US3 adds the motion and the typing
indicator on top of it.

**Conventions for every task**:

- Import links from `@/i18n/navigation` and addresses from `PAGES` in `@/lib/routes`. Never write a path
  literal outside e2e files.
- Use only theme tokens for colour. `brand-mark` is allowed only where a task says so.
- Component tests mock next-intl with `vi.mock("next-intl", () => import("@/testing/next-intl-mock"))`.
  Keys then render as `namespace.key`.
- Comments are rare and one line (CLAUDE.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 – US4)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Confirm the baseline on branch `007-landing-page`:
  - Run `npm run typecheck`, `npm run lint` and `npm run test:run`. All must be green before any change.
  - Note whether `.next/prerender-manifest.json` lists `/en` and `/uk`. It does today (research R9).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add the `landing` namespace to `src/messages/en.json` and `src/messages/uk.json`, with exactly
      the keys and texts in data-model.md § Catalog keys. Keep the same key order in both files.
  - Do not remove `home.*` yet: `src/app/[locale]/page.tsx` still reads it until T008.
  - Run `npm run test:run -- src/i18n`. The parity and "Atmo AI" naming checks must pass, and
    `landing.metaTitle` must not contain "Atmo".

**Checkpoint**: every user story can now read its copy.

---

## Phase 3: User Story 1 — A visitor learns what the product is (Priority: P1) 🎯 MVP

**Goal**: `/en` and `/uk` show the header (logo, theme, language, Sign in), the hero with the still example
conversation, four benefit cards, and a footer, in both themes and down to 320px.

**Independent Test**: Open `/en` and `/uk` anonymously, in both themes, at desktop width and at 320px.
Read every piece of copy against spec FR-003 and FR-004, and check that nothing scrolls sideways.

- [x] T003 [P] [US1] Add an optional `footer` slot to `AppShell` in
      `src/components/shell/app-shell/app-shell.tsx` (contracts/ui.md § AppShell, research R3).
  - Add `footer?: ReactNode` to the props.
  - After `<main>`, render `{footer && <footer className="border-t px-4 py-6 text-sm text-muted-foreground">{footer}</footer>}`.
  - Leave the header and `<main>` unchanged.

  In `src/components/shell/app-shell/app-shell.test.tsx`, add two tests:
  - with `footer`: `getByRole("contentinfo")` contains it and is the next sibling of `getByRole("main")`;
  - without `footer`: `queryByRole("contentinfo")` is null.

- [x] T004 [P] [US1] Create `ExampleConversation` in
      `src/components/landing/example-conversation/example-conversation.tsx`, in its final, still state
      (contracts/ui.md § ExampleConversation, research R5). It is a server component with no props and
      reads `useTranslations("landing")` and `useTranslations("common")`.
  - **Figure**: `<figure>` styled as a card surface (`rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 p-4`),
    with `<figcaption className="text-xs text-muted-foreground">{t("example.caption")}</figcaption>`.
  - **Customer bubble**: aligned to the end, `bg-primary text-primary-foreground`, rounded, `max-w-[85%]`.
    Inside: `<span className="sr-only">{t("example.speaker", { name: t("example.customer") })} </span>`
    followed by `t("example.question")`.
  - **Agent bubble**: aligned to the start, `bg-muted text-foreground`, rounded, `max-w-[85%]`. Inside:
    `<span className="sr-only">{t("example.speaker", { name: common("appName") })} </span>` followed by
    `t("example.answer")`. Wrap it in a `relative` container, so that T014 can position the typing
    indicator over its start.
  - **No literal text**: write no text in the markup, punctuation included (research R5). The single space
    after each label only separates it from the message.
  - **Not interactive**: no link, button, input, `tabindex`, `role`, or `aria-live` anywhere inside.

  Test in `example-conversation.test.tsx`:
  - `getByRole("figure", { name: "landing.example.caption" })` exists;
  - it contains `landing.example.question` and `landing.example.answer`, and exactly two
    `landing.example.speaker` labels inside `.sr-only` elements (the mock ignores the `name` argument);
  - `figure.querySelectorAll("a,button,input,textarea,select,[tabindex]")` is empty;
  - no element has `aria-live`.

- [x] T005 [P] [US1] Create `BenefitCards` in `src/components/landing/benefit-cards/benefit-cards.tsx`
      (contracts/ui.md § BenefitCards, data-model.md § Page structure). It is a server component with no
      props.
  - Define a constant array, in order: `allHours`/`Clock`, `language`/`Languages`, `history`/`History`,
    `solar`/`Sun`. Import the icons from `lucide-react`.
  - Render a `<section>` with a grid, `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`, inside the page's
    content width.
  - Each item is a `Card` from `@/components/ui/card` with `CardContent` holding:
    - the icon, `className="size-6 text-brand-mark"`, with no wrapper tile behind it (research R6);
    - `<h2 className="font-medium">{t(`benefits.${id}.title`)}</h2>`;
    - `<p className="text-muted-foreground">{t(`benefits.${id}.body`)}</p>`.

  Test in `benefit-cards.test.tsx`:
  - `getAllByRole("heading", { level: 2 })` gives the four title keys in order;
  - each card has its body key;
  - the container has no `img` role, because the icons are `aria-hidden` by lucide's default.

- [x] T006 [US1] Create `LandingHero` in `src/components/landing/landing-hero/landing-hero.tsx`
      (contracts/ui.md § LandingHero, research R6). It depends on T004. It is a server component with no
      props.
  - **Section**: `<section className="relative isolate overflow-hidden">`.
  - **Glow**: `<div aria-hidden="true" className="absolute … -z-10 rounded-full bg-brand-mark/10 blur-3xl" />`,
    sized and placed behind the hero. Use `/10` and no stronger tint anywhere in the file.
  - **Layout**: a content-width container with `grid gap-10 md:grid-cols-2 md:items-center` and responsive
    padding.
  - **Text column**: `<h1>` with `t("headline")` (large, `font-medium`, `text-balance`); `<p>` with
    `t("subheading")` in `text-foreground`, not `text-muted-foreground` (research R6); a
    `<Link href={PAGES.signIn} className={buttonVariants({ size: "lg" })}>{t("signIn")}</Link>`.
  - **Second column**: `<ExampleConversation />`.

  Test in `landing-hero.test.tsx`:
  - mock `@/i18n/navigation` so that `Link` renders `<a href={href}>`;
  - exactly one `h1` (`landing.headline`);
  - a link named `landing.signIn` with `href="/sign-in"`;
  - the glow element has `aria-hidden="true"`;
  - the figure is present.

- [x] T007 [P] [US1] Update the conventions for the landing accents (research R6, R7).
  - **`src/conventions/brand-mark-usage.test.ts`**: add
    `src/components/landing/landing-hero/landing-hero.tsx` and
    `src/components/landing/benefit-cards/benefit-cards.tsx` to `ALLOWED`. Extend the header comment with
    "spec 007, FR-026: the hero glow and the benefit icons".
  - **`src/conventions/theme-contrast.test.ts`**: add three pairs to `PAIRS`:
    - `{ fg: "foreground", surface: "brand-mark/10", over: "background", min: TEXT }`;
    - `{ fg: "ring", surface: "brand-mark/10", over: "background", min: GRAPHIC }`;
    - `{ fg: "brand-mark", surface: "card", min: GRAPHIC }`.

    Then add a `describe` that reads `landing-hero.tsx` and fails on any `brand-mark/NN` with NN > 10,
    mirroring the destructive-tint scan.

- [x] T008 [US1] Rewrite `src/app/[locale]/page.tsx` (contracts/ui.md § Landing page). It depends on T003,
      T005 and T006.
  - **Metadata**: `generateMetadata` returns `{ title: t("metaTitle"), description: t("metaDescription") }`
    from `getTranslations("landing")`.
  - **Page**: the default export renders `<AppShell>` with:
    - `logo`: `<Link href={PAGES.home} className="rounded-sm"><BrandLogo className="h-6 w-auto" /></Link>`;
    - `account`: `<Link href={PAGES.signIn} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("signIn")}</Link>`;
    - `footer`: `{common("appName")}`;
    - children: `<LandingHero />` then `<BenefitCards />` (wrapped in the content-width container with
      vertical padding).
  - **No request data**: no session, cookies, headers, or database.
  - **Catalogs**: remove `home` from `src/messages/en.json` and `src/messages/uk.json`. Confirm with grep
    that no `"home"` namespace use remains in `src`.
  - Run `npm run typecheck`.

- [x] T009 [P] [US1] Move the e2e headline assertions to the new copy.
  - In `e2e/locale-switching.spec.ts` and `e2e/locale-resolution.spec.ts`, replace "How can we help?" with
    "AI support for your solar system", and "Чим можемо допомогти?" with
    "ШІ-підтримка для вашої сонячної станції".
  - Change nothing else. The first file is the spec's FR-030 coverage.

- [x] T010 [P] [US1] Extend `e2e/smoke.spec.ts` (FR-032, SC-008).
  - Keep the existing `/` test.
  - Add a loop over `/en` and `/uk` that collects console errors and page errors the same way, expects
    status 200, waits for `networkidle`, and expects `errors` to equal `[]`.
  - Reuse `IGNORED_CONSOLE_ERRORS`.

- [x] T011 [US1] Create `e2e/landing.spec.ts` with a `test.describe("landing page (US1)")` block (FR-005,
      FR-007, FR-028, SC-006). For `en` and `uk`:
  - the banner's first link is named "Atmo AI" with `href` `/{locale}`;
  - the banner has a link named "Sign in" / "Увійти";
  - there is one `h1` with the localized headline;
  - there is a `figure` named "Example conversation" / "Приклад розмови";
  - there are four `h2`s;
  - `getByRole("contentinfo")` contains "Atmo AI";
  - the page title is "AI support for your solar system — Atmo AI" (en), and the uk equivalent;
  - at viewport 320×640, `document.documentElement.scrollWidth <= window.innerWidth`;
  - not-found still leads back here (FR-021): `goto("/{locale}/no-such-page")`, click the not-found page's
    back-home link ("Back to the start" / "На головну", `notFound.backHome`), and expect `/{locale}$`
    with the landing `h1`.

**Checkpoint**: US1 is complete. The placeholder is gone and the page stands on its own.

---

## Phase 4: User Story 2 — Sign in from the landing page (Priority: P1)

**Goal**: Both Sign in actions reach the sign-in form when anonymous and the dashboard when signed in. The
page is the same for both visitors.

**Independent Test**: Press each Sign in action once anonymously and once signed in, in each language.

- [x] T012 [US2] Add a `test.describe("Sign in (US2)")` block to `e2e/landing.spec.ts` (FR-019, FR-020,
      SC-002). It depends on T011.
  - **Anonymous**: for each of the two actions, go to `/{locale}`, click it, and expect `/{locale}/sign-in`
    with the email field visible:
    - the header action: `getByRole("banner").getByRole("link", { name: "Sign in" })`;
    - the hero action: the "Sign in" link inside `main`.

    Cover both `en` and `uk` (with the label "Увійти").

  - **Signed in**: use `signedInAsOwner(browser)` from `e2e/support/sign-in.ts`. Then:
    - `goto("/en")`; expect the URL to stay `/en$` and the same `h1` and "Sign in" header link as for an
      anonymous visitor;
    - click each Sign in action in turn and expect `/en/dashboard$` after the one click.

**Checkpoint**: US1 and US2 together are the MVP.

---

## Phase 5: User Story 3 — The example conversation plays once (Priority: P2)

**Goal**: The hero fades in and the conversation plays: question, typing indicator, answer. It is finished
by about three seconds, plays on every opening, and stays still under reduced motion.

**Independent Test**: Load the page normally and with reduced motion, and observe the sequence and the
final state.

- [x] T013 [US3] Add the typing-indicator keyframes to the `@theme` block of `src/app/globals.css`, beside
      the loader's (research R4, data-model.md § Motion timeline).
  - **`--animate-typing-indicator`**: `typing-indicator 1.8s linear both`, with
    `@keyframes typing-indicator`:
    - `0%, 44%` → `opacity: 0`;
    - `50%, 94%` → `opacity: 1`;
    - `100%` → `opacity: 0`.
  - **`--animate-typing-dot`**: a finite keyframe, `typing-dot`, that lifts a dot by about `0.25rem` and
    back. Use a fixed iteration count, for example `typing-dot 0.5s ease-in-out 0.8s 2`. Each dot adds its
    own small delay through `[animation-delay:…]` within the indicator's visible window.
  - No `infinite` anywhere.

- [x] T014 [US3] Add the motion to `ExampleConversation` and `LandingHero` (contracts/ui.md, research R4).
      It depends on T004, T006 and T013.
  - **`example-conversation.tsx`**:
    - figure: `animate-in fade-in duration-500 motion-reduce:animate-none`;
    - customer bubble: `animate-in fade-in slide-in-from-bottom-1 delay-300 duration-300 fill-mode-backwards motion-reduce:animate-none`;
    - agent bubble: `animate-in fade-in delay-[1800ms] duration-400 fill-mode-backwards motion-reduce:animate-none`;
    - typing indicator: a new element inside the agent bubble's `relative` container, absolutely
      positioned at its start. It is a small `bg-muted` bubble with three `size-1.5 rounded-full
bg-muted-foreground` dots using `animate-typing-dot`. It is `aria-hidden="true"`, with
      `animate-typing-indicator motion-reduce:hidden`.
  - **`landing-hero.tsx`**: the text column gets `animate-in fade-in duration-500 motion-reduce:animate-none`.

  Update `example-conversation.test.tsx`:
  - the typing indicator has `aria-hidden="true"` and the `motion-reduce:hidden` class;
  - every element whose class contains `animate-` also contains `motion-reduce:animate-none`, except the
    indicator, which has `motion-reduce:hidden`, and its dots inside it;
  - the answer text is in the DOM from the first render (FR-018).

- [x] T015 [US3] Add a `test.describe("motion (US3)")` block to `e2e/landing.spec.ts` (FR-015, FR-016,
      SC-007).
  - **Reduced motion**: `page.emulateMedia({ reducedMotion: "reduce" })` before `goto("/en")`. Then,
    without waiting:
    - `document.getAnimations().length` is `0`;
    - the answer bubble's computed `opacity` is `"1"`;
    - the typing indicator is hidden (`toBeHidden()`).
  - **Normal motion**: `goto("/en")`, then `expect.poll(() => page.evaluate(() =>
document.getAnimations().every(a => a.playState === "finished")), { timeout: 3_500 }).toBe(true)`.
    After that, the answer's opacity is `"1"` and the indicator's computed opacity is `"0"`.
  - **Theme change** (FR-017): after the sequence has finished, click the theme toggle ("Switch between
    light and dark"). Wait until `<html>` has the `dark` class, and expect every animation to still be
    `finished`, with none newly running.
  - **Replay** (clarification A, FR-015): after the sequence has finished, click the header's Sign in link,
    which is a client navigation. Wait for `/en/sign-in`, then `page.goBack()` and wait for `/en$`. Expect
    at least one animation that is not finished right after the return, and all of them finished within
    3.5s. Do not use `goto` for this step: a full navigation followed by Back is the back-forward-cache
    case, which FR-015 exempts and Playwright's Chromium does not reproduce.

**Checkpoint**: the page moves once per opening and is still under reduced motion.

---

## Phase 6: User Story 4 — Back to the landing page through the logo (Priority: P2)

**Goal**: The centred logo on sign-in and invite is a link to the landing page, and its look is unchanged.

**Independent Test**: On sign-in and an invite page, in each language, press the logo and reach it by
keyboard.

- [x] T016 [P] [US4] Wrap the logo in a link on both public pages (research R8, contracts/ui.md § Sign-in
      and invite pages).
  - **`src/app/[locale]/(public)/sign-in/page.tsx`**: replace
    `<BrandLogo className="mx-auto h-10 w-auto" />` with
    `<Link href={PAGES.home} className="self-center rounded-sm"><BrandLogo className="h-10 w-auto" /></Link>`.
    Import `Link` from `@/i18n/navigation`.
  - **`src/app/[locale]/(public)/invite/[token]/page.tsx`**: make the same change. `Link` is already
    imported there.
  - Change nothing else: the redirect, the signed-in notice, Sign out, and `referrer: "no-referrer"` stay.

- [x] T017 [US4] Update the sign-in and invite logo test in `e2e/brand.spec.ts` (FR-022, FR-023, SC-003).
      It depends on T016.
  - Rename the test to "…shows the logo above the card as a link to the landing page, not in the header
    (spec 005 FR-023, spec 007 FR-022)".
  - **Keep**: the banner-has-no-logo check, the single-logo count, and the logo-above-heading geometry.
  - **Replace** the non-link and no-focus checks with:
    - `const link = page.getByRole("link", { name: "Atmo AI" })`; expect it to have count 1, to contain
      the logo, and to have `href` `/en`;
    - Tab up to 8 times until `link` is focused, and assert it receives focus;
    - press Enter and expect `/en$`.
  - Add a `uk` iteration for `/uk/sign-in` that expects `/uk$`.

**Checkpoint**: all four stories are complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T018 [P] Add supersession pointers to `specs/005-atmo-brand/spec.md`, one line each:
  - under FR-011: "Superseded on the landing page only for the hero glow and benefit icons by spec 007,
    FR-026.";
  - under FR-023: "Superseded for the landing page only by spec 007, FR-007.";
  - under FR-024 and User Story 2 scenario 3: "Superseded by spec 007, FR-022: the logo is a link to the
    landing page."

  Change no other text.

- [x] T019 Run every gate: `npm run typecheck`, `npm run lint`, `npm run test:run`, and
      `npm run e2e -- smoke landing brand locale-switching locale-resolution theme-switching auth invite`
      (theme-switching runs entirely on `/en`, the landing page — FR-024). All must be
      green. Then run the full `npm run e2e` once.
- [x] T020 Run quickstart.md §2: `npm run build`. Confirm the route table shows `/[locale]` prerendered,
      with `/en` and `/uk` listed (MC-003, FR-019).
- [ ] T021 Run quickstart.md §3, steps 1–8, by hand: content, themes, 320px, reduced motion, no scripts,
      VoiceOver, logo links, and signed in. Record anything that fails as an amendment to spec 007 before
      changing code (Principle III).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002)** → user stories.
- **US1 (T003–T011)**:
  - T003, T004, T005, T007, T009 and T010 run in parallel;
  - T006 needs T004;
  - T008 needs T003, T005 and T006;
  - T011 needs T008.
- **US2 (T012)** needs T008, because the Sign in links exist from US1, and T011, because it shares the
  spec file.
- **US3 (T013–T015)** needs T004 and T006. T014 needs T013. T015 needs T014 and T011.
- **US4 (T016–T017)** needs only T002 and can run beside US1. T017 needs T016.
- **Polish (T018–T021)** comes after all stories. T018 can run any time.

### Parallel example — US1

```text
T003 AppShell footer slot      | T004 ExampleConversation | T005 BenefitCards
T007 conventions               | T009 e2e headlines       | T010 smoke en/uk
then T006 LandingHero → T008 page.tsx → T011 landing e2e
```

US4 (T016 → T017) can be worked by a second person at the same time as US1.

## Implementation Strategy

1. **MVP = US1 + US2**: the page replaces the placeholder and leads into the product. Stop and validate
   with quickstart §1 and §3, steps 1–3 and 8.
2. **US3**: motion on top of the still conversation. It can ship separately, because the still state
   already meets every content requirement.
3. **US4**: the logo links. They are independent of the page's internals.
4. **Polish**: the spec 005 pointers, the full gates, the build check, and the by-hand pass.

Done means the spec's acceptance scenarios and SC-001 – SC-010 hold and every gate is green. Anything
beyond that is recorded as a note, not built.
