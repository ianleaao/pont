#!/usr/bin/env node
/*
  Refreshes the exchange-rate snapshot in data/fx.json (docs/ai.md, docs/publish.md).

  Run before each publish as a claude.ai Artifact, from the project folder:
    node tools/fx-snapshot.mjs

  Inside the Artifact the page cannot reach external APIs, so js/fx.js uses this snapshot.
  For every currency in data/countries.json (except USD) it reads Frankfurter v2:
    https://api.frankfurter.dev/v2/rate/usd/{cur}  ->  { date, base, quote, rate }
  and writes data/fx.json "snapshot" with the source, the date of each rate and the day it ran.
  A currency Frankfurter does not answer is listed in "missing" and stays "Not confirmed".
  The official fallbacks in "rates" (BRL PTAX, INR FBIL) are kept untouched.
  Needs Node 18 or later (built-in fetch). No dependencies, no API key.
*/
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FX = join(root, "data", "fx.json");
const COUNTRIES = join(root, "data", "countries.json");
const URL_TEMPLATE = "https://api.frankfurter.dev/v2/rate/usd/{cur}";
const TIMEOUT_MS = 10000;

const today = () => new Date().toISOString().slice(0, 10);

async function rateFor(cur) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL_TEMPLATE.replace("{cur}", cur.toLowerCase()), { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const ok = j && String(j.quote).toUpperCase() === cur && String(j.base).toUpperCase() === "USD"
      && typeof j.rate === "number" && isFinite(j.rate) && j.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(j.date);
    if (!ok) throw new Error("unexpected answer " + JSON.stringify(j));
    return { rate: j.rate, date: j.date };
  } finally {
    clearTimeout(timer);
  }
}

const countries = JSON.parse(await readFile(COUNTRIES, "utf8")).countries;
const currencies = [...new Set(Object.values(countries).map((c) => c.currency).filter((c) => c && c !== "USD"))].sort();

const rates = {};
const missing = [];
for (const cur of currencies) {
  try {
    rates[cur] = await rateFor(cur);
    console.log(`${cur}  ${rates[cur].rate}  (${rates[cur].date})`);
  } catch (e) {
    missing.push(cur);
    console.warn(`${cur}  not confirmed: ${e.message}`);
  }
}

const fx = JSON.parse(await readFile(FX, "utf8"));
// A run that could not reach Frankfurter never replaces a good snapshot.
if (!Object.keys(rates).length) {
  console.error("No rate fetched: data/fx.json is unchanged (snapshot from " + ((fx.snapshot && fx.snapshot.fetched_on) || "never") + ").");
  process.exit(1);
}
// A currency that failed this time keeps its previous rate, with that rate's own date.
const previous = (fx.snapshot && fx.snapshot.rates) || {};
missing.slice().forEach((cur) => {
  if (previous[cur]) { rates[cur] = previous[cur]; missing.splice(missing.indexOf(cur), 1); console.warn(`${cur}  kept the previous rate from ${previous[cur].date}`); }
});
fx.note = "Exchange rates without the network. js/fx.js tries a live rate first (Frankfurter v2, then ExchangeRate-API); when both fail (always inside the claude.ai Artifact, whose network is blocked) it uses the snapshot below, then the official fallback in 'rates', with the message 'Could not update the exchange rate. Using the rate from DATE.' The snapshot is refreshed before each publish by tools/fx-snapshot.mjs. A currency in neither shows 'Not confirmed'. tests.html uses fixed rates so tests never change.";
fx.snapshot = {
  source: "Frankfurter (central bank data), snapshot",
  url: URL_TEMPLATE,
  credit_url: "https://frankfurter.dev",
  fetched_on: today(),
  tool: "tools/fx-snapshot.mjs",
  rates,
  missing,
};
await writeFile(FX, JSON.stringify(fx, null, 2) + "\n", "utf8");
console.log(`data/fx.json snapshot: ${Object.keys(rates).length} rates, ${missing.length} missing.`);
