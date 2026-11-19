# Pont: AI funding advisor for international students (E-1 prototype)

## What this is (direction approved 13 Nov 2026)
Pont works like a consultant. It learns the student's goal (for example "I want Harvard"), finds which financial aid and scholarships this exact profile can get, builds the routes to fund it ("Your dream", "Strong aid for you", "Lower-cost path"), and prepares the financial documents with AI (read, translate, convert to USD, flag problems).

Pont is NOT a cost calculator. Cost is one input to the funding strategy, never the headline.

Tagline: "Tell us your dream school. We find the scholarships to get you there."

Users: international students from ANY country applying to U.S. colleges (undergraduate first), plus cross-border students (U.S. citizen or resident with parents abroad). Never Brazil-only. Europe comes later.

This is a Harvard DGMD E-1 ("Digital Media: From Ideas to Designs and Prototypes") equivalency prototype: concept, brand, personas and stories, storyboard, component pattern library, and an interactive high-fidelity prototype with live data. A production app comes later (E-11, Next.js + Convex + Agent Component).

The previous direction ("See the real cost of studying in the U.S.") is replaced. Full decision record: Notion, Project HQ, page "12 Pivot Proposal".

## Stack
- Vanilla HTML, CSS, JavaScript. No frameworks, no build step. Runs with VS Code Live Server.
- Data in JSON files under `data/`.
- Live data: exchange rates (Frankfurter v2, then ExchangeRate-API, then data/fx.json) and live Claude.
- Live Claude, at zero cost (decided 16 Nov 2026): the prototype is published as a claude.ai Artifact. Inside the Artifact, js/ai.js calls Claude through the Artifact runtime (`await claude.use("sample")`, with images enabled for the documents studio). Each call uses the viewer's own Claude plan: no API key, no proxy, no paid account. Outside the Artifact (Live Server), js/ai.js uses the scripted answers. The E-11 rebuild moves to the Claude API through Convex.
- Visual design v4 "Campus": docs/design-campus.md, visual reference docs/mockups/dashboard.html. Font: Plus Jakarta Sans (Google Fonts). Icons: Lucide (CDN, pinned version).

## Folder structure
```
index.html
components.html        design system proof (the 14 Campus components in every state, engine values)
tests.html             engine tests (console + page)
assets/                favicon and images
css/tokens.css         brand variables (copy of docs/brand.md)
css/app.css            layout and components
js/engine.js           pure functions only: costs, funding profile, net price, gap, routes
js/fx.js               exchange rate loader and money formatting (any currency)
js/ai.js               AI client: Artifact runtime (claude.use("sample")) when available, else scripted answers; validates JSON
js/ui.js               component renderers (HTML strings) shared by the app and components.html; no math
js/app.js              intake, app shell (sidebar, top bar, advisor rail), pages, navigation, state
data/colleges.json     costs, aid policies, forms, deadlines, document rules, sources, dates
data/fees.json         government and test fees
data/countries.json    country -> currency, locale, language, ESTA, country notes
data/fx.json           fallback rates
data/ai-scripts.json   scripted fallback answers and failure states
js/prompts.js          one prompt builder per AI function (instructions + data + JSON format)
docs/                  specs: read the relevant file before each task
docs/mockups/          visual references (dashboard.html: Overview)
```

## Non-negotiable rules
1. The AI never does the math. Every amount comes from js/engine.js. The AI explains, organizes, extracts and drafts text from numbers it receives.
2. Never judge the family. Never write "you can't afford this". Show the funding gap per route and what can close it.
3. Money questions are optional and coarse: family income band (ranges, needed for need-based aid estimates) and "How much could your family pay per month?". Never exact income, savings balances, SSN or account numbers. Answers are never stored outside the browser tab.
4. Every amount and every aid rule shows its source and the date it was checked. Missing data shows "Not confirmed" plus the official link. Never invent a number or a policy.
5. No legal or visa advice. Show steps, fees and official links; route decisions to the college international office or an attorney.
6. The AI never writes admission essays, never edits or creates official documents, never changes amounts, never promises aid. Translations are labeled "Working translation, not certified."
7. Do not store sensitive data. Documents are processed for the session only; the document reader is instructed to drop account numbers and ID numbers.
8. UI copy: plain English, short sentences, one question per screen in forms. Never use em dashes (the long dash). Use commas, colons or periods.
9. Desktop first, adapting to 380 px with no horizontal scroll. Accessible (WCAG AA contrast, labels on inputs, color never the only signal).
10. Country-agnostic: currency, number format and family language come from data/countries.json. No Brazil defaults anywhere.
11. The page is English (`lang="en"`). Every block in the family language (family mode, bank letter, drafts) sets its own `lang` on its element (for example `lang="pt-BR"`, `lang="hi"`).

## Demo paths (must work end to end)
- Path 1, dream school: Ananya, India (INR), no visa, wants Harvard, income band under 65,000 USD, can pay about 10,000 INR per month. Result: Harvard is need-blind for internationals and meets full need; estimated family cost near 0 under Harvard's published threshold, label "Funded" with the lines still to confirm; plan with CSS Profile, documents and deadlines; MIT and Amherst in "Strong aid for you" (no estimate yet, official aid page); documents studio with an Indian bank statement sample; family mode in Hindi.
- Path 2, funding gap: Lucas, Brazil (BRL), no visa, Computer Science at UT Austin, can pay about 23,000 BRL per month (same value as the current tests). Result: UT gives internationals merit scholarships only; gap shown; routes: ACC then UT transfer in "Lower-cost path", outside scholarships, full-need colleges (Harvard, MIT, Amherst) in "Strong aid for you"; I-20 documents converted to USD.
- Path 3, cross-border: Ian, U.S. citizen, parents in Brazil, UT Austin. FAFSA path with foreign income (UT net price: no estimate, link to the Texas One Stop aid page), residency check card, parents' documents converted to USD.

Demo shortcuts: `index.html?demo=ananya`, `index.html?demo=lucas` and `index.html?demo=ian`. They fill the intake answers, open Overview and replace any saved session without a message. (When task 5 builds the profile confirm screen, the demos open it and "Build my funding plan" leads to Overview.) Nothing about them is visible in the UI.

## Which doc to read
- Product, journey, intake questions: docs/product.md
- Screens and exact copy: docs/screens.md
- Funding profile, aid policies, net price, gap, routes, currency by country: docs/funding-and-currency.md
- Cost formulas (still valid for the cost part): docs/calculation-rules.md. Sections 4 (budget band) and 7 (BRL-only currency) are replaced by docs/funding-and-currency.md.
- Visa paths, I-20 steps, fees by phase: docs/visa-and-fees.md
- AI functions, Artifact runtime, guardrails and failure states: docs/ai.md
- Colors, type, tokens: docs/brand.md
- Visual design, app shell, components and pages: docs/design-campus.md (reference: docs/mockups/dashboard.html)

## How to work
- Build one screen or one function per task. Do not build the whole app at once.
- Before coding, restate the task and list the files you will touch. Wait for approval.
- Keep js/engine.js pure and testable; every new engine function gets tests in tests.html. Existing tests must keep passing.
- New data must come from official pages, with source URL and checked date. If you cannot confirm a value, store null with status "not_confirmed". Never guess.
- If a doc is unclear or two docs conflict, stop and ask. Do not guess.
- Interface polish comes later (separate UI agents). Now: correct flows, real data, real AI, accessible and clean.
