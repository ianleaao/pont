/*
  Pont UI components (visual design v4 "Campus", docs/design-campus.md).
  HTML string renderers shared by index.html (js/app.js) and components.html.
  No math and no data rules here: every amount comes from js/engine.js. This file only formats and lays out.
*/
(function (root) {
  "use strict";

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const icon = (name, cls) => `<i data-lucide="${name}" class="icon${cls ? " " + cls : ""}" aria-hidden="true"></i>`;
  const ext = (url, text, cls) => url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ""}>${esc(text)}</a>`
    : esc(text);

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthDay = (iso) => MONTHS[+iso.slice(5, 7) - 1] + " " + (+iso.slice(8, 10));
  const fullDate = (iso) => monthDay(iso) + ", " + iso.slice(0, 4);
  const termLabel = (t) => (t ? t.replace(/^(\w)(\w*)-(\d{4})$/, (m, a, b, y) => a.toUpperCase() + b + " " + y) : "");

  // Logo symbol: arch over a deck; left dot = the family's country, right dot = the U.S.
  function logoSvg(opts) {
    const o = opts || {};
    const stroke = o.light ? "#FFFFFF" : "#111A35";
    return `<svg viewBox="0 0 64 40" aria-hidden="true"${o.size ? ` width="${o.size}"` : ""}><path d="M8 32 Q32 0 56 32" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round"/><line x1="8" y1="32" x2="56" y2="32" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="32" r="6" fill="#2747C9"/><circle cx="56" cy="32" r="6" fill="#F5B740"/></svg>`;
  }

  /* ---------- Money in the selected currency ---------- */
  // ctx: { currency: "USD" | family currency, rate: family units per 1 USD or null }
  function money(usd, ctx) {
    if (usd === null || usd === undefined || isNaN(usd)) return "Not confirmed";
    const F = root.PontFx;
    if (ctx && ctx.currency && ctx.currency !== "USD" && ctx.rate > 0) return F.formatMoney(usd * ctx.rate, ctx.currency);
    return F ? F.formatMoney(usd, "USD") : "$" + Math.round(usd).toLocaleString("en-US");
  }
  const usd = (n) => money(n, null);

  /* ---------- College identity: no logos or photos, a band and a monogram ---------- */
  const COLLEGE_UI = {
    harvard: { short: "Harvard", mono: "H" },
    mit: { short: "MIT", mono: "MIT" },
    amherst: { short: "Amherst", mono: "A" },
    "ut-austin": { short: "UT Austin", mono: "UT" },
    acc: { short: "ACC", mono: "ACC" },
  };
  function collegeUi(c) {
    if (COLLEGE_UI[c.id]) return COLLEGE_UI[c.id];
    const words = c.name.split(/\s+/).filter((w) => !/^(the|of|at|and)$/i.test(w));
    return { short: c.name, mono: words.slice(0, 3).map((w) => w[0]).join("").toUpperCase() };
  }

  /* ---------- Route groups: color always with the name and the icon ---------- */
  const GROUP_UI = {
    dream: { icon: "sparkles", tone: "dream" },
    strong_aid: { icon: "hand-coins", tone: "aid" },
    lower_cost: { icon: "piggy-bank", tone: "lower" },
  };

  // 6. Route group column header
  function groupHeader(group) {
    const g = GROUP_UI[group.id];
    return `<div class="col-head"><div class="tile tile-sm t-${g.tone}">${icon(g.icon)}</div>${esc(group.label)} <span class="col-count">${group.items.length}</span></div>`;
  }

  /* ---------- 8. Policy tag chips (from the aid block) ---------- */
  function policyTags(college, audience, short) {
    const a = college.aid;
    if (!a) return [];
    const v = (k) => (a[k] ? a[k].value : null);
    const tags = [];
    const intl = audience !== "us";
    if (v("intl_admission_policy") === "need_blind") tags.push(short ? "Need-blind" : intl ? "Need-blind for internationals" : "Need-blind");
    if (v("intl_admission_policy") === "not_applicable") tags.push("Open admission");
    if (v("meets_full_need_intl") === true) tags.push(short ? "Full need" : "Meets 100% of need");
    if (intl && v("intl_need_based_aid") === false) tags.push(short ? "Merit only" : "Merit scholarships only for internationals");
    if (v("merit_aid_intl") === "none") tags.push(short ? "No merit aid" : "No merit aid, all need-based");
    if (v("merit_aid_intl") === "yes") tags.push(short ? "Merit aid" : "Merit scholarships");
    if (!intl && a.forms_us && (a.forms_us.value || []).includes("fafsa")) tags.push("FAFSA");
    return tags;
  }
  const tagsHtml = (list, small) => list.length
    ? `<div class="tags">${list.map((t) => `<span class="tag${small ? " tag-sm" : ""}">${esc(t)}</span>`).join("")}</div>` : "";

  /* ---------- 7. Gap label, always with its to-confirm line ---------- */
  const LABELS = {
    Funded: { cls: "funded", icon: "circle-check" },
    "Small gap": { cls: "small-gap", icon: "contrast" },
    Gap: { cls: "gap", icon: "circle-alert" },
  };
  function gapLabel(name, small) {
    const l = LABELS[name];
    return `<span class="label ${l.cls}${small ? " label-sm" : ""}">${icon(l.icon)}${esc(name)}</span>`;
  }
  function gapBlock(gap, small) {
    if (!gap || !gap.label) return "";
    return `${gapLabel(gap.label, small)}${gap.note ? `<p class="confirm-line">${esc(gap.note)}</p>` : ""}`;
  }

  /* ---------- 13. Source line ---------- */
  function sourceLine(src, extra) {
    if (!src) return "";
    const date = src.checked_on ? `, checked ${fullDate(src.checked_on)}` : "";
    return `<p class="source">Source: ${ext(src.url, src.label)}${date}.${extra ? " " + esc(extra) : ""}</p>`;
  }

  /* ---------- Helpers on engine results ---------- */
  const estimatePerYear = (net) => (net.atMost ? net.averagePerYear.max : net.averagePerYear.mid);
  const listText = (arr, word) => arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " " + (word || "and") + " " + arr[arr.length - 1];
  function netSource(item) {
    const n = item.netPrice;
    if (n.threshold) return n.threshold.source;
    if (n.method === "full_cost" && n.sources && n.sources[0]) return n.sources[0];
    return n.aidPage;
  }

  /* ---------- 4. Funding bar with its legend ---------- */
  // bar: PontEngine.fundingBar(). legend: { aid, family, gap, not_confirmed } texts.
  function fundingBar(bar, legend) {
    if (!bar) return "";
    const cls = { aid: "seg-aid", family: "seg-family", gap: "seg-gap", not_confirmed: "seg-tbc" };
    const label = bar.segments.map((s) => legend[s.id]).filter(Boolean).join(". ");
    return `<div class="bar" role="img" aria-label="${esc(label)}">${bar.segments.map((s) =>
      `<span class="${cls[s.id]}" style="flex:${(s.share * 100).toFixed(2)} 0 0"></span>`).join("")}</div>
      <div class="legend">${bar.segments.map((s) =>
        `<span><i class="dot ${cls[s.id]}"></i>${esc(legend[s.id])}</span>`).join("")}</div>`;
  }

  function barLegend(item, college, bar, ctx) {
    const n = item.netPrice;
    const ui = collegeUi(college);
    const out = {};
    if (!bar) return out;
    bar.segments.forEach((s) => {
      if (s.id === "aid") {
        if (n.threshold && n.threshold.rule === "parent_contribution_zero") {
          const coa = college.cost_of_attendance_2026_27 && college.cost_of_attendance_2026_27.total;
          const coaText = coa ? (coa.min === coa.max ? money(coa.min, ctx) : money(coa.min, ctx) + " to " + money(coa.max, ctx)) : null;
          out.aid = `Parent contribution: ${money(0, ctx)} under ${ui.short}'s rule.` + (coaText ? ` Cost of attendance ${coaText} a year (2026-27).` : "");
        } else {
          out.aid = `Aid: at least tuition, ${money(s.amount, ctx)} a year on average`;
        }
      }
      if (s.id === "family") {
        if (n.threshold && n.threshold.rule === "parent_contribution_zero") out.family = `Your family: visa fees, ${money(n.total.mid, ctx)} once`;
        else if (bar.segments.some((x) => x.id === "gap")) out.family = `Your family can cover ${money(s.amount, ctx)} a year`;
        else out.family = `Your family pays ${n.atMost ? "at most " : ""}${money(s.amount, ctx)} a year${n.method === "full_cost" ? ", no need-based aid" : ""}`;
      }
      if (s.id === "gap") out.gap = `Gap: ${money(s.amount, ctx)} a year`;
      if (s.id === "not_confirmed") out.not_confirmed = "Still to confirm: amount not confirmed";
    });
    return out;
  }

  /* ---------- 3. Dream hero card ---------- */
  // item: one routes() item. college: its data entry. ctx: money context plus { audience, years }.
  function dreamHero(item, college, ctx, opts) {
    const o = opts || {};
    const ui = collegeUi(college);
    const n = item.netPrice;
    const E = root.PontEngine;
    let big = "";
    if (item.status !== "ok") {
      big = `<div class="big"><span class="n n-text">Cost not confirmed</span><span class="lbl">We have no published cost for your situation at this college yet.</span></div>`;
    } else if (n.method === "threshold" && n.threshold.rule === "parent_contribution_zero") {
      big = `<div class="big"><span class="n num">${esc(money(0, ctx))}</span><span class="lbl">a year expected from your parents, under ${esc(ui.short)}'s rule for families earning less than ${esc(usd(n.threshold.income_below_usd))}</span></div>`;
    } else if (n.method === "threshold") {
      big = `<div class="big"><span class="n num">${esc(money(estimatePerYear(n), ctx))}</span><span class="lbl">at most, a year on average. Aid covers at least tuition for families earning up to ${esc(usd(n.threshold.income_below_usd))}.</span></div>`;
    } else if (n.method === "full_cost") {
      const extra = [n.merit, n.message].filter(Boolean).join(" ");
      big = `<div class="big"><span class="n num">${esc(money(estimatePerYear(n), ctx))}</span><span class="lbl">a year on average over ${n.years} years, full cost.${extra ? " " + esc(extra) : ""}</span></div>`;
    } else {
      big = `<div class="big"><span class="n n-text">No estimate yet</span><span class="lbl">Cost before aid: ${esc(money(n.fullCost.mid / n.years, ctx))} a year on average. ${ext(n.aidPage.url, n.aidPage.label, "hero-link")}</span></div>`;
    }
    const bar = item.status === "ok" ? E.fundingBar(n, item.gap) : null;
    const label = item.gap && item.gap.label ? `<div class="label-wrap">${gapBlock(item.gap)}</div>` : "";
    const src = item.status === "ok" ? netSource(item) : null;
    const actions = o.actions === false ? "" : `<div class="hero-actions">
        <button type="button" class="btn btn-white" data-action="plan">${icon("list-checks")}See my ${esc(ui.short)} plan</button>
        <button type="button" class="btn btn-ghost-w" data-action="advisor">${icon("message-circle")}Ask the advisor</button>
      </div>`;
    return `<section class="card hero${o.cls ? " " + o.cls : ""}" aria-labelledby="dream-title-${esc(college.id)}">
      <svg class="arch" viewBox="0 0 420 240" aria-hidden="true"><path d="M40 230 Q210 -40 380 230" fill="none" stroke="#5B32C8" stroke-width="28" stroke-linecap="round" opacity=".55"/><path d="M40 230 Q210 -40 380 230" fill="none" stroke="#F5B740" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/><circle cx="380" cy="230" r="14" fill="#F5B740"/></svg>
      <span class="pill">${icon("sparkles")}Your dream</span>
      <div class="hero-row">
        <div class="mono mono-lg m-dream-solid" aria-hidden="true">${esc(ui.mono)}</div>
        <div><h2 id="dream-title-${esc(college.id)}">${esc(college.name)}</h2><div class="where">${esc(college.city || "")}</div></div>
      </div>
      ${tagsHtml(policyTags(college, ctx.audience))}
      ${big}
      ${label}
      ${fundingBar(bar, barLegend(item, college, bar, ctx))}
      ${actions}
      ${sourceLine(src)}
    </section>`;
  }

  /* ---------- 5. College card ---------- */
  function forYou(item, college, ctx) {
    const n = item.netPrice;
    if (item.status !== "ok") return `<div class="foryou">Cost not confirmed for your situation. ${ext(sourceUrl(college), "Official page")}</div>`;
    if (n.method === "calculator_link") return `<div class="foryou">No estimate yet. ${ext(n.aidPage.url, "See the official aid page")}</div>`;
    let line;
    if (n.threshold && n.threshold.rule === "parent_contribution_zero") line = `For you: <b class="num">${esc(money(0, ctx))}</b> a year from parents`;
    else line = `For you: ${n.atMost ? "at most " : ""}<b class="num">${esc(money(estimatePerYear(n), ctx))}</b> a year on average`;
    const msg = n.message && n.method === "full_cost" ? `<p class="confirm-line">${esc(n.message)}</p>` : "";
    return `<div class="foryou">${line}${item.gap && item.gap.label ? `<div>${gapBlock(item.gap, true)}</div>` : ""}${msg}</div>`;
  }
  const sourceUrl = (college) => ((college.sources || [])[0] || {}).url || null;

  function collegeCard(item, college, groupId, ctx, opts) {
    const o = opts || {};
    const tone = GROUP_UI[groupId].tone;
    const ui = collegeUi(college);
    let name = college.name;
    let city = college.city || "";
    if (item.kind === "transfer_path" && o.target) {
      name = `${ui.short}, then ${collegeUi(o.target).short}`;
      city = `2 years at ${ui.short}, then transfer. ${(college.transfer_note && college.transfer_note.text) || ""}`.trim();
    }
    const actions = o.actions ? `<div class="card-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="view" data-college="${esc(college.id)}">View</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="add" data-college="${esc(college.id)}"${o.added ? " aria-pressed=\"true\"" : ""}>${o.added ? icon("check") + "In your plan" : icon("plus") + "Add to plan"}</button>
      </div>` : "";
    return `<article class="college${o.cls ? " " + o.cls : ""}"><div class="band band-${tone}"></div><div class="body">
      <div class="name"><div class="mono m-${tone}" aria-hidden="true">${esc(ui.mono)}</div><div><h3>${esc(name)}</h3><div class="city">${esc(city)}</div></div></div>
      ${tagsHtml(policyTags(college, ctx.audience, true), true)}
      ${forYou(item, college, ctx)}
      ${actions}
    </div></article>`;
  }

  /* ---------- 9. Deadline list item ---------- */
  const ROUND = {
    restrictive_early_action: "Restrictive Early Action", early_action: "Early Action", regular: "Regular Decision",
    regular_action: "Regular Action", early_decision: "Early Decision", regular_decision: "Regular Decision",
    f1_fall: "F-1 students, fall start", scholarships_via_application: "Scholarship consideration",
    isss_scholarships_close: "ISSS scholarships", priority: "Scholarship priority date", closes: "Scholarship application closes",
  };
  const FORM = { css_profile: "CSS Profile", idoc: "IDOC", isfaa: "ISFAA", fafsa: "FAFSA", tasfa: "TASFA", college_form: "College scholarship application" };
  const ALTERNATIVE = { isfaa: true, tasfa: true }; // filed instead of the main form, never with it

  function formsText(forms, codes) {
    const name = (f) => FORM[f] + (codes && codes[f] ? `, code ${codes[f]}` : "");
    const main = forms.filter((f) => !ALTERNATIVE[f]).map(name);
    const alt = forms.filter((f) => ALTERNATIVE[f]).map(name);
    const m = listText(main, "and");
    return alt.length ? (m ? m + ", or " : "") + listText(alt, "or") : m;
  }

  function deadlineTitle(d) {
    if (d.kind === "admission") return d.round === "f1_fall" ? "F-1 application, fall start" : "Application, " + (ROUND[d.round] || d.round);
    return d.forms.length ? formsText(d.forms, d.codes) : (ROUND[d.round] || d.round);
  }
  // "Harvard College, Regular Decision aid". Scholarship rounds keep their own name.
  function deadlineSub(d) {
    if (d.kind === "admission") return d.collegeName;
    const round = ROUND[d.round] || d.round;
    if (!d.forms.length) return d.collegeName;
    return `${d.collegeName}, ${round}${/scholarship/i.test(round) ? "" : " aid"}`;
  }
  const STATUS = { to_do: { text: "To do", cls: "" }, done: { text: "Done", cls: "done", icon: "check" }, passed: { text: "Passed", cls: "passed", icon: "clock-alert" } };
  function statusChip(key) {
    const s = STATUS[key];
    return `<span class="status${s.cls ? " " + s.cls : ""}">${s.icon ? icon(s.icon) : ""}${s.text}</span>`;
  }
  function deadlineItem(d, status) {
    const st = status || d.status;
    return `<div class="dl${st === "passed" ? " is-passed" : ""}"><div class="dtile" aria-hidden="true"><small>${MONTHS[+d.date.slice(5, 7) - 1]}</small><b>${+d.date.slice(8, 10)}</b></div>
      <div class="what"><b>${esc(deadlineTitle(d))}</b><span><span class="sr-only">${esc(fullDate(d.date))}. </span>${esc(deadlineSub(d))}</span></div>${statusChip(st)}</div>`;
  }

  /* ---------- 10. Documents checklist ---------- */
  function ring(done, total) {
    const r = 26, c = 2 * Math.PI * r, part = total ? (done / total) * c : 0;
    return `<svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${done} of ${total} documents ready"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#E4E7F0" stroke-width="8"/>${part > 0 ? `<circle cx="32" cy="32" r="${r}" fill="none" stroke="#0B7A54" stroke-width="8" stroke-linecap="round" stroke-dasharray="${part.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>` : ""}<text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="#111A35" font-family="Plus Jakarta Sans, sans-serif">${done}/${total}</text></svg>`;
  }
  const DOC_STATUS = {
    not_started: { text: "Not started", cls: "", tile: "t-neutral" },
    uploaded: { text: "Uploaded", cls: "uploaded", tile: "t-primary" },
    flagged: { text: "Flagged", cls: "flagged", tile: "t-gap" },
    ready: { text: "Ready", cls: "ready", tile: "t-aid" },
  };
  function docItem(doc) {
    const s = DOC_STATUS[doc.status || "not_started"];
    const text = doc.status === "flagged" && doc.flags ? `${doc.flags} flag${doc.flags > 1 ? "s" : ""}` : s.text;
    return `<div class="doc"><div class="tile ${s.tile}">${icon(doc.icon || "file-text")}</div>
      <div class="what"><b>${esc(doc.title)}</b><span>${esc(doc.sub || "")}</span></div><span class="status${s.cls ? " " + s.cls : ""}">${esc(text)}</span></div>`;
  }
  function docsSummary(docs) {
    const ready = docs.filter((d) => d.status === "ready").length;
    return `<div class="ring">${ring(ready, docs.length)}<div><b>${ready} of ${docs.length} ready</b><div class="small muted">AI reads, translates and converts each one to USD.</div></div></div>`;
  }

  /* ---------- 11. Advisor messages ---------- */
  function message(m) {
    if (m.role === "me") return `<div class="msg me">${esc(m.text)}</div>`;
    const mini = m.mini ? `<div class="mini"><div class="mono mono-sm m-${m.mini.tone}-solid" aria-hidden="true">${esc(m.mini.mono)}</div><div><b>${esc(m.mini.title)}</b><div class="mini-sub">${esc(m.mini.sub)}</div></div>${m.mini.label ? gapLabel(m.mini.label, true) : ""}</div>` : "";
    const list = (m.sources || []).concat(m.source ? [m.source] : []).filter((x) => x && x.url);
    const one = (x) => `${ext(x.url, x.label)}${x.checked_on ? ", checked " + esc(fullDate(x.checked_on)) : ""}`;
    const src = list.length ? `<span class="msg-source">Source: ${list.map(one).join("; ")}.</span>` : "";
    // Offline: the scripted answer carries the offline banner (docs/screens.md, global).
    const banner = m.offline ? `<span class="msg-banner">${icon("wifi-off")}${esc(m.banner || "AI is offline. Showing a prepared answer.")}</span>` : "";
    // Live: every AI answer is labeled, with its confidence (docs/ai.md, principle).
    const conf = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" }[m.confidence];
    const label = m.live ? `<span class="msg-label">${icon("sparkles")}Written by AI. Check the source.${conf ? " " + conf + "." : ""}</span>` : "";
    return `<div class="msg ai${m.offline ? " offline" : ""}"${m.lang ? ` lang="${esc(m.lang)}"` : ""}>${banner}${esc(m.text)}${mini}${src}${label}</div>`;
  }
  const typing = (label) => `<div class="typing" role="status" aria-label="${esc(label || "The advisor is typing")}"><span></span><span></span><span></span></div>`;

  root.PontUI = {
    esc, icon, ext, monthDay, fullDate, termLabel, logoSvg, money, usd, listText,
    COLLEGE_UI, collegeUi, GROUP_UI, groupHeader, policyTags, tagsHtml,
    gapLabel, gapBlock, sourceLine, fundingBar, barLegend, dreamHero, collegeCard, netSource, estimatePerYear,
    ROUND, FORM, formsText, deadlineTitle, deadlineSub, deadlineItem, statusChip,
    ring, docItem, docsSummary, DOC_STATUS, message, typing,
  };
})(typeof window !== "undefined" ? window : globalThis);
