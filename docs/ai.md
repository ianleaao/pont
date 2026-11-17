# AI layer (js/ai.js and js/prompts.js)

## Principle
The AI never does the math. It receives numbers already computed by js/engine.js and only explains, organizes, extracts and drafts. Every AI output is labeled "Written by AI. Check the source." and shows a confidence level and the sources it used.

## Architecture (live Claude at zero cost, decided 16 Nov 2026)
- The prototype is published as a claude.ai Artifact (Claude in Cowork publishes each version from the repo). Inside the Artifact, the page reaches Claude through the Artifact runtime: `const sample = await claude.use("sample")`. Every call spends the VIEWER's own Claude usage; the first call asks the viewer to allow it. No API key, no proxy, no paid account.
- Manifest declared at publish: `capabilities: {sample: {images: true}}`. Images are needed by the document reader.
- js/ai.js picks the provider at runtime:
  1. Artifact runtime: `window.claude` exists and `claude.use("sample")` resolves a function. Use `sample.json(input, {modelTier})` for structured answers and `sample.limits()` to check that images are allowed before sending a document.
  2. Scripted fallback: anywhere else (Live Server, tests, a viewer who declines, `rate_limited`, any error). Returns the matching answer from data/ai-scripts.json with `offline: true`, so the UI shows the offline banner.
- Rules from the runtime: the model has no system prompt, no memory and no web. Each call sends the instructions, the data and the JSON format together in `input` (built in js/prompts.js). Call only on an explicit viewer action (Send, Analyze document, Explain), or once at load with a stable prompt; never in a loop or timer. Handle `not_granted` (hide or fall back), `rate_limited` (fall back, no retry loop) and invalid JSON (fall back).
- Validate every answer against the function's JSON shape; anything invalid falls back.
- Exchange rates inside the Artifact: external fetches may be blocked, so js/fx.js must fall back to data/fx.json. Before each publish, data/fx.json is refreshed with a Frankfurter snapshot for every currency in data/countries.json, with source and date (Claude Code runs a small script for it).
- E-11 later: the same prompts move to the Claude API through the Convex Agent Component.

## Functions
| # | Function | Input | Output (JSON) | Failure state |
| --- | --- | --- | --- | --- |
| 1 | Intake interviewer | Conversation so far, list of allowed values | Next question, chips, structured answers with confidence | Unclear answer: ask again with chips; never guess a country or status |
| 2 | Funding explainer | Funding profile and net price from the engine | Plain-language explanation per college, sources | Policy not confirmed: say so and link the official page |
| 3 | Routes explainer | Routes from the engine | One-line reason per route | No route closes the gap: suggest later start, more scholarships, other options; never "you can't" |
| 4 | Document reader and translator (vision) | Image or PDF page, college document rules | Fields (holder, date, currency, amounts), working translation, confidence per field, flags | Low confidence: highlight the field and ask the student to confirm; unreadable file: ask for a clearer scan |
| 5 | Drafts | Profile, college, language | Bank letter request in the family language; message to the aid office | Language not supported: draft in English with a note |
| 6 | Essay coach | Student draft | Suggestions on content and English | Request to write the essay: decline with the fixed message |
| 7 | Family mode | Plan and engine numbers | Summary in the family language and currency, next three steps | Term without a safe translation: keep the English term with a plain explanation |

The USD conversion of document amounts is done by js/engine.js with the rate from js/fx.js, never by the AI.

## Document rules used by the reader
UT Austin rules live in data/colleges.json (i20.document_rules; source UT ISSS financial information, checked 10 Nov 2026): upload only through myIO; English or a separate signed translation; student's name on it (or a Statement of Financial Support from the sponsor); not older than 6 months; liquid funds only (official not-accepted list); at most 10 pages. Add the equivalent rules for each new college from its official page.
The AI only flags and explains. It never edits the document and never says the document will be accepted.

## Prototype screens that must show AI
Intake chat, funding map explanations, routes explanations, documents studio (reader, translation, flags), drafts, essay coach decline, family mode, offline banner with scripted fallback.

## Guardrails
- Never changes amounts, never invents or edits official documents, never submits anything, never promises aid or admission.
- No legal or visa advice; route to the college international office or an attorney.
- Never says the family cannot afford something; uses funding gap language and lists what can close it.
- Never asks for SSN, account numbers, ID numbers or immigration documents; drops them if they appear in an uploaded file.
- Demo uses sample documents only (marked SAMPLE).
