# Screens (prototype, about 16)

Mobile first. One question per screen in onboarding with Back and Continue. Copy below is the default English text. Never use em dashes in copy.

1. Welcome
   Title: "See the real cost of studying in the U.S."
   Body: "In your family's currency, with a clear plan. No login needed."
   Button: "Start"
2. Level, area, state
   "What do you want to study?" Level (Bachelor's only active), area (Computer Science, Business, Engineering, Other), state (Texas).
3. College and program
   "Which colleges are you thinking about?" Pick from data/colleges.json; program per college. Link: "Help me choose".
4. Nationality
   "Which passport or passports do you have?"
5. Visa or status
   "What is your situation in the U.S. today?" Six options from docs/visa-and-fees.md.
6. Start date
   "When do you want to start?" Fall 2027, Spring 2028, Fall 2028.
7. Currency and monthly amount
   "Which currency does your family use?" then "How much could your family pay per month?" Helper: "Optional. It helps us sort colleges. You can skip it." Buttons: Continue, Skip.
8. Results list
   Title: "Your colleges". Each card: college, program, total for the whole program (USD and family currency), band badge, "Out of my budget" button. Section "More colleges" when a budget was given.
9. College detail: full cost by phase
   Tabs or sections: Before applying, Before travel, First semester, Every year, After graduation. Each line: amount, source, date. Clear split between "You pay" and "You show (I-20)". Note line for assumptions (3% yearly increase, sample exchange rate).
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
