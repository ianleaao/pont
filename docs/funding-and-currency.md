# Funding engine and currency by country (js/engine.js, js/fx.js)

Replaces docs/calculation-rules.md section 4 (budget band) and section 7 (BRL-only currency). Sections 1, 2, 3, 5 and 6 of calculation-rules.md stay valid for the cost part. All functions stay pure: data in, numbers and labels out, sources and dates kept on every output.

## 1. New data per college (data/colleges.json)
Add an `aid` block to each college. Every field has `source` and `checked_on`. Unknown means null plus `status: "not_confirmed"`.

Stored format (filled from docs/aid-data.md, checked 2026-11-13): each field is an object
`{ "value": ..., "source": "<source id in the college's sources list>", "checked_on": "YYYY-MM-DD", "note": "..." }`.
Unknown: `{ "value": null, "status": "not_confirmed", "source": <id or null>, "checked_on": ... }`.
A value whose page is not listed in docs/aid-data.md keeps `source: null` and a note saying so. Form codes go in `codes` (for example `{ "css_profile": "3434" }`).
Threshold items: `{ income_below_usd, rule: "parent_contribution_zero" | "covers_full_tuition_at_least" | "tuition_free", label, covers, applies_to_intl, applies_note }`. `applies_to_intl: null` with `status: "not_confirmed"` means the engine must not use that threshold for international students (MIT).
Document rules for the documents studio: `document_rules` per college (translation, format, signature, channel, plus college-specific rules). UT keeps `i20.document_rules`.

