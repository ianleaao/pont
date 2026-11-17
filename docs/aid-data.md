# Aid data for task 2 (researched 13 Nov 2026, official pages only)

Use this table to fill the `aid` block in data/colleges.json (schema: docs/funding-and-currency.md section 1). Every value has its official URL. checked_on for all: "2026-11-13". Values marked NOT CONFIRMED go in as null with status "not_confirmed". Do not fill them from memory.

## Summary

| Field | Harvard | MIT | Amherst | UT Austin | ACC |
| --- | --- | --- | --- | --- | --- |
| intl_admission_policy | need_blind | need_blind | need_blind | NOT CONFIRMED | not_applicable (open admission) |
| intl_need_based_aid | true | true | true | false for incoming students (see notes) | NOT CONFIRMED (FAFSA based) |
| meets_full_need_intl | true | true | true | false | false |
| merit_aid_intl | none | none | none | limited | yes (ACC scholarships open to internationals) |
| thresholds | under 100k: parents pay 0; up to 200k: at least full tuition (see note on internationals) | NOT for internationals (framed as "American families") | none published | none | none |
| forms_intl | css_profile, idoc | css_profile, idoc | css_profile or isfaa (fee hardship), income documents | none (automatic merit consideration) | ACC scholarship application |
| forms_us | fafsa, css_profile, idoc | fafsa, css_profile, idoc | fafsa (code 002115); css_profile NOT CONFIRMED | fafsa (or tasfa) | fafsa |
| admission deadlines | REA 11-01, RD 01-01 | NOT CONFIRMED | ED and RD in aid table only | EA 10-15, RD 12-01 | F-1 new students, fall: 07-01 |
| aid form deadlines | REA 11-01, RD 02-01 | EA 11-30, RA 02-15 | ED 11-13, RD 01-15 | scholarships via Common App by 12-01; ISSS fall window 02-01 to 03-01 | priority 05-01, closes 12-15 |
| outside scholarships | allowed, can replace expected contribution | allowed; first 5,400 USD replaces student contribution, then reduces MIT Scholarship | allowed, must be reported; replaces work, then up to 3,000 USD student contribution, then reduces college scholarship | NOT CONFIRMED (policy page not read) | NOT CONFIRMED |

## Harvard College
Sources:
- How aid works (cost table, thresholds, need-blind, outside scholarships): https://college.harvard.edu/financial-aid/how-aid-works
- International applicants: https://college.harvard.edu/admissions/apply/international-applicants
- Apply for aid, prospective students (forms, deadlines, 2027-28 instructions): https://college.harvard.edu/financial-aid/apply-financial-aid/prospective-students
- Application requirements (REA, RD): https://college.harvard.edu/admissions/apply/application-requirements

Facts:
- Need-blind: "Your financial need and your aid application will never affect your chance of being admitted to Harvard." Admissions and aid "are the same for all applicants - regardless of nationality or citizenship."
- Meets 100% of demonstrated need. No merit awards ("There are no merit-based awards").
- Thresholds: "For families with annual incomes below $100,000, the expected parent contribution is zero." "For families with incomes up to $200,000, financial aid will cover at least the full cost of tuition."
- Internationals and thresholds: the page does not say it directly, but says international students are "eligible for exactly the same aid as American students." Store applies_to_intl: true with note "Based on 'exactly the same aid as American students'. Confirm with Harvard financial aid."
- What the zero contribution covers is not listed. Store covers: null, note "Not listed on the page."
- Forms: "Regardless of your citizenship ... you will need to submit a CSS Profile and an IDOC Packet." CSS code 3434. FAFSA code E00468 (U.S. citizens and eligible non-citizens only). Fee hardship: alternate instructions at https://college.harvard.edu/alternate-application-financial-aid
- Aid deadlines: REA 11-01 (CSS, FAFSA, IDOC), RD 02-01. Late aid applications accepted but may delay the decision.
- Cost of attendance 2026-27: tuition 62,226; fees 6,216; housing 14,250; food 8,942; billed subtotal 91,634; personal 2,500; books 1,000; transportation 0 to 5,000; total 95,134 to 100,134. Health insurance 4,954 unless covered by a family plan. Travel allowance included in aid for students on aid.
- Documents: income documents translated to English, "You don't need an official translation." Submit through IDOC, not email. Actual filed 2025 tax return, no estimates; non-filers send a Tax Non-Filer Statement plus wage statement, salary certificate or employer letter.

