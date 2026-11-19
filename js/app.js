/*
  Pont app: intake screens, app shell (sidebar, top bar, content, advisor rail), pages, state.
  No math here: every amount comes from js/engine.js (CLAUDE.md rule 1). Components come from js/ui.js.

  Answers live only in this browser tab (sessionStorage). They are never sent
  to or saved on a server, and they are cleared when the tab closes.
  No income, savings, SSN, account numbers or immigration documents are stored.

  Demo shortcuts (nothing visible in the UI):
    index.html?demo=ananya, index.html?demo=lucas and index.html?demo=ian
  They replace any saved session, open Overview and then remove ?demo from the address bar.
  (Task 5 builds the profile confirm screen; the demos will open it then.)
*/
(function () {
  "use strict";

  const E = window.PontEngine;
  const U = window.PontUI;
  const KEY = { answers: "pont.answers", screen: "pont.screen", ticks: "pont.ticks", display: "pont.display" };

  /* ---------- Demo answers (CLAUDE.md, "Demo paths") ---------- */
  const DEMOS = {
    ananya: {
      name: "Ananya",
      area: "any",
      colleges: [{ collegeId: "harvard", programId: "undeclared" }],
      passports: ["IN"],
      parentCountries: ["IN"],
      status: "no_visa",
      term: "fall-2027",
      currency: "INR",
      incomeBand: "under_65k",
      monthly: 10000,
    },
    lucas: {
      name: "Lucas",
      area: "cs",
      colleges: [{ collegeId: "ut-austin", programId: "cs" }],
      passports: ["BR"],
      parentCountries: ["BR"],
      status: "no_visa",
      term: "fall-2027",
      currency: "BRL",
      monthly: 23000,
    },
    ian: {
      name: "Ian",
      area: "cs",
      colleges: [{ collegeId: "ut-austin", programId: "cs" }],
      passports: ["US"],
      parentCountries: ["BR"],
      status: "citizen_or_pr",
      term: "fall-2027",
      currency: "BRL",
      monthly: null,
    },
  };

  /* ---------- Storage (this tab only) ---------- */
  function load(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage blocked: the app still works for this page view */ }
  }
  function clearSession() {
    try {
      Object.values(KEY).forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* nothing to clear */ }
  }

  /* ---------- State ---------- */
  const state = {
    answers: load(KEY.answers, {}),
    screen: load(KEY.screen, "welcome"),
    ticks: load(KEY.ticks, {}),       // plan steps ticked by the student, this tab only
    display: load(KEY.display, "USD"), // currency switch
    data: null,                        // { colleges, fees, countries, scripts }
    countries: null,
    rates: {},
    ratePromises: {},
    fxStatus: null,
    chat: [],                          // advisor messages after the opening
    asked: {},                         // chips already used
    typing: false,
  };
  const hasPlan = () => Array.isArray(state.answers.colleges) && state.answers.colleges.length > 0 && !!state.answers.status;

  /* ---------- Intake screens (form fallback; the AI intake comes in task 5) ---------- */
  const SCREENS = [
    {
      id: "welcome", question: false,
      title: "Tell us your dream school. We find the scholarships to get you there.",
      body: () => `
        <p class="screen-lead">Scholarships, financial aid and the documents you need, in your family's currency. Powered by AI. No login needed.</p>
        <p class="small muted">Your answers stay only in this browser tab and are cleared when the tab closes.</p>`,
      next: "Start",
    },
    { id: "area", question: true, title: "What do you want to study?", body: () => skeleton("Area options") },
    { id: "college", question: true, title: "Which is your dream school?", body: () => skeleton("College search") },
    { id: "nationality", question: true, title: "Which passport or passports do you have?", body: () => skeleton("Passport options") },
    { id: "status", question: true, title: "What is your situation in the U.S. today?", body: () => skeleton("Six situations from docs/visa-and-fees.md") },
    { id: "start", question: true, title: "When do you want to start?", body: () => skeleton("Fall 2027, Spring 2028, Fall 2028") },
    { id: "currency", question: true, title: "Where do your parents earn their income?", body: () => skeleton("Countries") },
    {
      id: "monthly", question: true, skip: true,
      title: "How much could your family pay per month?",
      body: () => `<p class="screen-lead">Optional. It helps us show your funding gap. You can skip it.</p>${skeleton("Monthly amount field")}`,
    },
    { id: "results", question: false, final: true, title: "Your funding plan", body: () => skeleton("The plan opens after the intake (task 5)") },
  ];
  const QUESTIONS = SCREENS.filter((s) => s.question);
  const indexOf = (id) => SCREENS.findIndex((s) => s.id === id);
  const skeleton = (what) => `<div class="screen-skeleton">${U.esc(what)}. Built in task 5.</div>`;

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);

  /* ---------- Data (local files; exchange rates are fetched later, see ensureRates) ---------- */
  function loadData() {
    const get = (p) => fetch(p, { cache: "no-store" }).then((r) => r.json());
    return Promise.all(["data/colleges.json", "data/fees.json", "data/countries.json", "data/ai-scripts.json"].map(get))
      .then(([colleges, fees, countries, scripts]) => {
        state.data = { colleges, fees, countries, scripts };
        state.countries = countries;
        if (window.PontFx) PontFx.configure(countries);
      })
      .catch((e) => console.error("[Pont] could not load the data files", e));
  }

  /* ---------- Exchange rates (docs/funding-and-currency.md section 6) ---------- */
  const familyCurrencies = () =>
    !window.PontFx || !state.countries ? [] : PontFx.familyCurrencies(state.answers.parentCountries, state.countries);
  const rateOf = (cur) => (cur === "USD" ? 1 : state.rates[cur] && state.rates[cur].rate > 0 ? state.rates[cur].rate : null);

  // Fetched only after the family country is known, once per currency per session. Never at startup.
  function ensureRates() {
    familyCurrencies().forEach((cur) => {
      if (state.ratePromises[cur]) return;
      state.ratePromises[cur] = PontFx.getRate(cur, {
        fxJsonUrl: "data/fx.json",
        onStatus: (msg) => { state.fxStatus = msg; renderTop(); },
      }).then((info) => {
        state.rates[cur] = info;
        state.fxStatus = null;
        render(false);
        return info;
      }).catch((e) => {
        console.error("[Pont] exchange rate unavailable", cur, e);
        state.fxStatus = null;
        render(false);
        return null;
      });
    });
  }

  function rateLineHtml() {
    const curs = familyCurrencies();
    if (!curs.length) return "";
    return `<div class="rate-line" aria-live="polite">${curs.map((cur) => {
      const info = state.rates[cur];
      if (!info) return state.fxStatus ? `<span>${U.esc(state.fxStatus)}</span>` : "";
      const l = PontFx.rateLines(info);
      if (!l.value) return `<span class="rate-notice">${U.esc(l.notice)}${l.officialUrl ? " " + U.ext(l.officialUrl, "Official rate") : ""}</span>`;
      return `<span><b>${U.esc(l.value)}</b></span><span>Source: ${U.ext(l.source.url, l.source.name)}, ${U.esc(l.source.date)}</span>${l.notice ? `<span class="rate-notice">${U.esc(l.notice)}</span>` : ""}`;
    }).join("")}</div>`;
  }

  /* ---------- Engine results for the current answers ---------- */
  function todayIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const findCollege = (id) => state.data.colleges.colleges.find((c) => c.id === id);

  function compute() {
    if (!state.data || !hasPlan()) return null;
    const a = state.answers;
    const fxRate = rateOf(a.currency);
    const data = state.data;
    const today = todayIso();
    const r = E.routes(a, data, { fxRate, today });
    const deadlines = E.deadlineList(r, data, { term: a.term, today });
    return { routes: r, deadlines, today, fxRate };
  }

  // Money context for the currency switch.
  function moneyCtx(res) {
    const cur = state.display;
    return { currency: rateOf(cur) ? cur : "USD", rate: rateOf(cur), audience: res ? res.routes.profile.audience : "intl" };
  }

  /* ---------- Pages ---------- */
  const PAGES = [
    { id: "overview", label: "Overview", icon: "layout-dashboard" },
    { id: "colleges", label: "My colleges", icon: "graduation-cap" },
    { id: "scholarships", label: "Scholarships", icon: "award" },
    { id: "plan", label: "Plan and deadlines", icon: "calendar-days" },
    { id: "documents", label: "Documents", icon: "file-check-2" },
    { id: "family", label: "Family mode", icon: "users" },
  ];
  const currentPage = () => {
    const id = location.hash.replace("#", "");
    return PAGES.some((p) => p.id === id) ? id : "overview";
  };

  function renderNav(res) {
    const page = currentPage();
    const soon = res ? res.deadlines.filter((d) => d.status === "to_do" && !state.ticks[d.id] && d.daysLeft <= 30).length : 0;
    $("nav").innerHTML = PAGES.map((p) => {
      const count = p.id === "plan" && soon ? `<span class="nav-count" aria-label="${soon} deadlines in the next 30 days">${soon}</span>` : "";
      return `<a class="nav-item" href="#${p.id}"${p.id === page ? ' aria-current="page"' : ""}>${U.icon(p.icon)}${U.esc(p.label)}${count}</a>`;
    }).join("");

    const a = state.answers;
    const country = (code) => (state.countries && state.countries.countries[code] ? state.countries.countries[code].name : code);
    const curs = familyCurrencies();
    const where = a.status === "citizen_or_pr"
      ? `U.S. citizen, parents in ${(a.parentCountries || []).map(country).join(" and ")}`
      : `${country((a.passports || [])[0])}${curs.length ? ", " + curs.join(" and ") : ""}`;
    $("profile-card").innerHTML = `<div class="avatar" aria-hidden="true">${U.esc((a.name || "You")[0])}</div>
      <div><b>${U.esc(a.name || "Your profile")}</b><small>${U.esc(where)}. ${U.esc(U.termLabel(a.term))}</small></div>`;
  }

  function greeting() {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return state.answers.name ? `${part}, ${state.answers.name}` : part;
  }
  function bandText(id) {
    const b = E.INCOME_BANDS[id];
    if (!b) return null;
    if (b.min === 0) return "under " + U.usd(b.max);
    if (b.max === Infinity) return "over " + U.usd(b.min);
    return U.usd(b.min) + " to " + U.usd(b.max);
  }

  function renderTop() {
    const page = currentPage();
    const a = state.answers;
    const p = PAGES.find((x) => x.id === page);
    let title = p.label;
    let sub = "";
    if (page === "overview") {
      title = greeting();
      sub = `Your funding plan for ${U.termLabel(a.term)}.`;
      if (a.incomeBand && bandText(a.incomeBand)) sub += ` Family income ${bandText(a.incomeBand)}.`;
      else if (a.monthly > 0 && window.PontFx) sub += ` Your family could pay about ${PontFx.formatMoney(a.monthly, a.currency)} a month.`;
    }
    const curs = ["USD"].concat(familyCurrencies());
    const seg = curs.length > 1 ? `<div class="seg" role="group" aria-label="Currency">${curs.map((c) => {
      const ok = !!rateOf(c);
      return `<button type="button" data-currency="${c}" aria-pressed="${state.display === c && ok}"${ok ? "" : ` disabled title="Exchange rate for ${c} not available"`}>${c}</button>`;
    }).join("")}</div>` : "";
    $("top").innerHTML = `
      <div class="top-title"><h1 id="page-title" tabindex="-1">${U.esc(title)}</h1>${sub ? `<p>${U.esc(sub)}</p>` : ""}</div>
      <div class="top-tools">
        <form class="search" role="search" id="search-form">
          ${U.icon("search")}<label for="search" class="sr-only">Search colleges and scholarships</label>
          <input id="search" type="search" placeholder="Search colleges and scholarships">
        </form>
        ${seg}
        <button type="button" class="icon-btn" data-action="advisor" aria-label="Help: ask the advisor">${U.icon("circle-help")}</button>
      </div>
      ${rateLineHtml()}`;
    icons();
  }

  /* ---------- Overview ---------- */
  function documentsFor(res, dream) {
    const profile = res.routes.profile;
    const docs = [];
    const pc = profile.colleges.find((c) => c.collegeId === dream.id) || { forms: [] };
    if (profile.visaStudent) {
      const rules = dream.i20 && dream.i20.document_rules;
      docs.push({ title: "Bank statement for the I-20", icon: "landmark",
        sub: rules && rules.max_pages ? `${U.collegeUi(dream).short} accepts up to ${rules.max_pages} pages.` : "Shows the money for the first year." });
    }
    const dr = dream.document_rules || {};
    if (dr.tax_documents) docs.push({ title: "Parents' 2025 tax return", icon: "file-text", sub: dr.channel && dr.channel.channel ? `Through ${dr.channel.channel}` : "" });
    if (profile.audience === "us" && (state.answers.parentCountries || []).some((c) => c !== "US")) {
      const names = state.answers.parentCountries.filter((c) => c !== "US").map((c) => state.countries.countries[c].name);
      docs.push({ title: "Parents' income documents", icon: "file-text", sub: `From ${names.join(" and ")}, converted to USD in the studio` });
    }
    const where = { css_profile: "On the College Board site", fafsa: "On studentaid.gov", isfaa: "College form", college_form: "College form" };
    pc.forms.filter((f) => f !== "idoc" && !(f === "tasfa" && pc.forms.includes("fafsa"))).forEach((f) => {
      docs.push({ title: U.FORM[f], icon: "clipboard-list", sub: where[f] || "" });
    });
    return docs.map((d) => Object.assign({ status: "not_started" }, d));
  }

  function nextCard(res) {
    const upcoming = res.deadlines.filter((d) => d.status === "to_do");
    const head = `<div class="card-head"><div class="tile t-primary">${U.icon("alarm-clock")}</div><h2 id="next-title">Next deadline</h2></div>`;
    if (!upcoming.length) {
      return `<section class="card next span-5" aria-labelledby="next-title">${head}<div class="empty">${U.icon("calendar-check")}No upcoming deadlines in our data.</div></section>`;
    }
    const next = upcoming.find((d) => !state.ticks[d.id]) || upcoming[0];
    const done = upcoming.filter((d) => state.ticks[d.id]).length;
    const steps = upcoming.slice(0, 3);
    const days = next.daysLeft === 0 ? "Today" : next.daysLeft === 1 ? "1 day left" : `${next.daysLeft} days left`;
    return `<section class="card next span-5" aria-labelledby="next-title">${head}
      <div class="date"><strong class="num">${U.esc(U.monthDay(next.date))}</strong><span class="days">${U.esc(days)}</span></div>
      <div class="what">${U.esc(U.deadlineTitle(next))}</div>
      <div class="what-sub">${U.esc(U.deadlineSub(next))}</div>
      <div class="progress" aria-hidden="true"><span style="width:${(done / upcoming.length) * 100}%"></span></div>
      <div class="small muted">${done} of ${upcoming.length} plan steps done</div>
      <ul class="steps">${steps.map((d, i) => `<li class="step"><input type="checkbox" id="step-${i}" data-tick="${U.esc(d.id)}"${state.ticks[d.id] ? " checked" : ""}>
        <label for="step-${i}">${U.esc(U.deadlineTitle(d))}, ${U.esc(U.collegeUi(findCollege(d.collegeId)).short)}, ${U.esc(U.monthDay(d.date))}</label></li>`).join("")}</ul>
      ${U.sourceLine(next.source)}
    </section>`;
  }

  function routesSection(res, ctx) {
    const groups = res.routes.groups;
    const dreamFunded = groups[0].items.length && groups[0].items.every((i) => i.gap && i.gap.label === "Funded");
    const col = (g) => {
      const cards = g.items.map((it) => U.collegeCard(it, findCollege(it.collegeId), g.id, ctx,
        { target: it.targetCollegeId ? findCollege(it.targetCollegeId) : null })).join("");
      const empty = g.id === "lower_cost" && dreamFunded
        ? "Your dream school already looks funded. Ask the advisor to compare lower-cost options anyway."
        : "No route in our data for this group yet.";
      return `<div>${U.groupHeader(g)}${cards || `<div class="empty">${U.icon("route")}${U.esc(empty)}</div>`}</div>`;
    };
    return `<section class="span-12" aria-labelledby="routes-title">
      <div class="routes-head"><h2 id="routes-title">Your routes</h2><a class="more" href="#colleges">Explore all colleges</a></div>
      <div class="cols">${groups.map(col).join("")}</div>
    </section>`;
  }

  function deadlinesCard(res) {
    const list = res.deadlines.filter((d) => d.status === "to_do").slice(0, 4);
    return `<section class="card span-7" aria-labelledby="dl-title">
      <div class="card-head"><div class="tile t-primary">${U.icon("calendar-days")}</div><h2 id="dl-title">Upcoming deadlines</h2><a class="more" href="#plan">See the full plan</a></div>
      ${list.length ? list.map((d) => U.deadlineItem(d, state.ticks[d.id] ? "done" : d.status)).join("") : `<div class="empty">No upcoming deadlines in our data.</div>`}
    </section>`;
  }

  function docsCard(res, dream) {
    const docs = documentsFor(res, dream);
    return `<section class="card span-5" aria-labelledby="docs-title">
      <div class="card-head"><div class="tile t-gap">${U.icon("file-search")}</div><h2 id="docs-title">Documents</h2><a class="more" href="#documents">Open studio</a></div>
      ${docs.length ? U.docsSummary(docs) + docs.map(U.docItem).join("") : `<div class="empty">No documents needed yet.</div>`}
    </section>`;
  }

  function overviewHtml(res) {
    if (!res) return loadingHtml();
    const ctx = moneyCtx(res);
    const dreamItem = res.routes.groups[0].items[0];
    const dream = findCollege(dreamItem.collegeId);
    return `<div class="grid">
      ${U.dreamHero(dreamItem, dream, ctx, { cls: "span-7" })}
      ${nextCard(res)}
      ${routesSection(res, ctx)}
      ${deadlinesCard(res)}
      ${docsCard(res, dream)}
    </div>`;
  }

  function loadingHtml() {
    return `<div class="grid" aria-busy="true" aria-label="Loading your plan">
      <div class="card span-7"><div class="skel skel-line" style="width:30%"></div><div class="skel skel-big"></div><div class="skel skel-line"></div><div class="skel skel-line" style="width:70%"></div></div>
      <div class="card span-5"><div class="skel skel-line" style="width:40%"></div><div class="skel skel-big" style="width:40%"></div><div class="skel skel-line"></div></div>
    </div>`;
  }

  function placeholderHtml(page) {
    const p = PAGES.find((x) => x.id === page);
    return `<div class="page-empty"><div class="empty">${U.icon(p.icon)}<b>${U.esc(p.label)}</b> comes in a later step of this prototype.<br>Your Overview already has your routes, deadlines and documents.<br><br><a class="btn btn-outline btn-sm" href="#overview">Back to Overview</a></div></div>`;
  }

  /* ---------- Advisor rail (scripted until task 4) ---------- */
  function scriptVars(res) {
    if (!res) return {};
    const a = state.answers;
    const ctx = moneyCtx(res);
    const groups = res.routes.groups;
    const dreamItem = groups[0].items[0];
    const dream = findCollege(dreamItem.collegeId);
    const ui = U.collegeUi(dream);
    const n = dreamItem.netPrice || {};
    const g = dreamItem.gap || {};
    const v = { name: a.name || "there", dream: ui.short, years: n.years || null };
    const audience = res.routes.profile.audience;
    const formsField = audience === "us" ? dream.aid.forms_us : dream.aid.forms_intl;
    if (n.threshold) v.threshold_income = U.usd(n.threshold.income_below_usd);
    if (a.incomeBand) v.band = bandText(a.incomeBand);
    if (n.threshold && n.threshold.rule === "parent_contribution_zero") v.visa_fees = U.money(n.total.mid, ctx);
    if (n.notConfirmed && n.notConfirmed.length) v.pending = n.notConfirmed.map((x) => x.label).join(", ");
    const dreamDl = res.deadlines.filter((d) => d.collegeId === dream.id && d.status === "to_do");
    const aidDl = dreamDl.find((d) => d.kind === "aid");
    if (aidDl) v.dream_aid_deadline = U.fullDate(aidDl.date);
    if (dreamDl[0]) v.dream_next_deadline = `${U.deadlineTitle(dreamDl[0])}, ${U.fullDate(dreamDl[0].date)}`;
    if (formsField && formsField.codes && formsField.codes.css_profile) v.css_code = formsField.codes.css_profile;
    if (n.hasEstimate) v.net_per_year = U.money(U.estimatePerYear(n), ctx);
    if (g.label) v.family_per_year = U.money(g.familyPerYearUsd, ctx);
    if (g.label && g.gapUsd > 0) v.gap_per_year = U.money(g.gapUsd, ctx);
    if (n.fullCost) v.full_per_year = U.money(n.fullCost.mid / n.years, ctx);
    v.increase = Math.round(E.DEFAULTS.yearlyIncrease * 100) + "%";
    const cc = groups[2].items.find((i) => i.kind === "transfer_path" && i.status === "ok");
    if (cc && cc.gap && cc.gap.label && cc.gap.gapShare > 0) {
      const c = findCollege(cc.collegeId);
      v.cc_name = U.collegeUi(c).short;
      v.cc_gap_label = cc.gap.label.toLowerCase();
      v.cc_gap_share = Math.round(cc.gap.gapShare * 100) + "%";
      v.transfer_note = (c.transfer_note && c.transfer_note.text) || null;
    }
    const strong = groups[1].items.map((i) => U.collegeUi(findCollege(i.collegeId)).short);
    if (strong.length) v.strong_list = U.listText(strong);
    const i20 = dreamItem.cost && dreamItem.cost.status === "ok" ? E.showForI20(dreamItem.cost, state.data) : null;
    if (i20) { v.i20_amount = U.money(i20.amount, ctx); v.i20_note = i20.label || ""; }
    if (dream.residency_rule) v.residency_rule = dream.residency_rule;
    if (formsField && formsField.value && formsField.value.length) {
      const forms = formsField.value.filter((f) => audience === "us" || f !== "fafsa")
        .filter((f) => !(f === "tasfa" && formsField.value.includes("fafsa")));
      v.dream_forms = U.formsText(forms, formsField.codes);
    }
    // Sources for each answer
    const src = (c, id) => { const s = (c.sources || []).find((x) => x.id === id); return s || null; };
    v.$sources = {
      dream: dreamItem.status === "ok" ? U.netSource(dreamItem) : null,
      dream_apply: formsField ? src(dream, formsField.source) : null,
      cc: cc ? src(findCollege(cc.collegeId), "acc-proof-support") : null,
      i20: i20 ? i20.source : null,
      residency: src(dream, "ut-residency"),
      cost: dreamItem.cost && dreamItem.cost.annual ? dreamItem.cost.annual.lines[0].source : null,
    };
    v.$mini = {
      tone: "dream", mono: ui.mono, title: dream.name,
      sub: n.threshold && n.threshold.rule === "parent_contribution_zero" ? `${U.money(0, ctx)} a year from parents`
        : n.hasEstimate ? `${v.net_per_year} a year on average` : "No estimate yet",
      label: g.label || null,
    };
    return v;
  }
  // Fills {name} variables. A missing variable means the message is not shown (never invent).
  function fill(tpl, v) {
    let missing = false;
    const out = tpl.replace(/\{(\w+)\}/g, (m, k) => {
      if (v[k] === undefined || v[k] === null || v[k] === "") { missing = true; return ""; }
      return v[k];
    });
    return missing ? null : out;
  }
  function script() {
    const all = state.data && state.data.scripts && state.data.scripts.advisor;
    if (!all) return null;
    return { all, path: all[state.answers.demo] || all.generic };
  }

  function renderRail(res) {
    const s = script();
    $("rail-status").textContent = s ? s.all.status_sample : "Sample answers";
    $("ai-label").querySelector("span").textContent = s ? s.all.ai_label : "";
    if (!s || !res) { $("msgs").innerHTML = U.typing(); return; }
    const v = scriptVars(res);
    const opening = fill(s.path.opening.text, v);
    const msgs = [];
    if (opening) msgs.push({ role: "ai", text: opening, mini: s.path.opening.mini ? v.$mini : null, source: v.$sources[s.path.opening.source] || null });
    const chips = (s.path.chips || []).map((c, i) => ({ i, q: fill(c.q, v), a: fill(c.a, v), source: c.source }))
      .filter((c) => c.q && c.a && !state.asked[c.i]);
    $("msgs").innerHTML = msgs.concat(state.chat).map(U.message).join("") +
      (state.typing ? U.typing() : "") +
      (chips.length && !state.typing ? `<div class="chips">${chips.map((c) => `<button type="button" class="chip" data-chip="${c.i}">${U.esc(c.q)}</button>`).join("")}</div>` : "");
    icons();
  }

  function askChip(i) {
    const s = script();
    const res = compute();
    const v = scriptVars(res);
    const c = s.path.chips[i];
    const q = fill(c.q, v);
    const a = fill(c.a, v);
    if (!q || !a) return;
    state.asked[i] = true;
    state.chat.push({ role: "me", text: q });
    reply({ role: "ai", text: a, source: v.$sources[c.source] || null }, res);
  }
  function reply(msg, res) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    state.typing = true;
    renderRail(res);
    setTimeout(() => {
      state.typing = false;
      state.chat.push(msg);
      renderRail(compute());
      const m = $("msgs");
      m.scrollTop = m.scrollHeight;
    }, reduce ? 0 : 700);
  }

  /* ---------- Drawers: advisor (below 1280 px) and menu (below 960 px) ---------- */
  const isNarrow = (px) => window.matchMedia(`(max-width: ${px}px)`).matches;
  let lastFocus = null;
  function openAdvisor() {
    if (isNarrow(1280)) {
      lastFocus = document.activeElement;
      $("rail").classList.add("is-open");
      document.body.classList.add("drawer-open");
      $("backdrop").hidden = false;
      $("fab").setAttribute("aria-expanded", "true");
    }
    $("ask").focus();
  }
  function closeDrawers() {
    const wasOpen = $("rail").classList.contains("is-open") || $("side").classList.contains("is-open");
    $("rail").classList.remove("is-open");
    $("side").classList.remove("is-open");
    document.body.classList.remove("drawer-open");
    $("backdrop").hidden = true;
    $("fab").setAttribute("aria-expanded", "false");
    $("btn-menu").setAttribute("aria-expanded", "false");
    if (wasOpen && lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }
  function openMenu() {
    lastFocus = document.activeElement;
    $("side").classList.add("is-open");
    $("backdrop").hidden = false;
    $("btn-menu").setAttribute("aria-expanded", "true");
    const first = $("nav").querySelector("a");
    if (first) first.focus();
  }

  /* ---------- Render ---------- */
  function icons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
  }

  function renderIntake(moveFocus) {
    $("intake").hidden = false;
    $("shell").hidden = true;
    $("fab").hidden = true;
    const i = Math.max(indexOf(state.screen), 0);
    const s = SCREENS[i];
    const q = QUESTIONS.indexOf(s);
    $("intake-progress").hidden = q < 0;
    if (q >= 0) {
      $("progress-text").textContent = `Question ${q + 1} of ${QUESTIONS.length}`;
      $("progress-fill").style.width = ((q + 1) / QUESTIONS.length) * 100 + "%";
    }
    $("screen").innerHTML = `
      <h1 id="screen-title" tabindex="-1">${U.esc(s.title)}</h1>
      <div class="screen-body">${s.body(state.answers)}</div>
      <div class="intake-foot">
        ${i > 0 ? `<button type="button" class="btn btn-outline" data-intake="back">Back</button>` : ""}
        <span class="spacer"></span>
        ${s.skip ? `<button type="button" class="btn btn-link" data-intake="skip">Skip</button>` : ""}
        ${s.final ? "" : `<button type="button" class="btn btn-primary" data-intake="next">${U.esc(s.next || "Continue")}</button>`}
      </div>
      ${i > 0 ? `<p class="small" style="margin-top:24px"><button type="button" class="btn btn-link" data-intake="over">Start over</button></p>` : ""}`;
    document.title = i === 0 ? "Pont" : `${s.title} | Pont`;
    icons();
    if (moveFocus) { window.scrollTo(0, 0); $("screen-title").focus(); }
  }

  function render(moveFocus) {
    if (!hasPlan()) { renderIntake(moveFocus); return; }
    $("intake").hidden = true;
    $("shell").hidden = false;
    $("fab").hidden = false;
    ensureRates(); // a family currency without a rate shows amounts in USD (see moneyCtx)
    const res = compute();
    const page = currentPage();
    renderNav(res);
    renderTop();
    $("page").innerHTML = page === "overview" ? overviewHtml(res) : placeholderHtml(page);
    renderRail(res);
    document.querySelectorAll(".logo-slot").forEach((el) => { el.innerHTML = U.logoSvg(); });
    const p = PAGES.find((x) => x.id === page);
    document.title = `${p.label} | Pont`;
    icons();
    if (moveFocus) { window.scrollTo(0, 0); $("page-title").focus(); }
  }

  /* ---------- Events ---------- */
  function goScreen(id) {
    state.screen = indexOf(id) < 0 ? "welcome" : id;
    save(KEY.screen, state.screen);
    renderIntake(true);
  }
  function startOver() {
    clearSession();
    state.answers = {};
    state.ticks = {};
    state.chat = [];
    state.asked = {};
    state.display = "USD";
    closeDrawers();
    history.replaceState(null, "", location.pathname);
    goScreen("welcome"); // rates already fetched stay cached: one request per currency per session
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-intake],[data-currency],[data-action],[data-chip]");
    if (!t) return;
    if (t.dataset.intake) {
      const i = indexOf(state.screen);
      if (t.dataset.intake === "next") goScreen(SCREENS[Math.min(i + 1, SCREENS.length - 1)].id);
      if (t.dataset.intake === "back") goScreen(SCREENS[Math.max(i - 1, 0)].id);
      if (t.dataset.intake === "skip") { state.answers.monthly = null; save(KEY.answers, state.answers); goScreen(SCREENS[i + 1].id); }
      if (t.dataset.intake === "over") startOver();
    }
    if (t.dataset.currency) {
      state.display = t.dataset.currency;
      save(KEY.display, state.display);
      render(false);
      const b = document.querySelector(`[data-currency="${state.display}"]`);
      if (b) b.focus();
    }
    if (t.dataset.action === "advisor") openAdvisor();
    if (t.dataset.action === "plan") location.hash = "#plan";
    if (t.dataset.chip !== undefined) askChip(+t.dataset.chip);
  });

  document.addEventListener("change", (e) => {
    const id = e.target.dataset && e.target.dataset.tick;
    if (!id) return;
    if (e.target.checked) state.ticks[id] = true; else delete state.ticks[id];
    save(KEY.ticks, state.ticks);
    const focusId = e.target.id;
    render(false);
    const el = $(focusId);
    if (el) el.focus();
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id === "compose") {
      e.preventDefault();
      const text = $("ask").value.trim();
      if (!text) return;
      $("ask").value = "";
      state.chat.push({ role: "me", text });
      const s = script();
      reply({ role: "ai", offline: true, text: s ? s.all.offline : "AI is offline right now." }, compute());
    }
    if (e.target.id === "search-form") {
      e.preventDefault();
      location.hash = "#colleges";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawers();
  });

  $("fab").addEventListener("click", openAdvisor);
  $("btn-rail-close").addEventListener("click", closeDrawers);
  $("backdrop").addEventListener("click", closeDrawers);
  $("btn-menu").addEventListener("click", openMenu);
  $("btn-side-close").addEventListener("click", closeDrawers);
  $("btn-start-over").addEventListener("click", startOver);
  $("nav").addEventListener("click", (e) => { if (e.target.closest("a")) closeDrawers(); });
  window.addEventListener("hashchange", () => { if (hasPlan()) render(true); });

  /* ---------- Demo shortcuts ---------- */
  function applyDemo() {
    const params = new URLSearchParams(location.search);
    const name = params.get("demo");
    if (!name || !DEMOS[name]) return false;
    // The shortcut replaces any saved session, with no message on screen.
    clearSession();
    state.answers = Object.assign(JSON.parse(JSON.stringify(DEMOS[name])), { demo: name });
    state.ticks = {};
    state.display = "USD";
    save(KEY.answers, state.answers);
    params.delete("demo");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + "#overview");
    return true;
  }

  /* ---------- Start ---------- */
  document.getElementById("intake-logo").innerHTML = U.logoSvg();
  applyDemo();
  if (indexOf(state.screen) < 0) state.screen = "welcome";
  render(false);
  loadData().then(() => render(false));

  // For later steps and for checks in the console. Read only.
  window.PontApp = {
    get answers() { return JSON.parse(JSON.stringify(state.answers)); },
    get page() { return hasPlan() ? currentPage() : state.screen; },
    get rates() { return Object.assign({}, state.rates); },
    ratesReady: () => Promise.all(Object.values(state.ratePromises)),
    compute,
  };
})();
