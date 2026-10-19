# Data Model: Product Landing Page

No stored data, schema, or migration. This file holds the page's shape, the copy it ships, the timing of its
motion, and the colour pairs added to the contrast gate.

## Page structure

```text
AppShell
├── header (banner)
│   ├── logo slot ── Link → PAGES.home ── BrandLogo (h-6)           "Atmo AI"
│   ├── ThemeToggle, LocaleSwitcher                                  (unchanged)
│   └── account slot ── Link → PAGES.signIn (outline, sm)            landing.signIn
├── main
│   ├── LandingHero (section, overflow clipped)
│   │   ├── glow (aria-hidden, brand-mark/10, blurred)
│   │   ├── h1 landing.headline · p landing.subheading               foreground text
│   │   ├── Link → PAGES.signIn (primary, lg)                        landing.signIn
│   │   └── ExampleConversation (figure)
│   │       ├── figcaption landing.example.caption
│   │       ├── customer bubble   [sr-only speaker(example.customer)] landing.example.question
│   │       ├── typing indicator  (aria-hidden)
│   │       └── agent bubble      [sr-only speaker(common.appName)]  landing.example.answer
│   └── BenefitCards (four Cards)
│       └── icon (aria-hidden, brand-mark) · h2 title · p body       landing.benefits.<id>.*
└── footer (contentinfo) ── common.appName
```

Below `md`, the hero is one column and the conversation follows the call to action. From `md`, it has two
columns. The cards are one column, then two from `sm`, then four from `lg`.

| Benefit id | Icon (lucide) | Capability (spec FR-003) |
| ---------- | ------------- | ------------------------ |
| `allHours` | `Clock`       | around the clock         |
| `language` | `Languages`   | the customer's language  |
| `history`  | `History`     | conversation history     |
| `solar`    | `Sun`         | built for solar energy   |

## Catalog keys

Removed: `home.title`, `home.intro`. Reused: `common.appName`. Everything else is new, under `landing`.

| Key                               | en                                                                                                                                                                                                      | uk                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing.metaTitle`               | AI support for your solar system                                                                                                                                                                        | ШІ-підтримка для вашої сонячної станції                                                                                                                                                            |
| `landing.metaDescription`         | An AI support agent that answers your questions about your solar system around the clock, in your language.                                                                                             | ШІ-агент підтримки, який цілодобово відповідає на ваші запитання про сонячну станцію вашою мовою.                                                                                                  |
| `landing.headline`                | AI support for your solar system                                                                                                                                                                        | ШІ-підтримка для вашої сонячної станції                                                                                                                                                            |
| `landing.subheading`              | Atmo AI answers your questions at any hour, in the language you write in, and keeps every conversation.                                                                                                 | Atmo AI відповідає на ваші запитання у будь-яку годину, тією мовою, якою ви пишете, і зберігає кожну розмову.                                                                                      |
| `landing.signIn`                  | Sign in                                                                                                                                                                                                 | Увійти                                                                                                                                                                                             |
| `landing.example.caption`         | Example conversation                                                                                                                                                                                    | Приклад розмови                                                                                                                                                                                    |
| `landing.example.customer`        | Customer                                                                                                                                                                                                | Клієнт                                                                                                                                                                                             |
| `landing.example.speaker`         | {name}:                                                                                                                                                                                                 | {name}:                                                                                                                                                                                            |
| `landing.example.question`        | Why is my solar system producing less this week?                                                                                                                                                        | Чому моя сонячна станція цього тижня виробляє менше?                                                                                                                                               |
| `landing.example.answer`          | Output usually drops when there is more cloud, when panels are dusty or shaded, or as days get shorter. If the weather has been clear and the panels are clean, check the inverter for a warning light. | Виробіток зазвичай падає, коли більше хмар, коли панелі запилені чи затінені або коли дні коротшають. Якщо погода була ясна, а панелі чисті, перевірте, чи не світиться попередження на інверторі. |
| `landing.benefits.allHours.title` | Around the clock                                                                                                                                                                                        | Цілодобово                                                                                                                                                                                         |
| `landing.benefits.allHours.body`  | You get an answer at any hour, weekends and holidays included.                                                                                                                                          | Ви отримуєте відповідь у будь-яку годину, також у вихідні та свята.                                                                                                                                |
| `landing.benefits.language.title` | In your language                                                                                                                                                                                        | Вашою мовою                                                                                                                                                                                        |
| `landing.benefits.language.body`  | The agent replies in the language you write in.                                                                                                                                                         | Агент відповідає тією мовою, якою ви пишете.                                                                                                                                                       |
| `landing.benefits.history.title`  | Conversation history                                                                                                                                                                                    | Історія розмов                                                                                                                                                                                     |
| `landing.benefits.history.body`   | Every conversation is kept, so you can pick it up where you left off.                                                                                                                                   | Кожна розмова зберігається, тож ви можете продовжити її з того місця, де зупинилися.                                                                                                               |
| `landing.benefits.solar.title`    | Built for solar energy                                                                                                                                                                                  | Створено для сонячної енергетики                                                                                                                                                                   |
| `landing.benefits.solar.body`     | Knows what owners of solar systems ask about.                                                                                                                                                           | Знає, про що запитують власники сонячних станцій.                                                                                                                                                  |

Checked against spec FR-003 and FR-004:

- No figures, customers, prices, partner-data integration, human handoff, analytics, or per-partner
  separation.
- The answer gives general guidance and does not look up the customer's system (FR-012).
- `landing.metaTitle` does not name the product, because `common.titleTemplate` adds "— Atmo AI".

## Motion timeline

Times are from the page's first paint. Every animation is finite.

| Element          | Animation                          | Starts | Ends   | Reduced motion |
| ---------------- | ---------------------------------- | ------ | ------ | -------------- |
| Hero text column | fade in                            | 0      | 500ms  | none, visible  |
| Conversation     | fade in                            | 0      | 500ms  | none, visible  |
| Question bubble  | fade in, slight rise               | 300ms  | 600ms  | none, visible  |
| Typing indicator | shown, dots move, hidden           | 800ms  | 1800ms | hidden         |
| Answer bubble    | fade in, over the indicator's spot | 1800ms | 2200ms | none, visible  |

These durations are a target, not a contract: the spec asks for the order and for the sequence to end
within about three seconds (FR-015). The e2e check asserts the order's end state, and that every animation
has finished by 3.5s.

## Contrast pairs added to the gate

Added to `PAIRS` in `src/conventions/theme-contrast.test.ts` and checked in both themes. The values come
from [research R6](./research.md#r6--brand-red-glow-strength-icon-surface-and-which-text-sits-on-the-glow).

| Foreground   | Surface                           | Min | Covers                          |
| ------------ | --------------------------------- | --- | ------------------------------- |
| `foreground` | `brand-mark/10` over `background` | 4.5 | headline and subheading on glow |
| `ring`       | `brand-mark/10` over `background` | 3   | call to action's focus on glow  |
| `brand-mark` | `card`                            | 3   | benefit icons (FR-026)          |

Also added: a scan of `landing-hero.tsx` that fails on any `brand-mark/NN` stronger than `/10`.