## MIT
Sources:
- Making MIT affordable (need-blind, thresholds): https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/
- Cost of attendance 2026-27: https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/coa/
- International aid application: https://sfs.mit.edu/undergraduate-students/apply-for-aid/international/
- Domestic aid application: https://sfs.mit.edu/undergraduate-students/apply-for-aid/domestic/
- Deadlines: https://sfs.mit.edu/undergraduate-students/apply-for-aid/deadlines-process/
- Outside scholarships: https://sfs.mit.edu/undergraduate-students/types-of-aid/outside-scholarships-grants/

Facts:
- Need-blind and full need "for all of our undergraduate students, domestic and international."
- "We are committed to meeting 100% of demonstrated financial need for international students."
- All aid is need-based; no merit.
- Thresholds (tuition-free under 200,000; parents pay nothing under 100,000) are framed for "American families". Store with applies_to_intl: null, status "not_confirmed", note "Stated for American families. Not confirmed for international students." The engine must NOT use these thresholds for Ananya; MIT net price for internationals uses method "calculator_link".
- Forms, international: CSS Profile (code 3514) and parental tax returns or income documentation through IDOC. Domestic: CSS Profile, FAFSA (002178), IDOC.
- Aid deadlines: EA 11-30, RA 02-15. Late applications have no penalty. Admission deadlines: NOT CONFIRMED (admissions page failed).
- Cost of attendance 2026-27: tuition 66,720; student life fee 420; housing 14,090; food 8,104; books and supplies 930; personal 2,496; total 92,760. Travel not included. Health insurance: automatic MIT SHIP unless waived; premium NOT CONFIRMED.
- Documents: tax return from the parents' country "along with a translation to English if applicable. Professional translation is not required." Only through IDOC.

## Amherst College
Sources:
- International admission: https://www.amherst.edu/admission/apply/international
- International financial aid: https://www.amherst.edu/offices/financialaid/international_students
- Applying for aid, international (forms, deadlines, document rules): https://www.amherst.edu/offices/financialaid/international_students/appleton
- Cost 2026-27: https://www.amherst.edu/tuition
- Financial aid (U.S. forms): https://www.amherst.edu/offices/financialaid
- Gift aid (outside scholarships): https://www.amherst.edu/offices/financialaid/international_students/gift_aid

