# Pont: study-in-the-U.S. cost planner (E-1 prototype)

## What this is
Pont helps international and cross-border students see the real, full cost of a U.S. college program in their family's currency, compare it with what the family can pay per month, and get a clear plan (applications, scholarships, I-20 and visa steps, documents). Prototype scope: Texas only, undergraduate only.

Tagline: "Others help you get in. Pont shows the real cost, in your currency, and builds the plan."

This is a Harvard DGMD E-1 ("Interactive Prototyping & Creative AI") portfolio prototype. It must look high-fidelity and work end to end for two demo paths. A production app comes later (E-11, Next.js + Convex).

## Stack
- Vanilla HTML, CSS, JavaScript. No frameworks, no build step.
- Runs with VS Code Live Server.
- Data in JSON files under `data/`.
- Font: Public Sans (Google Fonts), weights 400 to 800, for headlines and UI.
- Icons: Lucide (CDN).

## Folder structure
```
index.html          app shell: header, progress, screen, footer
components.html     design system proof (every component, every state)
tests.html          engine checks (console), fixed rate 5.5146
assets/favicon.svg  bridge symbol
css/tokens.css      brand variables (copy from docs/brand.md)
css/app.css         layout and components
js/engine.js        calculation engine: pure functions only, no DOM
js/app.js           screens, navigation, state
js/fx.js            exchange rate once per session, money and rate formats
js/ai.js            AI layer (scripted responses for the prototype)
data/colleges.json  college costs, rules, sources, dates
data/fees.json      government and test fees
data/fx.json        live rate sources and the fallback rate
data/ai-scripts.json scripted AI outputs and failure states
docs/               specs: read the relevant file before each task
```

## Non-negotiable rules
1. The AI never does the math. All amounts come from `js/engine.js`. The AI layer only explains, organizes and drafts text from numbers it receives.
2. Never judge the family. Never write "you can't afford this". Use the neutral budget bands in docs/calculation-rules.md.
3. Never ask income or savings. The only money question is optional: "How much could your family pay per month?"
4. Every amount shows its source and the date it was checked. Missing data shows "Not confirmed" plus the official link. Never invent a number.
5. No legal or visa advice. Show steps, fees and official links; route decisions to the college international office or an attorney.
6. The AI never writes admission essays, never edits or creates official documents, never changes amounts.
7. Do not store sensitive data: no SSN, bank account numbers or immigration documents.
8. UI copy: plain English, short sentences, one question per screen. Never use em dashes (the long dash). Use commas, colons or periods.
9. Mobile first (380 px base), accessible (WCAG AA contrast, labels on inputs, color never the only signal).
10. The page is English (`lang="en"`). Every Portuguese block (Family mode, bank letter) sets `lang="pt-BR"` on its own element.

## Demo paths (must work end to end)
- Lucas: Brazil, no visa (starting from zero), Computer Science at UT Austin, pays 2,000 BRL per month. Result: well above budget, then "Out of my budget" shows ACC first, then transfer to UT, plus the full I-20 and visa checklist.
- Ian: U.S. citizen, parents in Brazil, UT Austin. No visa steps; cost and scholarship plan.

Demo shortcuts: `index.html?demo=lucas` and `index.html?demo=ian`. They fill the onboarding answers, open the last question (7b) and replace any saved session without a message. Nothing about them is visible in the UI.

## Which doc to read
- Product, flows, onboarding questions: docs/product.md
- Screens and exact copy: docs/screens.md
- Colors, type, tokens, components: docs/brand.md
- Formulas, budget bands, currency: docs/calculation-rules.md
- Visa paths, I-20 steps, fees by phase: docs/visa-and-fees.md
- AI functions and failure states: docs/ai.md

## How to work
- Build one screen or one function per task. Do not build the whole app at once.
- Before coding, restate the task and list the files you will touch. Wait for approval.
- Keep `js/engine.js` pure and testable; add a small test page `tests.html` that runs engine checks in the console.
- If a doc is unclear or two docs conflict, stop and ask. Do not guess.
