# Calculation rules (js/engine.js)

All functions are pure: input objects in, numbers and labels out. No DOM, no AI. Every output keeps a list of the sources and dates used.

## Inputs
- college (from data/colleges.json), program, start year
- visa situation (from onboarding)
- family currency and optional monthly amount
- fees (data/fees.json), exchange rate (data/fx.json)

## 1. Annual cost (USD)
annual = college cost of attendance (use the international or nonresident figure; if a range, keep min and max)
       + required extras not inside the cost of attendance (for example UT student health insurance, ISSS fee)
       + optional flights estimate (user can edit)

Colleges that publish cost line by line (Harvard, MIT, Amherst; `cost_of_attendance_2026_27.lines`): each line is added when `added: true`. A line can be an amount or a published range (Harvard transportation 0 to 5,000). Lines marked `added: false` (travel "varies", insurance premium "not confirmed") are shown, never added, never invented.
When the college publishes a total, the lines must add up to it (Harvard 95,134 to 100,134; MIT 92,760). When it publishes none (Amherst), the engine sums the published lines and labels the result "sum of published lines" (Amherst 2026-27: 98,160).
Required extras outside the cost of attendance: Harvard student health insurance 4,954 (2026-27), "unless covered by a family plan". MIT and Amherst insurance premiums are not confirmed: shown, not added.

If a college publishes a range, compute min and max separately and show the range. Use the midpoint for the budget band and say so in the UI ("based on the middle of the range").

If it is unconfirmed whether a fee is already inside the cost of attendance (for example UT differential tuition), do NOT add it. Show it as a separate line: "May already be included. Confirm with the college."

Student extras (UT SHIP, ISSS fee) apply only to F and J students. U.S. citizens and permanent residents do not pay them.
UT 2026-27: ISSS fee 450 USD per year (225 per semester). SHIP has two fixed values: 4,217.85 USD in the student's first year at UT (includes New Student Fall) and 3,893.40 USD in the other years.

Residency (U.S. citizens and permanent residents): default is nonresident. A dependent's domicile follows the parents; parents outside Texas means nonresident. The engine NEVER decides residency. When the college publishes a resident figure (UT 2026-27: 32,508 to 35,386 USD), the engine computes both scenarios (resident and nonresident) for the "Residency check" card; the main result stays nonresident.

## 2. Program total (USD)
years = 4 for a bachelor's (2 for an associate at ACC)
yearly_increase = config value, default 0.03 (labeled in the UI as an assumption).
base year = 2026-27 (the year of the published data in data/colleges.json).
exponent = academic years since the base year. Fall 2027 start: year 1 = base x 1.03, year 2 = base x 1.03^2, and so on. A Spring start counts as the academic year it falls in (Spring 2028 = 2027-28).
The same 3% assumption applies to ACC: its frozen rate is confirmed only for 2026-27, which is before any start date offered.
total = sum for y = 1..years of annual x (1 + yearly_increase)^exponent(y)
      + one-time costs before arrival (only for visa students): SEVIS, visa application, Visa Integrity Fee where collected, tests, application fee.
Visa Integrity Fee: added only where collection is confirmed for the country. If unconfirmed (Brazil today), do NOT add it: separate line "Not confirmed".
Flights: start at 0 with the field "Add your flight estimate". No default value.
The enrollment deposit is NOT added: it is credited to tuition.

Community-college path (ACC, then UT): same exponent by calendar year. ACC years 1 and 2 (x1.03, x1.03^2) on the ACC estimate ("ACC estimate (first year)", 30,000 USD: 13,000 tuition and fees + 17,000 living, from the ACC proof of financial support page, checked 13 Nov 2026); UT years 3 and 4 (x1.03^3, x1.03^4) on the UT base cost. Year 3 is the student's first year at UT, so it uses the first-year SHIP (4,217.85); year 4 uses 3,893.40. One-time costs are counted once, before arrival at ACC. At transfer: no new SEVIS fee (the transfer I-20 keeps the SEVIS ID), no new visa if still valid. The UT transfer application fee is not confirmed: separate line "Not confirmed", not added.

## 3. Monthly equivalent
monthly_usd = total / (years x 12)
monthly_family = monthly_usd x fx_rate

## 4. Budget band: replaced
Replaced by docs/funding-and-currency.md section 4 (funding gap). js/engine.js keeps budgetBand only so the existing tests keep passing; the app does not use it.

## 5. Show for the I-20 (visa students only)
show_for_i20 = the college's published amount for the I-20 when available. Only when there is none: the MAX of the year 1 estimate range (showing too little delays the I-20), labeled "Estimate. The college confirms the exact amount."
UT publishes 71,912 USD for 2026-27, undergraduate, nonresident: 49,912 tuition and fees (2 semesters) + 22,000 living expenses (12 months). Source: UT ISSS financial information, checked 10 Nov 2026. Note shown with it: "2026-27 amount. The amount for your start year is not published yet and may be higher."
ACC publishes 30,000 USD on its proof of financial support page (13,000 tuition and fees + 17,000 living; checked 13 Nov 2026). The year is not stated on the page. Note shown with it: "Estimates, subject to change. The year is not stated on the page." In the ACC to UT path, ACC issues the first I-20, so this amount is used.
The published amount is not inflated by the engine: it is shown as published, with its year. The 3% yearly increase applies only to program cost lines.
UI line: "For the I-20, you will need to show about X for the first year."

## 6. Recommendations: replaced
Replaced by docs/funding-and-currency.md section 5 (Routes). Only this rule stays:
- Community-college path: 2 years at ACC (associate) then 2 years at the target university, with the combined total (see section 2). Transfer admission to UT is not guaranteed.

## 7. Currency: replaced
Replaced by docs/funding-and-currency.md section 6 (currency by country). Still valid here: the engine stays pure, receives rates as input and never fetches anything; never round in the engine, round only for display.

## 8. Tests (tests.html)
At minimum: annual with and without extras, total with 0 and 3% increase, band edges (exactly equal, exactly 20% above, above 20%), skipped budget, unconfirmed fee not added, deposit not added.