Facts:
- "Amherst College follows a need-blind admission policy for all students, domestic and international." (punctuation adapted)
- Meets 100% of calculated need for admitted international students, no packaged loans. 2025-26: 82% of international students with aid; average international award above 84,000 USD.
- All aid need-based; no merit. No published income thresholds.
- Forms, international: 2027-28 CSS Profile (code 3003), reporting finances in the home currency; or ISFAA if the CSS fee is a hardship (PDF: https://www.amherst.edu/system/files/2026-11/ISFAA27-28.pdf); Business/Farm Supplement if a parent owns a business or farm; both parents if divorced or separated; 2025 income and tax documents for parents (China: salary certificate).
- Aid deadlines 2027-28: ED 11-13-2026 (today), RD 01-15-2027.
- Forms, U.S. citizens: FAFSA (code 002115). CSS Profile for U.S. citizens: NOT CONFIRMED. (Corrected 2026-11-17: the table first listed fafsa and css_profile.)
- Outside scholarships: allowed, must be reported; replace work, then up to 3,000 USD of the student contribution, then reduce the college scholarship. The page may be the first-year version, not international-specific. Confirm with Amherst.
- Cost 2026-27: tuition 75,330; housing 10,980; meals 9,340; fees 710; personal 1,800; travel varies. No published total: the engine sums the lines and labels it "sum of published lines". Health insurance not included initially; premium NOT CONFIRMED.
- Documents: PDF only (no images); original currency and home language plus English translation ("your own translation is sufficient"); original signatures, no digital signatures. Exchange rate review: if the rate moves 10% or more from the rate used in the award, a review can be requested once per year (early August or early December).

## UT Austin
Sources:
- International admissions: https://admissions.utexas.edu/apply/international-students/
- ISSS scholarships: https://global.utexas.edu/isss/advising-services/scholarships
- Texas One Stop, apply for aid: https://onestop.utexas.edu/managing-costs/scholarships-financial-aid/apply/
- ISSS insurance: https://global.utexas.edu/isss/advising-services/insurance

Facts:
- Deadlines: EA 10-15 (passed), RD 12-01; decisions EA 01-15, RD 02-15. Application fee 90 USD, no fee waivers for internationals.
- Most aid requires U.S. citizen, permanent resident or eligible non-citizen. Non-residents who are not FAFSA-eligible "are only eligible for non-resident aid." So intl_need_based_aid for incoming F-1: false.
- Merit: "There is no separate scholarship application." Students without a FAFSA are still considered for scholarships that do not require need. Store merit_aid_intl: "limited".
- ISSS scholarships for internationals, fall window 02-01 to 03-01-2027, some open to new students (examples: STEM Scholarship 4,800 USD, Iimura Peace 5,000, African Leadership Bridge 5,000, each with specific criteria). One-time awards. 14% tax withholding unless a treaty applies. Show as "possible, not guaranteed", never in totals.
- U.S. citizens: FAFSA code 003658; TASFA for students without FAFSA. CSS Profile not used.
- Need-blind policy for internationals: NOT CONFIRMED. Outside scholarship policy: NOT CONFIRMED (https://finaid.utexas.edu/ut-financial-aid-policy/outsidescholarshipspolicy/ not read).
- Existing UT document rules (i20.document_rules) stay: separate signed translation required. Note the contrast: Harvard, MIT and Amherst accept the family's own translation.

## Austin Community College
Sources:
- International students: https://admissions.austincc.edu/international-students/
- Proof of financial support: https://admissions.austincc.edu/international-students/application-requirements/proof-of-financial-solvency/
- Scholarships: https://students.austincc.edu/scholarships/
- Tuition for international students: https://admissions.austincc.edu/international-students/application-requirements/tuition-information-for-international-students/

Facts:
- Scholarships: "ACC scholarships are for every kind of student, including international." One application, matched to many scholarships. Opens 01-15, priority 05-01, closes 12-15. Need-based ones use the FAFSA, so F-1 students get only the non-need ones.
- Health insurance for general F-1 students: "Health insurance is not required but is strongly recommended." Source: the proof of financial support page. This replaces the unsourced health_insurance_required: false.
- F-1 application deadline, fall: 07-01 (new students needing a visa).
- F-1 tuition: out-of-district international rate; amount not on that page.
- Transfer to UT: no transfer agreement or guaranteed admission found on the ACC transfer page. The route must say "Transfer admission to UT is not guaranteed."

## Conflict to resolve in task 2
ACC estimate: data/colleges.json has f1_estimated_annual_cost 29,000 ("ACC estimate (9 months)", checked 8 Nov). The proof of financial support page now says 30,000 USD per year for the first year (tuition and fees 13,000; living 17,000), "estimates, subject to change without notice". Proposal: use 30,000 with the new source for both the cost line and the I-20 amount, and update the affected tests (ACC I-20 estimate and ACC + UT totals). Show me the before and after test values.
