/*
  Pont app shell: screens, navigation, answers, header rate.
  No math here: every amount comes from js/engine.js (CLAUDE.md rule 1).

  Answers live only in this browser tab (sessionStorage). They are never sent
  to or saved on a server, and they are cleared when the tab closes.
  No income, savings, SSN, account numbers or immigration documents are stored.

  Demo shortcuts (nothing visible in the UI):
    index.html?demo=lucas  and  index.html?demo=ian
  They replace any saved session, open the last onboarding question
  and then remove ?demo from the address bar.
*/
(function () {
  "use strict";

  const KEY_ANSWERS = "pont.answers";
  const KEY_SCREEN = "pont.screen";

  /* ---------- Demo answers (CLAUDE.md, "Demo paths") ---------- */
  const DEMOS = {
    lucas: {
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

  /* ---------- Storage ---------- */
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
    } catch (e) {
      /* storage blocked: the app still works for this page view */
    }
  }
  function clearAnswers() {
    try {
      sessionStorage.removeItem(KEY_ANSWERS);
      sessionStorage.removeItem(KEY_SCREEN);
    } catch (e) { /* nothing to clear */ }
  }

  /* ---------- State ---------- */
  const state = {
    answers: load(KEY_ANSWERS, {}),
    screen: load(KEY_SCREEN, "welcome"),
    countries: null,  // data/countries.json
    rates: {},        // currency -> rate info from PontFx.getRate, once ready
    ratePromises: {}, // currency -> promise, shared by every screen that needs it
    fxStatus: null,   // "Updating the exchange rate..." while waiting
  };

  function setAnswer(key, value) {
    state.answers[key] = value;
    save(KEY_ANSWERS, state.answers);
  }

  /*
    Screens, in order (docs/screens.md). Item c builds the skeletons:
    title and helper copy only. Item d adds each question and its check.
      question: counted by the progress bar (screens 2 to 7b)
      skip:     shows the Skip button (7b only)
      valid:    can Continue be used
  */
  const SCREENS = [
    {
      id: "welcome",
      question: false,
      title: "See the real cost of studying in the U.S.",
      body: () => `
        <p class="screen-lead">In your family's currency, with a clear plan. No login needed.</p>
        <p class="small muted">Answers are never sent to or saved on a server. They stay only in this browser tab and are cleared when the tab closes.</p>`,
      next: "Start",
      valid: () => true,
    },
    {
      id: "area",
      question: true,
      title: "What do you want to study?",
      body: () => `
        <p class="screen-lead">Bachelor's degree in Texas. More levels and states are coming.</p>
        ${skeleton("Area options")}`,
      valid: () => true,
    },
    {
      id: "college",
      question: true,
      title: "Which colleges are you thinking about?",
      body: () => skeleton("College and program options"),
      valid: () => true,
    },
    {
      id: "nationality",
      question: true,
      title: "Which passport or passports do you have?",
      body: () => skeleton("Passport options"),
      valid: () => true,
    },
    {
      id: "status",
      question: true,
      title: "What is your situation in the U.S. today?",
      body: () => skeleton("Six situations from docs/visa-and-fees.md"),
      valid: () => true,
    },
    {
      id: "start",
      question: true,
      title: "When do you want to start?",
      body: () => skeleton("Fall 2027, Spring 2028, Fall 2028"),
      valid: () => true,
    },
    {
      id: "currency",
      question: true,
      title: "Which currency does your family use?",
      body: () => skeleton("BRL and USD"),
      valid: () => true,
    },
    {
      id: "monthly",
      question: true,
      title: "How much could your family pay per month?",
      body: () => `
        <p class="screen-lead">Optional. It helps us sort colleges. You can skip it.</p>
        ${skeleton("Monthly amount field")}`,
      skip: true,
      valid: () => true,
    },
    {
      id: "results",
      question: false,
      title: "Your colleges",
      body: () => skeleton("Results list"),
      final: true,
      valid: () => true,
    },
  ];

  const QUESTIONS = SCREENS.filter((s) => s.question);
  const indexOf = (id) => SCREENS.findIndex((s) => s.id === id);

  // Placeholder block for item c. Item d replaces each one with the real question.
  function skeleton(what) {
    return `<div class="screen-skeleton">${what}. Built in step d.</div>`;
  }

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    rate: $("app-rate"),
    progress: $("app-progress"),
    progressText: $("progress-text"),
    progressFill: $("progress-fill"),
    screen: $("screen"),
    nav: $("app-nav"),
    back: $("btn-back"),
    skip: $("btn-skip"),
    next: $("btn-next"),
    startOver: $("btn-start-over"),
  };

  /* ---------- Header: exchange rate in two lines, per family currency ---------- */
  // Family currencies come from the parents' countries of income. USD families get none.
  const familyCurrencies = () =>
    typeof PontFx === "undefined" || !state.countries ? []
      : PontFx.familyCurrencies(state.answers.parentCountries, state.countries);

  function renderRate() {
    const currencies = familyCurrencies();
    if (!currencies.length) {
      el.rate.innerHTML = "";
      return;
    }
    el.rate.innerHTML = currencies.map((cur) => {
      const info = state.rates[cur];
      if (!info) return state.fxStatus ? `<p class="rate-source">${esc(state.fxStatus)}</p>` : "";
      const l = PontFx.rateLines(info);
      if (!l.value) {
        const link = l.officialUrl ? ` <a href="${esc(l.officialUrl)}" target="_blank" rel="noopener">Official rate</a>` : "";
        return `<div class="rate"><span class="rate-notice">${esc(l.notice)}${link}</span></div>`;
      }
      const name = l.source.url
        ? `<a href="${esc(l.source.url)}" target="_blank" rel="noopener">${esc(l.source.name)}</a>`
        : esc(l.source.name);
      return `
        <div class="rate">
          <span class="rate-value">${esc(l.value)}</span>
          <span class="rate-source">Source: ${name}, ${esc(l.source.date)}</span>
          ${l.notice ? `<span class="rate-notice">${esc(l.notice)}</span>` : ""}
        </div>`;
    }).join("");
  }

  // Rates are fetched only after the family country is known, once per currency per session
  // (docs/funding-and-currency.md section 6). Never at startup.
  function ensureRates() {
    familyCurrencies().forEach((cur) => {
      if (state.ratePromises[cur]) return;
      state.ratePromises[cur] = PontFx.getRate(cur, {
        fxJsonUrl: "data/fx.json",
        onStatus: (msg) => { state.fxStatus = msg; renderRate(); },
      }).then((info) => {
        state.rates[cur] = info;
        state.fxStatus = null;
        renderRate();
        return info;
      }).catch((e) => {
        console.error("[Pont] exchange rate unavailable", cur, e);
        state.fxStatus = null;
        renderRate();
        return null;
      });
    });
  }

  // Local data file, not a rate: needed to map countries to currencies and locales.
  function loadCountries() {
    return fetch("data/countries.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        state.countries = json;
        if (typeof PontFx !== "undefined") PontFx.configure(json);
      })
      .catch((e) => console.error("[Pont] could not load data/countries.json", e));
  }

  /* ---------- Screens ---------- */
  function go(id, options) {
    if (indexOf(id) < 0) id = "welcome";
    state.screen = id;
    save(KEY_SCREEN, id);
    render(options && options.focus !== false);
  }

  function render(moveFocus) {
    const i = indexOf(state.screen);
    const s = SCREENS[i];

    el.screen.innerHTML = `
      <h1 id="screen-title" tabindex="-1">${esc(s.title)}</h1>
      <div class="screen-body">${s.body(state.answers)}</div>`;

    // Progress: questions only (2 to 7b). Hidden on the welcome screen and after the last question.
    const q = QUESTIONS.indexOf(s);
    el.progress.hidden = q < 0;
    if (q >= 0) {
      const n = q + 1;
      el.progressText.textContent = `Question ${n} of ${QUESTIONS.length}`;
      el.progressFill.style.width = (n / QUESTIONS.length) * 100 + "%";
    }

    // Footer buttons
    el.back.hidden = i === 0;
    el.next.hidden = !!s.final;
    el.next.textContent = s.next || "Continue";
    el.next.disabled = !s.valid(state.answers);
    el.skip.hidden = !s.skip;
    el.nav.classList.toggle("app-nav--single", i === 0);
    el.startOver.hidden = i === 0;

    document.title = i === 0 ? "Pont" : `${s.title} | Pont`;
    ensureRates();
    renderRate();
    if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });

    if (moveFocus) {
      window.scrollTo(0, 0);
      $("screen-title").focus();
    }
  }

  function next() {
    const i = indexOf(state.screen);
    if (!SCREENS[i].valid(state.answers)) return;
    go(SCREENS[Math.min(i + 1, SCREENS.length - 1)].id);
  }

  function back() {
    const i = indexOf(state.screen);
    go(SCREENS[Math.max(i - 1, 0)].id);
  }

  function skip() {
    setAnswer("monthly", null);
    next();
  }

  function startOver() {
    clearAnswers();
    state.answers = {};
    go("welcome"); // rates already fetched stay cached: one request per currency per session
  }

  /* ---------- Demo shortcuts ---------- */
  function applyDemo() {
    const params = new URLSearchParams(location.search);
    const name = params.get("demo");
    if (!name || !DEMOS[name]) return false;

    // The shortcut replaces any saved session, with no message on screen.
    clearAnswers();
    state.answers = JSON.parse(JSON.stringify(DEMOS[name]));
    save(KEY_ANSWERS, state.answers);
    state.screen = QUESTIONS[QUESTIONS.length - 1].id;
    save(KEY_SCREEN, state.screen);

    params.delete("demo");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    return true;
  }

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Start ---------- */
  el.next.addEventListener("click", next);
  el.back.addEventListener("click", back);
  el.skip.addEventListener("click", skip);
  el.startOver.addEventListener("click", startOver);

  applyDemo();
  if (indexOf(state.screen) < 0) state.screen = "welcome";
  render(false);
  loadCountries().then(() => render(false));

  // For later steps and for checks in the console. Read only.
  window.PontApp = {
    get answers() { return JSON.parse(JSON.stringify(state.answers)); },
    get screen() { return state.screen; },
    get rates() { return Object.assign({}, state.rates); },
    ratesReady: () => Promise.all(Object.values(state.ratePromises)),
  };
})();
