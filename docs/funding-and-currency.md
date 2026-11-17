# Funding engine and currency by country (js/engine.js, js/fx.js)

Replaces docs/calculation-rules.md section 4 (budget band) and section 7 (BRL-only currency). Sections 1, 2, 3, 5 and 6 of calculation-rules.md stay valid for the cost part. All functions stay pure: data in, numbers and labels out, sources and dates kept on every output.

## 1. New data per college (data/colleges.json)
Add an `aid` block to each college. Every field has `source` and `checked_on`. Unknown means null plus `status: "not_confirmed"`.

```json
"aid": {
  "intl_admission_policy": "need_blind | need_aware | not_applicable",
  "intl_need_based_aid": true,
  "meets_full_need_intl": true,
  "merit_aid_intl": "none | limited | yes",
  "f1_aid": "none | college_only",
  "thresholds": [
    { "income_below_usd": 100000, "family_pays": "zero", "covers": ["tuition", "housing", "food", "insurance"], "applies_to_intl": true }
  ],
  "forms_intl": ["css_profile", "isfaa", "college_form", "certification_of_finances"],
  "forms_us": ["fafsa", "css_profile"],
  "deadlines": { "early": "11-01", "regular": "01-01", "aid_forms": "..." },
  "outside_scholarships_allowed": true,
  "source": "official aid page id", "checked_on": "YYYY-MM-DD"
}
```
Example values above are placeholders. Fill every value from the official page of each college.

## 2. Funding profile (deterministic)
`fundingProfile(answers, data)` returns which aid doors are open, each with a reason and a source:
- FAFSA: only U.S. citizens and eligible non-citizens (permanent residents). Never F or J students.
- Need-based college aid: open at colleges with `intl_need_based_aid: true` (internationals) or for all citizens and residents.
- Merit aid: per college `merit_aid_intl`.
- Outside scholarships: always listed as possible, never counted in totals.
- Home-country government scholarships: listed from data/countries.json when known, otherwise "Check your government's scholarship programs" with no invented names.
- International student loans: mentioned as a category only, no lender names, no promotion.

## 3. Estimated net price (range, never a promise)
`netPrice(college, profile, costResult)`:
- If the income band falls fully under a published threshold that applies to this student, use the threshold rule (for example family pays 0 for the covered items) and keep uncovered items (flights, visa fees, personal costs) as lines the family pays.
- If the college meets full need but the band is above all thresholds, show a range from "Not confirmed" to full cost, with the link to the college's net price calculator. No formula of our own.
- Merit-only colleges: net price = full cost; merit shown as "possible, not guaranteed" with the published range only if the college publishes one.
- No income band given: show full cost plus "Share an income range to see aid estimates."
Output: { min, max, method: "threshold" | "calculator_link" | "full_cost", lines, sources }.

## 4. Funding gap (replaces the budget band)
gap = estimated net price, average per year over the program, minus what the family can pay per year (monthly amount x 12, converted to USD).
The average per year is the program total divided by the program years, so the 3% yearly increase is included. The UI labels it "average per year over the program". The college detail also shows year 1.
Labels, neutral:
- "Funded": gap <= 0
- "Small gap": gap <= 20% of the net price (margin in config)
- "Gap": everything else
Without a monthly amount: no gap label, show the net price only.
Copy never says "can't afford". It always lists what can close it.

## 5. Routes
`routes(answers, data)` returns three groups, each item with net price range, gap label, forms and next deadline:
- Reach: the dream colleges, always shown first and never hidden.
- Match: colleges in data with need-based aid for this profile.
- Affordable: community college then transfer to the dream or a public university (uses transferPath), and public universities with merit aid.
Sorted inside each group by gap, then by net price midpoint.

## 6. Currency by country (js/fx.js)
- data/countries.json maps country code to { currency, locale, currency_display, family_language, family_language_alternatives, esta, home_scholarships, notes }. Countries: BR, IN, MX, CO, NG, VN, CN, KR, US.
- India: family_language "en", alternative "hi". Family mode always shows a language selector with the country's alternatives. In the Ananya demo, family mode uses Hindi.
- ESTA and home-country scholarships: null until confirmed on the official page (ESTA: State Department Visa Waiver Program page). The UI shows "Check your government's scholarship programs", with no invented names.
- The family currency comes from the parents' country of income. Two countries means two currencies, both shown.
- Fetch order per currency:
  1. Frankfurter v2: https://api.frankfurter.dev/v2/rate/usd/{currency}. Returns { date, base, quote, rate }; rate = units of the currency per 1 USD. No provider parameter (the default blends central bank providers). Source line: "Frankfurter (central bank data)".
  2. ExchangeRate-API open endpoint (credit link "Rates By Exchange Rate API" required).
  3. data/fx.json fallback, only for the demo currencies, each from its official source with date: BRL (Banco Central do Brasil, PTAX sell rate) and INR (FBIL USD/INR reference rate; RBI keeps an archive). Notice: "Could not update the exchange rate. Using the rate from DATE." Every other currency is null: "Not confirmed" with the official link when known.
  4. Inside the claude.ai Artifact, external fetches may be blocked. Before each publish, a script refreshes data/fx.json with a Frankfurter v2 snapshot for every currency in data/countries.json (rate, date, source "Frankfurter (central bank data), snapshot"). The UI shows that date, so the number stays real and dated even when live fetch is blocked. The official BRL and INR fallbacks stay as they are.
- Fetch only after the country is known, once per currency per session, 5 second budget per currency. No rate is fetched at startup and USD families see no rate.
- Format each currency with its own locale through Intl.NumberFormat (USD en-US, BRL pt-BR, INR en-IN, VND vi-VN, and so on). Where the local symbol is "$" (MXN, COP), show the currency code ("MXN 150,000") so it is never confused with USD.
- Totals without cents. Rates with 2 decimals below 1,000 ("1 USD = ₹94.00") and no decimals at 1,000 and above ("1 USD = 25.750 ₫").
- Header and every family-currency amount show the rate in two lines: "1 USD = <rate in family currency>" and "Source: <provider>, <date>".
- tests.html keeps fixed rates (BRL 5.5146 and INR 94, test only) so tests never change.

## 7. Tests to add
fundingProfile for the three demo paths; FAFSA closed for F-1; threshold net price for path 1; full-cost net price for UT (path 2); gap labels at the edges (0, exactly 20%, above 20%); no income band; routes keep the dream college first; currency formatting for BRL, INR and VND; two-currency family.
