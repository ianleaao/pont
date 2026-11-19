# Brand: Pont (version 4, "Campus")

Name: Pont (French for bridge; short and easy for Americans to read). Personality: calm, honest, warm, precise, like a good consultant. Never judges, never promises.

Direction (chosen 18 Nov 2026): a complete desktop web app in the style of an education platform. Rich, organized and colorful, full of useful information (routes, deadlines, progress, documents) with the AI advisor always at hand. It adapts down to phone width. Full spec, app shell and components: docs/design-campus.md. Visual reference: docs/mockups/dashboard.html. Replaces version 2 (sober, form-like) and the dropped Compass direction.

## Logo
Wordmark "Pont" in Plus Jakarta Sans 800, ink, letter-spacing -0.02em, next to the symbol. Symbol: one arch connecting two dots on a flat deck line. Arch and deck in ink; left dot primary blue (family's country); right dot sun (the U.S.). The symbol alone is the favicon (assets/favicon.svg). On dark backgrounds the arch is white.

SVG symbol (viewBox 0 0 64 40):
```html
<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M8 32 Q32 0 56 32" fill="none" stroke="#111A35" stroke-width="4.5" stroke-linecap="round"/><line x1="8" y1="32" x2="56" y2="32" stroke="#111A35" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="32" r="6" fill="#2747C9"/><circle cx="56" cy="32" r="6" fill="#F5B740"/></svg>
```

## Tokens
css/tokens.css is the code copy of this section. Change both together.

| Token | Value | Use |
| --- | --- | --- |
| --bg | #F6F7FB | App background |
| --surface | #FFFFFF | Cards, sidebar, inputs |
| --ink | #111A35 | Main text, dark hero cards |
| --ink-2 | #333C5A | Nav text, tags |
| --muted | #5A6480 | Secondary text, source lines |
| --line | #E4E7F0 | Card borders, dividers (decorative only) |
| --line-strong | #8A93AB | Input borders, checkboxes, dashed empty states |
| --primary | #2747C9 | Primary buttons, links, active nav, focus ring |
| --primary-tint | #EAEEFD | Active nav background, selected filters |
| --dream | #5B32C8 | "Your dream" group (violet) |
| --dream-tint | #F0EBFD | |
| --aid | #0B7A54 | "Strong aid for you" group and the "Funded" label (green) |
| --aid-tint | #E3F5EC | |
| --lower | #9A5A00 | "Lower-cost path" group and the "Small gap" label (amber, text-safe) |
| --lower-tint | #FFF3DC | |
| --gap | #B4235A | "Gap" label (raspberry) |
| --gap-tint | #FCE8EF | |
| --sun | #F5B740 | Decorative fills only (charts on dark, logo U.S. dot), never text |
| --aid-on-dark | #3FBF8A | Funding bar aid part on the dark hero |
| --gap-on-dark | #F0739E | Funding bar gap part on the dark hero |
| --on-dark-muted | #C9CEE0 | Secondary text on the dark hero |
| --on-dark-soft | #AEB4CB | Source line on the dark hero |

Spacing: 8 px grid (8, 12, 16, 24, 32, 48). Radius: 16 cards, 12 inputs and buttons, 10 icon tiles, 999 chips and badges. Card shadow: `0 1px 2px rgba(17,26,53,.04), 0 4px 16px rgba(17,26,53,.04)`.

## Contrast (WCAG AA, checked 18 and 19 Nov 2026)
Text needs 4.5:1. Non-text elements that identify a control or carry meaning (input borders, bar parts) need 3:1.

| Foreground on background | Use | Ratio | AA |
| --- | --- | --- | --- |
| ink on bg | Main text | 16.04 | Pass |
| muted on bg / white | Secondary text | 5.50 / 5.88 | Pass |
| muted on primary-tint | Secondary text on selected | 5.08 | Pass |
| ink-2 on white | Nav, tags | 10.85 | Pass |
| primary on white | Links | 7.42 | Pass |
| white on primary | Primary button | 7.42 | Pass |
| primary on primary-tint | Active nav | 6.41 | Pass |
| dream on dream-tint | Group text, monogram | 6.58 | Pass |
| white on dream | Solid monogram | 7.68 | Pass |
| aid on aid-tint / white | Funded label, group | 4.72 / 5.35 | Pass |
| lower on lower-tint / white | Small gap label, group | 4.98 / 5.47 | Pass |
| gap on gap-tint / white | Gap label | 5.39 / 6.31 | Pass |
| white on ink | Hero text | 17.17 | Pass |
| on-dark-muted on ink | Hero secondary text | 10.95 | Pass |
| on-dark-soft on ink | Hero source line | 8.33 | Pass |
| aid-on-dark / sun / gap-on-dark on ink | Funding bar parts on the hero | 7.38 / 9.59 / 6.26 | Pass (non-text) |
| line-strong on white | Input borders | 3.07 | Pass (non-text) |
| line on white | Card borders | 1.59 | Decorative only |
| sun on white | Never used on light backgrounds | 1.79 | Not used |

## Color rules
- Each route group has its color, and the color always comes with the group name and its icon: "Your dream" (sparkles, violet), "Strong aid for you" (hand-coins, green), "Lower-cost path" (piggy-bank, amber).
- Gap labels: Funded (circle-check, green), Small gap (contrast, amber), Gap (circle-alert, raspberry). Always icon plus text, never color alone, and always with the to-confirm line under it.
- --line never marks a control. Inputs and checkboxes use --line-strong.
- --sun is a fill on dark backgrounds only, never text.

## Typography
- One family: Plus Jakarta Sans (Google Fonts), 400, 500, 600, 700, 800.
- Scale (px): 44 welcome headline (800, line height 1.08, letter-spacing -0.02em); 28 page title (700 to 800); 20 card and section titles (700); 40 to 64 big numbers (800, tabular figures); 15 body; 14 secondary; 13 labels, chips, source lines; 12 minimum.
- Money: font-variant-numeric: tabular-nums (class `num`).
- Sentence case. No all-caps labels. No em dashes.

## Money and exchange rate format
- Each currency in its own country's format, with Intl.NumberFormat and the locale from data/countries.json. Examples:
  - USD in en-US: "$315,110"
  - BRL in pt-BR: "R$ 36.200"
  - INR in en-IN: "₹29,62,050"
  - VND in vi-VN: "93.000.000 ₫"
  Reason: each family reads amounts in its own format; "R$ 36,200" in U.S. format can be read as 36 reais and 20 centavos.
- Where the local symbol is "$" (MXN, COP), show the code ("MXN 150,000"), never a bare "$" next to USD.
- Totals without cents. Exchange rate with 2 decimals below 1,000, no decimals at 1,000 and above.
- The currency switch (USD and the family currencies) sits in the top bar; the rate shows under it with its source and date: "1 USD = R$ 5,84" and "Source: Frankfurter (central bank data), Nov 19, 2026". A currency without a rate is disabled and shows "Not confirmed" with the official link.

## Layout
Desktop first, adapting to 380 px with no horizontal scroll. App shell: left sidebar 256 px, content grid of 12 columns (max 1200 px, gap 24 px), advisor rail 360 px. Breakpoints: below 1280 px the rail becomes the "Ask the advisor" button and a drawer; below 1100 px the hero and side cards stack; below 960 px the sidebar becomes a top bar with a menu button; below 640 px cards stack in one column. Visible keyboard focus on every control (2 px --primary outline with offset).
Language: the page is English (`<html lang="en">`). Every block in the family language sets its own lang on its element (for example lang="pt-BR", lang="hi").

## Motion
Subtle and purposeful only: card hover lifts 1 px with a slightly stronger shadow; advisor messages fade in after a short typing indicator; the funding bar fills once. Off under prefers-reduced-motion.

## Components
The 14 components of docs/design-campus.md (sidebar nav item, top bar, dream hero, funding bar, college card, route group header, gap label, policy tags, deadline item, documents checklist, AI advisor panel, filter panel, source line, empty, loading and offline states). components.html shows every one in every state, rendered by js/ui.js with engine values.

## Voice
Plain, warm, short. Neutral about money: "Your family can cover $47,264 a year. Gap: $31,514 a year." Honest: "Not confirmed. See the official page." No em dashes in any copy.
