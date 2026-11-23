/*
  Pont calculation engine.
  Pure functions only: data in, numbers and labels out. No DOM, no network, no AI.
  Rules live in docs/calculation-rules.md. Never round here; round only for display.

  Works as a plain <script> (window.PontEngine) and in Node (module.exports).
*/
(function (root) {
  "use strict";

  const DEFAULTS = {
    yearlyIncrease: 0.03, // assumption, labeled in the UI
    aboveMargin: 0.20,    // "a bit above" margin, to test in interviews
    baseYear: "2026-27",  // year of the published data
  };

  /* ---------- Money ranges ---------- */

  // Every amount is a range. A single value has min === max.
  function range(min, max) {
    if (max === undefined) max = min;
    return { min, max, mid: (min + max) / 2 };
  }
  const ZERO = range(0);
  const addRanges = (a, b) => range(a.min + b.min, a.max + b.max);
  const scaleRange = (r, k) => range(r.min * k, r.max * k);
  const sumLines = (lines) => lines.reduce((acc, l) => addRanges(acc, l.amount), ZERO);
  // firstYear: the student's first year at this college (some items cost more then, e.g. UT SHIP).
  function amountOf(item, firstYear) {
    if (firstYear && item.first_year_amount !== undefined && item.first_year_amount !== null) return range(item.first_year_amount);
    return item.amount !== undefined && item.amount !== null ? range(item.amount) : range(item.min, item.max);
  }

  /* ---------- Sources ---------- */

  function collegeSource(college, id, checkedOn) {
    if (!id) return { id: null, label: "Source not confirmed", url: null, checked_on: checkedOn || null };
    const s = (college.sources || []).find((x) => x.id === id);
    const base = s || { id, label: id, url: null };
    return Object.assign({}, base, { checked_on: checkedOn || base.checked_on || null });
  }

  function feeSource(fees, fee) {
    const s = (fees.sources || []).find((x) => x.id === fee.source);
    if (!s) return { id: "fees:" + fee.id, label: fee.label, url: null, checked_on: fee.checked_on || fees.checked_on };
    return Object.assign({}, s, { checked_on: fee.checked_on || s.checked_on || fees.checked_on });
  }

  const USER_SOURCE = { id: "user", label: "Your estimate", url: null, checked_on: null };

  function uniqueSources(lines) {
    const seen = new Map();
    lines.forEach((l) => {
      if (l.source && !seen.has(l.source.id)) seen.set(l.source.id, l.source);
    });
    return Array.from(seen.values());
  }

  /* ---------- Lines ---------- */

  // A line that is added to the total.
  const line = (id, label, amount, source, note) => ({ id, label, amount, source, note: note || null });

  // A line shown to the user but NOT added to the total.
  // reason: "not_confirmed" (may already be included or unknown), "credited_to_tuition", "not_needed".
  const shownNotAdded = (id, label, amount, source, reason, note) => ({
    id, label, amount: amount || null, source, reason, note: note || null,
  });

  /* ---------- Years ---------- */

  const academicStart = (label) => parseInt(String(label), 10); // "2026-27" -> 2026
  const academicLabel = (start) => start + "-" + String((start + 1) % 100).padStart(2, "0");

  // "fall-2027" -> 2027 (academic year 2027-28). "spring-2028" -> 2027 (same academic year).
  function termToAcademicYear(term) {
    const m = /^(fall|spring)-(\d{4})$/.exec(term || "");
    if (!m) throw new Error("Unknown start term: " + term);
    const y = parseInt(m[2], 10);
    return m[1] === "fall" ? y : y - 1;
  }

  // Exponent = academic years since the base year. Fall 2027, year 1 -> 1.
  function growthFactor(academicYearStart, config) {
    const exp = academicYearStart - academicStart(config.baseYear);
    return { exp, factor: Math.pow(1 + config.yearlyIncrease, exp) };
  }

  /* ---------- Visa situation ---------- */

  // visaClass: which student extras apply (F or J). oneTime: pays pre-arrival government costs.
  // Only the demo situations are fully modeled in the prototype.
  const VISA_PROFILES = {
    citizen_or_pr: { visaClass: null, oneTime: false, modeled: true },
    no_visa: { visaClass: "F", oneTime: true, modeled: true },
    f1_transfer: { visaClass: "F", oneTime: false, modeled: true },
    tourist: { visaClass: "F", oneTime: true, modeled: false },
    dependent: { visaClass: null, oneTime: false, modeled: false },
    // F-2 dependents may study only part time: routing only, the plan shows the switch to F-1 steps.
    f2_dependent: { visaClass: null, oneTime: false, modeled: false },
    daca_or_none: { visaClass: null, oneTime: false, modeled: false },
  };

  function visaProfile(status) {
    const p = VISA_PROFILES[status];
    if (!p) throw new Error("Unknown visa situation: " + status);
    return p;
  }

  /* ---------- Data lookup ---------- */

  const findCollege = (data, id) => data.colleges.colleges.find((c) => c.id === id);
  const findProgram = (college, id) => (college.programs || []).find((p) => p.id === id);
  const findFee = (fees, id) => fees.government.concat(fees.tests).find((f) => f.id === id);

  function notConfirmedResult(college, programId, reason) {
    return { status: "not_confirmed", collegeId: college.id, collegeName: college.name, programId, reason };
  }

  /* ---------- 1. Annual cost (USD) ---------- */

  // opts: { status, residency: "nonresident" | "resident", flights, yearAtCollege (1 = first year there, default 1) }
  function annualCost(college, programId, opts) {
    const firstYear = (opts.yearAtCollege || 1) === 1;
    if (college.status !== "verified") return notConfirmedResult(college, programId, "college_not_verified");
    const program = findProgram(college, programId);
    if (!program) return notConfirmedResult(college, programId, "program_not_found");

    const profile = visaProfile(opts.status);
    const lines = [];
    const notAdded = [];

    if (college.cost_of_attendance_2026_27) {
      // Line-by-line cost (Harvard, MIT, Amherst). Lines with added: false are shown, never added.
      const coa = college.cost_of_attendance_2026_27;
      const src = collegeSource(college, coa.source, coa.checked_on);
      coa.lines.forEach((l) => {
        if (l.added) lines.push(line(l.id, l.label, amountOf(l), src, l.note));
        else notAdded.push(shownNotAdded(l.id, l.label, null, src, "not_confirmed", l.note));
      });
      (college.required_extras_per_year || []).forEach((x) => {
        if (x.applies_to && !x.applies_to.includes(profile.visaClass)) return;
        lines.push(line(x.id, x.label, amountOf(x, firstYear), collegeSource(college, x.source, x.checked_on), x.note));
      });
      (college.shown_not_added_per_year || []).forEach((x) => {
        notAdded.push(shownNotAdded(x.id, x.label, null, collegeSource(college, x.source, x.checked_on), "not_confirmed", x.note));
      });
    } else if (college.id === "acc") {
      // ACC publishes one F-1 estimate. Other situations are not in the prototype data.
      if (profile.visaClass !== "F") return notConfirmedResult(college, programId, "no_data_for_situation");
      lines.push(line("acc_f1_estimate", college.f1_estimate_label, range(college.f1_estimated_annual_cost),
        collegeSource(college, college.f1_estimate_source, college.f1_estimate_checked_on), college.f1_estimate_note));
    } else {
      const residency = opts.residency || "nonresident";
      const coa = residency === "resident"
        ? college.cost_of_attendance_resident_2026_27
        : college.cost_of_attendance_nonresident_2026_27;
      if (!coa) return notConfirmedResult(college, programId, "no_cost_of_attendance");
      lines.push(line("coa_" + residency, "Cost of attendance (" + residency + ")", range(coa.min, coa.max),
        collegeSource(college, coa.source, coa.checked_on)));

      (college.required_extras_per_year || []).forEach((x) => {
        if (x.applies_to && !x.applies_to.includes(profile.visaClass)) return;
        lines.push(line(x.id, x.label, amountOf(x, firstYear), collegeSource(college, x.source, x.checked_on), x.note));
      });

      // Differential tuition: add only if we know it is NOT inside the cost of attendance.
      if (program.differential_tuition_per_semester) {
        const amt = range(program.differential_tuition_per_semester * 2);
        const src = collegeSource(college, "ut-coa");
        if (college.differential_included_in_coa === false) {
          lines.push(line("differential", "Differential tuition", amt, src));
        } else if (college.differential_included_in_coa !== true) {
          notAdded.push(shownNotAdded("differential", "Differential tuition", amt, src, "not_confirmed",
            "May already be included. Confirm with the college."));
        }
      }
    }

    if (opts.flights > 0) lines.push(line("flights", "Your flight estimate", range(opts.flights), USER_SOURCE));

    return {
      status: "ok",
      collegeId: college.id,
      programId,
      lines,
      notAdded,
      total: sumLines(lines),
      sources: uniqueSources(lines.concat(notAdded)),
    };
  }

  /* ---------- One-time costs before arrival (visa students only) ---------- */

  // opts: { status, country, englishTest: "toefl" | "det" }
  function oneTimeCosts(college, opts, fees) {
    const profile = visaProfile(opts.status);
    const lines = [];
    const notAdded = [];
    if (!profile.oneTime) return { lines, notAdded, total: ZERO };

    // Unconfirmed fees are shown with the official link and never added.
    const addFee = (id) => {
      const f = findFee(fees, id);
      if (f.status === "not_confirmed" || (f.amount == null && f.min == null)) {
        notAdded.push(shownNotAdded(f.id, f.label, null, feeSource(fees, f), "not_confirmed",
          "Not confirmed. See the official page."));
        return;
      }
      lines.push(line(f.id, f.label, amountOf(f), feeSource(fees, f), f.note));
    };

    addFee("sevis_f_m");
    addFee("mrv");

    const layer = (fees.country_layer || {})[opts.country] || {};
    const vif = findFee(fees, "visa_integrity");
    if (layer.visa_integrity_fee_collected === true) addFee("visa_integrity");
    else if (layer.visa_integrity_fee_collected !== false) {
      notAdded.push(shownNotAdded(vif.id, vif.label, amountOf(vif), feeSource(fees, vif), "not_confirmed",
        "Not confirmed for your country. See the official page."));
    }
    if (layer.reciprocity_fee_f1 === null || layer.reciprocity_fee_f1 === undefined) {
      notAdded.push(shownNotAdded("reciprocity", "Visa reciprocity fee, if any", null,
        { id: "fees:reciprocity", label: "U.S. Department of State", url: null, checked_on: fees.checked_on },
        "not_confirmed", "Varies by country. See the official page."));
    }

    const test = opts.englishTest || "toefl";
    if (test === "det") addFee("det");
    else if (opts.country === "BR") addFee("toefl_brazil");
    else notAdded.push(shownNotAdded("toefl", "TOEFL iBT", null, { id: "fees:toefl", label: "ETS", url: null,
      checked_on: fees.checked_on }, "not_confirmed", "Price for your country not confirmed."));

    const app = college.application || {};
    if (app.sat_or_act_required) addFee("sat_abroad");
    if (app.fee !== undefined && app.fee !== null) {
      lines.push(line("application_fee", college.name + " application fee", range(app.fee),
        collegeSource(college, app.source, app.checked_on)));
    }

    // Enrollment deposit is credited to tuition: shown, never added.
    if (college.enrollment_deposit) {
      notAdded.push(shownNotAdded("enrollment_deposit", "Enrollment deposit", range(college.enrollment_deposit.amount),
        collegeSource(college, "ut-intl-admissions"), "credited_to_tuition", "Credited to tuition. Not added again."));
    }

    return { lines, notAdded, total: sumLines(lines) };
  }

  /* ---------- 2. Program total (USD) ---------- */

  function assumptions(config) {
    return [
      { id: "yearly_increase", value: config.yearlyIncrease, base_year: config.baseYear,
        label: "Assumes costs rise " + Math.round(config.yearlyIncrease * 100) + "% per year from " + config.baseYear + "." },
    ];
  }

  // input: { collegeId, programId, status, country, term, residency, flights, englishTest }
  function programTotal(input, data, config) {
    config = Object.assign({}, DEFAULTS, config);
    const college = findCollege(data, input.collegeId);
    if (!college) throw new Error("Unknown college: " + input.collegeId);
    const annual = annualCost(college, input.programId, input);
    if (annual.status !== "ok") return annual;

    const program = findProgram(college, input.programId);
    const start = termToAcademicYear(input.term);
    const perYear = [];
    for (let i = 0; i < program.years; i++) {
      const g = growthFactor(start + i, config);
      const base = i === 0 ? annual : annualCost(college, input.programId, Object.assign({}, input, { yearAtCollege: i + 1 }));
      perYear.push({ year: i + 1, academicYear: academicLabel(start + i), collegeId: college.id,
        exponent: g.exp, factor: g.factor, base: base.total, amount: scaleRange(base.total, g.factor) });
    }
    const recurring = perYear.reduce((acc, y) => addRanges(acc, y.amount), ZERO);
    const once = oneTimeCosts(college, input, data.fees);

    return finish({
      kind: "single",
      collegeId: college.id,
      collegeName: college.name,
      programId: program.id,
      programName: program.name,
      years: program.years,
      annual,
      perYear,
      recurring,
      oneTime: once,
      notAdded: annual.notAdded.concat(once.notAdded),
      total: addRanges(recurring, once.total),
      assumptions: assumptions(config),
      i20: college.i20 || null,
    }, input, annual.lines.concat(once.lines));
  }

  function finish(result, input, addedLines) {
    result.status = "ok";
    result.visaStudent = visaProfile(input.status).visaClass === "F";
    result.modeledSituation = visaProfile(input.status).modeled;
    result.basedOnMidpoint = result.total.min !== result.total.max;
    result.sources = uniqueSources(addedLines.concat(result.notAdded));
    return result;
  }

  /* ---------- Community-college path: 2 years at ACC, then 2 at the target ---------- */

  // input: same as programTotal, with collegeId/programId pointing at the ACC transfer program.
  function transferPath(input, data, config) {
    config = Object.assign({}, DEFAULTS, config);
    const cc = findCollege(data, input.collegeId);
    const ccProgram = cc && findProgram(cc, input.programId);
    if (!ccProgram || !ccProgram.transfers_to) throw new Error("Not a transfer program: " + input.programId);
    const target = findCollege(data, ccProgram.transfers_to);
    const targetProgram = (target.programs || []).find((p) => p.area === ccProgram.area && p.level === "bachelor");

    const ccAnnual = annualCost(cc, ccProgram.id, input);
    // The student arrives at the target as a new student: year 3 of the path is year 1 there.
    const tAnnual = annualCost(target, targetProgram.id, Object.assign({}, input, { yearAtCollege: 1 }));
    if (ccAnnual.status !== "ok") return ccAnnual;
    if (tAnnual.status !== "ok") return tAnnual;

    const totalYears = targetProgram.years;
    const start = termToAcademicYear(input.term);
    const perYear = [];
    for (let i = 0; i < totalYears; i++) {
      const atCC = i < ccProgram.years;
      const g = growthFactor(start + i, config);
      let base;
      if (atCC) base = i === 0 ? ccAnnual : annualCost(cc, ccProgram.id, Object.assign({}, input, { yearAtCollege: i + 1 }));
      else {
        const yearAtTarget = i - ccProgram.years + 1;
        base = yearAtTarget === 1 ? tAnnual
          : annualCost(target, targetProgram.id, Object.assign({}, input, { yearAtCollege: yearAtTarget }));
      }
      perYear.push({ year: i + 1, academicYear: academicLabel(start + i), collegeId: atCC ? cc.id : target.id,
        exponent: g.exp, factor: g.factor, base: base.total, amount: scaleRange(base.total, g.factor) });
    }
    const recurring = perYear.reduce((acc, y) => addRanges(acc, y.amount), ZERO);

    // One-time costs happen once, before arriving at the community college.
    const once = oneTimeCosts(cc, input, data.fees);
    const transferNotes = [];
    const ta = target.transfer_application;
    if (ta && (ta.fee === null || ta.status === "not_confirmed")) {
      transferNotes.push(shownNotAdded("transfer_application_fee", ta.label, null,
        collegeSource(target, ta.source, ta.checked_on), "not_confirmed", "Not confirmed. See the official page."));
    }
    if (visaProfile(input.status).visaClass === "F") {
      transferNotes.push(shownNotAdded("transfer_sevis", "SEVIS fee at transfer", null, null, "not_needed",
        "No new SEVIS fee. The transfer I-20 keeps the same SEVIS ID."));
      transferNotes.push(shownNotAdded("transfer_visa", "New visa at transfer", null, null, "not_needed",
        "No new visa if the current F-1 visa is still valid."));
    }

    return finish({
      kind: "transfer_path",
      collegeId: cc.id,
      collegeName: cc.name,
      programId: ccProgram.id,
      programName: ccProgram.name,
      targetCollegeId: target.id,
      targetCollegeName: target.name,
      targetProgramId: targetProgram.id,
      years: totalYears,
      segments: [
        { collegeId: cc.id, years: ccProgram.years, annual: ccAnnual },
        { collegeId: target.id, years: totalYears - ccProgram.years, annual: tAnnual },
      ],
      perYear,
      recurring,
      oneTime: once,
      notAdded: ccAnnual.notAdded.concat(tAnnual.notAdded, once.notAdded, transferNotes.filter((n) => n.source)),
      notes: transferNotes,
      total: addRanges(recurring, once.total),
      assumptions: assumptions(config),
      i20: cc.i20 || null, // the community college issues the first I-20
    }, input, ccAnnual.lines.concat(tAnnual.lines, once.lines));
  }

  /* ---------- 3. Monthly equivalent ---------- */

  function monthly(total, years, fxRate) {
    const usd = scaleRange(total, 1 / (years * 12));
    return { usd, family: fxRate ? scaleRange(usd, fxRate) : null };
  }

  /* ---------- 4. Budget band (neutral, never a verdict) ---------- */

  const EPS = 1e-9; // guards float noise at the band edges

  function budgetBand(monthlyFamily, amount, config) {
    config = Object.assign({}, DEFAULTS, config);
    if (amount === null || amount === undefined || amount === "" || !(amount > 0)) return "none";
    if (monthlyFamily <= amount + EPS) return "within";
    if (monthlyFamily <= amount * (1 + config.aboveMargin) + EPS) return "above";
    return "well_above";
  }

  // ctx: { fxRate, monthlyAmount }. Band uses the midpoint of the monthly range.
  function evaluate(result, ctx, config) {
    if (result.status !== "ok") return Object.assign({}, result, { band: "not_confirmed" });
    const m = monthly(result.total, result.years, ctx.fxRate);
    const band = budgetBand(m.family ? m.family.mid : null, ctx.monthlyAmount, config);
    const gap = band === "none" ? null : m.family.mid / ctx.monthlyAmount - 1; // 0.11 = 11% above
    return Object.assign({}, result, {
      monthly: m,
      totalFamily: ctx.fxRate ? scaleRange(result.total, ctx.fxRate) : null,
      fxRate: ctx.fxRate,
      monthlyAmount: ctx.monthlyAmount === undefined ? null : ctx.monthlyAmount,
      band,
      gapVsAmount: gap,
    });
  }

  /* ---------- 5. Show for the I-20 (visa students only) ---------- */

  // Rule: the college's published amount first. Only without one, the MAX of the
  // year 1 estimate (showing too little delays the I-20).
  function showForI20(result, data) {
    if (result.status !== "ok" || !result.visaStudent) return null;
    const i20 = result.i20;
    if (i20 && i20.first_year_amount_to_show) {
      const college = data ? findCollege(data, result.collegeId) : null;
      return {
        amount: i20.first_year_amount_to_show,
        estimate: false,
        year: i20.first_year_amount_year || null,
        breakdown: i20.first_year_amount_breakdown || [],
        label: i20.first_year_amount_note || null,
        source: college ? collegeSource(college, i20.source, i20.checked_on) : { id: i20.source, checked_on: i20.checked_on },
      };
    }
    return { amount: result.perYear[0].amount.max, estimate: true, year: result.perYear[0].academicYear,
      breakdown: [], label: "Estimate. The college confirms the exact amount.", source: null };
  }

  /* ---------- Residency scenarios (the engine never decides residency) ---------- */

  function residencyScenarios(input, data, config) {
    const college = findCollege(data, input.collegeId);
    if (!college || !college.cost_of_attendance_resident_2026_27) return null;
    return {
      nonresident: programTotal(Object.assign({}, input, { residency: "nonresident" }), data, config),
      resident: programTotal(Object.assign({}, input, { residency: "resident" }), data, config),
      sources: [collegeSource(college, "ut-residency")],
    };
  }

  /* ---------- 7. Funding profile (docs/funding-and-currency.md section 2) ---------- */

  // Income bands from docs/product.md, in USD. max is exclusive: "under 65k" is [0, 65,000).
  const INCOME_BANDS = {
    under_65k: { min: 0, max: 65000, label: "Under 65,000 USD" },
    "65k_100k": { min: 65000, max: 100000, label: "65,000 to 100,000 USD" },
    "100k_150k": { min: 100000, max: 150000, label: "100,000 to 150,000 USD" },
    "150k_200k": { min: 150000, max: 200000, label: "150,000 to 200,000 USD" },
    over_200k: { min: 200000, max: Infinity, label: "Over 200,000 USD" },
    prefer_not: null,
  };

  const aidValue = (college, key) => (college.aid && college.aid[key] ? college.aid[key].value : null);

  // answers: { status, parentCountries, incomeBand, colleges, area, monthly, currency }
  // data: { colleges, countries? }
  function fundingProfile(answers, data) {
    const fafsaOpen = answers.status === "citizen_or_pr";
    const visaStudent = visaProfile(answers.status).visaClass === "F";
    const band = answers.incomeBand ? INCOME_BANDS[answers.incomeBand] : null;
    if (band === undefined) throw new Error("Unknown income band: " + answers.incomeBand);

    const currencies = [];
    const countries = data.countries && data.countries.countries;
    (answers.parentCountries || []).forEach((code) => {
      const cur = countries && countries[code] ? countries[code].currency : null;
      if (cur && cur !== "USD" && !currencies.includes(cur)) currencies.push(cur);
    });

    const colleges = data.colleges.colleges.filter((c) => c.status === "verified" && c.aid).map((c) => {
      const intl = aidValue(c, "intl_need_based_aid");
      const needBased = fafsaOpen
        ? { open: true, reason: "U.S. citizens and permanent residents can apply for need-based aid." }
        : intl === true ? { open: true, reason: "Need-based aid is open to international students." }
          : intl === false ? { open: false, reason: "No need-based aid for international students." }
            : { open: null, status: "not_confirmed", reason: "Not confirmed for international students." };
      const forms = fafsaOpen ? c.aid.forms_us : c.aid.forms_intl;
      return {
        collegeId: c.id,
        needBased,
        meetsFullNeed: aidValue(c, "meets_full_need_intl") === true,
        merit: aidValue(c, "merit_aid_intl"),
        // F-1 students never get the FAFSA; FAFSA filers do not need the TASFA (it is for students without a FAFSA).
        forms: ((forms && forms.value) || []).filter((f) => (fafsaOpen ? f !== "tasfa" : f !== "fafsa")),
        source: collegeSource(c, c.aid.intl_need_based_aid.source, c.aid.intl_need_based_aid.checked_on),
      };
    });

    return {
      status: answers.status,
      audience: fafsaOpen ? "us" : "intl",
      visaStudent,
      fafsa: fafsaOpen
        ? { open: true, reason: "FAFSA is for U.S. citizens and eligible non-citizens." }
        : { open: false, reason: visaStudent ? "FAFSA is not open to F-1 or J-1 students." : "FAFSA is for U.S. citizens and eligible non-citizens." },
      incomeBand: band ? Object.assign({ id: answers.incomeBand }, band) : null,
      currencies,
      colleges,
    };
  }

  /* ---------- 8. Estimated net price (range, never a promise) ---------- */

  const COPY = {
    noEstimate: "No estimate yet. See the official aid page.",
    shareIncome: "Share an income range to see aid estimates.",
    aidPage: "Official aid page",
    meritPossible: "Merit scholarships: possible, not guaranteed.",
    covers: "Covers every confirmed cost.",
    stillToConfirm: "Still to confirm: ",
  };

  // Usable thresholds for this profile. MIT's (applies_to_intl: null) are never used for internationals.
  function usableThresholds(college, profile) {
    const t = college.aid && college.aid.thresholds;
    return ((t && t.value) || []).filter((x) => profile.audience === "us" || x.applies_to_intl === true)
      .slice().sort((a, b) => a.income_below_usd - b.income_below_usd);
  }

  // The aid page for an audience is the source of that audience's forms (forms_us or forms_intl).
  function aidPageFor(college, profile) {
    const f = profile.audience === "us" ? college.aid.forms_us : college.aid.forms_intl;
    const id = f && f.source ? f.source : college.aid.source;
    return Object.assign(collegeSource(college, id, college.aid.checked_on), { label: COPY.aidPage });
  }

  const notConfirmedItem = (id, label, source, note) => ({ id, label, source: source || null, note: note || null });

  // costResult: programTotal() or transferPath() for this college and profile.
  // Output: { method, hasEstimate, atMost, total, averagePerYear, year1, lines, notConfirmed, message, aidPage, sources }
  function netPrice(college, profile, costResult) {
    if (!costResult || costResult.status !== "ok") {
      return { status: "not_confirmed", method: null, hasEstimate: false, reason: costResult ? costResult.reason : null };
    }
    const years = costResult.years;
    const pending = costResult.notAdded.filter((l) => l.reason === "not_confirmed")
      .map((l) => notConfirmedItem(l.id, l.label, l.source, l.note));
    const aidPage = aidPageFor(college, profile);
    const pc = profile.colleges.find((c) => c.collegeId === college.id) || { needBased: { open: false } };
    const band = profile.incomeBand;
    const base = { status: "ok", collegeId: college.id, years, fullCost: costResult.total, aidPage };
    const fullYear1 = addRanges(costResult.perYear[0].amount, costResult.oneTime.total);

    const fullCost = (message) => Object.assign(base, {
      method: "full_cost",
      hasEstimate: true,
      atMost: false,
      total: costResult.total,
      averagePerYear: scaleRange(costResult.total, 1 / years),
      year1: fullYear1,
      lines: costResult.annual ? costResult.annual.lines.concat(costResult.oneTime.lines) : costResult.oneTime.lines,
      notConfirmed: pending,
      merit: pc.merit === "limited" || pc.merit === "yes" ? COPY.meritPossible : null,
      message: message || null,
      sources: costResult.sources,
    });
    const calculatorLink = () => Object.assign(base, {
      method: "calculator_link",
      hasEstimate: false,
      atMost: false,
      total: null,
      averagePerYear: null,
      year1: null,
      lines: [],
      notConfirmed: pending,
      message: COPY.noEstimate,
      sources: [aidPage],
    });

    // Transfer paths and colleges without need-based aid for this profile: full cost.
    if (costResult.kind !== "single" || pc.needBased.open !== true) return fullCost();
    if (!band) return profile.audience === "us" ? calculatorLink() : fullCost(COPY.shareIncome);

    const thr = usableThresholds(college, profile).find((x) => band.max <= x.income_below_usd);
    if (!thr) return calculatorLink();
    const thrSource = collegeSource(college, college.aid.thresholds.source, college.aid.thresholds.checked_on);

    if (thr.rule === "parent_contribution_zero") {
      // Parents pay 0 toward the cost of attendance. What else the family pays is not published: listed, never added.
      const extra = [
        notConfirmedItem("student_contribution", "Student contribution", aidPage, "Not published. Confirm with the college."),
        notConfirmedItem("travel", "Travel", aidPage, "Not confirmed. See the official aid page."),
        notConfirmedItem("personal", "Personal costs", aidPage, "Not confirmed. See the official aid page."),
      ];
      (college.required_extras_per_year || []).forEach((x) => extra.push(notConfirmedItem(x.id, x.label,
        collegeSource(college, x.source, x.checked_on), "Not confirmed whether aid covers it. " + (x.note || ""))));
      const once = costResult.oneTime;
      return Object.assign(base, {
        method: "threshold",
        hasEstimate: true,
        atMost: false,
        threshold: Object.assign({}, thr, { source: thrSource }),
        total: once.total,
        averagePerYear: scaleRange(once.total, 1 / years),
        year1: once.total,
        lines: [line("parent_contribution", "Parent contribution", ZERO, thrSource, thr.label)].concat(once.lines),
        notConfirmed: extra.concat(pending.filter((p) => !extra.some((e) => e.id === p.id))),
        message: thr.applies_note || null,
        sources: uniqueSources([{ source: thrSource }].concat(once.lines, once.notAdded)),
      });
    }

    // covers_full_tuition_at_least or tuition_free: the family pays AT MOST the full cost minus tuition.
    const tuition = costResult.annual.lines.find((l) => l.id === "tuition");
    if (!tuition) return calculatorLink();
    const tuitionPerYear = costResult.perYear.map((y) => scaleRange(tuition.amount, y.factor));
    const tuitionTotal = tuitionPerYear.reduce(addRanges, ZERO);
    const capTotal = range(costResult.total.max - tuitionTotal.max);
    return Object.assign(base, {
      method: "threshold",
      hasEstimate: true,
      atMost: true,
      threshold: Object.assign({}, thr, { source: thrSource }),
      total: capTotal,
      averagePerYear: scaleRange(capTotal, 1 / years),
      year1: range(fullYear1.max - tuitionPerYear[0].max),
      lines: [line("tuition_covered", "Tuition, covered by aid (at least)", scaleRange(tuitionTotal, -1), thrSource, thr.label)],
      notConfirmed: [notConfirmedItem("aid_above_tuition", "Aid above tuition", aidPage, COPY.noEstimate)].concat(pending),
      message: thr.applies_note || null,
      sources: uniqueSources([{ source: thrSource }].concat(costResult.annual.lines)),
    });
  }

  /* ---------- 9. Funding gap (replaces the budget band) ---------- */

  // monthlyAmount: what the family could pay per month, in the family currency. fxRate: family currency per 1 USD.
  // The gap uses the average per year over the program; year 1 is also returned for the college detail.
  // Only confirmed lines count. The not-confirmed list always travels with the label.
  function fundingGap(net, monthlyAmount, fxRate, config) {
    config = Object.assign({}, DEFAULTS, config);
    if (!net || net.status !== "ok") return { label: null, status: "not_confirmed" };
    if (!net.hasEstimate) return { label: null, message: COPY.noEstimate, aidPage: net.aidPage, notConfirmed: net.notConfirmed };
    const pendingLabels = net.notConfirmed.map((n) => n.label);
    if (!(monthlyAmount > 0) || !(fxRate > 0)) {
      return { label: null, message: null, netPerYear: net.averagePerYear, notConfirmed: net.notConfirmed };
    }
    const familyPerYear = (monthlyAmount * 12) / fxRate;
    // "At most" estimates use the cap; ranges use the midpoint.
    const pick = (r) => (net.atMost ? r.max : r.mid);
    const perYear = pick(net.averagePerYear);
    const gapUsd = perYear - familyPerYear;
    const label = gapUsd <= EPS ? "Funded" : gapUsd <= config.aboveMargin * perYear + EPS ? "Small gap" : "Gap";
    let note = null;
    if (label === "Funded") {
      note = COPY.covers + (pendingLabels.length ? " " + COPY.stillToConfirm + pendingLabels.join(", ") + "." : "");
    } else if (pendingLabels.length) {
      note = COPY.stillToConfirm + pendingLabels.join(", ") + ".";
    }
    return {
      label,
      note,
      notConfirmed: net.notConfirmed,
      gapUsd,
      gapShare: perYear > 0 ? gapUsd / perYear : 0,
      gapFamily: gapUsd * fxRate,
      familyPerYearUsd: familyPerYear,
      netPerYear: perYear,
      basis: "average per year over the program",
      year1: { netUsd: pick(net.year1), gapUsd: pick(net.year1) - familyPerYear },
    };
  }

  /* ---------- 10. Routes ---------- */

  const ROUTE_GROUPS = [
    { id: "dream", label: "Your dream" },
    { id: "strong_aid", label: "Strong aid for you" },
    { id: "lower_cost", label: "Lower-cost path" },
  ];

  // Next aid deadline for the start term. "MM-DD" dates fall in the application cycle:
  // August to December of the year before the start, January to July of the start year.
  // A window with an "opens" date (ACC: opens 01-15, priority 05-01, closes 12-15) runs forward from it:
  // dates earlier in the year than the opening fall in the next year.
  function resolveDates(group, term) {
    const startYear = parseInt(/\d{4}/.exec(term)[0], 10);
    const cycle = (v) => (/^\d{4}-/.test(v) ? v : (parseInt(v.slice(0, 2), 10) >= 8 ? startYear - 1 : startYear) + "-" + v);
    // The opening date anchors only the keys that share its prefix ("isss_scholarships_open" ->
    // "isss_scholarships_close"); a bare "opens" anchors the whole group.
    const openKey = Object.keys(group).find((k) => /open/.test(k));
    const opens = openKey ? cycle(group[openKey]) : null;
    const prefix = openKey ? openKey.replace(/opens?$/, "") : "";
    const out = {};
    Object.keys(group).forEach((k) => {
      const v = group[k];
      if (!v) return;
      if (!opens || /^\d{4}-/.test(v) || k.indexOf(prefix) !== 0) { out[k] = cycle(v); return; }
      const y = parseInt(opens.slice(0, 4), 10);
      out[k] = (v >= opens.slice(5) ? y : y + 1) + "-" + v;
    });
    return out;
  }

  // Whole days from a to b ("YYYY-MM-DD"), calendar dates, no time zone shift.
  function daysBetween(a, b) {
    const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    return Math.round((t(b) - t(a)) / 86400000);
  }

  function nextDeadline(college, term, today) {
    const d = college.aid && college.aid.deadlines && college.aid.deadlines.value;
    if (!d || !d.aid) return null;
    const dates = resolveDates(d.aid, term);
    const all = Object.keys(dates).filter((k) => !/open/.test(k)).map((k) => {
      const date = dates[k];
      return { id: k, date, past: today ? date < today : false };
    }).sort((a, b) => (a.date < b.date ? -1 : 1));
    return { next: all.find((x) => !x.past) || null, past: all.filter((x) => x.past),
      source: collegeSource(college, college.aid.deadlines.source, college.aid.deadlines.checked_on) };
  }

  // Every admission and aid deadline of the colleges in the routes, sorted by date.
  // Opening dates and decision release dates are not deadlines and are left out.
  // routesResult: routes(). opts: { term, today }.
  function deadlineList(routesResult, data, opts) {
    const audience = routesResult.profile.audience;
    const seen = {};
    const items = [];
    routesResult.groups.forEach((g) => g.items.forEach((it) => {
      if (seen[it.collegeId] || it.status !== "ok") return; // no data for this situation: no dates either
      seen[it.collegeId] = true;
      const c = findCollege(data, it.collegeId);
      const dl = c && c.aid && c.aid.deadlines;
      if (!dl || !dl.value) return;
      const formsField = audience === "us" ? c.aid.forms_us : c.aid.forms_intl;
      const codes = (formsField && formsField.codes) || {};
      const source = collegeSource(c, dl.source, dl.checked_on);
      ["admission", "aid"].forEach((kind) => {
        const group = dl.value[kind];
        if (!group) return;
        const dates = resolveDates(group, opts.term);
        // ISSS scholarships are for international students only.
        Object.keys(dates).filter((k) => !/open|^decision_/.test(k) && !(audience === "us" && /^isss/.test(k))).forEach((k) => {
          const date = dates[k];
          const passed = opts.today ? date < opts.today : false;
          items.push({
            id: c.id + ":" + kind + ":" + k,
            collegeId: c.id,
            collegeName: c.name,
            group: g.id,
            kind,
            round: k,
            date,
            status: passed ? "passed" : "to_do",
            daysLeft: opts.today ? daysBetween(opts.today, date) : null,
            forms: kind === "aid" ? it.forms.slice() : [],
            codes,
            source,
          });
        });
      });
    }));
    return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  }

  /* ---------- 11. Funding bar (per year, USD) ---------- */

  // Segments: aid (full cost minus what the family pays), family (what the family pays or can cover),
  // gap (only when there is a gap), not_confirmed (hatched, fixed small width: its amount is unknown).
  // share: width as a fraction of the bar. Non-zero segments get at least MIN_SHARE so they stay visible.
  const BAR = { notConfirmedShare: 0.06, minShare: 0.02 };

  function fundingBar(net, gap) {
    if (!net || net.status !== "ok" || !net.hasEstimate) return null;
    const pick = (r) => (net.atMost ? r.max : r.mid);
    const fullPerYear = net.fullCost.mid / net.years;
    const perYear = pick(net.averagePerYear);
    const hasGap = !!(gap && gap.label && gap.gapUsd > EPS);
    const known = [];
    const aid = fullPerYear - perYear;
    if (aid > EPS) known.push({ id: "aid", amount: aid });
    known.push({ id: "family", amount: hasGap ? gap.familyPerYearUsd : perYear });
    if (hasGap) known.push({ id: "gap", amount: gap.gapUsd });
    const pending = net.notConfirmed && net.notConfirmed.length > 0;
    const room = 1 - (pending ? BAR.notConfirmedShare : 0);
    const total = known.reduce((s, x) => s + x.amount, 0);
    // Small parts get the minimum width first; the rest is shared in proportion.
    const raw = known.map((x) => (total > 0 ? x.amount / total : 0));
    const small = raw.map((r, i) => known[i].amount > EPS && r < BAR.minShare);
    const fixed = small.filter(Boolean).length * BAR.minShare;
    const bigTotal = raw.reduce((s, r, i) => s + (small[i] ? 0 : r), 0) || 1;
    const shares = raw.map((r, i) => (small[i] ? BAR.minShare : (r / bigTotal) * (1 - fixed)) * room);
    const segments = known.map((x, i) => ({ id: x.id, amount: x.amount, share: shares[i] }));
    if (pending) segments.push({ id: "not_confirmed", amount: null, share: BAR.notConfirmedShare });
    return { segments, fullPerYear, perYear, atMost: !!net.atMost };
  }

  const matchesArea = (p, area) => p.level === "bachelor" && (p.area === area || p.area === "any");

  // ctx: { fxRate, today: "YYYY-MM-DD" }. Returns the three groups; the dream group is always first and never empty
  // when the student named a college.
  function routes(answers, data, ctx, config) {
    ctx = ctx || {};
    const profile = fundingProfile(answers, data);
    const dreamIds = (answers.colleges || []).map((c) => c.collegeId);
    const base = { status: answers.status, country: (answers.passports || [])[0] || null, term: answers.term,
      englishTest: answers.englishTest || "toefl", flights: answers.flights || 0, residency: "nonresident" };

    const item = (college, programId, cost) => {
      const net = netPrice(college, profile, cost);
      const pc = profile.colleges.find((c) => c.collegeId === college.id);
      return {
        collegeId: college.id,
        collegeName: college.name,
        programId,
        kind: cost.kind || null,
        targetCollegeId: cost.targetCollegeId || null,
        status: cost.status,
        cost,
        netPrice: net,
        gap: fundingGap(net, answers.monthly, ctx.fxRate, config),
        forms: pc ? pc.forms : [],
        deadline: nextDeadline(college, answers.term, ctx.today),
      };
    };
    const single = (c, programId) => item(c, programId,
      programTotal(Object.assign({}, base, { collegeId: c.id, programId }), data, config));

    const groups = { dream: [], strong_aid: [], lower_cost: [] };
    (answers.colleges || []).forEach((d) => {
      const c = findCollege(data, d.collegeId);
      if (c) groups.dream.push(single(c, d.programId));
    });

    // Without a dream school ("Help me choose"), community-college paths into any college in the data are offered.
    const noDream = dreamIds.length === 0;
    data.colleges.colleges.forEach((c) => {
      if (c.status !== "verified" || dreamIds.includes(c.id)) return;
      const pc = profile.colleges.find((x) => x.collegeId === c.id);
      (c.programs || []).forEach((p) => {
        if (p.transfers_to && (noDream || dreamIds.includes(p.transfers_to)) && p.area === answers.area) {
          groups.lower_cost.push(item(c, p.id, transferPath(Object.assign({}, base, { collegeId: c.id, programId: p.id }), data, config)));
        }
      });
      const prog = (c.programs || []).find((p) => matchesArea(p, answers.area));
      if (!prog || !pc) return;
      if (pc.needBased.open === true && pc.meetsFullNeed) groups.strong_aid.push(single(c, prog.id));
      else if (c.type === "public_university" && (pc.merit === "limited" || pc.merit === "yes")) groups.lower_cost.push(single(c, prog.id));
    });

    // Routes this profile cannot use (status not_confirmed, for example ACC then UT for U.S. citizens) are hidden.
    // Dream colleges are never hidden.
    groups.strong_aid = groups.strong_aid.filter((r) => r.status === "ok");
    groups.lower_cost = groups.lower_cost.filter((r) => r.status === "ok");

    // Inside each group: unconfirmed last, then no estimate, then by gap, then by net price midpoint.
    const rank = (r) => (r.status !== "ok" ? 2 : r.netPrice.hasEstimate ? 0 : 1);
    const gapOf = (r) => (r.gap && typeof r.gap.gapUsd === "number" ? r.gap.gapUsd : 0);
    const mid = (r) => (r.netPrice && r.netPrice.averagePerYear ? r.netPrice.averagePerYear.mid : Infinity);
    const sortGroup = (list) => list.sort((a, b) => rank(a) - rank(b) || gapOf(a) - gapOf(b) || mid(a) - mid(b));

    return {
      profile,
      groups: ROUTE_GROUPS.map((g) => ({ id: g.id, label: g.label, items: sortGroup(groups[g.id]) })),
    };
  }

  /* ---------- 6. Recommendations ---------- */

  const sortKey = (r) => (r.status === "ok" ? r.monthly.usd.mid : Infinity);

  // evaluated: results from evaluate(). Unconfirmed colleges always go last.
  function recommend(evaluated, hasAmount) {
    const sorted = evaluated.slice().sort((a, b) => sortKey(a) - sortKey(b));
    if (!hasAmount) return { main: sorted, more: [] };
    const fits = (r) => r.band === "within" || r.band === "above";
    return { main: sorted.filter(fits), more: sorted.filter((r) => !fits(r)) };
  }

  // "Out of my budget": cheaper bachelor's options in the same area, plus community-college paths
  // into the original college. Never hides the original.
  function outOfBudget(original, input, data, ctx, config) {
    const origCollege = findCollege(data, original.collegeId);
    const area = findProgram(origCollege, original.programId).area;
    const options = [];

    data.colleges.colleges.forEach((c) => {
      if (c.status !== "verified") return;
      (c.programs || []).forEach((p) => {
        if (p.area !== area) return;
        let r = null;
        if (p.transfers_to === original.collegeId) {
          r = transferPath(Object.assign({}, input, { collegeId: c.id, programId: p.id }), data, config);
        } else if (p.level === "bachelor" && c.id !== original.collegeId) {
          r = programTotal(Object.assign({}, input, { collegeId: c.id, programId: p.id }), data, config);
        }
        if (!r || r.status !== "ok") return;
        if (r.total.mid >= original.total.mid) return;
        options.push(evaluate(r, ctx, config));
      });
    });

    options.sort((a, b) => sortKey(a) - sortKey(b));
    const hasAmount = budgetBand(1, ctx.monthlyAmount, config) !== "none";
    return {
      original,
      options,
      stillWellAbove: hasAmount && options.every((o) => o.band === "well_above"),
    };
  }

  const api = {
    DEFAULTS,
    range,
    termToAcademicYear,
    growthFactor: (y, config) => growthFactor(y, Object.assign({}, DEFAULTS, config)),
    visaProfile,
    annualCost,
    oneTimeCosts,
    programTotal,
    transferPath,
    monthly,
    budgetBand,
    evaluate,
    showForI20,
    residencyScenarios,
    recommend,
    outOfBudget,
    INCOME_BANDS,
    ROUTE_GROUPS,
    COPY,
    fundingProfile,
    netPrice,
    fundingGap,
    nextDeadline,
    routes,
    daysBetween,
    deadlineList,
    fundingBar,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PontEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
