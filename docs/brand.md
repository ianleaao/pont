# Brand: Pont (version 2)

Name: Pont (French for bridge; short and easy for Americans to read). Personality: calm, honest, warm, precise. Never judges, never promises.

Direction: the subject is official U.S. paperwork plus money moving between countries. The look is clear, sober and form-like, close to a well-made government or bank form, not a lifestyle app. Only one element is bold: the cost bridge (see below). Version 2 replaces the cream background, the serif headlines and terracotta; it will be refined later.

## Logo
Wordmark "Pont" in Public Sans 800, ink, tracking -0.015em, next to the symbol. Symbol: one arch connecting two dots on a flat deck line; left dot green (family's country), right dot amber (U.S.). The symbol alone is the app icon and favicon (unchanged from version 1).

SVG symbol (viewBox 0 0 64 40):
```html
<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M8 32 Q32 0 56 32" fill="none" stroke="#15233A" stroke-width="4" stroke-linecap="round"/><line x1="8" y1="32" x2="56" y2="32" stroke="#15233A" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="32" r="5.5" fill="#2E7D5B"/><circle cx="56" cy="32" r="5.5" fill="#E3A947"/></svg>
```

## Tokens
css/tokens.css is the code copy of this section. Change both together.

| Token | Value | Use |
| --- | --- | --- |
| --ink | #15233A | Main text, primary button, focus ring |
| --bg | #F4F6F8 | Page background |
| --surface | #FFFFFF | Panels, inputs |
| --line | #D5DCE4 | Decorative dividers only |
| --line-strong | #7B8794 | Borders of inputs, question options, checkboxes |
| --slate | #5A6475 | Secondary text |
| --green | #2E7D5B | Family-country dot, icons |
| --green-text | #25684C | Green text |
| --green-tint | #E3EFE8 | Badge "Fits your monthly amount" |
| --amber | #E3A947 | U.S. dot, fills only |
| --amber-tint | #FBEFD6 | Badge "A bit above your amount" |
| --plum | #8A2E5C | "Well above" text and icon |
| --plum-tint | #F3E4EC | Badge "Well above your amount" |

Spacing: 4 px grid (4, 8, 12, 16, 24, 32, 48, 64). Radius: 8 inputs and buttons, 12 panels, full for badges. One soft shadow (--shadow-raised), used sparingly.

## Contrast (WCAG AA, checked 12 Nov 2026)
Text needs 4.5:1. Non-text elements that identify a control (input borders, icons) need 3:1.

| Foreground on background | Use | Ratio | AA |
| --- | --- | --- | --- |
| ink on bg | Main text | 14.54 | Pass |
| ink on surface | Main text | 15.75 | Pass |
| slate on bg | Secondary text | 5.52 | Pass |
| slate on surface | Secondary text | 5.98 | Pass |
| green-text on surface | Green text | 6.64 | Pass |
| green-text on bg | Green text | 6.13 | Pass |
| green-text on green-tint | Badge within | 5.62 | Pass |
| green on surface / bg | Dot, icons | 5.00 / 4.61 | Pass |
| plum on surface | Well above text | 8.00 | Pass |
| plum on bg | Well above text | 7.38 | Pass |
| plum on plum-tint | Badge well above | 6.52 | Pass |
| ink on amber-tint | Badge above | 13.81 | Pass |
| ink on amber | Text on amber fill | 7.52 | Pass |
| white on ink | Primary button | 15.75 | Pass |
| line-strong on surface / bg | Input and option borders | 3.66 / 3.38 | Pass (non-text) |
| line on surface / bg | Dividers | 1.38 / 1.28 | Decorative only |
| amber on surface / bg | U.S. dot | 2.09 / 1.93 | Never the only signal |

## Color rules
- Background bg; panels surface; text ink; secondary text slate.
- --line never marks a control. Inputs, question options and checkboxes use --line-strong.
- Amber never as text on light backgrounds; use as fill with ink text. The amber dot always has the text "USD" next to it.
- Green as text uses --green-text.

## Budget band badges
| Band | Label | Background | Text | Icon (Lucide) |
| --- | --- | --- | --- | --- |
| within | Fits your monthly amount | --green-tint | --green-text | circle-check |
| above | A bit above your amount | --amber-tint | --ink | circle-alert |
| well_above | Well above your amount | --plum-tint | --plum | circle-arrow-up |
| none | Total cost | --bg | --ink | info |
Always icon plus text, never color alone.

## Typography
- One family: Public Sans (Google Fonts), weights 400 to 800.
- Headlines: 700 to 800, tracking -0.015em, 24 px and up.
- UI and body: 16 px minimum, line height 1.5.
- Money: font-variant-numeric: tabular-nums (Public Sans has the tnum feature; its default figures are proportional, so always set it).
- Scale: 12, 14, 16, 18, 20, 24, 32, 40.

## Money and exchange rate format
- Each currency in its own country's format, with Intl.NumberFormat:
  - USD in en-US: "$315,110"
  - BRL in pt-BR: "R$ 36.200"
  Reason: Brazilian families read the BRL amounts; "R$ 36,200" in U.S. format can be read as 36 reais and 20 centavos.
- Totals without cents. Exchange rate with 2 decimals.
- Exchange rate in two lines, no dot separators:
  "1 USD = R$ 5,55"
  "Source: Frankfurter, Nov 10, 2026"

## Avoid generic patterns
- No dot separators (A · B · C). Use separate lines or plain sentences.
- No uppercase labels above headlines, no "→" in buttons, no single highlighted word in a headline.
- Do not turn everything into identical cards with the same shadow. Build hierarchy with size, weight and space; use panels only where grouping helps.
- Motion only as a response to a user action, short (120 to 200 ms), and off under prefers-reduced-motion.

## Signature element: the cost bridge
The only bold element. The program total is drawn as the logo arch: the BRL amount sits at the green dot (left, family's country) and the USD amount at the amber dot (right, U.S.), each with its currency code as text. Under the arch: the band badge and the monthly amount. It appears on the results list and on the college detail. Everything else stays sober.
Accessibility: the amounts are real text (not inside the SVG drawing), the arch is aria-hidden, and the reading order is BRL amount, USD amount, band.

## Layout
Mobile first, 380 px base, centered, content max 720 px. Visible keyboard focus on every control (2 px --focus outline with offset).

## Components
Buttons (primary, secondary, link), question option (single and multiple choice), input, progress bar, band badges, cost line (label, amount, source and date in slate), alert (info, rule change, missing data), AI note (label "Written by AI. Check the source.", confidence, source link), cost bridge, checklist item (todo, done, warning), currency toggle (USD and family currency), timeline. components.html shows every component in every state.

## Voice
Plain, warm, short. Neutral about money: "This is above the amount you shared." Honest: "Not confirmed. See the official page." No em dashes in any copy.
