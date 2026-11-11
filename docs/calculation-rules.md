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

Community-college path (ACC, then UT): same exponent by calendar year. ACC years 1 and 2 (x1.03, x1.03^2) on the ACC estimate ("ACC estimate (9 months)"); UT years 3 and 4 (x1.03^3, x1.03^4) on the UT base cost. Year 3 is the student's first year at UT, so it uses the first-year SHIP (4,217.85); year 4 uses 3,893.40. One-time costs are counted once, before arrival at ACC. At transfer: no new SEVIS fee (the transfer I-20 keeps the SEVIS ID), no new visa if still valid. The UT transfer application fee is not confirmed: separate line "Not confirmed", not added.

## 3. Monthly equivalent
monthly_usd = total / (years x 12)
monthly_family = monthly_usd x fx_rate

## 4. Budget band (neutral, never a verdict)
If the user skipped the monthly question: band = "none" (show "Total cost").
Otherwise compare monthly_family with the amount the user shared:
- within: monthly_family <= amount
- above: monthly_family <= amount x 1.20 (the 20% margin is a config value to test in interviews)
- well_above: everything else

## 5. Show for the I-20 (visa students only)
show_for_i20 = the college's published amount for the I-20 when available. Only when there is none: the MAX of the year 1 estimate range (showing too little delays the I-20), labeled "Estimate. The college confirms the exact amount."
UT publishes 71,912 USD for 2026-27, undergraduate, nonresident: 49,912 tuition and fees (2 semesters) + 22,000 living expenses (12 months). Source: UT ISSS financial information, checked 10 Nov 2026. Note shown with it: "2026-27 amount. The amount for your start year is not published yet and may be higher."
The published amount is not inflated by the engine: it is shown as published, with its year.
UI line: "For the I-20, you will need to show about X for the first year."

## 6. Recommendations
- With a monthly amount: main list = colleges with band within or above, sorted by monthly cost; others go to "More colleges" (still visible).
- Without: all colleges sorted by total cost.
- "Out of my budget" on any college: show cheaper colleges with the same program area, and the community-college path: 2 years at ACC (associate) then 2 years at the target university, with the combined total. If the cheaper path is still well above, say so plainly and show next steps (scholarship plan, starting later, other options). Never hide the original college.

## 7. Currency
The rate is fetched once per session by js/fx.js, before any family-currency amount is shown. The engine stays pure: it receives the rate as an input and never fetches anything.
Order: Frankfurter (https://api.frankfurter.app/latest?from=USD&to=BRL), then the ExchangeRate-API open endpoint (with the credit link its terms require), then the fallback in data/fx.json (Banco Central PTAX sell rate, 5.5146, 9 Nov 2026) with the notice "Could not update the exchange rate. Using the rate from DATE."
Time budget: 5 seconds in total, then the fallback. While waiting: "Updating the exchange rate...". The results screen appears only after a rate is ready.
sessionStorage keeps the rate, source, rate date and time of the request. One request per session.
Header and every family-currency amount: "1 USD = R$ X · source · rate from DATE".
tests.html always uses the fixed rate 5.5146 so tests never change.
INR stays null and is hidden in the prototype (India is not in the demo paths).
Never round in the engine; round only for display (no cents for totals).

## 8. Tests (tests.html)
At minimum: annual with and without extras, total with 0 and 3% increase, band edges (exactly equal, exactly 20% above, above 20%), skipped budget, unconfirmed fee not added, deposit not added.
