# Screens (prototype, about 14)

## Pages (visual design v4 "Campus", decided 19 Nov 2026)
docs/design-campus.md decides the pages and the layout; this file keeps the flow and the exact copy. Map from the screens below to the Campus pages:

| Screens in this file | Campus page | Built in |
| --- | --- | --- |
| 1 Welcome | 1 Welcome | task 5 (done) |
| 2 AI intake (chat) | 2 Intake | task 5 (done) |
| 3 Profile confirm | 3 Profile confirm | task 5 (done) |
| 4 Funding map + 5 Routes | 4 Overview (dream hero, next deadline, routes in group columns, deadlines, documents, advisor rail) | task D |
| 6 College detail | 5 My colleges (filters, cards) and 6 College detail | task 6 (done) |
| 7 Scholarships | 7 Scholarships | task 6 (done) |
| 8 Plan timeline | 8 Plan and deadlines | task 6 (done) |
| 9 Upload + 10 Document result + 11 Drafts | 9 Documents studio | task 7 (done) |
| 12 Essay coach | Advisor rail ("Essay help" in the rail header) | task 8 (done) |
| 13 Family mode | 10 Family mode | task 8 (done) |
| 14 Save plan | "Export my plan" in the sidebar and on Plan and deadlines | task 8 (done) |

App frame: the Campus app shell (left sidebar, top bar with search and currency switch, content grid, AI advisor rail) replaces the header, progress and footer described below for every page after the intake. The intake keeps the progress and the Back and Continue buttons.

Desktop first, adapting to 380 px. Copy below is the default English text. Never use em dashes in copy. Every AI block is labeled "Written by AI. Check the source." with a confidence level and its sources. Every number is tappable for "Source and date".

App frame (index.html, every screen):
- Header: Pont logo on the left; after the family country is known, the exchange rate in two lines on the right ("1 USD = <rate in family currency>" and "Source: <provider>, <date>"). Hidden for USD families and before the country is known.
- Progress: in the chat, a small "Step X of Y" for the intake topics; in form mode, "Question X of Y". Not shown on the welcome screen or after the profile confirm.
- Footer: Back and Continue in form screens. A discreet "Start over" link clears all answers; not shown on screen 1.
- Language: the page is English (lang="en"). Every block in the family language sets its own lang attribute.

