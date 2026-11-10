# Brand: Pont

Name: Pont (French for bridge; short and easy for Americans to read). Personality: calm, honest, warm, precise. Never judges, never promises.

## Logo
Wordmark "Pont" in DM Serif Display, ink blue. Symbol: one arch connecting two dots on a flat deck line; left dot green (family's country), right dot amber (U.S.). Symbol alone is the app icon and favicon.

SVG symbol (viewBox 0 0 64 40):
```html
<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M8 32 Q32 0 56 32" fill="none" stroke="#15233A" stroke-width="4" stroke-linecap="round"/><line x1="8" y1="32" x2="56" y2="32" stroke="#15233A" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="32" r="5.5" fill="#2E7D5B"/><circle cx="56" cy="32" r="5.5" fill="#E3A947"/></svg>
```

## Tokens (paste into css/tokens.css)
```css
:root {
  --ink: #15233A;
  --paper: #F5F1E9;
  --sand: #E9E3D6;
  --white: #FFFFFF;
  --slate: #5A6475;
  --green: #2E7D5B;
  --green-text: #25684C;
  --green-tint: #E3EFE8;
  --amber: #E3A947;
  --amber-tint: #FBEFD6;
  --terracotta: #C2553A;
  --terracotta-text: #A8442D;
  --terracotta-tint: #F6E1DA;
  --font-display: "DM Serif Display", Georgia, serif;
  --font-ui: "Inter", system-ui, sans-serif;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-full: 999px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;
  --shadow-card: 0 1px 3px rgba(21, 35, 58, 0.08);
}
```

## Color rules
- Background paper; cards sand or white; text ink; secondary text slate.
- Green #2E7D5B and terracotta #C2553A are below 4.5:1 on paper: icons and fills only. For text use --green-text and --terracotta-text.
- Amber never as text on light backgrounds; use as fill with ink text.

## Budget band badges
| Band | Label | Background | Text | Icon (Lucide) |
| --- | --- | --- | --- | --- |
| within | Fits your monthly amount | --green-tint | --green-text | check-circle |
| above | A bit above your amount | --amber-tint | --ink | alert-circle |
| well_above | Well above your amount | --terracotta-tint | --terracotta-text | arrow-up-circle |
| none | Total cost | --sand | --ink | info |
Always icon plus text, never color alone.

## Typography
- Headlines: DM Serif Display, 24 px and up.
- UI and body: Inter, 16 px minimum, line height 1.5.
- Money: Inter with font-variant-numeric: tabular-nums.
- Scale: 12, 14, 16, 18, 20, 24, 32, 40.

## Layout
Mobile first, 380 px base, content max 720 px. 4 px spacing grid. Radius 8 inputs and buttons, 12 cards. One soft shadow level.

## Components
Question card (one question, big tap targets, Back and Continue), college card (name, program, total USD and family currency, band badge, "Out of my budget" button), cost line (label, amount, source and date in slate), phase card (pay versus show), checklist item (todo, done, warning), AI note (label "Written by AI. Check the source.", confidence, source link), alert banner (info, rule change, missing data), currency toggle (USD and family currency), timeline.

## Voice
Plain, warm, short. Neutral about money: "This is above the amount you shared." Honest: "Not confirmed. See the official page." No em dashes in any copy.
