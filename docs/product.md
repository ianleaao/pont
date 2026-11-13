# Product: Pont

## Problem
International families do not know the full cost of a U.S. degree in their own currency, which costs are hidden (insurance, visa, fees, flights), what they must show for the I-20, or which realistic paths exist. Existing tools help students get admitted; they do not show the real cost in the family's currency with a plan.

## Users (by visa situation)
| Priority | Situation | Why they use Pont |
| --- | --- | --- |
| Main | No visa, starting from zero | Full cost, budget band, complete I-20 and visa checklist |
| Secondary | Already F-1 at another school (for example ACC to UT transfer) | Does the next college fit; SEVIS transfer steps |
| Secondary | Tourist visa (B-1, B-2) or ESTA | Learns they cannot study with it and which path to take |
| Secondary | H-4, L-2, E or G dependent | Can study now; cost and aid rules; optional switch to F-1 |
| Secondary | F-2 dependent | Part-time limit; how to switch to F-1 |
| Outside visa flow | U.S. citizen or permanent resident | Cost and FAFSA path |
| Outside visa flow | DACA or no status | Cost, college aid, official guidance only |

Visa types are the same for every nationality. A country layer adjusts: ESTA access (Brazil, Mexico, Argentina and Canada are not in the Visa Waiver Program), Canadians need no visa stamp (still need I-20 and SEVIS fee), reciprocity fees, Visa Integrity Fee collection, travel restrictions, consulate wait times. Prototype countries: Brazil and India.

## Core flow
1. Onboarding, one question per screen, no login.
2. Result list: each college with total program cost in USD and family currency, and a budget band.
3. College detail: cost by phase (pay versus show), scholarships, deadlines.
4. "Out of my budget" button: similar cheaper options and next steps.
5. Plan: application timeline, I-20 request kit, visa checklist.
6. Save plan (login only here).

## Onboarding questions
Block 0, interest:
1. Level: bachelor's (prototype), graduate or MBA, continuing education. Not a screen in the prototype: only one option is active.
2. Area of study.
3. State or city (prototype: Texas). Not a screen in the prototype: only one option is active.
4. Colleges and program for each, or "help me choose". Program is required because cost varies by program.

Block 1, before the result:
5. Nationality (one or more passports).
6. Visa or status today: U.S. citizen or permanent resident; no visa, starting from zero; tourist visa or ESTA; dependent visa (H-4, L-2, E, G or F-2); already F-1 at another school; DACA or no status.
7. When do you want to start?
8. Family currency.
9. Optional: "How much could your family pay per month?" (skip allowed).

Block 2, for the plan (after the result):
10. Where you finished or will finish high school (English test exemption).
11. Tests taken (SAT, TOEFL, IELTS, Duolingo).
12. Grade range.
13. Parents' countries.

Block 3, only at documents:
14. Which financial documents the family has.

## Choosing colleges: filters
Aid form used (FAFSA, CSS Profile, own form), aid for internationals (need, merit, both, none), cost, location, college type.

## Privacy and limits
Answers are never sent to or saved on a server. They stay only in this browser tab (sessionStorage) and are cleared when the tab closes. A discreet "Start over" button clears them at any time.
No income, savings, SSN or account numbers. No legal or visa advice. Every number has source and date.
