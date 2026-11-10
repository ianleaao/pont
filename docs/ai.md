# AI layer (js/ai.js)

## Principle
The AI never does the math. It receives numbers already computed by js/engine.js and only explains, organizes and drafts. Every AI output is labeled "Written by AI. Check the source." and shows a confidence level and the sources it used.

## Prototype approach
For the E-1 prototype, AI outputs are scripted in data/ai-scripts.json, keyed by function and demo path, with variables filled from the engine (for example {total_family}). This keeps the demo reliable. A live Claude call through a small serverless proxy is optional and later; never put an API key in the browser.

Each scripted output has: id, function, path (lucas or ian), text (with variables), confidence (high, medium, low), sources (list of source ids), and an optional failure variant.

## Functions
| # | Function | In prototype |
| --- | --- | --- |
| 1 | Profile triage and plan builder | Implicit (engine + copy) |
| 2 | Scholarship path routing | Copy on college detail |
| 3 | Currency and document conversion with rate and date | Engine; AI explains |
| 4 | Essay coaching only (never writes essays) | Failure state screen only |
| 5 | Alternatives explainer | Yes, on "Out of my budget" |
| 6 | Language gaps | No |
| 7 | I-20 document and message assistant | Yes: document check + bank letter draft |
| 8 | Family mode: plan summary for parents in their language and currency | Yes |
| 9 | "Why this number?" with official source | Optional |
| 10 | What-if simulator: exchange rate, scholarship, community-college path; engine recalculates, AI explains the change | Yes |
| 11 | Aid offer reader in local currency | No |
| 12 | Rule radar | Alert banners only |
| 13 | Money-focused interview practice | No |
| 14 | Aid review letter draft | No |
| 15 | Savings plan for "a bit above" | No |

## Prototype AI screens (must exist)
1. Family mode (path Lucas): Portuguese summary for parents, total in BRL, next three steps. Failure variant: a term without a safe translation keeps the English term with a plain explanation.
2. What-if simulator: controls for exchange rate (+/- 10%), scholarship amount, "start at ACC". Engine recalculates band; AI explains in two sentences what changed. Failure variant: scenario outside the data shows a range, never a promise.
3. Document check (I-20 kit): student uploads a sample bank letter (fake demo file). AI flags issues: statement older than 6 months, currency not shown, no signature, balance below the amount to show. Failure variant: low-confidence reading highlights the field and asks the student to confirm.
4. Bank letter request draft: message in Portuguese to the family's bank asking for an English-language letter with balance, currency, date and signature.
5. Essay request declined: "I can help you plan and review your ideas, but I can't write your essay. Colleges require it to be your own work."
6. Data not confirmed: "Not confirmed. See the official page." with link.

## Guardrails
- Never changes amounts, never invents or edits official documents, never submits anything.
- No legal or visa advice; route to the college international office or an attorney.
- Never says the family cannot afford something; uses budget band language.
- Never asks for SSN, account numbers or immigration documents.