1. Welcome
   Title: "Tell us your dream school. We find the scholarships to get you there."
   Body: "Scholarships, financial aid and the documents you need, in your family's currency. Powered by AI. No login needed."
   Privacy line: "Your answers stay only in this browser tab and are cleared when the tab closes."
   Button: "Start"
   "Try an example" (bottom of the welcome screen): three buttons, Ananya (India to Harvard), Lucas (Brazil to UT Austin), Ian (U.S. citizen with parents in Brazil). Each loads the demo answers and opens the profile confirm screen.
   Campus layout (task 5): hero in two columns (title, body, dream school search with "Dream school" and "Your family's country" selects and "Find my scholarships", popular chips, privacy line, "Start without a school"; on the right an example plan built by the engine from Harvard's published rule, captioned as an example), "How Pont works" in 4 steps, "Colleges that fund international students" (verified colleges that meet full need with need-based aid for internationals, from data/colleges.json, each with its source), and the source note.
2. AI intake (chat)
   Pont asks the intake questions from docs/product.md one at a time, with quick-answer chips under each question (countries, statuses, terms, income bands, "Prefer not to say"). Free text is allowed; Claude turns it into structured answers. A small "Use a form instead" link opens the same questions as one-question-per-screen forms (accessibility and fallback when the AI is offline).
   Questions in order (js/intake.js): first name (optional), dream school (one or more), program (only for a college with more than one), passports, situation in the U.S. (six situations), where you live now (optional), where parents live and earn (one or more; sets the currency), start term, family income band (optional, USD ranges also shown in the family currency), monthly amount in the family currency (optional). Required: dream school, program, passports, situation, parents' countries, start term.
   Chips answer directly. Multi-answer questions use toggle chips and "Continue". Optional questions have "Skip". Header: "Your funding plan starts here", the AI status ("Live, powered by Claude" or "Sample answers") and "Step X of Y". On the right, the "Your profile" card fills in as answers arrive, with "Check my answers" once the required ones are in.
   Reload guard: a screen that needs answers the tab does not have opens the first missing question in the form.
3. Profile confirm
   "Here is what we understood. Edit anything that is wrong." Editable summary: dream colleges and program, citizenship, status, where parents earn, currencies, start term, income band, monthly amount. Button: "Build my funding plan".
4. Funding map (dream school first)
   For each dream college: aid policy in plain words ("Need-blind for international students and meets full need"), estimated net price range per year in USD and family currency, method label (published threshold, calculator link or full cost), gap label, forms, next deadline. Section "Doors open for you" from the funding profile.
5. Routes
   Three groups, named for money, not admission chances: "Your dream", "Strong aid for you", "Lower-cost path". Route cards with net price range, gap label, one-line AI explanation of why this route fits. Dream colleges never hidden.
   Under every gap label, one line with what is still to confirm: "Funded" always shows "Covers every confirmed cost." plus "Still to confirm: <lines>." when lines are pending; "Small gap" and "Gap" show "Still to confirm: <lines>." when lines are pending.
   No estimate (net price method calculator_link): no gap label, the card says "No estimate yet. See the official aid page." with the link labeled "Official aid page".
6. College detail
   Aid policy with source, thresholds, forms, deadlines, full cost by phase (pay versus show for the I-20), scholarships, residency check card for U.S. citizens and residents (UT), I-20 amount for visa students.
   Built in task 6 (js/pages.js): header with route group, "Add to plan" (dream colleges always stay in the plan) and "Official aid page"; cards "Net price for you" (method, estimate, gap label with its to-confirm line, funding bar, "Still to confirm" list, "Explain with AI"), "Aid policy" (one row per rule with source), "Cost by phase" (before you arrive, each year, year by year, whole program, shown not added), "Deadlines and forms", "Show for the I-20" ("This is what you show, not what you pay."), "Document rules", "Residency check".
   My colleges (task 6): filter panel (route group, aid policy, type, only with an estimate; active chips and Clear all; folds below 1100 px), sort (best funding fit, lowest estimate, name), cards with View and "Add to plan", and "Why these routes" with "Explain my routes". The top bar search filters this page by name.
7. Scholarships
   College scholarships (automatic or separate application) and outside scholarship categories that match the profile. Never counted in totals. Link to each official page.
   Built in task 6: "Never counted in your totals." banner; one card per route college (merit policy, automatic consideration, international student scholarships with window and examples, college scholarship application deadlines, outside scholarship rule), each with its source; "Outside scholarships" (colleges that allow them, and the family's country: "Not confirmed" until a checked list exists).
8. Plan timeline
   Month by month until the start term: tests, applications, CSS Profile or ISFAA or college form, scholarship deadlines, I-20 request, SEVIS, visa interview. Items depend on the profile.
   Built in task 6: the deadlines of the colleges in the plan (every route college unless the student took it out in My colleges), grouped by month, with status (to do, done, passed) and ticks kept in the tab; a card with the steps for the student's situation (after admission: I-20 and F-1 visa; F-1 transfer; switch to F-1 for F-2 dependents; change of status for visitors; FAFSA for U.S. citizens), each with its official link, and "Confirm every decision with the college international office or an immigration attorney."
9. Documents studio: upload
   "Upload a bank statement or income document. We read it, translate it and convert it to USD." Sample files available for each demo path (marked SAMPLE). Notice: "Do not upload real account numbers in this prototype."
10. Document result
   Extracted fields (holder name, date, currency, balance or income), working English translation (labeled "Working translation, not certified"), USD value with rate and date (engine), flags against the college's rules (age, liquidity, name, language, page limit). Low-confidence fields highlighted with "Please confirm this value."
11. Drafts
   Bank letter request in the family language; message to the college aid office in English. Copy and share buttons. The AI never sends anything.
   Built in task 7 (js/studio.js), one page "Documents": the list of the dream college's documents with the progress ring and live status (not started, uploaded, flagged, ready; forms are ticked "I filed it"); for the selected document: the notice, upload (PNG or JPG; a PDF shows "Upload a photo or screenshot of the page."), "Or use a sample document" (SAMPLE images in assets/samples/), "Read and check"; the result: fields with confidence ("Please confirm this value" with an editable field for low confidence), the amount in USD converted by the engine with the rate line, flags (age and pages checked by the engine, the other rules by the AI) against i20.document_rules for the I-20 statement and document_rules for aid documents ("Not confirmed" with the official page when the college has none), the working translation; then Drafts with Copy. Offline: the scripted reading of each sample with the offline banner; an uploaded image offline shows "We cannot read this document right now." and the rules. The Overview documents card and the Documents menu badge (documents to check) use the same status.
12. Essay coach
   Student pastes a draft; AI suggests what to highlight and what to cut. A request to write the essay is declined: "I can help you plan and review your ideas, but I can't write your essay. Colleges require it to be your own work."
   Built in task 8: "Essay help" in the advisor rail header switches the rail to the coach (draft, optional question, "Get suggestions", up to 6 suggestions typed highlight, cut, structure or English). Offline: the note and the decline example.
13. Family mode
   Plan summary for parents in their language and currency: dream school, what it would cost the family, the next three steps.
   Language selector with the country's family languages (data/countries.json). The Ananya demo uses Hindi (lang="hi").
   Built in task 8: the default language is the country's family language, or its first alternative when the family language is English (India: Hindi). "Write it in <language>" asks the AI; the English summary built from engine data is always one click away and is the offline version, with the offline banner. Amounts in the family currency, converted by the engine.
14. Save plan
   "Save your plan to come back later." Email login only here.
   Prototype (task 8): no login and no server. "Export my plan" (sidebar and Plan and deadlines) saves a clean HTML summary: profile, routes, deadlines, documents status and sources. The screen says: "No login and no server in this prototype. Your plan stays in this browser tab until you close it. Export it to keep a copy." Email login comes with the E-11 rebuild.

Global: currency toggle (USD and family currencies) in the header after the country is known; offline AI banner when live Claude is not available ("AI is offline. Showing a prepared answer."). The first AI action asks the viewer to allow Claude (Artifact consent dialog).
