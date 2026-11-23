/*
  Pont pages after Overview (task 6, docs/design-campus.md screens 5 to 8, Overview style):
    colleges      My colleges: filter panel, college cards, sort, "Add to plan", routes explainer (AI)
    college/<id>  College detail: aid policy, net price for you, cost by phase, deadlines, forms,
                  document rules, I-20 amount, residency card, funding explainer (AI)
    scholarships  College and outside scholarships for this profile, never counted in totals
    plan          Plan and deadlines: month timeline with status and ticks, steps for the student's situation

  No math here: every amount comes from js/engine.js (CLAUDE.md rule 1). Every amount and rule shows its
  source and checked date; missing data shows "Not confirmed" with the official link (rule 4).
  AI explanations run only on a click, with the scripted fallback and the offline banner (docs/ai.md).
*/
(function () {
  "use strict";

  const U = window.PontUI;
  const E = window.PontEngine;
  const AI = window.PontAI;
  const P = window.PontPrompts;

  const TYPE = { private_college: "Private college", public_university: "Public university", community_college: "Community college" };
  const POLICY_FILTERS = [
    { id: "need_blind", label: "Need-blind", test: (c) => val(c, "intl_admission_policy") === "need_blind" },
    { id: "full_need", label: "Meets full need", test: (c) => val(c, "meets_full_need_intl") === true },
    { id: "merit", label: "Merit aid", test: (c) => ["yes", "limited"].includes(val(c, "merit_aid_intl")) },
    { id: "outside", label: "Outside scholarships allowed", test: (c) => val(c, "outside_scholarships_allowed") === true },
  ];
  const SORTS = [
    { id: "fit", label: "Best funding fit" },
    { id: "estimate", label: "Lowest estimate first" },
    { id: "name", label: "Name, A to Z" },
  ];
  const METHOD = {
    threshold: "Estimate from the college's published income rule",
    calculator_link: "No published rule for your profile: the official aid page has the next steps",
    full_cost: "Full cost: no need-based aid for your profile",
  };
  function val(c, key) {
    const f = c.aid && c.aid[key];
    return f && typeof f === "object" && "value" in f ? f.value : null;
  }

  function create(app) {
    const st = app.state;
    const data = () => st.data;
    const findCollege = app.findCollege;
    const short = (c) => U.collegeUi(c).short;
    const srcOf = (c, id, checked) => {
      const s = (c.sources || []).find((x) => x.id === id);
      return s ? Object.assign({}, s, !s.checked_on && checked ? { checked_on: checked } : {}) : null;
    };
    const feeSrc = (id) => (data().fees.sources || []).find((s) => s.id === id) || null;
    const fee = (id) => (data().fees.government || []).find((f) => f.id === id) || null;
    const rangeText = (r, ctx) => (r.min === r.max ? U.money(r.mid, ctx) : U.money(r.min, ctx) + " to " + U.money(r.max, ctx));
    const srcLink = (s) => (s && s.url ? `${U.ext(s.url, s.label)}${s.checked_on ? ", checked " + U.esc(U.fullDate(s.checked_on)) : ""}` : "");
    const card = (title, icon, tone, body, opts) => {
      const o = opts || {};
      const id = "c-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return `<section class="card ${o.span || "span-6"}" aria-labelledby="${id}">
        <div class="card-head"><div class="tile t-${tone}">${U.icon(icon)}</div><h2 id="${id}">${U.esc(title)}</h2>${o.more || ""}</div>${body}</section>`;
    };
    const notConfirmed = (link, label) => `<span class="nc">Not confirmed.</span>${link ? " " + U.ext(link.url, label || "Official page") : ""}`;

    // Every route as { it, g }. A college can appear once per group.
    const allItems = (res) => res.routes.groups.reduce((acc, g) => acc.concat(g.items.map((it) => ({ it, g }))), []);
    const itemFor = (res, id) => allItems(res).find((x) => x.it.collegeId === id) || null;
    const isDream = (res, id) => res.routes.groups[0].items.some((i) => i.collegeId === id);
    const inPlan = (res, id) => isDream(res, id) || !st.planOut[id];
    const routeName = (it) => {
      const c = findCollege(it.collegeId);
      return it.targetCollegeId ? `${short(c)}, then ${short(findCollege(it.targetCollegeId))}` : c.name;
    };

    /* ---------- AI explanations (click only, scripted fallback) ---------- */
    function scriptedReason(it, g, res) {
      const c = findCollege(it.collegeId);
      const n = it.netPrice || {};
      const tags = U.policyTags(c, res.routes.profile.audience);
      let first;
      if (it.kind === "transfer_path") first = `Two years at ${short(c)}, then transfer to ${short(findCollege(it.targetCollegeId))}.`;
      else if (g.id === "dream") first = "Your dream school.";
      else first = tags.length ? tags.slice(0, 2).join(", ") + "." : "";
      const second = !n.hasEstimate ? "No estimate yet. See the official aid page." : it.gap && it.gap.label ? it.gap.label + "." : "";
      return (first + " " + second).trim();
    }
    function scriptedFunding(it, c, res) {
      const n = it.netPrice || {};
      const parts = [U.policyTags(c, res.routes.profile.audience).join(". ")].filter(Boolean);
      if (it.status !== "ok") parts.push("Cost not confirmed for your situation.");
      else if (n.method === "threshold") parts.push(n.threshold.label);
      else if (n.method === "calculator_link") parts.push(n.message || "No estimate yet. See the official aid page.");
      else {
        parts.push("We count the full cost of attendance.");
        if (n.merit) parts.push(n.merit);
        if (n.message) parts.push(n.message);
      }
      if (n.notConfirmed && n.notConfirmed.length) parts.push("Still to confirm: " + n.notConfirmed.map((x) => x.label).join(", ") + ".");
      return parts.map((p) => p.replace(/\.?$/, ".")).join(" ");
    }
    const offlineNote = (fn) => (data().scripts.functions && data().scripts.functions[fn]) || AI.COPY.offline;

    async function explainRoutes() {
      const res = app.compute();
      if (!res || (st.routesAi && st.routesAi.busy)) return;
      const facts = app.planFacts(res);
      st.routesAi = { busy: true };
      app.render(false, { focusId: "btn-explain-routes" });
      const fallback = () => ({
        routes: allItems(res).map(({ it, g }) => ({ routeId: g.id + ":" + it.collegeId, reason: scriptedReason(it, g, res) })),
        suggestions: [],
      });
      const out = await app.ai.ask(P.routes({ facts: app.factsForPrompt(facts) }), { fallback });
      st.routesAi = { busy: false, data: out.cancelled ? null : out.data, live: out.live, offline: out.offline };
      app.render(false, { focusId: "routes-ai" });
    }

    async function explainFunding(id) {
      const res = app.compute();
      const x = res && itemFor(res, id);
      if (!x || (st.fundingAi[id] && st.fundingAi[id].busy)) return;
      const c = findCollege(id);
      const facts = app.planFacts(res);
      const one = Object.assign({}, facts, { routes: facts.routes.filter((r) => r.college_id === id).slice(0, 1) });
      st.fundingAi[id] = { busy: true };
      app.render(false, { focusId: "btn-explain-funding" });
      const fallback = () => ({ explanations: [{ collegeId: id, text: scriptedFunding(x.it, c, res), sources: [] }], confidence: "high" });
      const out = await app.ai.ask(P.funding({ facts: app.factsForPrompt(one) }), { fallback });
      const ex = out.data && out.data.explanations.find((e) => e.collegeId === id);
      st.fundingAi[id] = { busy: false, text: ex ? ex.text : null, sources: ex && out.live ? app.sourcesFor(facts, ex.sources) : [],
        confidence: out.data && out.data.confidence, live: out.live, offline: out.offline };
      app.render(false, { focusId: "funding-ai" });
    }

    function aiBlock(s, fn, id) {
      if (!s) return "";
      if (s.busy) return `<div class="ai-out" id="${id}" tabindex="-1">${U.typing("Pont is writing an explanation")}</div>`;
      if (!s.text && !s.data) return "";
      return `<div class="ai-out" id="${id}" tabindex="-1">${U.message(s.live
        ? { role: "ai", live: true, text: s.text, confidence: s.confidence, sources: s.sources }
        : { role: "ai", offline: true, banner: AI.COPY.offline, text: (s.text ? s.text + " " : "") + offlineNote(fn) })}</div>`;
    }

    /* ================= 5. My colleges ================= */
    function filtered(res) {
      const f = st.filters;
      const q = (f.q || "").trim().toLowerCase();
      let list = allItems(res).filter(({ it, g }) => {
        const c = findCollege(it.collegeId);
        if (f.groups.length && !f.groups.includes(g.id)) return false;
        if (f.policy.length && !f.policy.every((p) => POLICY_FILTERS.find((x) => x.id === p).test(c))) return false;
        if (f.types.length && !f.types.includes(c.type)) return false;
        if (f.estimate && !(it.netPrice && it.netPrice.hasEstimate)) return false;
        if (q && !(routeName(it) + " " + c.name + " " + (c.city || "")).toLowerCase().includes(q)) return false;
        return true;
      });
      const est = (x) => (x.it.netPrice && x.it.netPrice.hasEstimate ? U.estimatePerYear(x.it.netPrice) : Infinity);
      if (f.sort === "estimate") list = list.slice().sort((a, b) => est(a) - est(b));
      if (f.sort === "name") list = list.slice().sort((a, b) => routeName(a.it).localeCompare(routeName(b.it)));
      return list;
    }

    function filterPanel(res) {
      const f = st.filters;
      const items = allItems(res);
      const count = (pred) => items.filter(pred).length;
      const box = (group, value, label, n) => {
        const on = group === "estimate" ? f.estimate : f[group].includes(value);
        const id = `f-${group}-${value}`;
        return `<label class="check" for="${id}"><input type="checkbox" id="${id}" data-filter="${group}" value="${U.esc(value)}"${on ? " checked" : ""}> ${U.esc(label)} <span class="muted small">(${n})</span></label>`;
      };
      const types = Object.keys(TYPE).filter((t) => items.some((x) => findCollege(x.it.collegeId).type === t));
      const active = [];
      f.groups.forEach((g) => active.push([`groups:${g}`, res.routes.groups.find((x) => x.id === g).label]));
      f.policy.forEach((p) => active.push([`policy:${p}`, POLICY_FILTERS.find((x) => x.id === p).label]));
      f.types.forEach((t) => active.push([`types:${t}`, TYPE[t]]));
      if (f.estimate) active.push(["estimate:1", "With an estimate"]);
      if (f.q) active.push(["q:1", `"${f.q}"`]);
      // Below 1100 px the panel folds so the cards come first; it stays open once the student opens it.
      const wide = !(window.matchMedia && window.matchMedia("(max-width: 1100px)").matches);
      const open = wide || st.filtersOpen || active.length > 0;
      return `<aside class="card filters-card" aria-labelledby="filters-title">
        <details class="filters-fold" data-filters-fold${open ? " open" : ""}>
        <summary class="card-head"><div class="tile t-primary">${U.icon("sliders-horizontal")}</div><h2 id="filters-title" tabindex="-1">Filters${active.length ? ` (${active.length})` : ""}</h2>${wide ? "" : U.icon("chevron-down", "fold-icon")}</summary>
        <div class="filters">
          ${active.length ? `<div class="active-chips" aria-label="Active filters">${active.map(([k, l]) => `<button type="button" class="fchip" data-unfilter="${U.esc(k)}" aria-label="Remove filter ${U.esc(l)}">${U.esc(l)} ${U.icon("x")}</button>`).join("")}<button type="button" class="btn btn-link" data-clear-filters>Clear all</button></div>` : ""}
          <fieldset><legend>Route group</legend>${res.routes.groups.map((g) => box("groups", g.id, g.label, count((x) => x.g.id === g.id))).join("")}</fieldset>
          <fieldset><legend>Aid policy</legend>${POLICY_FILTERS.map((p) => box("policy", p.id, p.label, count((x) => p.test(findCollege(x.it.collegeId))))).join("")}</fieldset>
          <fieldset><legend>Type</legend>${types.map((t) => box("types", t, TYPE[t], count((x) => findCollege(x.it.collegeId).type === t))).join("")}</fieldset>
          <fieldset><legend>Estimate</legend>${box("estimate", "1", "Only routes with an estimate", count((x) => x.it.netPrice && x.it.netPrice.hasEstimate))}</fieldset>
        </div>
        </details>
      </aside>`;
    }

    function collegesHtml(res) {
      const ctx = app.moneyCtx(res);
      const list = filtered(res);
      const ra = st.routesAi;
      const reasons = {};
      if (ra && ra.data) ra.data.routes.forEach((r) => { reasons[r.routeId] = r.reason; });
      const cards = list.map(({ it, g }) => {
        const c = findCollege(it.collegeId);
        const rid = g.id + ":" + it.collegeId;
        const reason = reasons[rid] ? `<p class="route-reason${ra.live ? " is-live" : ""}">${U.icon(ra.live ? "sparkles" : "info")}<span>${U.esc(reasons[rid])}</span></p>` : "";
        return U.collegeCard(it, c, g.id, ctx, {
          target: it.targetCollegeId ? findCollege(it.targetCollegeId) : null,
          actions: true, added: inPlan(res, it.collegeId), locked: isDream(res, it.collegeId), reason, group: g.label,
        });
      }).join("");
      const sel = `<label for="sort" class="small muted">Sort by</label>
        <select id="sort" data-sort>${SORTS.map((s) => `<option value="${s.id}"${st.filters.sort === s.id ? " selected" : ""}>${U.esc(s.label)}</option>`).join("")}</select>`;
      const aiHead = ra && !ra.busy && ra.data
        ? `<div class="ai-out" id="routes-ai" tabindex="-1">${U.message(ra.live
          ? { role: "ai", live: true, confidence: null, text: ra.data.suggestions.length ? "Ideas to close the gap: " + ra.data.suggestions.join(" ") : "Each card now has a one-line reason." }
          : { role: "ai", offline: true, banner: AI.COPY.offline, text: offlineNote("routes") })}</div>`
        : ra && ra.busy ? `<div class="ai-out" id="routes-ai">${U.typing("Pont is explaining your routes")}</div>` : "";
      return `<div class="colleges-page">
        ${filterPanel(res)}
        <div class="colleges-main">
          <div class="toolbar">
            <p class="small muted" aria-live="polite"><b class="num">${list.length}</b> of ${allItems(res).length} routes</p>
            <div class="sort">${sel}</div>
          </div>
          <section class="card explain-card" aria-labelledby="why-title">
            <div class="card-head"><div class="tile t-dream">${U.icon("sparkles")}</div><h2 id="why-title">Why these routes</h2>
              <button type="button" class="btn btn-outline btn-sm more" id="btn-explain-routes" data-explain="routes"${ra && ra.busy ? " disabled" : ""}>${U.icon("sparkles")}Explain my routes</button></div>
            <p class="small muted">One line per route, written from your engine numbers. Uses your Claude account when live AI is available.</p>
            ${aiHead}
          </section>
          ${list.length ? `<div class="college-grid">${cards}</div>` : `<div class="empty">${U.icon("search-x")}No route matches these filters. <button type="button" class="btn btn-link" data-clear-filters>Clear all</button></div>`}
          <p class="small muted note-line">Colleges with checked data only. Routes that are not confirmed for your situation are hidden.</p>
        </div>
      </div>`;
    }

    /* ================= 6. College detail ================= */
    function aidRows(c, res) {
      const audience = res.routes.profile.audience;
      const aidPage = (itemFor(res, c.id) || {}).it ? itemFor(res, c.id).it.netPrice.aidPage : srcOf(c, c.aid.source, c.aid.checked_on);
      const row = (label, value, f) => {
        const s = f && f.source ? srcOf(c, f.source, f.checked_on) : null;
        const body = value === null ? notConfirmed(aidPage, "Official aid page") : U.esc(value);
        return `<div class="kv"><dt>${U.esc(label)}</dt><dd>${body}${f && f.note ? `<span class="kv-note">${U.esc(f.note)}</span>` : ""}${s ? `<span class="kv-src">Source: ${srcLink(s)}.</span>` : ""}</dd></div>`;
      };
      const a = c.aid || {};
      const pick = (v, map) => (v === null || v === undefined ? null : map[String(v)] || null);
      const rows = [];
      if (audience !== "us") {
        rows.push(row("Admission", pick(val(c, "intl_admission_policy"), { need_blind: "Need-blind: admission does not look at your family's money", need_aware: "Need-aware", not_applicable: "Open admission" }), a.intl_admission_policy));
        rows.push(row("Need-based aid for international students", pick(val(c, "intl_need_based_aid"), { true: "Yes", false: "No" }), a.intl_need_based_aid));
        rows.push(row("Meets full need", pick(val(c, "meets_full_need_intl"), { true: "Yes, 100% of demonstrated need", false: "No" }), a.meets_full_need_intl));
        rows.push(row("Merit scholarships", pick(val(c, "merit_aid_intl"), { none: "None: all aid is need-based", limited: "Limited: possible, not guaranteed", yes: "Yes: possible, not guaranteed" }), a.merit_aid_intl));
      }
      const forms = audience === "us" ? a.forms_us : a.forms_intl;
      if (forms) rows.push(row("Aid forms", forms.value && forms.value.length ? U.formsText(forms.value.filter((f) => !(f === "tasfa" && forms.value.includes("fafsa"))), forms.codes) : "None listed", forms));
      const thr = (a.thresholds && a.thresholds.value) || [];
      const usable = thr.filter((t) => audience === "us" || t.applies_to_intl === true);
      if (usable.length) rows.push(row("Published income rules", usable.map((t) => t.label + (t.applies_note ? " " + t.applies_note : "")).join(" "), a.thresholds));
      else if (a.thresholds) rows.push(row("Published income rules", audience === "us" || !thr.length ? "None published for your profile" : "Not stated for international students", a.thresholds));
      rows.push(row("Outside scholarships", pick(val(c, "outside_scholarships_allowed"), { true: "Allowed", false: "Not allowed" }), a.outside_scholarships_allowed));
      return `<dl class="kv-list">${rows.join("")}</dl>`;
    }

    function netCard(x, c, ctx, res) {
      const fa = st.fundingAi[c.id];
      const explain = x ? `<button type="button" class="btn btn-outline btn-sm more" id="btn-explain-funding" data-explain="funding" data-college="${U.esc(c.id)}"${fa && fa.busy ? " disabled" : ""}>${U.icon("sparkles")}Explain with AI</button>` : "";
      let body;
      if (!x) body = `<p>${U.esc(c.name)} is not one of your routes for this profile.</p>`;
      else {
        const it = x.it;
        const n = it.netPrice;
        if (it.status !== "ok") body = `<p>Cost not confirmed for your situation.</p>${U.sourceLine((c.sources || [])[0])}`;
        else if (!n.hasEstimate) body = `<p class="big-line">No estimate yet.</p><p>${U.esc(METHOD.calculator_link)}. ${U.ext(n.aidPage.url, "Official aid page")}</p>`;
        else {
          const zero = n.threshold && n.threshold.rule === "parent_contribution_zero";
          const big = zero ? U.money(0, ctx) : U.money(U.estimatePerYear(n), ctx);
          const bar = E.fundingBar(n, it.gap);
          const pending = (n.notConfirmed || []).map((p) => `<li>${U.esc(p.label)}${p.note ? `: <span class="muted">${U.esc(p.note)}</span>` : ""}${p.source && p.source.url ? ` ${U.ext(p.source.url, "Source")}` : ""}</li>`).join("");
          body = `<p class="small muted">${U.esc(METHOD[n.method])}</p>
            <div class="big-num"><b class="num">${zero ? "" : n.atMost ? '<span class="pre">at most</span> ' : ""}${U.esc(big)}</b><span>${zero ? "a year expected from your parents" : "a year on average over " + n.years + " years"}</span></div>
            ${n.year1 && !zero ? `<p class="small muted">First year: ${U.esc(rangeText(n.year1, ctx))}.</p>` : ""}
            ${U.gapBlock(it.gap)}
            ${bar ? `<div class="light-bar">${U.fundingBar(bar, U.barLegend(it, c, bar, ctx))}</div>` : ""}
            ${n.merit ? `<p class="small">${U.esc(n.merit)}</p>` : ""}
            ${n.message ? `<p class="small muted">${U.esc(n.message)}</p>` : ""}
            ${pending ? `<details class="pending"><summary>Still to confirm (${n.notConfirmed.length})</summary><ul>${pending}</ul></details>` : ""}
            ${U.sourceLine(U.netSource(it))}`;
        }
      }
      return card("Net price for you", "hand-coins", "aid", body + aiBlock(fa, "funding", "funding-ai"), { span: "span-7", more: explain });
    }

    function lineRows(lines, ctx, notAdded) {
      return lines.map((l) => {
        const amount = l.amount ? rangeText(l.amount, ctx) : null;
        const right = notAdded
          ? `<span class="nc">${amount ? U.esc(amount) + ", " : ""}${l.reason === "credited_to_tuition" ? "not added again" : "not added"}</span>`
          : `<b class="num">${U.esc(amount)}</b>`;
        return `<div class="line-row"><div><span>${U.esc(l.label)}</span>${l.note ? `<span class="kv-note">${U.esc(l.note)}</span>` : ""}${l.source && l.source.url ? `<span class="kv-src">Source: ${srcLink(l.source)}.</span>` : ""}</div>${right}</div>`;
      }).join("");
    }

    function costCard(x, c, ctx) {
      if (!x || x.it.status !== "ok") return card("Cost by phase", "wallet", "lower", `<p>${notConfirmed((c.sources || [])[0])}</p>`, { span: "span-7" });
      const cost = x.it.cost;
      const phases = [];
      if (cost.oneTime && cost.oneTime.lines.length) phases.push(["Before you arrive, once", lineRows(cost.oneTime.lines, ctx)]);
      if (cost.kind === "transfer_path") {
        (cost.segments || []).forEach((s) => {
          const sc = findCollege(s.collegeId);
          phases.push([`Each year at ${short(sc)} (${s.years} years)`, lineRows(s.annual.lines, ctx)]);
        });
      } else phases.push([`Each year at ${short(c)} (first year)`, lineRows(cost.annual.lines, ctx)]);
      const years = cost.perYear.map((y) => `<div class="line-row"><span>Year ${y.year}, ${U.esc(y.academicYear)}${y.collegeId && cost.kind === "transfer_path" ? ", " + U.esc(short(findCollege(y.collegeId))) : ""}</span><b class="num">${U.esc(rangeText(y.amount, ctx))}</b></div>`).join("");
      const notAdded = cost.notAdded && cost.notAdded.length ? `<details class="pending"><summary>Shown, not added (${cost.notAdded.length})</summary>${lineRows(cost.notAdded, ctx, true)}</details>` : "";
      const body = `${phases.map(([t, rows]) => `<h3 class="phase">${U.esc(t)}</h3>${rows}`).join("")}
        <h3 class="phase">Year by year</h3>${years}
        <div class="line-row total"><span>Whole program, ${cost.years} years</span><b class="num">${U.esc(rangeText(cost.total, ctx))}</b></div>
        <p class="small muted">${U.esc((cost.assumptions || []).map((a) => a.label).join(" "))} Before aid. This is the cost, not what your family pays.</p>
        ${notAdded}`;
      return card("Cost by phase", "wallet", "lower", body, { span: "span-7" });
    }

    function i20Card(x, c, ctx, res) {
      if (!res.routes.profile.visaStudent || !x || x.it.status !== "ok") return "";
      const i20 = E.showForI20(x.it.cost, data());
      if (!i20) return "";
      const rows = (i20.breakdown || []).map((b) => `<div class="line-row"><span>${U.esc(b.label)}</span><b class="num">${U.esc(U.money(b.amount, ctx))}</b></div>`).join("");
      return card("Show for the I-20", "landmark", "primary", `<div class="big-num"><b class="num">${U.esc(U.money(i20.amount, ctx))}</b><span>for the first year${i20.year ? ", " + U.esc(i20.year) : ""}</span></div>
        <p class="small">This is what you show, not what you pay.</p>${rows}${i20.label ? `<p class="small muted">${U.esc(i20.label)}</p>` : ""}${U.sourceLine(i20.source)}`, { span: "span-5" });
    }

    function deadlinesFormsCard(x, c, res) {
      const list = res.allDeadlines.filter((d) => d.collegeId === c.id);
      const items = list.length ? list.map((d) => U.deadlineItem(d, st.ticks[d.id] ? "done" : d.status)).join("") : `<div class="empty">No deadlines in our data for your profile.</div>`;
      const audience = res.routes.profile.audience;
      const f = audience === "us" ? c.aid.forms_us : c.aid.forms_intl;
      const forms = x && x.it.forms && x.it.forms.length
        ? `<p><b>Forms:</b> ${U.esc(U.formsText(x.it.forms.filter((k) => !(k === "tasfa" && x.it.forms.includes("fafsa"))), f && f.codes))}.</p>${f ? U.sourceLine(srcOf(c, f.source, f.checked_on)) : ""}`
        : `<p><b>Forms:</b> none listed for your profile.</p>`;
      return card("Deadlines and forms", "calendar-days", "primary", forms + `<div class="dl-list">${items}</div>${list[0] ? U.sourceLine(list[0].source) : ""}`, { span: "span-5" });
    }

    function rulesHtml(rules, keys) {
      return keys.filter(([k]) => rules[k]).map(([k, label]) => {
        const r = rules[k];
        if (r && r.status === "not_confirmed") return `<li><b>${U.esc(label)}:</b> <span class="nc">Not confirmed.</span>${r.note ? " " + U.esc(r.note) : ""}</li>`;
        const text = typeof r === "string" ? r : r.rule;
        return text ? `<li><b>${U.esc(label)}:</b> ${U.esc(text)}</li>` : "";
      }).join("");
    }
    function docRulesCard(c, res) {
      const out = [];
      const i20r = res.routes.profile.visaStudent && c.i20 && c.i20.document_rules;
      if (i20r) {
        const list = rulesHtml(i20r, [["upload", "Upload"], ["language", "Language"], ["name", "Name"], ["liquid", "Liquid funds"]])
          + (i20r.max_age_rule ? `<li><b>Age:</b> ${U.esc(i20r.max_age_rule)}</li>` : "")
          + (i20r.max_pages ? `<li><b>Pages:</b> at most ${i20r.max_pages}.</li>` : "")
          + (i20r.not_accepted ? `<li><b>Not accepted:</b> ${U.esc(i20r.not_accepted.join(", "))}.</li>` : "");
        out.push(`<h3 class="phase">Proof of funds for the I-20</h3><ul class="rules">${list}</ul>${U.sourceLine(srcOf(c, i20r.source, i20r.checked_on))}`);
      }
      const dr = c.document_rules;
      if (dr) {
        const src = srcOf(c, dr.source, dr.checked_on);
        if (dr.status === "not_confirmed") out.push(`<h3 class="phase">Financial aid documents</h3><p>${notConfirmed(src)}${dr.note ? ` <span class="muted small">${U.esc(dr.note)}</span>` : ""}</p>`);
        else out.push(`<h3 class="phase">Financial aid documents</h3><ul class="rules">${rulesHtml(dr, [["channel", "How to send"], ["tax_documents", "Tax documents"], ["translation", "Translation"], ["format", "Format"], ["signature", "Signature"]])}</ul>${U.sourceLine(src)}`);
      }
      if (!out.length) return "";
      return card("Document rules", "file-check-2", "gap", out.join("") + `<p class="small muted">The documents studio checks your files against these rules.</p>`, { span: "span-7" });
    }

    function residencyCard(c, res) {
      if (res.routes.profile.audience !== "us" || !c.residency_rule) return "";
      return card("Residency check", "map-pin", "lower", `<p>${U.esc(c.residency_rule)}</p><p class="small muted">Pont does not decide residency. Only the college can.</p>${U.sourceLine(srcOf(c, "ut-residency"))}`, { span: "span-5" });
    }

    function collegeHtml(res, id) {
      const c = data().colleges.colleges.find((x) => x.id === id && x.status === "verified");
      if (!c) return `<div class="page-empty"><div class="empty">${U.icon("search-x")}We have no checked data for this college.<br><br><a class="btn btn-outline btn-sm" href="#colleges">Back to My colleges</a></div></div>`;
      const ctx = app.moneyCtx(res);
      const x = itemFor(res, id);
      const tone = x ? U.GROUP_UI[x.g.id].tone : "dream";
      const ui = U.collegeUi(c);
      const dream = isDream(res, id);
      const planBtn = !x ? "" : dream
        ? `<span class="tag">${U.icon("sparkles")}Your dream, always in your plan</span>`
        : `<button type="button" class="btn ${inPlan(res, id) ? "btn-outline" : "btn-primary"} btn-sm" data-action="add" data-college="${U.esc(id)}" aria-pressed="${inPlan(res, id)}">${inPlan(res, id) ? U.icon("check") + "In your plan" : U.icon("plus") + "Add to plan"}</button>`;
      const aidPage = x && x.it.netPrice && x.it.netPrice.aidPage;
      const transfer = x && x.it.kind === "transfer_path" && c.transfer_note
        ? `<p class="transfer-note">${U.icon("route")}<span>${U.esc(`Route: two years at ${short(c)}, then transfer to ${short(findCollege(x.it.targetCollegeId))}. ${c.transfer_note.text}`)}${c.transfer_note.note ? " " + U.esc(c.transfer_note.note) : ""}</span></p>` : "";
      return `<div class="grid">
        <section class="card detail-head span-12" aria-label="${U.esc(c.name)}">
          <div class="band band-${tone}"></div>
          <div class="detail-row">
            <div class="mono mono-lg m-${tone}-solid" aria-hidden="true">${U.esc(ui.mono)}</div>
            <div class="detail-id"><p class="small"><a href="#colleges">${U.icon("arrow-left")}My colleges</a></p>
              <p class="city">${U.esc([c.city, TYPE[c.type]].filter(Boolean).join(", "))}${x ? `. Route: ${U.esc(x.g.label)}` : ""}</p></div>
            <div class="detail-actions">${planBtn}${aidPage && aidPage.url ? U.ext(aidPage.url, "Official aid page", "btn btn-outline btn-sm") : ""}</div>
          </div>
          ${U.tagsHtml(U.policyTags(c, res.routes.profile.audience))}
          ${transfer}
        </section>
        ${netCard(x, c, ctx, res)}
        ${card("Aid policy", "badge-check", "dream", aidRows(c, res), { span: "span-5" })}
        ${costCard(x, c, ctx)}
        ${deadlinesFormsCard(x, c, res)}
        ${i20Card(x, c, ctx, res)}
        ${docRulesCard(c, res)}
        ${residencyCard(c, res)}
      </div>`;
    }

    /* ================= 7. Scholarships ================= */
    function scholarshipsHtml(res) {
      const ctx = app.moneyCtx(res);
      const audience = res.routes.profile.audience;
      const ids = [];
      allItems(res).forEach(({ it }) => { if (!ids.includes(it.collegeId)) ids.push(it.collegeId); });
      const blocks = ids.map((id) => {
        const c = findCollege(id);
        const rows = [];
        const a = c.aid || {};
        if (audience !== "us" && a.merit_aid_intl) {
          const v = val(c, "merit_aid_intl");
          const txt = { none: "No merit scholarships: all aid is need-based.", limited: "Merit scholarships are limited: possible, not guaranteed.", yes: "Merit scholarships: possible, not guaranteed." }[v];
          rows.push(`<li>${txt ? U.esc(txt) : notConfirmed(srcOf(c, a.merit_aid_intl.source))}${a.merit_aid_intl.source ? `<span class="kv-src">Source: ${srcLink(srcOf(c, a.merit_aid_intl.source, a.merit_aid_intl.checked_on))}.</span>` : ""}</li>`);
        }
        if (typeof c.scholarships === "string") rows.push(`<li>${U.esc(c.scholarships)}<span class="kv-src">Source not recorded in our data. Confirm with ${U.esc(short(c))}.</span></li>`);
        const isss = c.isss_scholarships;
        if (isss && audience !== "us") {
          const w = isss.window || {};
          const when = w.opens && w.closes && w.year ? `Applications ${U.fullDate(w.year + "-" + w.opens)} to ${U.fullDate(w.year + "-" + w.closes)}. ` : "";
          const ex = (isss.examples || []).map((e) => `<li>${U.esc(e.name)}: <b class="num">${U.esc(U.money(e.amount, ctx))}</b> once${e.note ? `, ${U.esc(e.note.replace(/\.$/, "").toLowerCase())}` : ""}.</li>`).join("");
          rows.push(`<li><b>International student scholarships.</b> ${U.esc(when)}${U.esc(isss.note || "")}${ex ? `<ul class="examples-list">${ex}</ul>` : ""}<span class="kv-src">Source: ${srcLink(srcOf(c, isss.source, isss.checked_on))}.</span></li>`);
        }
        const aidDl = res.allDeadlines.filter((d) => d.collegeId === id && d.kind === "aid" && (d.forms || []).includes("college_form"));
        if (aidDl.length) rows.push(`<li><b>${U.esc(U.FORM.college_form)}.</b><div class="dl-list">${aidDl.map((d) => U.deadlineItem(d, st.ticks[d.id] ? "done" : d.status)).join("")}</div>${U.sourceLine(aidDl[0].source)}</li>`);
        const os = a.outside_scholarships_allowed;
        if (os) {
          const v = os.value === true ? "Outside scholarships allowed." : os.value === false ? "Outside scholarships not allowed." : null;
          rows.push(`<li>${v ? U.esc(v) : `Outside scholarships: ${notConfirmed(srcOf(c, os.source))}`}${os.note ? " " + U.esc(os.note) : ""}${os.source ? `<span class="kv-src">Source: ${srcLink(srcOf(c, os.source, os.checked_on))}.</span>` : ""}</li>`);
        }
        return `<article class="card sch-card"><div class="name"><div class="mono mono-sm m-${U.GROUP_UI[(itemFor(res, id) || { g: { id: "dream" } }).g.id].tone}" aria-hidden="true">${U.esc(U.collegeUi(c).mono)}</div><h3><a href="#college/${U.esc(id)}">${U.esc(c.name)}</a></h3></div>
          <ul class="sch-list">${rows.join("") || `<li>${notConfirmed((c.sources || [])[0])}</li>`}</ul></article>`;
      }).join("");
      const homes = [];
      (st.answers.passports || []).concat(st.answers.parentCountries || []).forEach((code) => { if (code !== "US" && !homes.includes(code)) homes.push(code); });
      const homeRows = homes.map((code) => {
        const k = data().countries.countries[code];
        const hs = k && k.home_scholarships;
        return `<li>${U.esc(k ? k.name : code)}: ${hs && hs.url ? U.ext(hs.url, hs.label || "Official list") : `<span class="nc">Not confirmed.</span> We have no checked list of scholarships from ${U.esc(k ? k.name : code)} yet.`}</li>`;
      }).join("");
      const allowed = ids.map(findCollege).filter((c) => val(c, "outside_scholarships_allowed") === true).map(short);
      return `<div class="grid">
        <section class="card span-12 sch-intro" aria-label="About scholarships">
          <p>${U.icon("info")}<span><b>Never counted in your totals.</b> Scholarships are possible, not guaranteed, so your net price and gap never include them. Each one links to its official page.</span></p>
        </section>
        <section class="span-12" aria-labelledby="sch-col-title">
          <div class="routes-head"><h2 id="sch-col-title">College scholarships for your profile</h2></div>
          <div class="sch-grid">${blocks || `<div class="empty">No college in your routes yet.</div>`}</div>
        </section>
        <section class="card span-12" aria-labelledby="sch-out-title">
          <div class="card-head"><div class="tile t-aid">${U.icon("globe")}</div><h2 id="sch-out-title">Outside scholarships</h2></div>
          <p>${allowed.length ? `Colleges in your routes that let you add outside scholarships: ${U.esc(U.listText(allowed))}. ` : ""}Outside scholarships can replace part of what your family pays at these colleges. Check each college's rule above.</p>
          ${homeRows ? `<h3 class="phase">From your family's country</h3><ul class="sch-list">${homeRows}</ul>` : ""}
        </section>
      </div>`;
    }

    /* ================= 8. Plan and deadlines ================= */
    function situationSteps(res, ctx) {
      const s = st.answers.status;
      const money = (id) => { const f = fee(id); return f && f.amount ? U.money(f.amount, ctx) : null; };
      const dream = res.routes.groups[0].items[0];
      const dc = dream ? findCollege(dream.collegeId) : null;
      const i20src = dc && dc.i20 ? srcOf(dc, dc.i20.source, dc.i20.checked_on) : null;
      const step = (text, src) => ({ text, src });
      const confirm = "Pont shows steps and official links only. Confirm every decision with the college international office or an immigration attorney.";
      const SETS = {
        no_visa: ["After admission: I-20 and F-1 visa", [
          step("Request the I-20 in the college portal and upload proof of funds.", i20src),
          step(`Pay the SEVIS I-901 fee${money("sevis_f_m") ? ": " + money("sevis_f_m") : ""}.`, feeSrc("ice-i901")),
          step(`Fill in the DS-160 and pay the visa fee${money("mrv") ? ": " + money("mrv") : ""}.`, feeSrc("dos-visa-fees")),
          step("Book the visa interview at a U.S. consulate. F visas can be issued up to 365 days before the program starts.", feeSrc("dos-visa-fees")),
        ]],
        f1_transfer: ["Transfer your F-1 record", [
          step("Get admitted by the new college."),
          step("Your current school releases your SEVIS record on a release date."),
          step("The new college issues a transfer I-20 with the same SEVIS ID. No new SEVIS fee.", feeSrc("ice-i901")),
          step("Report to the new college within 15 days of the program start."),
        ]],
        f2_dependent: ["Switch to F-1 to study full time", [
          step("As an F-2 dependent you can study only part time. A degree program needs F-1 status."),
          step("Get admitted and request the I-20 from the college.", i20src),
          step(`Pay the SEVIS I-901 fee${money("sevis_f_m") ? ": " + money("sevis_f_m") : ""}.`, feeSrc("ice-i901")),
          step(`Inside the U.S.: file USCIS Form I-539 to change to F-1${money("i539_online") ? " (" + money("i539_online") + " online)" : ""}. Or apply for an F-1 visa from your home country${money("mrv") ? " (visa fee " + money("mrv") + ")" : ""}.`, feeSrc("uscis-g1055")),
        ]],
        tourist: ["Change to F-1 status", [
          step("ESTA entrants cannot change status inside the U.S.: leave and apply for the F-1 visa from home.", feeSrc("dos-visa-fees")),
          step(`B-1 or B-2: file USCIS Form I-539${money("i539_online") ? " (" + money("i539_online") + " online)" : ""} and do not start classes until it is approved, or apply from home.`, feeSrc("uscis-g1055")),
        ]],
        dependent: ["Study on your dependent visa", [
          step("H-4, L-2, E and G dependents can study without changing visa. Switching to F-1 is optional."),
        ]],
        daca_or_none: ["Aid without the FAFSA", [
          step("You can enroll. The FAFSA is not open to you: ask each college about its own aid."),
        ]],
        citizen_or_pr: ["No visa steps", [
          step("You file the FAFSA. Your aid offer comes after it. Your parents' foreign income is reported in USD."),
        ]],
      };
      const set = SETS[s];
      if (!set) return "";
      const items = set[1].map((x) => `<li>${U.esc(x.text)}${x.src && x.src.url ? `<span class="kv-src">Source: ${srcLink(x.src)}.</span>` : ""}</li>`).join("");
      return card(set[0], "stamp", "lower", `<ol class="sit-steps">${items}</ol><p class="small muted">${U.esc(confirm)}</p>`, { span: "span-5" });
    }

    function planHtml(res) {
      const ctx = app.moneyCtx(res);
      const list = res.deadlines;
      const todo = list.filter((d) => d.status === "to_do");
      const done = todo.filter((d) => st.ticks[d.id]).length;
      const months = [];
      list.forEach((d) => {
        const key = d.date.slice(0, 7);
        let m = months.find((x) => x.key === key);
        if (!m) { m = { key, items: [] }; months.push(m); }
        m.items.push(d);
      });
      const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const row = (d) => {
        const status = d.status === "passed" ? "passed" : st.ticks[d.id] ? "done" : "to_do";
        const id = "pl-" + d.id.replace(/[^a-z0-9]+/gi, "-");
        const c = findCollege(d.collegeId);
        const days = d.status === "to_do" ? (d.daysLeft === 0 ? "Today" : d.daysLeft === 1 ? "1 day left" : `${d.daysLeft} days left`) : "";
        const lead = d.status === "to_do"
          ? `<input type="checkbox" id="${id}" data-tick="${U.esc(d.id)}"${st.ticks[d.id] ? " checked" : ""}>`
          : `<span class="pl-box" aria-hidden="true"></span>`;
        return `<li class="pl-item${status === "passed" ? " is-passed" : ""}">${lead}
          <div class="dtile" aria-hidden="true"><small>${U.esc(U.monthDay(d.date).split(" ")[0])}</small><b>${+d.date.slice(8, 10)}</b></div>
          <div class="what">${d.status === "to_do" ? `<label for="${id}"><b>${U.esc(U.deadlineTitle(d))}</b></label>` : `<b>${U.esc(U.deadlineTitle(d))}</b>`}
            <span><span class="sr-only">${U.esc(U.fullDate(d.date))}. </span>${U.esc(U.deadlineSub(d))}${days ? `. ${U.esc(days)}` : ""}</span>
            ${d.source && d.source.url ? `<span class="kv-src">Source: ${srcLink(d.source)}.</span>` : ""}</div>
          <a class="pl-college small" href="#college/${U.esc(c.id)}">${U.esc(short(c))}</a>
          ${U.statusChip(status)}</li>`;
      };
      const timeline = months.map((m) => `<section class="pl-month" aria-labelledby="m-${m.key}"><h3 id="m-${m.key}">${MONTH[+m.key.slice(5, 7) - 1]} ${m.key.slice(0, 4)}</h3><ul class="pl-list">${m.items.map(row).join("")}</ul></section>`).join("");
      const inPlanList = [];
      allItems(res).forEach(({ it }) => { if (inPlan(res, it.collegeId) && !inPlanList.includes(it.collegeId)) inPlanList.push(it.collegeId); });
      const out = allItems(res).filter(({ it }) => !inPlan(res, it.collegeId)).map(({ it }) => short(findCollege(it.collegeId)));
      return `<div class="grid">
        <section class="card span-7 plan-summary" aria-labelledby="ps-title">
          <div class="card-head"><div class="tile t-primary">${U.icon("list-checks")}</div><h2 id="ps-title">Your plan for ${U.esc(U.termLabel(st.answers.term))}</h2></div>
          <div class="progress" aria-hidden="true"><span style="width:${todo.length ? (done / todo.length) * 100 : 0}%"></span></div>
          <p class="small"><b>${done} of ${todo.length}</b> upcoming steps done. Ticks stay only in this browser tab.</p>
          <p class="small muted">Colleges in your plan: ${U.esc(U.listText(inPlanList.map((id) => short(findCollege(id)))))}.${out.length ? ` Not in your plan: ${U.esc(U.listText(out))}.` : ""} <a href="#colleges">Change in My colleges</a></p>
        </section>
        ${situationSteps(res, ctx) || ""}
        <section class="span-12 timeline" aria-labelledby="tl-title">
          <div class="routes-head"><h2 id="tl-title">Month by month</h2></div>
          ${timeline || `<div class="empty">${U.icon("calendar-check")}No deadlines in our data for the colleges in your plan.</div>`}
        </section>
      </div>`;
    }

    /* ---------- Events inside the page ---------- */
    function onClick(e) {
      // Filter panel fold: only below 1100 px; remember the student's choice across renders.
      const sum = e.target.closest("[data-filters-fold] > summary");
      if (sum) {
        const wide = !(window.matchMedia && window.matchMedia("(max-width: 1100px)").matches);
        if (wide) e.preventDefault(); else st.filtersOpen = !sum.parentElement.open;
        return true;
      }
      const t = e.target.closest("[data-explain],[data-unfilter],[data-clear-filters],[data-action]");
      if (!t) return false;
      if (t.dataset.explain === "routes") { explainRoutes(); return true; }
      if (t.dataset.explain === "funding") { explainFunding(t.dataset.college); return true; }
      if (t.dataset.unfilter) {
        const [k, v] = t.dataset.unfilter.split(":");
        if (k === "estimate") st.filters.estimate = false;
        else if (k === "q") st.filters.q = "";
        else st.filters[k] = st.filters[k].filter((x) => x !== v);
        app.saveFilters();
        app.render(false, { focusId: "filters-title" });
        return true;
      }
      if (t.hasAttribute("data-clear-filters")) {
        Object.assign(st.filters, { groups: [], policy: [], types: [], estimate: false, q: "" });
        app.saveFilters();
        app.render(false, { focusId: "filters-title" });
        return true;
      }
      if (t.dataset.action === "view") { app.navigate("college/" + t.dataset.college); return true; }
      if (t.dataset.action === "add") {
        const id = t.dataset.college;
        if (st.planOut[id]) delete st.planOut[id]; else st.planOut[id] = true;
        app.savePlan();
        const focus = t.id || null;
        app.render(false);
        const again = document.querySelector(`[data-action="add"][data-college="${CSS.escape(id)}"]`) || (focus && document.getElementById(focus));
        if (again) again.focus();
        return true;
      }
      return false;
    }
    function onChange(e) {
      const t = e.target;
      if (t.dataset.filter) {
        const k = t.dataset.filter;
        if (k === "estimate") st.filters.estimate = t.checked;
        else st.filters[k] = t.checked ? st.filters[k].concat([t.value]) : st.filters[k].filter((x) => x !== t.value);
        app.saveFilters();
        app.render(false, { focusId: t.id });
        return true;
      }
      if (t.hasAttribute("data-sort")) {
        st.filters.sort = t.value;
        app.saveFilters();
        app.render(false, { focusId: "sort" });
        return true;
      }
      return false;
    }

    return { collegesHtml, collegeHtml, scholarshipsHtml, planHtml, onClick, onChange, explainRoutes, explainFunding, scriptedReason, scriptedFunding };
  }

  window.PontPages = { create };
})();
