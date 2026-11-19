/*
  Pont exchange rates and money formatting (docs/funding-and-currency.md section 6).
  This is NOT part of the pure engine: the engine receives rates as input.

  Rates: fetched per currency, once per session, only after the family country
  is known. Never at startup. USD needs no rate.
    1. Frankfurter v2 (central bank data): /v2/rate/usd/{cur}
    2. ExchangeRate-API open endpoint (credit link required by its terms)
    3. data/fx.json: the Frankfurter snapshot (every currency, refreshed before each publish by
       tools/fx-snapshot.mjs), then the official fallback (BRL PTAX), with a visible notice
    4. Nothing left: status "not_confirmed"
  Time budget: 5 seconds per currency, then the fallback.
  options.offline skips 1 and 2 (inside the claude.ai Artifact external requests are blocked).

  Format: each currency in its own country's locale (data/countries.json),
  USD always en-US. Totals without cents. Rates with 2 decimals below 1,000
  and none at 1,000 and above (VND, NGN, COP, KRW). Shown in two lines.

  Works in the browser (window.PontFx) and in Node (module.exports) for tests.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PontFx = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TIMEOUT_MS = 5000;
  const STORAGE_PREFIX = "pont.fx.";
  const FRANKFURTER = { label: "Frankfurter (central bank data)", url: "https://frankfurter.dev" };

  const COPY = {
    updating: "Updating the exchange rate...",
    fallback: "Could not update the exchange rate. Using the rate from DATE.",
    notConfirmed: "Could not get an exchange rate for CUR. Not confirmed.",
    erCredit: "Rates By Exchange Rate API",
  };

  /* ---------- Locales from data/countries.json ---------- */
  // currency -> { locale, display }. USD is always en-US.
  let currencyFormats = { USD: { locale: "en-US", display: "symbol" } };

  function configure(countriesJson) {
    const map = { USD: { locale: "en-US", display: "symbol" } };
    const countries = (countriesJson && countriesJson.countries) || {};
    Object.keys(countries).forEach((code) => {
      const c = countries[code];
      if (c.currency && !map[c.currency]) {
        map[c.currency] = { locale: c.locale || "en-US", display: c.currency_display || "symbol" };
      }
    });
    currencyFormats = map;
  }

  const formatOf = (currency) => currencyFormats[currency] || { locale: "en-US", display: "code" };

  // Family currencies, without duplicates and without USD:
  // familyCurrencies(["IN", "US"], countries) -> ["INR"]; (["BR", "IN"]) -> ["BRL", "INR"]
  function familyCurrencies(countryCodes, countriesJson) {
    const countries = (countriesJson && countriesJson.countries) || {};
    const out = [];
    (countryCodes || []).forEach((code) => {
      const c = countries[code];
      if (c && c.currency && c.currency !== "USD" && out.indexOf(c.currency) < 0) out.push(c.currency);
    });
    return out;
  }

  /* ---------- Formatting ---------- */
  // "2026-11-09" -> "Nov 9, 2026" (read as a calendar date, no time zone shift)
  function formatDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US",
      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  // Totals without cents: (315109.84, "USD") -> "$315,110"; (36202, "BRL") -> "R$ 36.202"
  function formatMoney(amount, currency, options) {
    const digits = (options && options.digits) || 0;
    const f = formatOf(currency);
    return new Intl.NumberFormat(f.locale, {
      style: "currency", currency, currencyDisplay: f.display,
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(amount);
  }

  // 2 decimals below 1,000; none at 1,000 and above.
  const rateDigits = (rate) => (rate >= 1000 ? 0 : 2);
  const formatRate = (rate, currency) => formatMoney(rate, currency, { digits: rateDigits(rate) });

  /*
    The two lines shown in the header and next to every family-currency amount:
      value:  "1 USD = R$ 5,55"
      source: "Source: Frankfurter (central bank data), Nov 10, 2026"
    source.url is set when the source must be a link (ExchangeRate-API credit).
    When no rate exists: value is null and notice says "Not confirmed".
  */
  function rateLines(info) {
    if (!info || info.status === "not_confirmed" || !(info.rate > 0)) {
      return { value: null, source: null, notice: info && info.notice, officialUrl: info && info.sourceUrl };
    }
    const credit = info.credit;
    const name = credit ? credit.text : info.sourceLabel;
    const date = formatDate(info.rateDate);
    return {
      value: "1 USD = " + formatRate(info.rate, info.currency),
      source: { name, url: credit ? credit.url : null, date, text: "Source: " + name + ", " + date },
      notice: info.notice || null,
    };
  }

  // Plain text version of rateLines (for copy and for the AI layer).
  function label(info) {
    const l = rateLines(info);
    return l.value ? l.value + "\n" + l.source.text : l.notice || "";
  }

  /* ---------- Session cache ---------- */
  function readCache(currency) {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + currency);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(info) {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + info.currency, JSON.stringify(info));
    } catch (e) {
      /* storage blocked: the rate still works for this page view */
    }
  }

  /* ---------- Sources ---------- */
  async function fetchJson(url, ms) {
    if (ms <= 0) throw new Error("No time left");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const validRate = (r) => typeof r === "number" && isFinite(r) && r > 0;

  // Returns { date, base, quote, rate }; rate = units of the currency per 1 USD.
  async function fromFrankfurter(currency, ms) {
    const j = await fetchJson("https://api.frankfurter.dev/v2/rate/usd/" + currency.toLowerCase(), ms);
    if (!j || String(j.quote).toUpperCase() !== currency || !validRate(j.rate)) throw new Error("Frankfurter: no rate");
    return { rate: j.rate, rateDate: j.date, source: "frankfurter", sourceLabel: FRANKFURTER.label,
      sourceUrl: FRANKFURTER.url, credit: null };
  }

  async function fromExchangeRateApi(currency, ms) {
    const j = await fetchJson("https://open.er-api.com/v6/latest/USD", ms);
    const rate = j && j.result === "success" && j.rates && j.rates[currency];
    if (!validRate(rate)) throw new Error("ExchangeRate-API: no rate");
    const rateDate = new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10);
    return { rate, rateDate, source: "exchangerate-api", sourceLabel: "ExchangeRate-API",
      sourceUrl: "https://www.exchangerate-api.com",
      credit: { text: COPY.erCredit, url: "https://www.exchangerate-api.com" } };
  }

  // Fallback file: the snapshot first (newer, same source as the live rate), then the official rate.
  // A currency in neither returns status "not_confirmed".
  async function fromFile(currency, fxJsonUrl, json) {
    let r = null;
    let snap = null;
    try {
      const j = json || await (await fetch(fxJsonUrl, { cache: "no-store" })).json();
      r = j.rates && j.rates[currency];
      snap = j.snapshot && j.snapshot.rates && j.snapshot.rates[currency] ? j.snapshot : null;
    } catch (e) {
      console.warn("[Pont fx] fallback file unavailable", e.message);
    }
    if (snap && validRate(snap.rates[currency].rate)) {
      const s = snap.rates[currency];
      return { rate: s.rate, rateDate: s.date, source: "snapshot", sourceLabel: snap.source, sourceUrl: snap.credit_url,
        credit: null, fallback: true, notice: COPY.fallback.replace("DATE", formatDate(s.date)) };
    }
    if (r && validRate(r.rate)) {
      return { rate: r.rate, rateDate: r.set_on, source: "fallback", sourceLabel: r.source, sourceUrl: r.url,
        credit: null, fallback: true, notice: COPY.fallback.replace("DATE", formatDate(r.set_on)) };
    }
    return { rate: null, rateDate: null, source: "none", sourceLabel: null, sourceUrl: (r && r.url) || null,
      credit: null, fallback: true, status: "not_confirmed", notice: COPY.notConfirmed.replace("CUR", currency) };
  }

  /* ---------- Public API ---------- */
  /*
    getRate(currency, options) -> { currency, rate, rateDate, fetchedAt, source, sourceLabel,
      sourceUrl, credit, fallback, notice, status }
    status: "ok" or "not_confirmed". options: { fxJsonUrl, onStatus(message) }
    There is no default currency: call it only once the family country is known.
  */
  async function getRate(currency, options) {
    if (!currency) throw new Error("getRate needs a currency. Fetch only after the family country is known.");
    currency = String(currency).toUpperCase();
    options = options || {};
    if (currency === "USD") {
      return { currency, rate: 1, rateDate: null, fetchedAt: null, source: "none", sourceLabel: null,
        sourceUrl: null, credit: null, fallback: false, notice: null, status: "ok" };
    }
    const cached = readCache(currency);
    if (cached) return cached;

    if (options.onStatus) options.onStatus(COPY.updating);
    const deadline = Date.now() + TIMEOUT_MS;
    const left = () => deadline - Date.now();

    let info = null;
    for (const attempt of options.offline ? [] : [fromFrankfurter, fromExchangeRateApi]) {
      try {
        info = await attempt(currency, left());
        break;
      } catch (e) {
        console.warn("[Pont fx]", currency, e.message);
      }
    }
    if (!info) info = await fromFile(currency, options.fxJsonUrl || "data/fx.json");

    info = Object.assign({ fallback: false, notice: null, status: "ok" }, info,
      { currency, fetchedAt: new Date().toISOString() });
    writeCache(info);
    return info;
  }

  // Two-currency families: one request per currency, in parallel. Returns { BRL: info, INR: info }.
  async function getRates(currencies, options) {
    const list = [];
    (currencies || []).forEach((c) => {
      const cur = String(c).toUpperCase();
      if (cur !== "USD" && list.indexOf(cur) < 0) list.push(cur);
    });
    const infos = await Promise.all(list.map((c) => getRate(c, options)));
    const out = {};
    list.forEach((c, i) => { out[c] = infos[i]; });
    return out;
  }

  return { configure, familyCurrencies, getRate, getRates, rateLines, label, formatMoney, formatRate,
    rateDigits, formatDate, fromFile, COPY, TIMEOUT_MS };
});
