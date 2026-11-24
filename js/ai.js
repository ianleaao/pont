/*
  Pont AI client (docs/ai.md). Picks the provider at runtime:

  1. Live: inside the claude.ai Artifact, `claude.use("sample")` resolves a function that calls Claude
     on the VIEWER's own Claude account (no API key, no proxy). It is asked once, without blocking the
     first render: it may resolve late, or resolve null (about 10 s when no viewer answers).
  2. Scripted: anywhere else (Live Server, tests), or when a live call fails (not_granted, rate_limited,
     invalid JSON, an answer that breaks its JSON shape, or the sample function not ready in time).
     The caller's scripted answer comes back with offline: true and the UI shows the offline banner.

  Rules:
  - Calls happen only on a viewer action (the app calls ask() from click and submit handlers).
  - No retry loops. A failed call falls back once. not_granted and the other "hide" codes switch the
    client to scripted answers for the rest of the page view.
  - No timer on a call itself: the platform ends over-long calls (upstream_error) and a page timer
    would also count the time the viewer spends on the consent dialog. The only wait we cap is the
    wait for claude.use("sample") to resolve (useTimeoutMs).
  - Every live answer is validated against the function's JSON shape before it is shown. Numbers in
    the text must appear in the data the prompt sent (the AI never does math, CLAUDE.md rule 1).

  Works in the browser (window.PontAI) and in Node (module.exports) for tests.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PontAI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COPY = {
    live: "Live, powered by Claude",
    sample: "Sample answers",
    consent: "Pont uses your Claude account to answer. Allow it when Claude asks.",
    offline: "AI is offline. Showing a prepared answer.",
    label: "Written by AI. Check the source.",
    translation: "Working translation, not certified.",
    essayDeclined: "I can help you plan and review your ideas, but I can't write your essay. Colleges require it to be your own work.",
  };
  const USE_TIMEOUT_MS = 3000;
  const MODEL_TIER = "default";
  // Codes that mean "this view cannot use Claude": stop asking for the rest of the view.
  const HIDE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "session_expired"];
  const FUNCTIONS = ["advisor", "intake", "funding", "routes", "document", "drafts", "essay", "family"];

  /* ---------- Text checks ---------- */
  // Never show the long dash (CLAUDE.md rule 8).
  const LONG_DASH = new RegExp("\\s*\\u2014\\s*", "g");
  const RANGE_DASH = new RegExp("(\\d)\\s*\\u2013\\s*(\\d)", "g");
  const EN_DASH = new RegExp("\\u2013", "g");
  const clean = (s) => String(s).replace(LONG_DASH, ", ").replace(RANGE_DASH, "$1 to $2").replace(EN_DASH, "-").trim();
  const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= (max || 2000);
  const CONF = ["high", "medium", "low"];
  // "pt" and "pt-BR" are the same language for a draft or a summary.
  const sameLang = (a, b) => typeof a === "string" && typeof b === "string" && a.split("-")[0].toLowerCase() === b.split("-")[0].toLowerCase();

  // Every number written in the answer must exist in the data the prompt sent.
  // "$31,514" and "31514" are the same number; small counts (0 to 12) are always allowed.
  const numberTokens = (s) => (String(s).match(/\d[\d.,   ]*\d|\d/g) || [])
    .map((t) => t.replace(/[^\d]/g, "")).filter((t) => t.length > 0);
  function groundedIn(dataText) {
    const known = new Set(numberTokens(dataText));
    return (text) => numberTokens(text).every((t) => known.has(t) || (t.length <= 2 && +t <= 12));
  }

  // Account, ID and card numbers are removed (docs/ai.md guardrails): digit groups joined by spaces,
  // dots, hyphens or slashes with 11 or more digits in total (card numbers, CPF, IBAN-like), or 8 or
  // more digits in a row. Dates and amounts (up to 10 digits, for example 1.500.000.000 VND) stay.
  const scrubIds = (s) => String(s)
    .replace(/\d+(?:[ ./-]\d+)+/g, (m) => (m.replace(/\D/g, "").length >= 11 ? "[number removed]" : m))
    .replace(/\d{8,}/g, "[number removed]");

  /* ---------- Shapes: one validator per function. Returns the cleaned answer or null. ---------- */
  const sourcesOk = (list, ctx) => Array.isArray(list) && list.every((id) => typeof id === "string" && (!ctx.sourceIds || ctx.sourceIds.includes(id)));

  const SHAPES = {
    // Advisor rail: one answer about the student's plan.
    advisor(v, ctx, ok) {
      if (!v || !isText(v.answer, 1500) || !CONF.includes(v.confidence) || !sourcesOk(v.sources || [], ctx)) return null;
      if (!ok(v.answer)) return null;
      return { answer: clean(v.answer), sources: v.sources || [], confidence: v.confidence };
    },

    // Intake interviewer: structured answers checked against the allowed values. Unclear or
    // low-confidence values are dropped, never guessed (docs/ai.md function 1).
    intake(v, ctx) {
      if (!v || !isText(v.reply, 600) || typeof v.answers !== "object" || v.answers === null || Array.isArray(v.answers)) return null;
      const allowed = ctx.allowed || {};
      const answers = {};
      const dropped = [];
      Object.keys(v.answers).forEach((field) => {
        const a = v.answers[field];
        const check = allowed[field];
        const value = a && typeof a === "object" && "value" in a ? a.value : undefined;
        const conf = a && a.confidence;
        const okValue = typeof check === "function" ? check(value) : Array.isArray(check) && check.includes(value);
        if (check && okValue && (conf === "high" || conf === "medium")) answers[field] = value;
        else dropped.push(field);
      });
      const next = typeof v.next_field === "string" && Object.prototype.hasOwnProperty.call(allowed, v.next_field) ? v.next_field : null;
      return { reply: clean(v.reply), answers, dropped, nextField: next, unclear: v.unclear === true || dropped.length > 0 };
    },

    // Funding explainer: one plain explanation per college the prompt sent.
    funding(v, ctx, ok) {
      if (!v || !Array.isArray(v.explanations) || !v.explanations.length || !CONF.includes(v.confidence)) return null;
      const ids = ctx.collegeIds || [];
      const good = v.explanations.every((x) => x && ids.includes(x.college_id) && isText(x.text, 900) && ok(x.text) && sourcesOk(x.sources || [], ctx));
      if (!good) return null;
      return { explanations: v.explanations.map((x) => ({ collegeId: x.college_id, text: clean(x.text), sources: x.sources || [] })), confidence: v.confidence };
    },

    // Routes explainer: one line per route; suggestions when no route closes the gap.
    routes(v, ctx, ok) {
      if (!v || !Array.isArray(v.routes)) return null;
      const ids = ctx.routeIds || [];
      const good = v.routes.every((x) => x && ids.includes(x.route_id) && isText(x.reason, 300) && ok(x.reason));
      const sug = Array.isArray(v.suggestions) ? v.suggestions : [];
      if (!good || !sug.every((s) => isText(s, 300) && ok(s))) return null;
      return { routes: v.routes.map((x) => ({ routeId: x.route_id, reason: clean(x.reason) })), suggestions: sug.map(clean) };
    },

    // Document reader (vision): fields with confidence, working translation, flags. ID and account numbers dropped.
    document(v, ctx) {
      if (!v || typeof v !== "object") return null;
      if (v.unreadable === true) return { unreadable: true, fields: [], translation: "", flags: [], confidence: "low" };
      if (!Array.isArray(v.fields) || !CONF.includes(v.confidence) || typeof v.translation !== "string" || !Array.isArray(v.flags)) return null;
      const FIELD = ["holder", "date", "currency", "balance", "income", "issuer", "language", "pages"];
      const fieldsOk = v.fields.every((f) => f && FIELD.includes(f.name) && (typeof f.value === "string" || typeof f.value === "number") && CONF.includes(f.confidence));
      const rules = ctx.ruleIds || [];
      const flagsOk = v.flags.every((f) => f && (rules.includes(f.rule) || f.rule === "other") && isText(f.text, 400));
      if (!fieldsOk || !flagsOk || v.translation.length > 6000) return null;
      return {
        unreadable: false,
        fields: v.fields.map((f) => ({ name: f.name, value: typeof f.value === "string" ? scrubIds(f.value) : f.value, confidence: f.confidence })),
        translation: scrubIds(clean(v.translation)),
        flags: v.flags.map((f) => ({ rule: f.rule, text: clean(f.text) })),
        confidence: v.confidence,
      };
    },

    // Drafts: bank letter request in the family language, message to the aid office in English.
    drafts(v, ctx, ok) {
      if (!v || !Array.isArray(v.drafts) || !v.drafts.length) return null;
      const langOk = (l) => sameLang(l, "en") || (ctx.language && sameLang(l, ctx.language));
      const good = v.drafts.every((d) => d && ["bank_letter", "aid_office"].includes(d.kind) && langOk(d.language) && isText(d.text, 3000) && ok(d.text));
      if (!good) return null;
      return {
        drafts: v.drafts.map((d) => ({ kind: d.kind, language: sameLang(d.language, ctx.language) ? ctx.language : "en", text: scrubIds(clean(d.text)) })),
        note: isText(v.note, 400) ? clean(v.note) : null,
      };
    },

    // Essay coach: suggestions only. A request to write the essay shows the fixed decline message.
    essay(v) {
      if (!v || typeof v.declined !== "boolean") return null;
      if (v.declined) return { declined: true, message: COPY.essayDeclined, suggestions: [] };
      const TYPES = ["highlight", "cut", "english", "structure"];
      if (!Array.isArray(v.suggestions) || !v.suggestions.length || !v.suggestions.every((s) => s && TYPES.includes(s.type) && isText(s.text, 500))) return null;
      return { declined: false, message: null, suggestions: v.suggestions.map((s) => ({ type: s.type, text: clean(s.text) })) };
    },

    // Family mode: summary in the family language and currency, next three steps.
    family(v, ctx, ok) {
      if (!v || !sameLang(v.language, ctx.language) || !isText(v.summary, 1500) || !ok(v.summary)) return null;
      if (!Array.isArray(v.steps) || v.steps.length !== 3 || !v.steps.every((s) => isText(s, 300) && ok(s))) return null;
      const kept = Array.isArray(v.kept_terms) ? v.kept_terms.filter((k) => k && isText(k.term, 80) && isText(k.explanation, 300)) : [];
      return { language: ctx.language, summary: clean(v.summary), steps: v.steps.map(clean), keptTerms: kept.map((k) => ({ term: k.term, explanation: clean(k.explanation) })) };
    },
  };

  // validate("advisor", value, context) -> cleaned answer or null.
  function validate(fn, value, ctx) {
    const shape = SHAPES[fn];
    if (!shape) return null;
    ctx = ctx || {};
    const ok = ctx.dataText !== undefined ? groundedIn(ctx.dataText) : () => true;
    try {
      return shape(value, ctx, ok);
    } catch (e) {
      return null;
    }
  }

  /* ---------- Client ---------- */
  /*
    createClient({ claude, useTimeoutMs, onStatus }) -> client
    client.status()   "pending" (waiting for the runtime), "live" or "offline"
    client.consentPending()   true until the first live call (the UI shows COPY.consent)
    client.ask(built, { fallback, images, signal, cache }) -> Promise<{ data, offline, live, reason }>
      built: from js/prompts.js, { fn, input, context }
      fallback: the scripted answer (object) or a function returning it; used whenever live fails.
  */
  function createClient(opts) {
    opts = opts || {};
    const claude = opts.claude;
    const useTimeoutMs = typeof opts.useTimeoutMs === "number" ? opts.useTimeoutMs : USE_TIMEOUT_MS;
    let status = "pending";
    let reason = null;
    let sample = null;
    let liveCalls = 0;

    const setStatus = (s, why) => {
      const changed = s !== status;
      status = s;
      reason = why || null;
      if (changed && typeof opts.onStatus === "function") {
        try { opts.onStatus(status, reason); } catch (e) { /* UI errors never break the client */ }
      }
    };

    let ready;
    if (claude && typeof claude.use === "function") {
      ready = Promise.resolve()
        .then(() => claude.use("sample"))
        .then((fn) => {
          if (typeof fn === "function" && typeof fn.json === "function") {
            sample = fn;
            if (status !== "offline") setStatus("live");
          } else setStatus("offline", "unavailable");
          return sample;
        }, () => { setStatus("offline", "unavailable"); return null; });
    } else {
      status = "offline";
      reason = "no_runtime";
      ready = Promise.resolve(null);
    }

    // Waits for the sample function only up to useTimeoutMs. The first render never waits.
    function waitSample() {
      if (status !== "pending") return Promise.resolve(status === "live" ? sample : null);
      let timer;
      const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), useTimeoutMs); });
      return Promise.race([ready, late]).then((fn) => { clearTimeout(timer); return status === "live" ? fn : null; });
    }

    async function ask(built, o) {
      o = o || {};
      const fn = built && built.fn;
      if (!FUNCTIONS.includes(fn)) throw new Error("Unknown AI function: " + fn);
      const fallback = (why) => {
        const data = typeof o.fallback === "function" ? o.fallback(why) : o.fallback || null;
        return { data, offline: true, live: false, reason: why };
      };

      const s = await waitSample();
      if (!s) return fallback(status === "pending" ? "timeout" : reason || "unavailable");

      if (o.images) {
        const lim = await Promise.resolve().then(() => s.limits()).catch(() => null);
        if (!lim || !lim.images) return fallback("images_unavailable");
      }

      const callOpts = { modelTier: MODEL_TIER };
      if (o.signal) callOpts.signal = o.signal;
      if (o.images) callOpts.images = o.images;
      if (o.cache !== undefined) callOpts.cache = o.cache;

      let raw;
      try {
        liveCalls += 1;
        raw = await s.json(built.input, callOpts);
      } catch (e) {
        const code = (e && typeof e.code === "string" && e.code) || "upstream_error";
        if (HIDE.includes(code)) { sample = null; setStatus("offline", code); }
        const out = fallback(code);
        if (code === "cancelled") out.cancelled = true;
        return out;
      }
      const data = validate(fn, raw, built.context);
      if (!data) return fallback("invalid_shape");
      return { data, offline: false, live: true, reason: null };
    }

    return {
      ask,
      ready: () => ready,
      status: () => status,
      reason: () => reason,
      consentPending: () => status === "live" && liveCalls === 0,
      statusText: () => (status === "live" ? COPY.live : COPY.sample),
    };
  }

  return { createClient, validate, groundedIn, numberTokens, scrubIds, clean, COPY, FUNCTIONS, USE_TIMEOUT_MS };
});
