# Visual design v4: Campus (chosen by Ian on 18 Nov 2026)

Replaces Compass (docs/design-compass.md, dropped) and the look of brand v2. Format: a complete desktop web app, in the style of an education platform (rich, organized, colorful, full of useful information: filters, recommendations, deadlines, progress, AI always at hand). It adapts down to phone width. The logo symbol stays (arch over a deck, left dot = family's country, right dot = the U.S.).

Visual reference: docs/mockups/dashboard.html (open with Live Server). Every new screen follows its layout, tokens and components.

## App shell (every screen after the welcome)
- Left sidebar, 256 px, white: logo; navigation with icons (Overview, My colleges, Scholarships, Plan and deadlines, Documents, Family mode); at the bottom the profile card (name, country, currency) and "Start over".
- Top bar in the content area: page title and greeting, search field, currency switch (USD and the family currencies), help button.
- Content: 12-column grid, max width 1200 px, gap 24 px, cards on a light background.
- Right rail, 360 px: the AI advisor, always open on desktop (chat, suggested prompts, composer, AI label). On narrower screens it becomes a floating "Ask the advisor" button that opens a drawer.
- Below 960 px the sidebar becomes a top bar with a menu button; below 640 px cards stack in one column.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| --bg | #F6F7FB | App background |
| --surface | #FFFFFF | Cards, sidebar, inputs |
| --ink | #111A35 | Main text, dark hero cards |
| --muted | #5A6480 | Secondary text, source lines |
| --line | #E4E7F0 | Card borders, dividers (decorative) |
| --line-strong | #8A93AB | Input borders (3.07:1 on white) |
| --primary | #2747C9 | Primary buttons, links, active nav, focus |
| --primary-tint | #EAEEFD | Active nav background, selected filters |
| --dream | #5B32C8 | "Your dream" group (violet) |
| --dream-tint | #F0EBFD | |
| --aid | #0B7A54 | "Strong aid for you" group and the "Funded" label (green) |
| --aid-tint | #E3F5EC | |
| --lower | #9A5A00 | "Lower-cost path" group and the "Small gap" label (amber, text-safe) |
| --lower-tint | #FFF3DC | |
| --gap | #B4235A | "Gap" label (raspberry) |
| --gap-tint | #FCE8EF | |
| --sun | #F5B740 | Decorative fills only (charts, logo U.S. dot), never text |

Contrast checked 18 Nov 2026 (WCAG AA): ink on bg 16.04; muted on bg 5.50, on white 5.88; primary on white 7.42, white on primary 7.42, primary on primary-tint 6.41; dream on dream-tint 6.58, white on dream 7.68; aid on aid-tint 4.72, on white 5.35; lower on lower-tint 4.98; gap on gap-tint 5.39; white on ink 17.17. --line is decorative only (1.59).

Each route group has its color, and the color always comes with the group's name and icon (never color alone).

## Type
- One family: Plus Jakarta Sans (Google Fonts), 400, 500, 600, 700, 800.
- Scale (px): 44 welcome headline (800, line-height 1.08, letter-spacing -0.02em); 28 page title (700); 20 card title (700); 40 to 48 big numbers (800, tabular figures); 15 body; 14 secondary; 13 labels, chips, source lines; 12 minimum.
- Sentence case. No all-caps labels. No em dashes.

## Shape, depth, spacing
- Radius: 16 cards, 12 inputs and buttons, 999 chips and badges, 10 icon tiles.
- Cards: white, 1 px --line border, shadow `0 1px 2px rgba(17,26,53,.04), 0 4px 16px rgba(17,26,53,.04)`. Hero cards may use --ink or a group color as background with white text.
- Icon tiles: 40 px rounded squares in a tint with the group or section color icon (Lucide).
- College identity: no logos or photos. Each college gets a colored band and a monogram tile (initials) in its route group color.
- 8 px spacing grid: 8, 12, 16, 24, 32, 48.

## Components (build each in components.html, every state)
1. Sidebar nav item (default, hover, active, with count badge).
2. Top bar with search, currency switch (segmented control), help.
3. Dream hero card: college monogram, policy line, big number, gap label with the to-confirm line, funding bar, actions.
4. Funding bar: horizontal stacked bar per year (aid, family pays, gap, not confirmed hatched), with a legend under it.
   - Segments come from `fundingBar(net, gap)` in js/engine.js. Widths follow the amounts; a non-zero part is never thinner than 2% so it stays visible.
   - "Not confirmed" has no amount, so it gets a fixed small width (6%), hatched, with the legend "Still to confirm: amount not confirmed".
   - "Gap" (raspberry) appears only when there is a gap (Lucas at UT), with its own legend entry "Gap: <amount> a year". The family part then reads "Your family can cover <amount> a year".
   - Threshold rule (Ananya at Harvard), legend wording: "Parent contribution: $0 under Harvard's rule. Cost of attendance $95,134 to $100,134 a year (2026-27)." and "Your family: visa fees, $535 once".
   - On the dark hero: aid #3FBF8A, family --sun, gap #F0739E (all 3:1 or more on --ink). On light cards: aid --aid, family --lower, gap --gap (--sun is 1.79 on white, so it is not used there).
5. College card: color band, monogram, name, city, policy tags, "For you" net price line, gap label or "No estimate yet", actions (View, Add to plan).
6. Route group column header: icon tile, group name, count.
7. Gap label: Funded (check), Small gap (contrast), Gap (alert), each with tint background.
8. Policy tag chips: "Need-blind for internationals", "Meets full need", "Merit only", "No loans", etc.
9. Deadline list item: date tile (month and day), title, college, form name, status (to do, done, passed).
10. Documents checklist with progress ring and per-document status (not started, uploaded, flagged, ready).
11. AI advisor panel: header with status, messages (advisor, user), result mini-card inside the chat, suggested prompt chips, composer, AI label "AI advisor. Uses your Claude account. Numbers come from official pages."
12. Filter panel (colleges page): checkbox groups, range, active filter chips, clear all.
13. Source line: "Source: <page>, checked <date>" with link.
14. Empty, loading (skeleton) and offline AI states.

## Screens (desktop first)
1. Welcome: top navigation; hero in two columns (headline, dream school search with country select, popular chips; on the right a composed preview of the dashboard cards); "How Pont works" in 4 steps; colleges that fund international students; source note.
2. Intake: the advisor conversation in the center (chat with chips, "Use a form instead"), a live profile summary card building up on the right.
3. Profile confirm.
4. Overview (dashboard): dream hero, deadlines, routes in group columns, documents progress, advisor rail.
5. My colleges: filters on the left, college cards grid, sort.
6. College detail: policy, net price for you, cost by phase, deadlines, forms, documents rules.
7. Scholarships: college and outside scholarships for this profile.
8. Plan and deadlines: month timeline grouped by month, with status.
9. Documents studio: document viewer with AI highlights, extracted fields, USD conversion, flags, drafts.
10. Family mode: summary for parents in their language and currency.

## Real data only (decided 19 Nov 2026)
The mockup shows sample states. The app shows only what the data and the student's actions support:
- Plan steps: built from the real deadlines of the route colleges (`deadlineList` in js/engine.js), "0 of N" until the student ticks them. Ticks are saved in the tab only.
- Documents: the documents the dream college's data asks for, each "Not started", ring at 0, until the documents studio (task 8).
- Next deadline: the real next one for today's date (for example MIT Early Action aid, Nov 30, 2026), even when the mockup shows another.
- Advisor rail status: "Live, powered by Claude" when the Artifact runtime resolved the sample function, otherwise "Sample answers" (docs/ai.md). Scripted answers are templates filled from engine values (data/ai-scripts.json, "advisor") and carry the offline banner.

## Motion
Subtle and purposeful only: card hover lifts 1 px with a slightly stronger shadow; advisor messages fade in with a short typing indicator; the funding bar fills once on first view. Respect prefers-reduced-motion (no motion at all).
