/*
  Pont exchange rate loader (browser only; this is NOT part of the pure engine).
  Once per session, before any family-currency amount is shown:
    1. Frankfurter (ECB data)
    2. ExchangeRate-API open endpoint (credit link required by its terms)
    3. Fallback: data/fx.json (BCB PTAX sell rate) with a visible notice
  Total time budget: 5 seconds, then the fallback.
  The engine receives the rate as input; it never fetches anything.
*/
(function (root) {
  "use strict";

  const TIMEOUT_MS = 5000;
  const STORAGE_PREFIX = "pont.fx.";

  const COPY = {
    updating: "Updating the exchange rate...",
    fallback: "Could not update the exchange rate. Using the rate from DATE.",
    erCredit: "Rates By Exchange Rate API",
  };

  const SYMBOLS = { BRL: "R$", INR: "₹" };

  // "2026-11-09" -> "Nov 9, 2026" (read as a calendar date, no time zone shift)
  function formatDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US",
      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  // "1 USD = R$ 5.5146 · Frankfurter · rate from Nov 9, 2026"
  function label(info) {
    const sym = SYMBOLS[info.currency] || info.currency;
    return "1 USD = " + sym + " " + info.rate.toFixed(4) + " · " + info.sourceLabel + " · rate from " + formatDate(info.rateDate);
  }

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

  async function fromFrankfurter(currency, ms) {
    const j = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=" + currency, ms);
    const rate = j && j.rates && j.rates[currency];
    if (!validRate(rate)) throw new Error("Frankfurter: no rate");
    return { rate, rateDate: j.date, source: "frankfurter", sourceLabel: "Frankfurter",
      sourceUrl: "https://www.frankfurter.app", credit: null };
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

  async function fromFile(currency, fxJsonUrl) {
    const res = await fetch(fxJsonUrl, { cache: "no-store" });
    const j = await res.json();
    const r = j.rates && j.rates[currency];
    if (!r || !validRate(r.rate)) throw new Error("No fallback rate for " + currency);
    return { rate: r.rate, rateDate: r.set_on, source: "fallback", sourceLabel: r.source, sourceUrl: r.url,
      credit: null, fallback: true, notice: COPY.fallback.replace("DATE", formatDate(r.set_on)) };
  }

  /*
    Returns { currency, rate, rateDate, fetchedAt, source, sourceLabel, sourceUrl, credit, fallback, notice }.
    options: { fxJsonUrl, onStatus(message) }
  */
  async function getRate(currency, options) {
    currency = currency || "BRL";
    options = options || {};
    const cached = readCache(currency);
    if (cached) return cached;

    if (options.onStatus) options.onStatus(COPY.updating);
    const deadline = Date.now() + TIMEOUT_MS;
    const left = () => deadline - Date.now();

    let info = null;
    for (const attempt of [fromFrankfurter, fromExchangeRateApi]) {
      try {
        info = await attempt(currency, left());
        break;
      } catch (e) {
        console.warn("[Pont fx]", e.message);
      }
    }
    if (!info) info = await fromFile(currency, options.fxJsonUrl || "data/fx.json");

    info = Object.assign({ fallback: false, notice: null }, info, { currency, fetchedAt: new Date().toISOString() });
    writeCache(info);
    return info;
  }

  // Currencies offered in the prototype (INR is hidden).
  const visibleCurrencies = (fxJson) =>
    Object.keys(fxJson.rates).filter((c) => !fxJson.rates[c].hidden);

  root.PontFx = { getRate, label, formatDate, visibleCurrencies, COPY, TIMEOUT_MS };
})(window);
