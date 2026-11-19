/*
  Pont intake: screens 1 to 3 (docs/screens.md, docs/design-campus.md "Screens" 1 to 3).
    welcome  hero with the dream school search, country select and popular chips; how Pont works;
             colleges that fund international students (from data/colleges.json); source note.
    chat     the advisor conversation (live intake interviewer when Claude is available, otherwise
             scripted questions), quick-answer chips, free text, and the profile card building up.
    form     the same questions, one per screen ("Use a form instead", and the fallback when AI is offline).
    confirm  editable summary; "Build my funding plan" opens Overview.

  The app owns the questions, their order and the allowed values. The AI only reads free text into
  those values (validated in js/ai.js) and phrases the next question. It never guesses a country or a
  status: unclear values are dropped and asked again. No math here (CLAUDE.md rule 1).
  Answers live only in this browser tab (sessionStorage), through app.save().
*/
(function () {
  "use strict";

  const U = window.PontUI;
  const AI = window.PontAI;
  const P = window.PontPrompts;
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const $ = (id) => document.getElementById(id);

  const STATUS = [
    { value: "no_visa", label: "No visa yet, starting from zero" },
    { value: "citizen_or_pr", label: "U.S. citizen or permanent resident" },
    { value: "f1_transfer", label: "Already on an F-1 at another U.S. school" },
    { value: "tourist", label: "Tourist visa (B-1, B-2) or ESTA" },
    { value: "dependent", label: "Dependent visa (H-4, L-2, E or G)" },
    { value: "daca_or_none", label: "DACA or no status" },
  ];
  const TERMS = [
    { value: "fall-2027", label: "Fall 2027" },
    { value: "spring-2028", label: "Spring 2028" },
    { value: "fall-2028", label: "Fall 2028" },
  ];
  const BANDS = ["under_65k", "65k_100k", "100k_150k", "150k_200k", "over_200k"];

  function create(app) {
    const st = app.state;
    const A = () => st.answers;
    const data = () => st.data;
    const scripts = () => (data() && data().scripts && data().scripts.intake) || {};

    /* ---------- Options from the data files ---------- */
    const countryMap = () => (data() ? data().countries.countries : {});
    const countryName = (code) => (countryMap()[code] ? countryMap()[code].name : code);
    const countryOpts = () => Object.keys(countryMap())
      .map((code) => ({ value: code, label: countryMap()[code].name }))
      .sort((x, y) => x.label.localeCompare(y.label));
    const collegeById = (id) => data().colleges.colleges.find((c) => c.id === id);
    const bachelor = (c) => ((c && c.programs) || []).filter((p) => p.level === "bachelor");
    const dreamOpts = () => data().colleges.colleges
      .filter((c) => c.status === "verified" && bachelor(c).length)
      .map((c) => ({ value: c.id, label: U.collegeUi(c).short, long: c.name }));
    // The dream college whose program is asked: the first one without a program, else the first with a choice.
    const programTarget = (a) => (a.colleges || []).find((d) => !d.programId)
      || (a.colleges || []).find((d) => bachelor(collegeById(d.collegeId)).length > 1) || null;
    const currencyOf = (a) => (app.familyCurrencies(a.parentCountries)[0] || "USD");
    const bandText = (id) => {
      const b = window.PontEngine.INCOME_BANDS[id];
      if (!b) return null;
      if (b.min === 0) return "Under " + U.usd(b.max);
      if (b.max === Infinity) return "Over " + U.usd(b.min);
      return U.usd(b.min) + " to " + U.usd(b.max);
    };
    // Bands are in USD, shown also in the family currency when its rate is known (docs/product.md, question 8).
    const bandLabel = (id, a) => {
      const text = bandText(id);
      const cur = currencyOf(a);
      const rate = app.rateOf(cur);
      if (cur === "USD" || !rate) return text;
      const b = window.PontEngine.INCOME_BANDS[id];
      const fam = (n) => U.money(n, { currency: cur, rate });
      const extra = b.min === 0 ? fam(b.max) : b.max === Infinity ? fam(b.min) : fam(b.min) + " to " + fam(b.max);
      return `${text} (about ${extra})`;
    };
    const setArea = (a) => {
      const d = (a.colleges || []).find((x) => x.programId);
      const prog = d ? bachelor(collegeById(d.collegeId)).find((p) => p.id === d.programId) : null;
      a.area = prog ? prog.area : "any";
    };
    const namesList = (codes) => U.listText((codes || []).map(countryName));
    const nameOk = (v) => typeof v === "string" && /^[\p{L}][\p{L}\p{M} '.-]{0,39}$/u.test(v.trim());
    const listOf = (opts) => (v) => Array.isArray(v) && v.length > 0 && new Set(v).size === v.length && v.every((x) => opts().some((o) => o.value === x));
    const oneOf = (opts) => (v) => opts().some((o) => o.value === v);

    /* ---------- The questions (same for the chat and the form) ---------- */
    const FIELDS = [
      {
        id: "name", kind: "text", required: false, label: "Name",
        q: () => "First, what should we call you?",
        help: "Your first name is enough. You can skip this.",
        rule: "the student's first name as they wrote it",
        valid: nameOk,
        apply: (a, v) => { a.name = v ? String(v).trim() : ""; },
        show: (a) => a.name || null,
      },
      {
        id: "colleges", kind: "multi", required: true, label: "Dream school",
        q: () => "Which is your dream school?",
        help: "Pick one or more. Pont has checked aid data for these colleges today.",
        options: dreamOpts,
        valid: listOf(dreamOpts),
        value: (a) => (a.colleges || []).map((d) => d.collegeId),
        answered: (a) => Array.isArray(a.colleges) && a.colleges.length > 0,
        apply: (a, ids) => {
          a.colleges = ids.map((id) => {
            const old = (a.colleges || []).find((d) => d.collegeId === id);
            const progs = bachelor(collegeById(id));
            return { collegeId: id, programId: old && old.programId ? old.programId : progs.length === 1 ? progs[0].id : null };
          });
          setArea(a);
        },
        show: (a) => U.listText((a.colleges || []).map((d) => collegeById(d.collegeId).name)),
      },
      {
        id: "program", kind: "single", required: true, label: "Program",
        visible: (a) => (a.colleges || []).some((d) => bachelor(collegeById(d.collegeId)).length > 1),
        q: (a) => `What do you want to study at ${U.collegeUi(collegeById(programTarget(a).collegeId)).short}?`,
        help: "Programs with checked cost data.",
        options: (a) => { const t = programTarget(a || A()); return t ? bachelor(collegeById(t.collegeId)).map((p) => ({ value: p.id, label: p.name })) : []; },
        valid: (v) => { const t = programTarget(A()); return !!t && bachelor(collegeById(t.collegeId)).some((p) => p.id === v); },
        value: (a) => { const t = programTarget(a); return t ? t.programId : null; },
        answered: (a) => (a.colleges || []).length > 0 && a.colleges.every((d) => d.programId),
        apply: (a, v) => { const t = programTarget(a); if (t) t.programId = v; setArea(a); },
        show: (a) => (a.colleges || []).filter((d) => d.programId)
          .map((d) => `${bachelor(collegeById(d.collegeId)).find((p) => p.id === d.programId).name} (${U.collegeUi(collegeById(d.collegeId)).short})`).join(", ") || null,
      },
      {
        id: "passports", kind: "multi", required: true, label: "Citizenship",
        q: () => "Which passport or passports do you have?",
        help: "Pick every passport you hold.",
        options: countryOpts,
        valid: listOf(countryOpts),
        answered: (a) => Array.isArray(a.passports) && a.passports.length > 0,
        apply: (a, v) => { a.passports = v.slice(); },
        show: (a) => namesList(a.passports),
      },
      {
        id: "status", kind: "single", required: true, label: "Situation in the U.S.",
        q: () => "What is your situation in the U.S. today?",
        help: "We use it only to show the right steps. It is not stored.",
        options: (a) => {
          const us = ((a || A()).passports || []).includes("US");
          return us ? STATUS.slice(1, 2).concat(STATUS.slice(0, 1), STATUS.slice(2)) : STATUS.slice();
        },
        valid: (v) => STATUS.some((s) => s.value === v),
        apply: (a, v) => { a.status = v; },
        show: (a) => (STATUS.find((s) => s.value === a.status) || {}).label || null,
      },
      {
        id: "livesIn", kind: "single", required: false, label: "Lives in",
        q: () => "Where do you live now?",
        help: "Optional.",
        options: countryOpts,
        valid: oneOf(countryOpts),
        apply: (a, v) => { a.livesIn = v || null; },
        show: (a) => (a.livesIn ? countryName(a.livesIn) : null),
      },
      {
        id: "parentCountries", kind: "multi", required: true, label: "Parents earn in",
        q: () => "Where do your parents live and earn their income?",
        help: "Pick both countries if they earn in different places. Your currency comes from here.",
        options: countryOpts,
        valid: listOf(countryOpts),
        answered: (a) => Array.isArray(a.parentCountries) && a.parentCountries.length > 0,
        apply: (a, v) => { a.parentCountries = v.slice(); a.currency = currencyOf(a); },
        show: (a) => namesList(a.parentCountries),
      },
      {
        id: "term", kind: "single", required: true, label: "Start",
        q: () => "When do you want to start?",
        options: () => TERMS,
        valid: (v) => TERMS.some((t) => t.value === v),
        apply: (a, v) => { a.term = v; },
        show: (a) => (TERMS.find((t) => t.value === a.term) || {}).label || null,
      },
      {
        id: "incomeBand", kind: "single", required: false, label: "Family income",
        q: () => "Roughly, what is your family's yearly income?",
        help: "Optional. Colleges use it to estimate need-based aid. Ranges only, never exact numbers.",
        options: (a) => BANDS.map((id) => ({ value: id, label: bandLabel(id, a || A()) })).concat([{ value: "prefer_not", label: "Prefer not to say" }]),
        valid: (v) => BANDS.includes(v) || v === "prefer_not",
        apply: (a, v) => { a.incomeBand = v || null; },
        show: (a) => (a.incomeBand === "prefer_not" ? "Prefer not to say" : a.incomeBand ? bandText(a.incomeBand) : null),
      },
      {
        id: "monthly", kind: "number", required: false, label: "Family can pay",
        q: (a) => `How much could your family pay per month, in ${currencyOf(a)}?`,
        help: "Optional. A rough amount is fine. It helps us show your funding gap.",
        rule: "a positive number, in the family currency, per month, as the student said it",
        valid: (v) => typeof v === "number" && isFinite(v) && v > 0 && v < 1e10,
        apply: (a, v) => { a.monthly = v || null; },
        show: (a) => (a.monthly > 0 ? `${window.PontFx.formatMoney(a.monthly, a.currency || currencyOf(a))} a month` : null),
      },
    ];
    const field = (id) => FIELDS.find((f) => f.id === id);
    const visible = (a) => FIELDS.filter((f) => !f.visible || f.visible(a));
    const answered = (f, a) => (f.answered ? f.answered(a) : has(a, f.id));
    const current = (a) => visible(a).find((f) => !answered(f, a)) || null;
    const requiredComplete = (a) => visible(a).every((f) => !f.required || answered(f, a));
    const firstMissing = (a) => visible(a).find((f) => f.required && !answered(f, a)) || null;

    function setAnswer(f, value) {
      const a = A();
      f.apply(a, value);
      app.saveAnswers();
      if (f.id === "parentCountries") app.ensureRates();
    }

    /* ---------- Shared pieces ---------- */
    const statusPill = () => {
      const live = app.ai.status() === "live";
      return `<span class="rail-status${live ? " is-live" : ""}" data-ai-status>${U.esc(app.ai.statusText())}</span>`;
    };
    // Shown before the first live call; js/app.js updates it when the runtime answers.
    const consentNote = () => `<div data-ai-consent>${app.ai.consentPending()
      ? `<p class="consent">${U.icon("shield-check")}<span>${U.esc(AI.COPY.consent)}</span></p>` : ""}</div>`;

    function summaryRows(a, editable) {
      return visible(a).filter((f) => f.id !== "name" || editable).map((f) => {
        const v = f.show(a);
        const skipped = !v && has(a, f.id) && !f.required;
        const value = v ? U.esc(v) : `<span class="muted">${skipped ? "Skipped" : "Not answered yet"}</span>`;
        const edit = editable ? `<button type="button" class="btn btn-link" data-edit="${f.id}" aria-label="Edit ${U.esc(f.label.toLowerCase())}">Edit</button>` : "";
        const extra = f.id === "parentCountries" && v
          ? `<div class="small muted">Currency: ${U.esc(app.familyCurrencies(a.parentCountries).concat(["USD"]).join(" and "))}</div>` : "";
        return `<div class="sum-row${v ? " is-set" : ""}"><dt>${U.esc(f.label)}</dt><dd>${value}${extra}</dd>${edit}</div>`;
      }).join("");
    }

    /* ================= 1. Welcome ================= */
    function welcomeHtml() {
      if (!data()) return `<div class="welcome" aria-busy="true"><div class="skel skel-big"></div><div class="skel skel-line"></div></div>`;
      const opts = dreamOpts();
      const popular = opts.slice().sort((x, y) => ["harvard", "mit", "ut-austin", "amherst"].indexOf(x.value) - ["harvard", "mit", "ut-austin", "amherst"].indexOf(y.value));
      const profile = window.PontEngine.fundingProfile({ status: "no_visa", parentCountries: [], colleges: [] }, data());
      const funders = data().colleges.colleges.filter((c) => {
        const pc = profile.colleges.find((x) => x.collegeId === c.id);
        return c.status === "verified" && pc && pc.needBased.open === true && pc.meetsFullNeed;
      });
      const steps = [
        ["target", "Tell us your dream", "Your dream school, your country and your situation. A few questions, no login."],
        ["door-open", "See the aid doors open to you", "Which colleges give aid to your profile, with the official rule and the date we checked it."],
        ["route", "Follow your routes", "Your dream, colleges with strong aid for you, and lower-cost paths, in your family's currency."],
        ["file-check-2", "Prepare your documents", "AI reads and translates your family's papers. We convert the amounts to USD."],
      ];
      const fundCards = funders.map((c) => {
        const ui = U.collegeUi(c);
        const src = (c.sources || []).find((s) => s.id === (c.aid.intl_need_based_aid || {}).source) || (c.sources || [])[0];
        return `<article class="card fund-card">
          <div class="name"><div class="mono m-aid" aria-hidden="true">${U.esc(ui.mono)}</div><div><h3>${U.esc(c.name)}</h3><div class="city">${U.esc(c.city || "")}</div></div></div>
          ${U.tagsHtml(U.policyTags(c, "intl"), true)}
          ${U.sourceLine(src)}
          <button type="button" class="btn btn-outline btn-sm" data-dream="${U.esc(c.id)}">Start with ${U.esc(ui.short)}</button>
        </article>`;
      }).join("");
      return `
      <div class="welcome">
        <section class="welcome-hero" aria-labelledby="screen-title">
          <div class="welcome-copy">
            <p class="eyebrow">${U.icon("sparkles")}AI funding advisor for international students</p>
            <h1 id="screen-title" tabindex="-1">Tell us your dream school. We find the scholarships to get you there.</h1>
            <p class="screen-lead">Scholarships, financial aid and the documents you need, in your family's currency. Powered by AI. No login needed.</p>
            <form class="dream-search" id="dream-search" novalidate>
              <div class="ds-field">
                <label for="ds-college">Dream school</label>
                <select id="ds-college" required aria-describedby="ds-error">
                  <option value="">Choose one</option>
                  ${opts.map((o) => `<option value="${U.esc(o.value)}">${U.esc(o.long)}</option>`).join("")}
                </select>
              </div>
              <div class="ds-field">
                <label for="ds-country">Your family's country</label>
                <select id="ds-country">
                  <option value="">Choose one</option>
                  ${countryOpts().map((o) => `<option value="${U.esc(o.value)}">${U.esc(o.label)}</option>`).join("")}
                </select>
              </div>
              <button type="submit" class="btn btn-primary">${U.icon("search")}Find my scholarships</button>
              <p class="ds-error" id="ds-error" role="alert"></p>
            </form>
            <div class="popular"><span class="small muted">Popular:</span>
              ${popular.map((o) => `<button type="button" class="chip" data-dream="${U.esc(o.value)}">${U.esc(o.label)}</button>`).join("")}
            </div>
            <p class="small muted privacy">${U.icon("lock")}Your answers stay only in this browser tab and are cleared when the tab closes.</p>
            <p><button type="button" class="btn btn-link" data-intake="start">Start without a school ${U.icon("arrow-right")}</button></p>
          </div>
          <div class="welcome-preview">${previewHtml()}</div>
        </section>

        <section class="how" aria-labelledby="how-title" id="how">
          <h2 id="how-title">How Pont works</h2>
          <ol class="how-steps">${steps.map((s, i) => `<li class="card"><div class="tile t-primary">${U.icon(s[0])}</div><span class="how-n">Step ${i + 1}</span><h3>${U.esc(s[1])}</h3><p>${U.esc(s[2])}</p></li>`).join("")}</ol>
        </section>

        <section class="funders" aria-labelledby="fund-title" id="funders">
          <h2 id="fund-title">Colleges that fund international students</h2>
          <p class="muted">Need-based aid for international students that meets full need, from each college's official page.</p>
          <div class="fund-grid">${fundCards || `<div class="empty">No college in our data yet.</div>`}</div>
        </section>

        <p class="source-note">${U.icon("badge-check")}Every amount and aid rule in Pont comes from the colleges' official pages, with the date we checked it. College data checked ${U.esc(U.fullDate(data().colleges.checked_on))}. Missing data shows "Not confirmed" with the official link. Pont is a prototype and never promises aid or admission.</p>
      </div>`;
    }

    // A composed preview of the dashboard, built by the engine from Harvard's published rule (example profile).
    function previewHtml() {
      try {
        const ex = { status: "no_visa", passports: ["IN"], parentCountries: ["IN"], colleges: [{ collegeId: "harvard", programId: "undeclared" }],
          area: "any", term: "fall-2027", incomeBand: "under_65k", currency: "INR" };
        if (!collegeById("harvard")) return "";
        const r = window.PontEngine.routes(ex, data(), { fxRate: null, today: app.todayIso() });
        const ctx = { currency: "USD", rate: null, audience: r.profile.audience };
        const dreamItem = r.groups[0].items[0];
        const strong = r.groups[1].items[0];
        return `<figure class="preview" aria-labelledby="preview-cap">
          <div class="preview-cards" inert aria-hidden="true">
            ${U.dreamHero(dreamItem, collegeById("harvard"), ctx, {})}
            ${strong ? U.collegeCard(strong, collegeById(strong.collegeId), "strong_aid", ctx) : ""}
          </div>
          <figcaption id="preview-cap" class="small muted">Example plan: a student from India, family income under $65,000, dreaming of Harvard. Built from Harvard's published aid rule.</figcaption>
        </figure>`;
      } catch (e) {
        return "";
      }
    }

    /* ================= 2. Chat ================= */
    const chat = () => st.intakeChat;
    function pushMsg(m) { st.intakeChat.push(m); app.saveChat(); }
    function ensureQuestion(prefix) {
      const a = A();
      const f = current(a);
      const last = chat()[chat().length - 1];
      if (!f) {
        if (!last || last.field !== "_done") pushMsg({ role: "ai", field: "_done", text: scripts().done || "That is everything I need." });
        return;
      }
      if (last && last.role === "ai" && last.field === f.id) return;
      pushMsg({ role: "ai", field: f.id, text: (prefix ? prefix + " " : "") + f.q(a) });
    }
    function openChat() {
      if (!chat().length) {
        const a = A();
        const named = (a.colleges || [])[0];
        const open = named && scripts().opening_college
          ? scripts().opening_college.replace("{college}", U.collegeUi(collegeById(named.collegeId)).short)
          : scripts().opening || "Hi, I am your Pont advisor.";
        pushMsg({ role: "ai", field: "_open", text: open });
      }
      if (!st.intakeTyping) ensureQuestion(); // while an answer is being read, the next question waits for it
    }

    function chipsHtml(f) {
      const a = A();
      if (!f) return `<div class="chat-done"><button type="button" class="btn btn-primary" data-intake="confirm">${U.icon("list-checks")}Check my answers</button></div>`;
      const help = f.help ? `<p class="chat-help small muted">${U.esc(f.help)}</p>` : "";
      const skip = !f.required && f.id !== "incomeBand" ? `<button type="button" class="chip chip-quiet" data-skip="${f.id}">Skip</button>` : "";
      if (f.kind === "single") {
        return `${help}<div class="chips" role="group" aria-label="Quick answers">${f.options(a).map((o) => `<button type="button" class="chip" data-pick="${U.esc(o.value)}">${U.esc(o.label)}</button>`).join("")}${skip}</div>`;
      }
      if (f.kind === "multi") {
        const sel = st.pick[f.id] || (f.value ? f.value(a) : a[f.id]) || [];
        st.pick[f.id] = sel.slice();
        return `${help}<div class="chips" role="group" aria-label="Pick one or more">${f.options(a).map((o) => `<button type="button" class="chip chip-toggle" data-toggle="${U.esc(o.value)}" aria-pressed="${sel.includes(o.value)}">${sel.includes(o.value) ? U.icon("check") : ""}${U.esc(o.label)}</button>`).join("")}</div>
          <div class="chat-done"><button type="button" class="btn btn-primary btn-sm" data-pick-done="${f.id}"${sel.length ? "" : " disabled"}>Continue</button></div>`;
      }
      return `${help}${skip ? `<div class="chips">${skip}</div>` : ""}`;
    }

    function chatHtml() {
      const a = A();
      const f = current(a);
      const vis = visible(a);
      const pos = f ? vis.indexOf(f) + 1 : vis.length;
      const inputType = f && f.kind === "number" ? ` inputmode="decimal"` : "";
      const placeholder = !f ? "All set" : f.kind === "number" ? `Amount per month in ${currencyOf(a)}` : f.kind === "text" ? "Type your answer" : "Type your answer or pick one above";
      return `<div class="intake-grid">
        <section class="card chat" aria-labelledby="screen-title">
          <div class="chat-head">
            <div class="tile t-ink"><svg width="22" height="14" viewBox="0 0 64 40" aria-hidden="true"><path d="M8 32 Q32 0 56 32" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="56" cy="32" r="7" fill="#F5B740"/></svg></div>
            <div><h1 id="screen-title" tabindex="-1">Your funding plan starts here</h1>${statusPill()}</div>
            <span class="chat-step small muted">Step ${pos} of ${vis.length}</span>
          </div>
          <div class="msgs chat-msgs" id="chat-msgs" role="log" aria-live="polite">
            ${chat().map((m) => U.message(m)).join("")}${st.intakeTyping ? U.typing("The advisor is reading your answer") : ""}
          </div>
          <div class="chat-chips" id="chat-chips">${st.intakeTyping ? "" : chipsHtml(f)}</div>
          <div class="composer">
            ${consentNote()}
            <form class="compose" id="chat-compose">
              <label for="chat-input" class="sr-only">Your answer</label>
              <input id="chat-input" autocomplete="off"${inputType} placeholder="${U.esc(placeholder)}"${!f || st.intakeTyping ? " disabled" : ""}>
              ${st.intakeTyping ? `<button type="button" class="btn btn-link stop" data-intake="stop">Stop</button>` : ""}
              <button type="submit" class="send" aria-label="Send"${!f || st.intakeTyping ? " disabled" : ""}>${U.icon("arrow-up")}</button>
            </form>
            <p class="ai-label">${U.icon("info")}<span>${U.esc((data() && data().scripts.advisor.ai_label) || "")}</span></p>
          </div>
        </section>
        <aside class="card profile-sum" aria-labelledby="sum-title">
          <div class="card-head"><div class="tile t-dream">${U.icon("user-round")}</div><h2 id="sum-title">Your profile</h2></div>
          <dl class="sum-list">${summaryRows(a, false)}</dl>
          <p class="small muted">${U.icon("lock")}Stays only in this browser tab.</p>
          <div class="sum-actions">
            ${requiredComplete(a) ? `<button type="button" class="btn btn-primary btn-sm" data-intake="confirm">Check my answers</button>` : ""}
            <button type="button" class="btn btn-link" data-intake="form">Use a form instead</button>
          </div>
        </aside>
      </div>`;
    }

    // Offline reading of free text: exact names only (a country, a term, a status label), a first
    // name, or a number. Anything else is "not understood". Never guesses.
    function localRead(f, text) {
      const t = text.trim();
      const low = t.toLowerCase();
      if (!f) return {};
      if (f.kind === "text") return t.split(/\s+/).length <= 2 && f.valid(t) ? { [f.id]: t } : {};
      if (f.kind === "number") {
        if (!/^[^\d]*\d[\d.,\s]*[^\d]*$/.test(t)) return {};
        const n = Number(t.replace(/[^\d]/g, ""));
        return f.valid(n) ? { [f.id]: n } : {};
      }
      const words = (s) => new RegExp("(^|[^\\p{L}])" + s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^\\p{L}])", "u");
      const hits = f.options(A()).filter((o) => [o.label, o.long].filter(Boolean).some((l) => words(l).test(low)));
      if (f.kind === "single") return hits.length === 1 ? { [f.id]: hits[0].value } : {};
      return hits.length ? { [f.id]: hits.map((h) => h.value) } : {};
    }

    function applyAll(values) {
      let n = 0;
      FIELDS.forEach((f) => {
        if (!has(values, f.id)) return;
        if (f.visible && !f.visible(A())) return;
        if (!f.valid(values[f.id])) return;
        setAnswer(f, values[f.id]);
        n += 1;
      });
      st.pick = {};
      return n;
    }

    let ctl = null;
    async function sendText(text) {
      const a = A();
      const f = current(a);
      if (!f || !text) return;
      pushMsg({ role: "me", text });
      const notUnderstood = scripts().not_understood || "I could not read that. Pick an answer below, or use the form instead.";

      // Live: the intake interviewer reads the text. Offline: exact names only.
      const fields = visible(a).map((x) => ({
        id: x.id, question: x.q(a), required: x.required, answered: answered(x, a),
        allowed: x.options ? x.options(a).map((o) => ({ value: o.value, label: o.long || o.label })) : x.rule,
        multiple: x.kind === "multi",
      }));
      const allowed = {};
      visible(a).forEach((x) => { allowed[x.id] = x.valid; });
      const so = {};
      visible(a).forEach((x) => { if (answered(x, a)) so[x.id] = x.show(a) || "skipped"; });
      const built = P.intake({ fields, allowed, answers: so, history: chat().slice(-9, -1), message: text });

      st.intakeTyping = true;
      ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      app.render(false, { keepFocus: true });
      const res = await app.ai.ask(built, {
        signal: ctl ? ctl.signal : undefined,
        cache: false,
        fallback: () => ({ answers: localRead(f, text), reply: null, nextField: null, unclear: false }),
      });
      st.intakeTyping = false;
      ctl = null;
      if (res.cancelled) { app.render(false, { focusId: "chat-input" }); return; }

      const got = res.data || { answers: {} };
      const n = applyAll(got.answers || {});
      const next = current(A());
      if (!n) {
        if (res.live && got.reply) pushMsg({ role: "ai", field: f.id, text: got.reply, live: true });
        else pushMsg({ role: "ai", field: f.id, text: notUnderstood, offline: res.offline, banner: res.offline ? AI.COPY.offline : null });
      } else if (res.live && got.reply && next && got.nextField === next.id) {
        pushMsg({ role: "ai", field: next.id, text: got.reply, live: true });
      } else {
        ensureQuestion(scripts().ack || "Got it.");
      }
      ensureQuestion();
      app.render(false, { focusId: "chat-input" });
    }

    function pickSingle(value) {
      const f = current(A());
      if (!f) return;
      const opt = f.options(A()).find((o) => o.value === value);
      if (!opt) return;
      pushMsg({ role: "me", text: opt.label });
      setAnswer(f, value);
      ensureQuestion();
      app.render(false, { focusId: "chat-input" });
    }
    function pickDone(id) {
      const f = field(id);
      const sel = st.pick[id] || [];
      if (!f || !f.valid(sel)) return;
      pushMsg({ role: "me", text: U.listText(sel.map((v) => (f.options(A()).find((o) => o.value === v) || {}).label || v)) });
      setAnswer(f, sel);
      st.pick = {};
      ensureQuestion();
      app.render(false, { focusId: "chat-input" });
    }
    function skip(id) {
      const f = field(id);
      if (!f || f.required) return;
      pushMsg({ role: "me", text: "Skip" });
      setAnswer(f, null);
      ensureQuestion();
      app.render(false, { focusId: "chat-input" });
    }

    /* ================= Form (one question per screen) ================= */
    function formHtml() {
      const a = A();
      const vis = visible(a);
      let f = field(st.step);
      if (!f || !vis.includes(f)) f = current(a) || vis[0];
      st.step = f.id;
      const i = vis.indexOf(f);
      const err = `<p class="form-error" id="form-error" role="alert"></p>`;
      let control = "";
      if (f.kind === "single" || f.kind === "multi") {
        const type = f.kind === "single" ? "radio" : "checkbox";
        const cur = f.value ? f.value(a) : a[f.id];
        const isOn = (v) => (Array.isArray(cur) ? cur.includes(v) : cur === v);
        control = `<fieldset class="options" aria-describedby="form-error${f.help ? " form-help" : ""}">
          <legend class="sr-only">${U.esc(f.q(a))}</legend>
          ${f.options(a).map((o, k) => `<label class="option" for="opt-${k}"><input type="${type}" id="opt-${k}" name="opt" value="${U.esc(o.value)}"${isOn(o.value) ? " checked" : ""}><span>${U.esc(o.long || o.label)}</span></label>`).join("")}
        </fieldset>`;
      } else if (f.kind === "text") {
        control = `<div class="field"><label for="opt-text">First name</label><input id="opt-text" autocomplete="given-name" maxlength="40" value="${U.esc(a.name || "")}" aria-describedby="form-error"></div>`;
      } else {
        control = `<div class="field"><label for="opt-num">Amount per month, in ${U.esc(currencyOf(a))}</label><input id="opt-num" inputmode="decimal" value="${a.monthly > 0 ? U.esc(String(a.monthly)) : ""}" aria-describedby="form-error"></div>`;
      }
      return `<form class="intake-card" id="form-step" novalidate>
        <h1 id="screen-title" tabindex="-1">${U.esc(f.q(a))}</h1>
        ${f.help ? `<p class="screen-lead" id="form-help">${U.esc(f.help)}</p>` : ""}
        <div class="screen-body">${control}${err}</div>
        <div class="intake-foot">
          <button type="button" class="btn btn-outline" data-intake="back">Back</button>
          <span class="spacer"></span>
          ${f.required ? "" : `<button type="button" class="btn btn-link" data-skip-form="${f.id}">Skip</button>`}
          <button type="submit" class="btn btn-primary">${st.returnTo === "confirm" ? "Save" : i === vis.length - 1 ? "Check my answers" : "Continue"}</button>
        </div>
        <p class="small form-links"><button type="button" class="btn btn-link" data-intake="chat">Back to the chat</button></p>
      </form>`;
    }

    function readForm(f) {
      if (f.kind === "single") { const el = document.querySelector('#form-step input[name="opt"]:checked'); return el ? el.value : null; }
      if (f.kind === "multi") return Array.from(document.querySelectorAll('#form-step input[name="opt"]:checked')).map((el) => el.value);
      if (f.kind === "text") return $("opt-text").value.trim();
      const raw = $("opt-num").value.trim();
      return raw ? Number(raw.replace(/[^\d]/g, "")) : null;
    }
    const ERR = { single: "Choose an answer to continue.", multi: "Choose at least one to continue.", text: "Use letters only, up to 40.", number: "Enter an amount in numbers, or skip." };
    function nextFormStep(fromId) {
      const a = A();
      if (st.returnTo === "confirm" && requiredComplete(a)) { st.returnTo = null; return go("confirm"); }
      const vis = visible(a);
      const i = vis.findIndex((f) => f.id === fromId);
      const missing = vis.slice(i + 1).find((f) => !answered(f, a)) || (st.returnTo ? null : vis[i + 1]);
      if (missing) return go("form", missing.id);
      return requiredComplete(a) ? go("confirm") : go("form", firstMissing(a).id);
    }
    function submitForm() {
      const f = field(st.step);
      const v = readForm(f);
      const empty = v === null || v === "" || (Array.isArray(v) && !v.length);
      if (empty && !f.required) { setAnswer(f, null); return nextFormStep(f.id); }
      if (empty || !f.valid(v)) {
        $("form-error").textContent = ERR[f.kind];
        const first = document.querySelector("#form-step input");
        if (first) first.focus();
        return;
      }
      setAnswer(f, v);
      nextFormStep(f.id);
    }
    function formBack() {
      if (st.returnTo === "confirm") { st.returnTo = null; return go("confirm"); }
      const vis = visible(A());
      const i = vis.findIndex((f) => f.id === st.step);
      if (i <= 0) return go("welcome");
      go("form", vis[i - 1].id);
    }

    /* ================= 3. Profile confirm ================= */
    function confirmHtml() {
      const a = A();
      return `<div class="intake-card confirm">
        <h1 id="screen-title" tabindex="-1">Here is what we understood. Edit anything that is wrong.</h1>
        <dl class="sum-list confirm-list">${summaryRows(a, true)}</dl>
        <p class="small muted">${U.icon("lock")}Your answers stay only in this browser tab and are cleared when the tab closes.</p>
        <div class="intake-foot">
          <button type="button" class="btn btn-outline" data-intake="chat">Back to the chat</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-primary" data-intake="build">${U.icon("sparkles")}Build my funding plan</button>
        </div>
      </div>`;
    }

    /* ================= Navigation and render ================= */
    function go(screen, step) {
      st.screen = screen;
      st.step = step || null;
      app.saveScreen();
      app.render(true);
    }

    // Reload guard: a screen that needs answers the tab does not have opens the first missing step.
    function guard() {
      if (!data()) return;
      const a = A();
      if (st.screen === "confirm" && !requiredComplete(a)) { st.screen = "form"; st.step = firstMissing(a).id; app.saveScreen(); }
      if (st.screen === "form" && st.step && !visible(a).some((f) => f.id === st.step)) st.step = (current(a) || visible(a)[0]).id;
      if (!["welcome", "chat", "form", "confirm"].includes(st.screen)) st.screen = "welcome";
    }

    function headActions() {
      const a = A();
      if (st.screen === "welcome") {
        return `<nav class="welcome-nav" aria-label="Welcome"><a href="#how">How it works</a><a href="#funders">Colleges</a>
          <button type="button" class="btn btn-primary btn-sm" data-intake="start">Start</button></nav>`;
      }
      const vis = visible(a);
      let progress = "";
      if (st.screen === "form") {
        const i = vis.findIndex((f) => f.id === st.step);
        progress = `<div class="intake-progress"><span>Question ${i + 1} of ${vis.length}</span><div class="progress" aria-hidden="true"><span style="width:${((i + 1) / vis.length) * 100}%"></span></div></div>`;
      } else if (st.screen === "chat") {
        const done = vis.filter((f) => answered(f, a)).length;
        progress = `<div class="intake-progress" aria-hidden="true"><div class="progress"><span style="width:${(done / vis.length) * 100}%"></span></div></div>`;
      }
      return `${progress}<button type="button" class="btn btn-link start-over" data-intake="over">Start over</button>`;
    }

    function render(moveFocus, opts) {
      opts = opts || {};
      guard();
      $("intake").hidden = false;
      $("shell").hidden = true;
      $("fab").hidden = true;
      const screen = $("screen");
      if (!data()) {
        // Data still loading (a reload): a quiet skeleton, nothing that needs the college list yet.
        $("intake-actions").innerHTML = "";
        screen.className = "intake-screen";
        screen.innerHTML = `<div aria-busy="true" aria-label="Loading"><div class="skel skel-big"></div><div class="skel skel-line"></div><div class="skel skel-line" style="width:60%"></div></div>`;
        return;
      }
      $("intake-actions").innerHTML = headActions();
      // A background re-render (a rate arriving) keeps what the student is typing.
      const active = document.activeElement && document.activeElement.id;
      const draft = $("chat-input") ? $("chat-input").value : "";
      screen.className = "intake-screen is-" + st.screen;
      if (st.screen === "chat") openChat();
      screen.innerHTML = st.screen === "chat" ? chatHtml() : st.screen === "form" ? formHtml() : st.screen === "confirm" ? confirmHtml() : welcomeHtml();
      const titles = { welcome: "Pont", chat: "Your profile | Pont", confirm: "Check your answers | Pont" };
      document.title = st.screen === "form" ? `${field(st.step).q(A())} | Pont` : titles[st.screen];
      app.icons();
      const m = $("chat-msgs");
      if (m) m.scrollTop = m.scrollHeight;
      if (moveFocus) { window.scrollTo(0, 0); const t = $("screen-title"); if (t) t.focus(); return; }
      if (opts.focusId && $(opts.focusId) && !$(opts.focusId).disabled) { $(opts.focusId).focus(); return; }
      if (draft && $("chat-input") && !$("chat-input").disabled) $("chat-input").value = draft;
      if (active && $(active) && !$(active).disabled) $(active).focus();
    }

    /* ---------- Events (inside the intake only) ---------- */
    $("intake").addEventListener("click", (e) => {
      const t = e.target.closest("[data-intake],[data-dream],[data-pick],[data-toggle],[data-pick-done],[data-skip],[data-skip-form],[data-edit]");
      if (!t) return;
      const act = t.dataset.intake;
      if (act === "start") { go("chat"); }
      if (act === "chat") { st.returnTo = null; go("chat"); }
      if (act === "form") { const f = current(A()); go("form", f ? f.id : visible(A())[0].id); }
      if (act === "confirm") go(requiredComplete(A()) ? "confirm" : "chat");
      if (act === "back") formBack();
      if (act === "over") app.startOver();
      if (act === "stop" && ctl) ctl.abort();
      if (act === "build") {
        if (!requiredComplete(A())) return go("form", firstMissing(A()).id);
        app.finish();
      }
      if (t.dataset.dream) {
        const f = field("colleges");
        setAnswer(f, [t.dataset.dream]);
        go("chat");
      }
      if (t.dataset.pick !== undefined) pickSingle(t.dataset.pick);
      if (t.dataset.toggle !== undefined) {
        const f = current(A());
        const sel = st.pick[f.id] || [];
        const v = t.dataset.toggle;
        st.pick[f.id] = sel.includes(v) ? sel.filter((x) => x !== v) : sel.concat([v]);
        $("chat-chips").innerHTML = chipsHtml(f);
        app.icons();
        const again = document.querySelector(`#chat-chips [data-toggle="${CSS.escape(v)}"]`);
        if (again) again.focus();
      }
      if (t.dataset.pickDone) pickDone(t.dataset.pickDone);
      if (t.dataset.skip) skip(t.dataset.skip);
      if (t.dataset.skipForm) { setAnswer(field(t.dataset.skipForm), null); nextFormStep(t.dataset.skipForm); }
      if (t.dataset.edit) { st.returnTo = "confirm"; go("form", t.dataset.edit); }
    });

    $("intake").addEventListener("submit", (e) => {
      e.preventDefault();
      if (e.target.id === "dream-search") {
        const college = $("ds-college").value;
        const country = $("ds-country").value;
        if (!college) {
          $("ds-error").textContent = "Choose a dream school, or pick one of the popular ones.";
          $("ds-college").focus();
          return;
        }
        setAnswer(field("colleges"), [college]);
        if (country) setAnswer(field("parentCountries"), [country]);
        go("chat");
      }
      if (e.target.id === "chat-compose") {
        const input = $("chat-input");
        const text = input.value.trim().slice(0, 800);
        input.value = "";
        sendText(text);
      }
      if (e.target.id === "form-step") submitForm();
    });

    return { render, requiredComplete, firstMissing, visible, FIELDS, STATUS, TERMS, localRead, current };
  }

  window.PontIntake = { create };
})();
