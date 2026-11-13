/*
  Pont exchange rate loader (browser only; this is NOT part of the pure engine).
  Once per session, before any family-currency amount is shown:
    1. Frankfurter (ECB data)
    2. ExchangeRate-API open endpoint (credit link required by its terms)
    3. Fallback: data/fx.json (BCB PTAX sell rate) with a visible notice
  Total time budget: 5 seconds, then the fallback.
  The engine receives the rate as input; it never fetches anything.
  Display: each currency in its own country's format (USD en-US, BRL pt-BR),
  totals without cents, the rate with 2 decimals, shown in two lines.
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

  // Each currency in its own country's format (docs/brand.md, "Money and exchange rate format").
  const LOCALES = { USD: "en-US", BRL: "pt-BR", INR: "en-IN" };
  const localeOf = (currency) => LOCALES[currency] || "en-US";

  // "2026-11-09" -> "Nov 9, 2026" (read as a calendar date, no time zone shift)
  function formatDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US",
      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  // Totals without cents: formatMoney(315109.84, "USD") -> "$315,110"; (36202, "BRL") -> "R$ 36.202"
  function formatMoney(amount, currency, options) {
    const digits = (options && options.digits) || 0;
    return new Intl.NumberFormat(localeOf(currency), {
      style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(amount);
  }

  // The rate always has 2 decimals: 5.5146 BRL -> "R$ 5,51"
  const formatRate = (rate, currency) => formatMoney(rate, currency, { digits: 2 });

  /*
    The two lines shown in the header and next to every family-currency amount:
      value:  "1 USD = R$ 5,55"
      source: "Source: Frankfurter, Nov 10, 2026"
    source.url is set when the source must be a link (ExchangeRate-API credit).
  */
  function rateLines(info) {
    const credit = info.credit;
    const name = credit ? credit.text : info.sourceLabel;
    const date = formatDate(info.rateDate);
    return {
      value: "1 USD = " + formatRate(info.rate, info.currency),
      source: { name, url: credit ? credit.url : null, date, text: "Source: " + name + ", " + date },
      notice: info.notice || null,
    };
  }

  // Plain text version of rateLines, one line each (for copy and for the AI layer).
  function label(info) {
    const l = rateLines(info);
    return l.value + "\n" + l.source.text;
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
    const j = await fetchJson("https://api.frankfurter.dev/v1/latest?from=USD&to=" + currency, ms);
    const rate = j && j.rates && j.rates[currency];
    if (!validRate(rate)) throw new Error("Frankfurter: no rate");
    return { rate, rateDate: j.date, source: "frankfurter", sourceLabel: "Frankfurter",
      sourceUrl: "https://frankfurter.dev", credit: null };
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
    // USD families: rate 1, nothing to fetch.
    if (currency === "USD") {
      return { currency, rate: 1, rateDate: null, fetchedAt: null, source: "none", sourceLabel: null,
        sourceUrl: null, credit: null, fallback: false, notice: null };
    }
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

  root.PontFx = { getRate, rateLines, label, formatMoney, formatRate, formatDate, visibleCurrencies, COPY, TIMEOUT_MS };
})(window);
