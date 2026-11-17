# Screens (prototype, about 14)

Mobile first. Copy below is the default English text. Never use em dashes in copy. Every AI block is labeled "Written by AI. Check the source." with a confidence level and its sources. Every number is tappable for "Source and date".

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
2. AI intake (chat)
   Pont asks the intake questions from docs/product.md one at a time, with quick-answer chips under each question (countries, statuses, terms, income bands, "Prefer not to say"). Free text is allowed; Claude turns it into structured answers. A small "Use a form instead" link opens the same questions as one-question-per-screen forms (accessibility and fallback when the AI is offline).
3. Profile confirm
   "Here is what we understood. Edit anything that is wrong." Editable summary: dream colleges and program, citizenship, status, where parents earn, currencies, start term, income band, monthly amount. Button: "Build my funding plan".
4. Funding map (dream school first)
   For each dream college: aid policy in plain words ("Need-blind for international students and meets full need"), estimated net price range per year in USD and family currency, method label (published threshold, calculator link or full cost), gap label, forms, next deadline. Section "Doors open for you" from the funding profile.
5. Routes
   Three groups: Reach, Match, Affordable. Route cards with net price range, gap label, one-line AI explanation of why this route fits. Dream colleges never hidden.
6. College detail
   Aid policy with source, thresholds, forms, deadlines, full cost by phase (pay versus show for the I-20), scholarships, residency check card for U.S. citizens and residents (UT), I-20 amount for visa students.
7. Scholarships
   College scholarships (automatic or separate application) and outside scholarship categories that match the profile. Never counted in totals. Link to each official page.
8. Plan timeline
   Month by month until the start term: tests, applications, CSS Profile or ISFAA or college form, scholarship deadlines, I-20 request, SEVIS, visa interview. Items depend on the profile.
9. Documents studio: upload
   "Upload a bank statement or income document. We read it, translate it and convert it to USD." Sample files available for each demo path (marked SAMPLE). Notice: "Do not upload real account numbers in this prototype."
10. Document result
   Extracted fields (holder name, date, currency, balance or income), working English translation (labeled "Working translation, not certified"), USD value with rate and date (engine), flags against the college's rules (age, liquidity, name, language, page limit). Low-confidence fields highlighted with "Please confirm this value."
11. Drafts
   Bank letter request in the family language; message to the college aid office in English. Copy and share buttons. The AI never sends anything.
12. Essay coach
   Student pastes a draft; AI suggests what to highlight and what to cut. A request to write the essay is declined: "I can help you plan and review your ideas, but I can't write your essay. Colleges require it to be your own work."
13. Family mode
   Plan summary for parents in their language and currency: dream school, what it would cost the family, the next three steps.
   Language selector with the country's family languages (data/countries.json). The Ananya demo uses Hindi (lang="hi").
14. Save plan
   "Save your plan to come back later." Email login only here.

Global: currency toggle (USD and family currencies) in the header after the country is known; offline AI banner when live Claude is not available ("AI is offline. Showing a prepared answer."). The first AI action asks the viewer to allow Claude (Artifact consent dialog).
