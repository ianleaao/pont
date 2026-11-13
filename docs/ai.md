# AI layer (js/ai.js and proxy/)

## Principle
The AI never does the math. It receives numbers already computed by js/engine.js and only explains, organizes, extracts and drafts. Every AI output is labeled "Written by AI. Check the source." and shows a confidence level and the sources it used.

## Architecture (live Claude)
- proxy/: a Cloudflare Worker with one POST endpoint per function. It holds the Anthropic API key as a Worker secret, sets the model, the system prompt and max tokens per function, limits request size, and allows only the prototype's origin (CORS). The key never appears in the browser or in the repo; add proxy/.dev.vars to .gitignore.
- js/ai.js: calls the proxy with a 15 second timeout, validates the JSON against the schema of each function, and on any failure (network, timeout, invalid JSON) returns the matching scripted answer from data/ai-scripts.json with `offline: true` so the UI shows the offline banner.
- Every function returns strict JSON. Free text goes inside defined fields.
- Prompts live in proxy/prompts/, one file per function, versioned in git.
- The Anthropic API key needs a monthly spending limit set in the Anthropic console.

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
