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

## 2. Program total (USD)
years = 4 for a bachelor's (2 for an associate at ACC)
yearly_increase = config value, default 0.03 (labeled in the UI as an assumption). Colleges with a frozen published rate for the year (ACC 2026-27) use 0 for that year.
total = sum for y = 1..years of annual x (1 + yearly_increase)^(y - 1)
      + one-time costs before arrival (only for visa students): SEVIS, visa application, Visa Integrity Fee where collected, tests, application fee.
The enrollment deposit is NOT added: it is credited to tuition.

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
show_for_i20 = the college's published first-year amount for the I-20 if available, otherwise the first-year annual cost estimate, labeled "Estimate. The college confirms the exact amount."
UI line: "For the I-20, you will need to show about X for the first year."

## 6. Recommendations
- With a monthly amount: main list = colleges with band within or above, sorted by monthly cost; others go to "More colleges" (still visible).
- Without: all colleges sorted by total cost.
- "Out of my budget" on any college: show cheaper colleges with the same program area, and the community-college path: 2 years at ACC (associate) then 2 years at the target university, with the combined total. If the cheaper path is still well above, say so plainly and show next steps (scholarship plan, starting later, other options). Never hide the original college.

## 7. Currency
Rates live in data/fx.json with the date. The prototype uses a manually set sample rate, labeled "Sample rate for the prototype, set on DATE". Never round in the engine; round only for display (no cents for totals).

## 8. Tests (tests.html)
At minimum: annual with and without extras, total with 0 and 3% increase, band edges (exactly equal, exactly 20% above, above 20%), skipped budget, unconfirmed fee not added, deposit not added.
