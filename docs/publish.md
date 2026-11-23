# Publishing the prototype as a claude.ai Artifact

The prototype runs live inside a claude.ai Artifact: Claude answers through the Artifact runtime on the viewer's own Claude account (docs/ai.md). Outside the Artifact (Live Server) the same files run with scripted answers.

## Before each publish
1. Refresh the exchange-rate snapshot (Node 18 or later, no key):
   `node tools/fx-snapshot.mjs`
   It writes data/fx.json "snapshot": a Frankfurter v2 rate (`/v2/rate/usd/{cur}`) for every currency in data/countries.json, with the date of each rate, the source and the day it ran. The official fallbacks in "rates" (BRL PTAX, INR FBIL) stay as they are. Commit the result.
2. Run tests.html (Live Server) and check that every test passes.
3. Check that no file has a long dash (CLAUDE.md rule 8).

## Manifest
`capabilities: {sample: {images: true}}`
- `sample`: live Claude for the advisor rail, the intake interviewer and, later, the other AI functions.
- `images: true`: the document reader sends one page image per call (task 7). Every viewer is told the page can send images to Claude.
No other capability. Answers stay in the browser tab (sessionStorage); nothing is stored on a server.

## Files the published app needs
The page is index.html. Every other file is published at the same relative path, because the page loads them by those paths.

| Published path | What it is |
| --- | --- |
| index.html | The page (intake and app shell) |
| css/tokens.css | Brand tokens |
| css/app.css | Layout and components |
| js/engine.js | Pure engine: costs, funding profile, net price, gap, routes, deadlines |
| js/fx.js | Exchange rates and money formatting |
| js/ui.js | Component renderers |
| js/ai.js | AI client: Artifact runtime or scripted answers, validation |
| js/prompts.js | One prompt builder per AI function |
| js/intake.js | Welcome, intake chat, form, profile confirm |
| js/pages.js | My colleges, College detail, Scholarships, Plan and deadlines |
| js/app.js | State, app shell, navigation, Overview, advisor rail |
| data/colleges.json | Costs, aid policies, forms, deadlines, document rules, sources |
| data/fees.json | Government and test fees |
| data/countries.json | Currency, locale, language per country |
| data/fx.json | Exchange-rate snapshot and official fallbacks |
| data/ai-scripts.json | Scripted answers and offline notes |
| assets/favicon.svg | Favicon |

Total about 340 KB. Not published: components.html, tests.html, docs/, tools/, the mockups.

## External resources (the only ones)
- Google Fonts: Plus Jakarta Sans (fonts.googleapis.com stylesheet, fonts.gstatic.com files).
- Lucide icons 0.468.0 from unpkg: `https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js`.

## What changes inside the Artifact
- The runtime exists (`window.claude`), so the advisor status reads "Live, powered by Claude" once `claude.use("sample")` resolves. The first question asks the viewer to allow Claude.
- Query strings and hashes may not reach the page: the demos load from the "Try an example" buttons on the welcome screen, and navigation keeps the current page in memory (the hash is updated only where the browser allows it).
- External requests are blocked, so js/fx.js does not try the live rate APIs. It uses the snapshot and shows "Could not update the exchange rate. Using the rate from <date>." with the source "Frankfurter (central bank data), snapshot".
- If the viewer declines, or the runtime does not answer, every AI feature falls back to the scripted answers with the offline banner. The app keeps working.
