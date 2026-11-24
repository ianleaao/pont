/*
  Pont studio (tasks 7 and 8, docs/screens.md 9 to 14, docs/ai.md functions 4 to 7):
    documents  Documents studio: upload an image or use a SAMPLE, the AI reads and translates it (live) or the
               scripted reading (offline), the engine converts the amount to USD and checks the age and page
               rules, the AI flags the other rules; drafts (bank letter in the family language, aid office in English)
    family     Family mode: a summary for parents in their language and currency
    essay      Essay coach inside the advisor rail: suggestions on the student's own draft, never the essay
    export     "Export my plan": a clean HTML summary to keep (no login and no server in the prototype)

  No math here: amounts are read by E.parseAmount and converted by E.toUsd (CLAUDE.md rule 1).
  Images stay in memory for this page view only and are never stored. Readings stay in this tab (sessionStorage).
  The AI never sends anything, never edits a document and never says a document will be accepted.
*/
(function () {
  "use strict";

  const U = window.PontUI;
  const E = window.PontEngine;
  const AI = window.PontAI;
  const P = window.PontPrompts;

  const FIELD = { holder: "Account holder", date: "Date", currency: "Currency", balance: "Balance", income: "Income", issuer: "Bank or employer", language: "Language", pages: "Pages" };
  const CONF = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };
  const FORM_WHERE = { css_profile: "On the College Board site", fafsa: "On studentaid.gov", isfaa: "College form", college_form: "College form" };
  const RULE_LABEL = { upload: "Upload", language: "Language", name: "Name", liquid: "Liquid funds", max_age_months: "Age", max_pages: "Pages",
    not_accepted: "Not accepted", channel: "How to send", tax_documents: "Tax documents", translation: "Translation", format: "Format", signature: "Signature", other: "Other" };
  const SUG = { highlight: "Highlight", cut: "Cut", structure: "Structure", english: "English" };

  function create(app) {
    const st = app.state;
    const data = () => st.data;
    const scripts = () => data().scripts;
    const short = (c) => U.collegeUi(c).short;
    const files = {}; // docId -> { blob, url, name, sampleId }: memory only, never stored
    const srcOf = (c, id, checked) => {
      const s = (c.sources || []).find((x) => x.id === id);
      return s ? Object.assign({}, s, !s.checked_on && checked ? { checked_on: checked } : {}) : null;
    };
    const langName = (code, inLang) => {
      try { return new Intl.DisplayNames([inLang || "en"], { type: "language" }).of(code) || code; } catch (e) { return code; }
    };
    const familyCountry = () => (st.answers.parentCountries || []).find((c) => c !== "US") || (st.answers.parentCountries || [])[0] || null;
    const familyLanguage = () => {
      const k = data().countries.countries[familyCountry()];
      return (k && k.family_language) || "en";
    };
    const localeOfCurrency = (cur) => {
      const k = Object.values(data().countries.countries).find((x) => x.currency === cur);
      return (k && k.locale) || "en-US";
    };
    const dreamOf = (res) => {
      const d = res.routes.groups[0].items[0];
      return d ? app.findCollege(d.collegeId) : null;
    };

    /* ================= Documents: the list ================= */
    // Documents the dream college's data asks for, with their rules and the matching SAMPLE.
    function docs(res) {
      const dream = dreamOf(res);
      if (!dream) return [];
      const profile = res.routes.profile;
      const list = [];
      const ui = short(dream);
      if (profile.visaStudent) {
        const r = dream.i20 && dream.i20.document_rules;
        list.push({ id: "bank_i20", kind: "bank_statement", upload: true, icon: "landmark", title: "Bank statement for the I-20",
          sub: r && r.max_pages ? `${ui} accepts up to ${r.max_pages} pages.` : "Shows the money for the first year.",
          rules: r || null, rulesFor: "proof of funds for the I-20", rulesSource: r ? srcOf(dream, r.source, r.checked_on) : null });
      }
      const dr = dream.document_rules && dream.document_rules.status !== "not_confirmed" ? dream.document_rules : null;
      const drSrc = dream.document_rules ? srcOf(dream, dream.document_rules.source, dream.document_rules.checked_on) : null;
      if (dr && dr.tax_documents) {
        list.push({ id: "tax_return", kind: "tax_return", upload: true, icon: "file-text", title: "Parents' 2025 tax return",
          sub: dr.channel && dr.channel.channel ? `Through ${dr.channel.channel}` : "", rules: dr, rulesFor: "financial aid documents", rulesSource: drSrc });
      }
      const abroad = (st.answers.parentCountries || []).filter((c) => c !== "US");
      if (profile.audience === "us" && abroad.length) {
        const names = abroad.map((c) => data().countries.countries[c].name);
        list.push({ id: "parents_income", kind: "income", upload: true, icon: "file-text", title: "Parents' income documents",
          sub: `From ${names.join(" and ")}, converted to USD in the studio`, rules: dr, rulesFor: "financial aid documents", rulesSource: drSrc });
      }
      const pc = profile.colleges.find((c) => c.collegeId === dream.id) || { forms: [] };
      pc.forms.filter((f) => f !== "idoc" && !(f === "tasfa" && pc.forms.includes("fafsa"))).forEach((f) => {
        list.push({ id: "form_" + f, kind: "form", upload: false, icon: "clipboard-list", title: U.FORM[f], sub: FORM_WHERE[f] || "" });
      });
      return list.map((d) => {
        const ev = evaluate(d);
        return Object.assign(d, { college: dream, status: ev.status, flags: ev.count, ev });
      });
    }

    // Live status of one document: not_started, uploaded (not read yet), flagged or ready.
    function evaluate(d) {
      const entry = st.docs[d.id];
      if (d.kind === "form") return { status: entry && entry.filed ? "ready" : "not_started", count: 0 };
      if (!entry) return { status: "not_started", count: 0 };
      if (!entry.result) return { status: "uploaded", count: 0 };
      const fields = effectiveFields(entry);
      const val = (n) => { const f = fields.find((x) => x.name === n); return f ? String(f.value) : null; };
      const engineFlags = E.documentChecks({ date: val("date"), pages: val("pages") }, d.rules, app.todayIso());
      const aiFlags = entry.result.flags || [];
      const pending = fields.filter((f) => f.confidence === "low" && !(entry.confirmed || {})[f.name]);
      const count = engineFlags.length + aiFlags.length + pending.length;
      return { status: count ? "flagged" : "ready", count, engineFlags, aiFlags, pending, fields };
    }
    const effectiveFields = (entry) => (entry.result.fields || []).map((f) => {
      const c = (entry.confirmed || {})[f.name];
      return c !== undefined ? Object.assign({}, f, { value: c, confirmed: true }) : f;
    });

    const samplesFor = (d) => {
      const all = (scripts().documents && scripts().documents.samples) || {};
      const ids = Object.keys(all).filter((k) => all[k].kind === d.kind);
      const mine = ids.filter((k) => (st.answers.parentCountries || []).includes(all[k].country));
      return (mine.length ? mine : ids).map((k) => Object.assign({ id: k }, all[k]));
    };

    /* ================= Documents: reading ================= */
    async function useSample(docId, sampleId) {
      const s = scripts().documents.samples[sampleId];
      if (!s) return;
      try {
        const blob = await (await fetch(s.file)).blob();
        files[docId] = { blob, url: s.file, name: s.label, sampleId };
      } catch (e) {
        files[docId] = { blob: null, url: s.file, name: s.label, sampleId };
      }
      st.docs[docId] = { sampleId, fileName: s.label, result: null };
      st.docError = null;
      app.saveDocs();
      app.render(false, { focusId: "btn-read" });
    }

    function onFile(docId, file) {
      if (!file) return;
      const D = scripts().documents;
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) { st.docError = D.pdf; app.render(false, { focusId: "doc-file" }); return; }
      if (!/^image\/(png|jpeg)$/.test(file.type)) { st.docError = "Use a PNG or JPG image. " + D.pdf; app.render(false, { focusId: "doc-file" }); return; }
      if (file.size > 20 * 1024 * 1024) { st.docError = "This image is too large. Use one under 20 MB."; app.render(false, { focusId: "doc-file" }); return; }
      if (files[docId] && files[docId].url && !files[docId].sampleId) URL.revokeObjectURL(files[docId].url);
      files[docId] = { blob: file, url: URL.createObjectURL(file), name: file.name, sampleId: null };
      st.docs[docId] = { sampleId: null, fileName: file.name, result: null };
      st.docError = null;
      app.saveDocs();
      app.render(false, { focusId: "btn-read" });
    }

    async function read(docId) {
      const res = app.compute();
      const d = res && docs(res).find((x) => x.id === docId);
      const entry = st.docs[docId];
      if (!d || !entry || st.docBusy) return;
      let f = files[docId];
      if (!f && entry.sampleId) { await useSample(docId, entry.sampleId); f = files[docId]; }
      if (!f) return;
      const ruleIds = Object.keys(d.rules || {});
      const built = P.document({ kind: d.kind, college: d.college.name, rules: d.rules || {}, language: familyLanguage() });
      const sample = f.sampleId ? scripts().documents.samples[f.sampleId] : null;
      st.docBusy = docId;
      app.render(false, { focusId: "doc-status" });
      const out = await app.ai.ask(built, {
        images: f.blob ? [f.blob] : undefined,
        fallback: () => (sample ? AI.validate("document", sample.reading, { ruleIds }) : null),
      });
      st.docBusy = null;
      if (out.cancelled) { app.render(false); return; }
      const result = out.data && !out.data.unreadable ? Object.assign({}, out.data, { live: out.live, offline: out.offline }) : null;
      st.docs[docId] = Object.assign({}, entry, { result, unreadable: !!(out.data && out.data.unreadable), offline: out.offline, confirmed: {} });
      app.saveDocs();
      app.render(false, { focusId: "doc-result" });
    }

    /* ================= Documents: page ================= */
    function rulesList(d) {
      const r = d.rules;
      if (!r) return `<p><span class="nc">Not confirmed.</span> ${U.esc(short(d.college))} has no document rules in our data for this document.${d.rulesSource && d.rulesSource.url ? " " + U.ext(d.rulesSource.url, "Official page") : ""}</p>`;
      const items = [];
      Object.keys(RULE_LABEL).forEach((k) => {
        const v = r[k];
        if (v === undefined || v === null) return;
        if (k === "max_age_months") { if (r.max_age_rule) items.push([k, r.max_age_rule]); return; }
        if (k === "max_pages") { items.push([k, `At most ${v} pages.`]); return; }
        if (k === "not_accepted") { items.push([k, v.join(", ") + "."]); return; }
        if (v && v.status === "not_confirmed") { items.push([k, "Not confirmed."]); return; }
        if (v && v.rule) items.push([k, v.rule]);
      });
      return `<ul class="rules">${items.map(([k, t]) => `<li><b>${U.esc(RULE_LABEL[k])}:</b> ${U.esc(t)}</li>`).join("")}</ul>${U.sourceLine(d.rulesSource)}`;
    }

    function amountBlock(fields, d, res) {
      const amountF = fields.find((f) => f.name === "balance" || f.name === "income");
      const curF = fields.find((f) => f.name === "currency");
      if (!amountF) return "";
      const cur = curF ? String(curF.value).trim().toUpperCase().slice(0, 3) : null;
      const amount = E.parseAmount(amountF.value, localeOfCurrency(cur));
      const rate = cur ? app.rateOf(cur) : null;
      const usd = E.toUsd(amount, rate);
      const info = cur && st.rates[cur] ? PontFx.rateLines(st.rates[cur]) : null;
      let line;
      if (cur === "USD" && amount !== null) line = `<b class="num">${U.esc(U.usd(amount))}</b>`;
      else if (usd !== null) line = `<b class="num">${U.esc(U.usd(usd))}</b> <span class="muted small">(${U.esc(PontFx.formatMoney(amount, cur))})</span>`;
      else line = `<span class="nc">USD value not confirmed.</span> <span class="small muted">${amount === null ? "Please confirm the amount." : `No exchange rate for ${U.esc(cur || "this currency")}.`}</span>`;
      const rateLine = info && info.value ? `<p class="small muted">${U.esc(info.value)}. Source: ${U.ext(info.source.url, info.source.name)}, ${U.esc(info.source.date)}.${info.notice ? " " + U.esc(info.notice) : ""}</p>` : "";
      let i20 = "";
      if (d.id === "bank_i20") {
        const item = res.routes.groups[0].items[0];
        const show = item && item.cost && item.cost.status === "ok" ? E.showForI20(item.cost, data()) : null;
        // Only a published amount with its source (Harvard publishes none: no line, never an estimate here).
        if (show && show.amount && show.source && show.source.url && !show.estimate) i20 = `<p class="small">${U.esc(short(d.college))} asks you to show <b class="num">${U.esc(U.usd(show.amount))}</b> for the first year${show.year ? " (" + U.esc(show.year) + ")" : ""}. ${U.ext(show.source.url, "Source")}</p>`;
      }
      return `<div class="usd-box"><span class="small muted">${U.esc(FIELD[amountF.name])} in USD, converted by Pont</span><div>${line}</div>${rateLine}${i20}</div>`;
    }

    function resultHtml(d, res) {
      const entry = st.docs[d.id];
      if (!entry) return "";
      if (st.docBusy === d.id) return `<div id="doc-result" tabindex="-1">${U.typing("Pont is reading your document")}<p class="small muted">Reading, translating and checking. This can take a minute with live AI.</p></div>`;
      if (!entry.result) {
        if (entry.offline || entry.unreadable) {
          const msg = entry.unreadable ? "We could not read this image. Try a clearer photo or screenshot of the page." : scripts().documents.cannot_read;
          return `<div id="doc-result" tabindex="-1" class="doc-result">${U.message({ role: "ai", offline: !!entry.offline, banner: AI.COPY.offline, text: msg })}<h3 class="phase">${U.esc(short(d.college))} rules for ${U.esc(d.rulesFor)}</h3>${rulesList(d)}</div>`;
        }
        return "";
      }
      const ev = d.ev;
      const r = entry.result;
      const label = r.live
        ? `<p class="msg-label">${U.icon("sparkles")}Written by AI. Check the source. ${U.esc(CONF[r.confidence] || "")}.</p>`
        : `<p class="msg-banner">${U.icon("wifi-off")}${U.esc(AI.COPY.offline)}</p>`;
      const rows = ev.fields.map((f) => {
        const low = f.confidence === "low" && !f.confirmed;
        const id = "fld-" + f.name;
        const shown = f.name === "date" && /^\d{4}-\d{2}-\d{2}$/.test(String(f.value)) ? U.fullDate(String(f.value)) : String(f.value);
        const value = low
          ? `<div class="confirm-field"><label for="${id}" class="small">${U.esc(scripts().documents.confirm_value)}</label><div class="confirm-row"><input id="${id}" value="${U.esc(String(f.value))}" data-doc-field="${f.name}"><button type="button" class="btn btn-primary btn-sm" data-confirm-field="${f.name}">Confirm</button></div></div>`
          : `<span>${U.esc(shown)}</span>${f.confirmed ? ` <span class="status ready">${U.icon("check")}Confirmed by you</span>` : ""}`;
        return `<div class="kv${low ? " is-low" : ""}"><dt>${U.esc(FIELD[f.name] || f.name)} <span class="conf conf-${U.esc(f.confidence)}">${U.esc(CONF[f.confidence] || "")}</span></dt><dd>${value}</dd></div>`;
      }).join("");
      const engineFlags = ev.engineFlags.map((x) => {
        if (x.rule === "max_age_months") return `<li><b>${U.esc(RULE_LABEL.max_age_months)}:</b> dated ${U.esc(U.fullDate(x.date))}, more than ${x.limitMonths} months ago. ${U.esc(x.text || "")} <span class="kv-src">Checked by Pont against the rule. ${d.rulesSource ? `Source: ${U.ext(d.rulesSource.url, d.rulesSource.label)}.` : ""}</span></li>`;
        return `<li><b>${U.esc(RULE_LABEL.max_pages)}:</b> ${x.pages} pages, the limit is ${x.maxPages}. <span class="kv-src">Checked by Pont against the rule.</span></li>`;
      }).join("");
      const aiFlags = ev.aiFlags.map((x) => `<li><b>${U.esc(RULE_LABEL[x.rule] || "Check")}:</b> ${U.esc(x.text)}</li>`).join("");
      const pend = ev.pending.length ? `<li><b>To confirm:</b> ${U.esc(ev.pending.map((f) => FIELD[f.name] || f.name).join(", "))}.</li>` : "";
      const flags = engineFlags || aiFlags || pend
        ? `<ul class="flags">${engineFlags}${aiFlags}${pend}</ul>`
        : d.rules ? `<p class="ok-line">${U.icon("circle-check")}No problems found against these rules. Pont never says a document will be accepted: the college decides.</p>` : "";
      return `<div id="doc-result" tabindex="-1" class="doc-result">
        ${label}
        <h3 class="phase">What we read</h3>
        <dl class="kv-list">${rows}</dl>
        ${amountBlock(ev.fields, d, res)}
        <h3 class="phase">${d.rules ? `Checked against ${U.esc(short(d.college))} rules for ${U.esc(d.rulesFor)}` : `${U.esc(short(d.college))} rules for ${U.esc(d.rulesFor)}`}</h3>
        ${d.rules ? "" : rulesList(d)}
        ${flags}
        ${d.rules ? `<details class="pending"><summary>The rules</summary>${rulesList(d)}</details>` : ""}
        <h3 class="phase">Working translation, not certified</h3>
        <div class="translation" lang="en">${U.esc(r.translation || "")}</div>
        <p class="small muted">Account and ID numbers are removed. Pont never edits your document.</p>
      </div>`;
    }

    function docPanel(d, res) {
      const D = scripts().documents;
      const entry = st.docs[d.id];
      const statusChip = `<span class="status ${U.DOC_STATUS[d.status].cls}" id="doc-status" tabindex="-1">${U.esc(d.status === "flagged" ? `${d.flags} to check` : U.DOC_STATUS[d.status].text)}</span>`;
      if (d.kind === "form") {
        const filed = entry && entry.filed;
        return `<section class="card doc-panel" aria-labelledby="doc-title">
          <div class="card-head"><div class="tile t-primary">${U.icon(d.icon)}</div><h2 id="doc-title">${U.esc(d.title)}</h2>${statusChip}</div>
          <p>${U.esc(d.sub)}. You file this form yourself on its official site. Pont does not file anything.</p>
          <label class="check" for="form-filed"><input type="checkbox" id="form-filed" data-form-filed="${U.esc(d.id)}"${filed ? " checked" : ""}> I filed it</label>
        </section>`;
      }
      const f = files[d.id];
      const samples = samplesFor(d);
      const preview = f
        ? `<figure class="doc-preview"><img src="${U.esc(f.url)}" alt="${U.esc(f.sampleId ? f.name + ", fake data" : "Your uploaded image")}"><figcaption class="small muted">${U.esc(f.name)}${f.sampleId ? "" : ". The image stays in this page only and is never stored."}</figcaption></figure>`
        : entry ? `<p class="small muted">${U.icon("image")} ${U.esc(entry.fileName || "Image")}: the image is not kept after the page reloads. Choose it again to read it again.</p>` : "";
      const canRead = !!(f || (entry && entry.sampleId));
      return `<section class="card doc-panel" aria-labelledby="doc-title">
        <div class="card-head"><div class="tile t-gap">${U.icon(d.icon)}</div><h2 id="doc-title">${U.esc(d.title)}</h2>${statusChip}</div>
        <p class="screen-lead-sm">Upload a bank statement or income document. We read it, translate it and convert it to USD.</p>
        <p class="notice">${U.icon("shield-alert")}<span>${U.esc(D.notice)}</span></p>
        <div class="upload-row">
          <div class="field"><label for="doc-file">Upload a photo or screenshot of the page (PNG or JPG)</label>
            <input type="file" id="doc-file" accept="image/png,image/jpeg,application/pdf" data-doc-file="${U.esc(d.id)}" aria-describedby="doc-error"></div>
          <div class="samples"><span class="small muted">Or use a sample document:</span>
            ${samples.length ? samples.map((s) => `<button type="button" class="btn btn-outline btn-sm" data-sample="${U.esc(s.id)}" data-doc="${U.esc(d.id)}">${U.icon("file-image")}${U.esc(s.label)}</button>`).join("") : `<span class="small">No sample for this document yet.</span>`}
          </div>
        </div>
        <p class="form-error" id="doc-error" role="alert">${U.esc(st.docError || "")}</p>
        ${preview}
        ${canRead ? `<div class="read-row"><button type="button" class="btn btn-primary" id="btn-read" data-read="${U.esc(d.id)}"${st.docBusy ? " disabled" : ""}>${U.icon("scan-text")}${entry && entry.result ? "Read again" : "Read and check"}</button>
          <span class="small muted">Uses your Claude account when live AI is available.</span></div>` : ""}
        ${resultHtml(d, res)}
      </section>`;
    }

    /* ---------- Drafts ---------- */
    function draftsCard(res, d) {
      const dream = d.college;
      const lang = familyLanguage();
      const one = (kind, title, sub) => {
        const s = st.drafts[kind];
        const btn = `<button type="button" class="btn btn-outline btn-sm" data-draft="${kind}"${s && s.busy ? " disabled" : ""}>${U.icon("pen-line")}${s && s.text ? "Write again" : "Write the draft"}</button>`;
        let body = "";
        if (s && s.busy) body = U.typing("Pont is writing a draft");
        else if (s && s.text) {
          const id = "draft-" + kind;
          body = `${s.live ? `<p class="msg-label">${U.icon("sparkles")}Written by AI. Check it before you send it.</p>` : `<p class="msg-banner">${U.icon("wifi-off")}${U.esc(AI.COPY.offline)}</p>`}
            ${s.note ? `<p class="small muted">${U.esc(s.note)}</p>` : ""}
            <label class="sr-only" for="${id}">${U.esc(title)} draft</label>
            <textarea id="${id}" class="draft-text" rows="9" readonly lang="${U.esc(s.language)}">${U.esc(s.text)}</textarea>
            <div class="copy-row"><button type="button" class="btn btn-primary btn-sm" data-copy="${id}">${U.icon("copy")}Copy</button><span class="small muted" aria-live="polite" id="${id}-copied"></span></div>`;
        }
        return `<div class="draft"><div class="draft-head"><div><b>${U.esc(title)}</b><span class="small muted">${U.esc(sub)}</span></div>${btn}</div>${body}</div>`;
      };
      return `<section class="card drafts-card" aria-labelledby="drafts-title">
        <div class="card-head"><div class="tile t-dream">${U.icon("mail")}</div><h2 id="drafts-title">Drafts</h2></div>
        <p class="small muted">Pont writes drafts. You check them and send them yourself. The AI never sends anything.</p>
        ${one("bank_letter", "Bank letter request", `To your family's bank, in ${langName(lang)}.`)}
        <div class="field"><label for="draft-question">Your question for the ${U.esc(short(dream))} aid office (optional)</label><input id="draft-question" maxlength="300" value="${U.esc(st.draftQuestion || "")}" placeholder="For example: do you accept my own translation?"></div>
        ${one("aid_office", "Message to the aid office", `To ${dream.name}, in English.`)}
      </section>`;
    }

    async function draft(kind) {
      const res = app.compute();
      if (!res || (st.drafts[kind] && st.drafts[kind].busy)) return;
      const dream = dreamOf(res);
      const list = docs(res);
      const d = list.find((x) => x.rules) || {};
      const lang = familyLanguage();
      const name = langName(lang);
      const reqs = [];
      if (d.rules) ["name", "language", "liquid"].forEach((k) => { if (d.rules[k] && d.rules[k].rule) reqs.push(d.rules[k].rule); });
      reqs.push("Shows the account holder, the date, the currency and the available balance.");
      const q = ($("draft-question") && $("draft-question").value.trim().slice(0, 300)) || st.draftQuestion || "";
      st.draftQuestion = q;
      st.drafts[kind] = { busy: true };
      app.render(false, { focusId: "drafts-title" });
      const S = scripts().drafts;
      const fallback = () => {
        if (kind === "bank_letter") {
          const has = S.bank_letter[lang];
          return { drafts: [{ kind, language: has ? lang : "en", text: has || S.bank_letter.en }],
            note: !has && lang.split("-")[0] !== "en" ? S.offline_other_language.replace("{language}", name) : null };
        }
        return { drafts: [{ kind, language: "en", text: S.aid_office }], note: null };
      };
      const built = P.drafts({ kinds: [kind], name: st.answers.name || null, college: dream.name,
        purpose: kind === "bank_letter" ? "A bank letter for the I-20 or financial aid application" : "A question to the financial aid office",
        language: lang, languageName: name, requirements: reqs, question: q || null });
      const out = await app.ai.ask(built, { fallback, cache: false });
      const dr = out.data && out.data.drafts.find((x) => x.kind === kind);
      st.drafts[kind] = dr ? { busy: false, text: dr.text, language: dr.language, note: out.data.note, live: out.live } : null;
      app.render(false, { focusId: "draft-" + kind });
    }

    function documentsHtml(res) {
      const list = docs(res);
      if (!list.length) return `<div class="page-empty"><div class="empty">${U.icon("file-search")}The documents list comes from your dream school. Pick one anytime.<br><br><button type="button" class="btn btn-outline btn-sm" data-action="pick-dream">Choose a dream school</button></div></div>`;
      const sel = list.find((d) => d.id === st.docSel) || list.find((d) => d.upload) || list[0];
      st.docSel = sel.id;
      const items = list.map((d) => `<li><button type="button" class="doc-pick${d.id === sel.id ? " is-on" : ""}" data-doc-sel="${U.esc(d.id)}" aria-current="${d.id === sel.id}">${U.docItem(d)}</button></li>`).join("");
      return `<div class="studio">
        <aside class="card doc-list" aria-labelledby="docs-list-title">
          <div class="card-head"><div class="tile t-gap">${U.icon("file-search")}</div><h2 id="docs-list-title">Your documents</h2></div>
          ${U.docsSummary(list)}
          <ul class="doc-picks">${items}</ul>
          <p class="small muted">Status stays in this browser tab. Images are never stored.</p>
        </aside>
        <div class="studio-main">
          ${docPanel(sel, res)}
          ${draftsCard(res, sel)}
        </div>
      </div>`;
    }

    /* ================= Family mode ================= */
    function familyLangs() {
      const out = [];
      (st.answers.parentCountries || []).forEach((c) => {
        const k = data().countries.countries[c];
        if (!k) return;
        [k.family_language].concat(k.family_language_alternatives || []).forEach((l) => { if (l && !out.includes(l)) out.push(l); });
      });
      if (!out.some((l) => l.split("-")[0] === "en")) out.push("en");
      return out;
    }
    // Default: the family language; when it is English and the country lists another language, that one (Ananya: Hindi).
    function defaultLang() {
      const k = data().countries.countries[familyCountry()];
      if (!k) return "en";
      if (k.family_language.split("-")[0] === "en" && (k.family_language_alternatives || []).length) return k.family_language_alternatives[0];
      return k.family_language;
    }

    // English summary built from engine data only (the offline version and the reference for parents).
    function englishSummary(res) {
      const a = st.answers;
      const ctx = { currency: a.currency && app.rateOf(a.currency) ? a.currency : "USD", rate: app.rateOf(a.currency), audience: res.routes.profile.audience };
      const m = (usd) => U.money(usd, ctx);
      const who = a.name || "Your child";
      const dreamItem = res.routes.groups[0].items[0];
      const parts = [];
      if (!dreamItem) parts.push(`${who} has not picked a dream school yet. Pont shows colleges with strong aid and lower-cost paths.`);
      else {
        const c = app.findCollege(dreamItem.collegeId);
        const n = dreamItem.netPrice || {};
        const g = dreamItem.gap || {};
        parts.push(`${who}'s dream school is ${c.name}, starting ${U.termLabel(a.term)}.`);
        if (dreamItem.status !== "ok") parts.push("The cost is not confirmed for this situation yet.");
        else if (n.threshold && n.threshold.rule === "parent_contribution_zero") parts.push(`Under ${short(c)}'s published rule, parents are expected to pay ${m(0)} a year. The family pays the visa fees, ${m(n.total.mid)} once.`);
        else if (n.hasEstimate) {
          parts.push(`The estimate is ${n.atMost ? "at most " : "about "}${m(U.estimatePerYear(n))} a year on average.`);
          if (g.label && g.gapUsd > 0) parts.push(`The family could cover about ${m(g.familyPerYearUsd)} a year. The gap is about ${m(g.gapUsd)} a year, and the plan shows routes that can close it.`);
          else if (g.label) parts.push("This is covered by what the family said it could pay.");
        } else parts.push("There is no estimate yet. The college's official aid page has the next steps.");
        if (n.notConfirmed && n.notConfirmed.length) parts.push(`Still to confirm: ${n.notConfirmed.map((x) => x.label).join(", ")}.`);
      }
      const steps = res.deadlines.filter((d) => d.status === "to_do" && !st.ticks[d.id]).slice(0, 3)
        .map((d) => `${U.fullDate(d.date)}: ${U.deadlineTitle(d)}, ${short(app.findCollege(d.collegeId))}.`);
      const fill = ["Read and check the family's financial documents in Pont's documents studio.", "Ask the college's financial aid office any question about the documents.", "Review the plan together every month."];
      while (steps.length < 3) steps.push(fill[steps.length]);
      return { summary: parts.join(" "), steps, currency: ctx.currency };
    }

    async function familyWrite(lang) {
      const res = app.compute();
      if (!res) return;
      const key = lang;
      if (st.family[key] && st.family[key].busy) return;
      const facts = app.factsForPrompt(app.planFacts(res));
      st.family[key] = { busy: true };
      app.render(false, { focusId: "family-out" });
      const out = await app.ai.ask(P.family({ facts, language: lang, languageName: langName(lang), currency: st.answers.currency || "USD" }), { fallback: () => null });
      st.family[key] = out.live && out.data ? { busy: false, data: out.data, live: true } : { busy: false, offline: true };
      app.render(false, { focusId: "family-out" });
    }

    function familyHtml(res) {
      const langs = familyLangs();
      const lang = st.familyLang && langs.includes(st.familyLang) ? st.familyLang : defaultLang();
      st.familyLang = lang;
      const en = englishSummary(res);
      const isEn = lang.split("-")[0] === "en";
      const s = st.family[lang];
      const enBlock = (title) => `<div class="family-text" lang="en"><h3 class="phase">${U.esc(title)}</h3><p>${U.esc(en.summary)}</p><h4>Next three steps</h4><ol>${en.steps.map((x) => `<li>${U.esc(x)}</li>`).join("")}</ol></div>`;
      let out;
      if (isEn) out = enBlock("Summary for parents");
      else if (s && s.busy) out = `<div id="family-out" tabindex="-1">${U.typing("Pont is writing the summary")}</div>`;
      else if (s && s.live) {
        const d = s.data;
        out = `<div id="family-out" tabindex="-1"><p class="msg-label">${U.icon("sparkles")}Written by AI from Pont's numbers. Check the source.</p>
          <div class="family-text" lang="${U.esc(lang)}"><p>${U.esc(d.summary)}</p><ol>${d.steps.map((x) => `<li>${U.esc(x)}</li>`).join("")}</ol>
          ${d.keptTerms.length ? `<dl class="kept">${d.keptTerms.map((k) => `<div><dt>${U.esc(k.term)}</dt><dd>${U.esc(k.explanation)}</dd></div>`).join("")}</dl>` : ""}</div>
          <details class="pending"><summary>In English</summary>${enBlock("Summary for parents")}</details></div>`;
      } else if (s && s.offline) {
        out = `<div id="family-out" tabindex="-1">${U.message({ role: "ai", offline: true, banner: AI.COPY.offline, text: (scripts().functions.family || "") })}${enBlock("Summary for parents, in English")}</div>`;
      } else {
        out = `<div id="family-out" tabindex="-1"><p>Pont writes this summary in ${U.esc(langName(lang))} (${U.esc(langName(lang, lang))}) from the plan's numbers. The amounts never change.</p>
          <button type="button" class="btn btn-primary" data-family-write="${U.esc(lang)}">${U.icon("languages")}Write it in ${U.esc(langName(lang))}</button>
          <details class="pending"><summary>In English</summary>${enBlock("Summary for parents")}</details></div>`;
      }
      return `<div class="grid">
        <section class="card span-12 family-card" aria-labelledby="family-title">
          <div class="card-head"><div class="tile t-aid">${U.icon("users")}</div><h2 id="family-title">For your parents</h2>
            <div class="family-lang more"><label for="family-lang" class="small muted">Language</label>
            <select id="family-lang" data-family-lang>${langs.map((l) => `<option value="${U.esc(l)}"${l === lang ? " selected" : ""}>${U.esc(langName(l))} (${U.esc(langName(l, l))})</option>`).join("")}</select></div></div>
          <p class="small muted">Amounts in ${U.esc(en.currency)}, converted by Pont with the rate shown at the top. Never by the AI.</p>
          ${out}
        </section>
      </div>`;
    }

    /* ================= Essay coach (advisor rail) ================= */
    function essayHtml() {
      const e = st.essay;
      let out = "";
      if (e.busy) out = U.typing("Pont is reading your draft");
      else if (e.result) {
        const r = e.result;
        if (r.offline) out = U.message({ role: "ai", offline: true, banner: AI.COPY.offline, text: scripts().functions.essay }) +
          `<p class="small muted">If you ask Pont to write your essay, it answers:</p>` + U.message({ role: "ai", text: AI.COPY.essayDeclined });
        else if (r.declined) out = U.message({ role: "ai", live: true, text: r.message });
        else out = `<div class="msg ai"><p class="msg-label">${U.icon("sparkles")}Written by AI. Your essay stays yours.</p><ol class="sugs">${r.suggestions.map((s) => `<li><b>${U.esc(SUG[s.type] || s.type)}:</b> ${U.esc(s.text)}</li>`).join("")}</ol></div>`;
      }
      return `<div class="essay">
        <p class="small">Paste your own draft. Pont suggests what to highlight, cut or fix in English, up to 6 points. It never writes your essay.</p>
        <label for="essay-draft" class="small"><b>Your draft</b></label>
        <textarea id="essay-draft" rows="8" maxlength="8000">${U.esc(e.draft || "")}</textarea>
        <label for="essay-ask" class="small"><b>What do you want help with?</b> (optional)</label>
        <input id="essay-ask" maxlength="300" value="${U.esc(e.ask || "")}" placeholder="For example: is my opening strong?">
        <button type="button" class="btn btn-primary btn-sm" data-essay-run${e.busy ? " disabled" : ""}>${U.icon("sparkles")}Get suggestions</button>
        <div id="essay-out" tabindex="-1">${out}</div>
      </div>`;
    }
    async function essayRun() {
      const draftText = ($("essay-draft").value || "").trim();
      const ask = ($("essay-ask").value || "").trim();
      st.essay = { draft: draftText, ask, busy: true };
      if (!draftText && !ask) { st.essay = { draft: "", ask: "", busy: false }; return; }
      app.renderRail(app.compute());
      const out = await app.ai.ask(P.essay({ draft: draftText, request: ask }), { fallback: () => null, cache: false });
      st.essay = { draft: draftText, ask, busy: false, result: out.live && out.data ? out.data : { offline: true } };
      if (out.live && out.data && out.data.suggestions) st.essay.result.suggestions = out.data.suggestions.slice(0, 6);
      app.renderRail(app.compute());
      const o = $("essay-out");
      if (o) o.focus();
    }

    /* ================= Export my plan ================= */
    function planHtml(res) {
      const a = st.answers;
      const e = (s) => U.esc(s == null ? "" : String(s));
      const country = (c) => (data().countries.countries[c] || {}).name || c;
      const ctx = { currency: "USD", rate: null, audience: res.routes.profile.audience };
      const facts = app.planFacts(res);
      const routes = res.routes.groups.map((g) => `<h3>${e(g.label)}</h3>${g.items.length ? `<ul>${g.items.map((it) => {
        const c = app.findCollege(it.collegeId);
        const n = it.netPrice || {};
        const name = it.targetCollegeId ? `${c.name}, then ${app.findCollege(it.targetCollegeId).name}` : c.name;
        const est = it.status !== "ok" ? "Not confirmed" : !n.hasEstimate ? "No estimate yet. See the official aid page."
          : n.threshold && n.threshold.rule === "parent_contribution_zero" ? `Parent contribution ${U.money(0, ctx)} a year under the published rule`
          : `${n.atMost ? "At most " : "About "}${U.money(U.estimatePerYear(n), ctx)} a year on average`;
        return `<li><b>${e(name)}</b>: ${e(est)}${it.gap && it.gap.label ? `. ${e(it.gap.label)}. ${e(it.gap.note || "")}` : ""}</li>`;
      }).join("")}</ul>` : "<p>None yet.</p>"}`).join("");
      const deadlines = res.deadlines.map((d) => `<tr><td>${e(U.fullDate(d.date))}</td><td>${e(U.deadlineTitle(d))}</td><td>${e(short(app.findCollege(d.collegeId)))}</td><td>${d.status === "passed" ? "Passed" : st.ticks[d.id] ? "Done" : "To do"}</td></tr>`).join("");
      const documents = docs(res).map((d) => `<li>${e(d.title)}: ${e(U.DOC_STATUS[d.status].text)}</li>`).join("");
      const sources = facts.sources.map((s) => `<li><a href="${e(s.url)}">${e(s.title)}</a>${s.checked_on ? `, checked ${e(U.fullDate(s.checked_on))}` : ""}</li>`).join("");
      const rate = facts.exchange_rate;
      return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My Pont funding plan</title>
<style>body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111A35;max-width:760px;margin:32px auto;padding:0 16px}h1{font-size:28px}h2{font-size:20px;margin-top:32px;border-bottom:2px solid #E4E7F0;padding-bottom:6px}h3{font-size:16px;margin-bottom:4px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #E4E7F0;font-size:14px}.muted{color:#5A6480;font-size:14px}a{color:#2747C9}</style></head><body>
<h1>My funding plan</h1>
<p class="muted">Exported from Pont on ${e(U.fullDate(app.todayIso()))}. Pont is a prototype: estimates are not promises of aid or admission. Every number comes from the official pages listed below.</p>
<h2>Profile</h2>
<ul><li>Name: ${e(a.name || "Not given")}</li><li>Situation: ${e(facts.student.situation)}</li><li>Passports: ${e((a.passports || []).map(country).join(", "))}</li><li>Parents earn in: ${e((a.parentCountries || []).map(country).join(", "))}</li><li>Start: ${e(U.termLabel(a.term))}</li><li>Family income: ${e(facts.student.family_income)}</li><li>Family can pay per month: ${e(facts.student.family_can_pay_per_month)}</li><li>Exchange rate: ${e(rate)}</li></ul>
<h2>Routes</h2>${routes}
<h2>Deadlines</h2>${deadlines ? `<table><tr><th>Date</th><th>What</th><th>College</th><th>Status</th></tr>${deadlines}</table>` : "<p>None in our data.</p>"}
<h2>Documents</h2>${documents ? `<ul>${documents}</ul>` : "<p>None yet.</p>"}
<h2>Sources</h2><ul>${sources}</ul>
</body></html>`;
    }

    async function exportPlan() {
      const res = app.compute();
      if (!res) return;
      const html = planHtml(res);
      const filename = "pont-funding-plan.html";
      const blob = new Blob([html], { type: "text/html" });
      st.exportMsg = "";
      // Inside the claude.ai Artifact the page saves through the downloads capability (the viewer confirms).
      if (window.claude && typeof window.claude.use === "function") {
        let dl = null;
        try { dl = await window.claude.use("downloads"); } catch (e) { dl = null; }
        if (dl && typeof dl.save === "function") {
          try {
            await dl.save({ filename, data: blob });
            st.exportMsg = "Your plan was saved as an HTML file.";
          } catch (e) {
            st.exportMsg = e && e.code === "declined" ? "Export cancelled." : "This view cannot save files. Try again in claude.ai.";
          }
          app.render(false);
          return;
        }
      }
      try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        st.exportMsg = "Your plan was downloaded as an HTML file.";
      } catch (e) {
        st.exportMsg = "This browser could not save the file.";
      }
      app.render(false);
    }

    /* ---------- Events ---------- */
    const $ = (id) => document.getElementById(id);
    function onClick(e) {
      const t = e.target.closest("[data-doc-sel],[data-sample],[data-read],[data-confirm-field],[data-draft],[data-copy],[data-family-write],[data-essay-run],[data-export]");
      if (!t) return false;
      if (t.dataset.docSel) { st.docSel = t.dataset.docSel; st.docError = null; app.render(false, { focusId: "doc-title" }); return true; }
      if (t.dataset.sample) { useSample(t.dataset.doc, t.dataset.sample); return true; }
      if (t.dataset.read) { read(t.dataset.read); return true; }
      if (t.dataset.confirmField) {
        const name = t.dataset.confirmField;
        const input = $("fld-" + name);
        const entry = st.docs[st.docSel];
        if (!entry || !input || !input.value.trim()) return true;
        entry.confirmed = Object.assign({}, entry.confirmed, { [name]: input.value.trim().slice(0, 120) });
        app.saveDocs();
        app.render(false, { focusId: "doc-result" });
        return true;
      }
      if (t.dataset.draft) { draft(t.dataset.draft); return true; }
      if (t.dataset.copy) {
        const area = $(t.dataset.copy);
        const done = $(t.dataset.copy + "-copied");
        const ok = () => { if (done) done.textContent = "Copied."; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(area.value).then(ok, () => { area.select(); if (done) done.textContent = "Select and copy the text."; });
        else { area.select(); if (done) done.textContent = "Select and copy the text."; }
        return true;
      }
      if (t.dataset.familyWrite) { familyWrite(t.dataset.familyWrite); return true; }
      if (t.hasAttribute("data-essay-run")) { essayRun(); return true; }
      if (t.hasAttribute("data-export")) { exportPlan(); return true; }
      return false;
    }
    function onChange(e) {
      const t = e.target;
      if (t.dataset.docFile) { onFile(t.dataset.docFile, t.files && t.files[0]); return true; }
      if (t.dataset.formFiled) {
        st.docs[t.dataset.formFiled] = { filed: t.checked };
        app.saveDocs();
        app.render(false, { focusId: "form-filed" });
        return true;
      }
      if (t.hasAttribute("data-family-lang")) { st.familyLang = t.value; app.render(false, { focusId: "family-lang" }); return true; }
      if (t.id === "draft-question") { st.draftQuestion = t.value.trim().slice(0, 300); return true; }
      return false;
    }

    return { docs, documentsHtml, familyHtml, essayHtml, exportPlan, planHtml, englishSummary, onClick, onChange, evaluate, langName, defaultLang };
  }

  window.PontStudio = { create };
})();
