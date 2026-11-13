# Product: Pont (direction approved 13 Nov 2026)

## Problem
International students know which college they dream of, but not how to pay for it. Aid rules are scattered and different for every college: some are need-blind for internationals and meet full need, some give only merit aid, some give nothing to F-1 students. Each uses different forms (CSS Profile, ISFAA, its own form, certification of finances) and asks for financial documents in English and USD, while the family's papers are in another language and currency. Many students give up on a dream school that would have cost them less than a "cheaper" one.

## What exists and the gap (checked 12 Nov 2026)
- ApplyBoard: program search, a "Scholarships Available" filter, partner-school scholarships, Abbie AI advisor (GPT) for discovery and applications. Its public pages do not cover cost in the family's currency, need-based aid forms or financial document conversion.
- Cost calculators (MyinTuition, net price calculators): several colleges say they are not meant for international students.
- Scholarship databases (IEFA, Fastweb, Bold.org): lists, not plans.
- Gap Pont fills: a personal funding strategy (which aid doors are open for this profile, at which colleges, with which forms and documents), in the family's currency, with AI that prepares the documents.

## Users
| Priority | Situation | What Pont does for them |
| --- | --- | --- |
| Main | International student, no visa yet, any country | Funding profile, routes, aid forms, I-20 and visa steps, documents studio |
| Main | U.S. citizen or permanent resident with parents abroad | FAFSA and CSS Profile with foreign income, residency check, documents converted |
| Secondary | Already F-1 at another school (transfer) | Aid at the next college, SEVIS transfer steps |
| Secondary | Tourist visa or ESTA, dependent visas, DACA | Routing and official guidance only (docs/visa-and-fees.md) |

## The consultancy journey
A. Goal intake: short AI conversation, then a confirm screen.
B. Funding profile: which aid doors are open (engine, deterministic).
C. Funding map for the dream school: aid policy, published thresholds, estimated net price range, forms, deadlines, the gap.
D. Routes: Reach (dream), Match (strong aid for internationals), Affordable path (community college then transfer, public universities with merit aid). Later options listed only: graduate, continuing education, Europe.
E. Plan: timeline with tests, applications, aid forms, scholarships, I-20, visa.
F. Documents studio: upload, AI reads and translates, engine converts to USD, AI flags problems against the college's rules, drafts requests to the bank.
G. Family mode: summary for parents in their language and currency.
H. Save plan (login only here).

## Intake questions (AI asks them in conversation; the confirm screen shows them as a form)
1. Dream colleges (one or more) and program, or "help me choose".
2. Level: bachelor's (prototype). Graduate, MBA and continuing education appear only as alternatives.
3. Citizenship (one or more passports).
4. Visa or status today (six situations, docs/visa-and-fees.md).
5. Where the student lives now.
6. Where each parent lives and earns (country). Parents in different countries are allowed.
7. When do you want to start? Fall 2027, Spring 2028, Fall 2028.
8. Optional: family income band, in USD ranges shown also in the family currency (under 65k, 65k to 100k, 100k to 150k, 150k to 200k, over 200k, prefer not to say).
9. Optional: "How much could your family pay per month?" in the family currency.
10. For the plan (later): tests taken, where high school was finished, grade range.

The currency and the number format come from the parents' country of income (data/countries.json). If parents earn in two countries, both currencies are shown.

## Colleges in the prototype
UT Austin, Austin Community College (Texas), Harvard, MIT, Amherst. Every aid policy, threshold, form and deadline needs an official source and a checked date before it is used. Anything unconfirmed shows "Not confirmed" with the official link.

## Privacy and limits
Answers stay only in this browser tab (sessionStorage) and are cleared when the tab closes. A discreet "Start over" button clears them at any time. Only the text needed for an AI answer is sent to the proxy, and the proxy stores nothing.
No exact income, savings balances, SSN, account or ID numbers. Status is used only for routing and not stored. No legal or visa advice. No aid promises: estimates are ranges with sources. Every number and rule has a source and a date.