The original sketch of the block (placeholder values):

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
Example values in the sketch are placeholders. Every stored value comes from docs/aid-data.md.

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
- Threshold `parent_contribution_zero` (Harvard under 100,000 USD): parent contribution 0 for the cost of attendance. The family pays the one-time visa fees (lines). Student contribution, travel, personal costs and the student health insurance are listed as "Not confirmed", never added.
- Threshold `covers_full_tuition_at_least` or `tuition_free` (Harvard 100,000 to 200,000 USD): the family pays AT MOST the full cost minus tuition (`atMost: true`). "Aid above tuition" is listed as not confirmed. The gap uses the cap.
- Thresholds with `applies_to_intl` not true are never used for international students (MIT). They apply to U.S. citizens and residents.
- The band must fall fully under the threshold (bands are [min, max) in USD: under 65k, 65k to 100k, 100k to 150k, 150k to 200k, over 200k).
- If the college meets full need but the band is above all usable thresholds (or it has none: MIT and Amherst for internationals), method `calculator_link`: no estimate, the message "No estimate yet. See the official aid page." and the link labeled "Official aid page" (the college's aid page from the data). No formula of our own.
- U.S. citizens and residents (FAFSA open): need-based aid is open at every college with an aid block. Without a usable threshold, method `calculator_link` (UT for Ian: the Texas One Stop aid page).
- Merit-only colleges: net price = full cost; merit shown as "possible, not guaranteed" with the published range only if the college publishes one.
- No income band given: international students see full cost plus "Share an income range to see aid estimates."; U.S. citizens and residents get `calculator_link`.
- Transfer paths (community college then transfer) use full cost.
Output: { method: "threshold" | "calculator_link" | "full_cost", hasEstimate, atMost, total, averagePerYear, year1, lines, notConfirmed, message, aidPage, merit, sources }. Ranges are { min, max, mid } in USD; null when there is no estimate.

## 4. Funding gap (replaces the budget band)
gap = estimated net price, average per year over the program, minus what the family can pay per year (monthly amount x 12, converted to USD).
The average per year is the program total divided by the program years, so the 3% yearly increase is included. The UI labels it "average per year over the program". The college detail also shows year 1.
Labels, neutral:
- "Funded": gap <= 0
- "Small gap": gap <= 20% of the net price (margin in config)
- "Gap": everything else
Without a monthly amount: no gap label, show the net price only.
Without an estimate (`calculator_link`): no gap label; the result says "No estimate yet. See the official aid page."
Only confirmed lines count. The not-confirmed list always travels with the label, as one line under it:
- "Funded": "Covers every confirmed cost." plus " Still to confirm: <lines>." when lines are pending. Never shown alone.
- "Small gap" and "Gap": "Still to confirm: <lines>." when lines are pending.
`fundingGap(net, monthlyAmount, fxRate)` returns { label, note, notConfirmed, gapUsd, gapShare, gapFamily, netPerYear, basis, year1 }.
Copy never says "can't afford". It always lists what can close it.

## 5. Routes
`routes(answers, data, { fxRate, today })` returns three groups, named for money, not admission chances. Each item has net price, gap label with its not-confirmed list, forms and next aid deadline:
- "Your dream" (id `dream`): the dream colleges, always shown first and never hidden.
- "Strong aid for you" (id `strong_aid`): verified colleges with need-based aid open for this profile that meet full need (Harvard, MIT and Amherst for Ananya, Lucas and Ian).
- "Lower-cost path" (id `lower_cost`): community college then transfer to a dream college (uses transferPath), and public universities with merit aid.
Sorted inside each group: colleges with an estimate first, then colleges without an estimate, then unconfirmed ones; within those, by gap, then by net price midpoint.
Next aid deadline: "MM-DD" dates fall in the application cycle (August to December of the year before the start, January to July of the start year). Dates before `today` are returned as past (Amherst ED aid deadline 2026-11-13).
A window with an opening date runs forward from it: ACC opens 01-15, priority 05-01, closes 12-15, so for Fall 2027 they are 2027-01-15, 2027-05-01 and 2027-12-15. An opening date anchors only the keys that share its name prefix ("isss_scholarships_open" anchors "isss_scholarships_close"; a bare "opens" anchors the whole group).
Forms per profile: F-1 students never get the FAFSA. FAFSA filers do not get the TASFA (it is for students without a FAFSA).

## 5b. Overview helpers (task D)
- `deadlineList(routes, data, { term, today })`: every admission and aid deadline of the route colleges, sorted by date, each with kind (admission or aid), round, forms and codes, status ("to_do" or "passed"), days left and source. Opening dates and decision release dates are not deadlines. Routes without data for the student's situation add no dates; ISSS dates are for international students only.
- `fundingBar(net, gap)`: segments per year for the funding bar: aid (full cost minus what the family pays), family (what the family pays, or what it can cover when there is a gap), gap (only with a gap) and not_confirmed (fixed 6% width, no amount). No bar when there is no estimate.

## 6. Currency by country (js/fx.js)
- data/countries.json maps country code to { currency, locale, currency_display, family_language, family_language_alternatives, esta, home_scholarships, notes }. Countries: BR, IN, MX, CO, NG, VN, CN, KR, US.
- India: family_language "en", alternative "hi". Family mode always shows a language selector with the country's alternatives. In the Ananya demo, family mode uses Hindi.
- ESTA and home-country scholarships: null until confirmed on the official page (ESTA: State Department Visa Waiver Program page). The UI shows "Check your government's scholarship programs", with no invented names.
- The family currency comes from the parents' country of income. Two countries means two currencies, both shown.
- Fetch order per currency:
  1. Frankfurter v2: https://api.frankfurter.dev/v2/rate/usd/{currency}. Returns { date, base, quote, rate }; rate = units of the currency per 1 USD. No provider parameter (the default blends central bank providers). Source line: "Frankfurter (central bank data)".
  2. ExchangeRate-API open endpoint (credit link "Rates By Exchange Rate API" required).
  3. data/fx.json fallback, only for the demo currencies, each from its official source with date: BRL (Banco Central do Brasil, PTAX sell rate) and INR (FBIL USD/INR reference rate; RBI keeps an archive). Notice: "Could not update the exchange rate. Using the rate from DATE." Every other currency is null: "Not confirmed" with the official link when known.
  4. Inside the claude.ai Artifact, external fetches are blocked, so js/fx.js skips steps 1 and 2. Before each publish, tools/fx-snapshot.mjs refreshes data/fx.json with a Frankfurter v2 snapshot for every currency in data/countries.json (rate, date, source "Frankfurter (central bank data), snapshot"). When the live rate fails (always inside the Artifact), the snapshot is used first, then the official fallback of step 3, with the same notice and the snapshot date, so the number stays real and dated. The official BRL and INR fallbacks stay as they are.
- Fetch only after the country is known, once per currency per session, 5 second budget per currency. No rate is fetched at startup and USD families see no rate.
- Format each currency with its own locale through Intl.NumberFormat (USD en-US, BRL pt-BR, INR en-IN, VND vi-VN, and so on). Where the local symbol is "$" (MXN, COP), show the currency code ("MXN 150,000") so it is never confused with USD.
- Totals without cents. Rates with 2 decimals below 1,000 ("1 USD = ₹94.00") and no decimals at 1,000 and above ("1 USD = 25.750 ₫").
- Header and every family-currency amount show the rate in two lines: "1 USD = <rate in family currency>" and "Source: <provider>, <date>".
- tests.html keeps fixed rates (BRL 5.5146 and INR 94, test only) so tests never change.

## 7. Tests to add
fundingProfile for the three demo paths; FAFSA closed for F-1; threshold net price for path 1; full-cost net price for UT (path 2); gap labels at the edges (0, exactly 20%, above 20%); no income band; routes keep the dream college first; currency formatting for BRL, INR and VND; two-currency family.
