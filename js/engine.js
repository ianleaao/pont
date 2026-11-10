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
  const amountOf = (item) =>
    item.amount !== undefined && item.amount !== null ? range(item.amount) : range(item.min, item.max);

  /* ---------- Sources ---------- */

  function collegeSource(college, id, checkedOn) {
    if (!id) return { id: null, label: "Source not confirmed", url: null, checked_on: checkedOn || null };
    const s = (college.sources || []).find((x) => x.id === id);
    const base = s || { id, label: id, url: null };
    return Object.assign({}, base, { checked_on: checkedOn || base.checked_on || null });
  }

  function feeSource(fees, fee) {
    return { id: "fees:" + fee.id, label: fee.label, url: fee.url || null, checked_on: fees.checked_on };
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

  // opts: { status, residency: "nonresident" | "resident", flights }
  function annualCost(college, programId, opts) {
    if (college.status !== "verified") return notConfirmedResult(college, programId, "college_not_verified");
    const program = findProgram(college, programId);
    if (!program) return notConfirmedResult(college, programId, "program_not_found");

    const profile = visaProfile(opts.status);
    const lines = [];
    const notAdded = [];

    if (college.id === "acc") {
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
        lines.push(line(x.id, x.label, amountOf(x), collegeSource(college, x.source, x.checked_on), x.note));
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

    const addFee = (id) => {
      const f = findFee(fees, id);
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
      perYear.push({ year: i + 1, academicYear: academicLabel(start + i), collegeId: college.id,
        exponent: g.exp, factor: g.factor, amount: scaleRange(annual.total, g.factor) });
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
    const tAnnual = annualCost(target, targetProgram.id, input);
    if (ccAnnual.status !== "ok") return ccAnnual;
    if (tAnnual.status !== "ok") return tAnnual;

    const totalYears = targetProgram.years;
    const start = termToAcademicYear(input.term);
    const perYear = [];
    for (let i = 0; i < totalYears; i++) {
      const atCC = i < ccProgram.years;
      const g = growthFactor(start + i, config);
      perYear.push({ year: i + 1, academicYear: academicLabel(start + i), collegeId: atCC ? cc.id : target.id,
        exponent: g.exp, factor: g.factor, amount: scaleRange((atCC ? ccAnnual : tAnnual).total, g.factor) });
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
      i20: null,
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
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PontEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
