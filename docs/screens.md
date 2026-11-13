# Screens (prototype, about 17)

Mobile first. One question per screen in onboarding with Back and Continue. Copy below is the default English text. Never use em dashes in copy.

App frame (index.html, every screen):
- Header: Pont logo on the left; exchange rate in two lines on the right ("1 USD = R$ 5,55" and "Source: Frankfurter, Nov 10, 2026"). Hidden when the family currency is USD.
- Progress bar: counts only the questions, screens 2 to 7b ("Question 1 of 7" to "Question 7 of 7"). Not shown on screen 1 or after the last question.
- Footer: Back and Continue (Skip on 7b). A discreet "Start over" link clears all answers; not shown on screen 1.
- Language: the page is English (lang="en"). Every Portuguese block (Family mode, bank letter) sets lang="pt-BR" on its own element.

1. Welcome
   Title: "See the real cost of studying in the U.S."
   Body: "In your family's currency, with a clear plan. No login needed."
   Privacy line: "Answers are never sent to or saved on a server. They stay only in this browser tab and are cleared when the tab closes."
   Button: "Start"
2. Area
   "What do you want to study?" Context line: "Bachelor's degree in Texas. More levels and states are coming." Area: Computer Science, Business, Engineering, Other. Level and state are not screens: each has only one active option.
3. College and program
   "Which colleges are you thinking about?" UT Austin selectable, program per college. The 4 pending colleges are visible, marked "Not confirmed", with the official link. ACC is not listed here: it appears only from "Out of my budget". Link: "Help me choose".
4. Nationality
   "Which passport or passports do you have?"
5. Visa or status
   "What is your situation in the U.S. today?" Six options from docs/visa-and-fees.md.
6. Start date
   "When do you want to start?" Fall 2027, Spring 2028, Fall 2028.
7a. Currency
   "Which currency does your family use?" BRL or USD. With USD the rate is 1 and nothing is fetched.
7b. Monthly amount
   "How much could your family pay per month?" Helper: "Optional. It helps us sort colleges. You can skip it." Buttons: Continue, Skip. While the rate loads: "Updating the exchange rate...". Results appear only after a rate is ready.
8. Results list
   Title: "Your colleges". Each card: college, program, total for the whole program (USD and family currency), band badge, "Out of my budget" button. Section "More colleges" when a budget was given.
9. College detail: full cost by phase
   Tabs or sections: Before applying, Before travel, First semester, Every year, After graduation. Each line: amount, source, date. Clear split between "You pay" and "You show (I-20)". Note line for assumptions (3% yearly increase, exchange rate source and date).
   Residency check card (U.S. citizens and permanent residents only, path Ian): shows both official UT 2026-27 ranges side by side: Texas resident, on or off campus, 32,508 to 35,386 USD; nonresident, 64,204 to 72,916 USD. Text: "You may qualify for Texas resident tuition. Confirm with the UT residency office." Link: onestop.utexas.edu. Pont never decides residency; the main result stays nonresident.
10. Out of my budget
   "Here are options with the same program area." Cheaper colleges, plus "Start at ACC, then transfer to UT" with combined total and band. If still well above: "This path is also above the amount you shared. Here is what can help:" scholarship plan, later start.
11. Scholarship and application timeline
   UT: Early Action 15 Oct, Regular 1 Dec; automatic scholarship consideration; notifications Feb to Apr.
12. Visa path checklist
   Checklist from docs/visa-and-fees.md for the user's situation, with fees and official links. Rule-change alert banners where relevant.
13. I-20 request kit
   Checklist: bank letter, sponsor form, passport copy, translation rule for this college. Button: "Check my documents".
14. AI document check
   Upload sample, results with flagged issues (see docs/ai.md). Failure state: low confidence.
15. AI drafts
   Bank letter request in Portuguese; family mode summary. Copy and share buttons.
16. What-if simulator
   Controls and recalculated band with AI explanation.
17. Save plan
   "Save your plan to come back later." Email login only here.

Global: currency toggle in the header; every AI block labeled; every number tappable for "Source and date".
