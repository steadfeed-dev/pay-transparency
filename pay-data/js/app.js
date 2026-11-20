/* Steadfeed Pay Data Report Builder - UI. All processing is local; the only fetches are this site's own static files. */
(function () {
  'use strict';
  const P = window.PDR;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtPct = (x) => isFinite(x) ? (x >= 0 ? '' : '−') + Math.abs(x).toFixed(1) + '%' : 'n/a';
  const fmtMoney = (x) => isFinite(x) ? '$' + x.toFixed(2) : 'n/a';
  const HIGH = 0.85;
  const NOTIFY_MAIL = 'hello@getsteadfeed.com';
  const NOTIFY_MAILTO = 'mailto:hello@getsteadfeed.com?subject=' +
    encodeURIComponent('Notify me when the official 2027 pay-data filing export opens') +
    '&body=' + encodeURIComponent('Please email me at this address when the official California RY2026 filing export is available on getsteadfeed.com/pay-data/.');

  const S = { raw: null, headers: [], map: {}, employees: [], issues: [], ests: {}, socMap: {}, matcher: null, ca: null, eu: null, loadedName: '' };

  // ---------- navigation ----------
  function go(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.toggle('active', s.id === 'step-' + step));
    document.querySelectorAll('#steps button').forEach(b => b.classList.toggle('active', b.dataset.step === step));
    if (step === 'headline') renderHeadline();
    if (step === 'soc') renderSoc();
    if (step === 'est') renderEsts();
    if (step === 'ca') renderCaSchemaInfo();
    if (step === 'eu') renderEuFilters();
    if (step === 'method') renderMethod();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#steps button').forEach(b => b.addEventListener('click', () => go(b.dataset.step)));

  function bindNotify(root) {
    if (!root) return;
    root.querySelectorAll('.copy-hello').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(NOTIFY_MAIL); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy address'; }, 1600); }
        catch (e) {
          const t = document.createElement('textarea'); t.value = NOTIFY_MAIL; document.body.appendChild(t); t.select();
          try { document.execCommand('copy'); btn.textContent = 'Copied'; } catch (err) { /* ignore */ }
          t.remove(); setTimeout(() => { btn.textContent = 'Copy address'; }, 1600);
        }
      });
    });
  }

  // ---------- file reading ----------
  async function readTable(file) {
    if (/\.xlsx?$/i.test(file.name)) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      const headers = rows.length ? Object.keys(rows[0]) : [];
      return { headers, rows };
    }
    return P.parseCSV(await file.text());
  }
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function ensureMatcher() {
    if (S.matcher) return S.matcher;
    const res = await fetch('data/soc-titles.json'); // same-origin static file shipped with the app
    S.matcher = new P.SocMatcher(await res.json());
    return S.matcher;
  }

  function loadEmployeesTable(t, name) {
    S.raw = t.rows; S.headers = t.headers; S.loadedName = name;
    S.map = P.autoMap(t.headers);
    $('loadStatus').innerHTML = `<span class="ok">Loaded ${t.rows.length.toLocaleString()} rows from ${esc(name)}</span> with ${t.headers.length} columns. Next: check column matching.`;
    renderMap(); applyMap(); go('map');
  }
  function loadEstsTable(t) {
    for (const r of t.rows) {
      const id = String(r.establishment_id ?? r.id ?? '').trim(); if (!id) continue;
      S.ests[id] = { name: r.name, address1: r.address1, address2: r.address2, city: r.city, state: r.state, zip: r.zip, naics: r.naics, activity: r.activity, filedLastYear: r.filed_last_year, hq: r.hq };
    }
  }
  $('fileEmployees').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { loadEmployeesTable(await readTable(f), f.name); } catch (e) { $('loadStatus').innerHTML = `<span class="bad">Could not read that file: ${esc(e.message)}</span>`; }
  });
  $('fileEsts').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { loadEstsTable(await readTable(f)); $('loadStatus').innerHTML = ( $('loadStatus').innerHTML || '' ) + ` <span class="ok">Loaded establishment details from ${esc(f.name)}</span>`; if (document.querySelector('#step-est.active')) renderEsts(); }
    catch (e) { $('loadStatus').innerHTML = `<span class="bad">Could not read establishment file: ${esc(e.message)}</span>`; }
  });
  $('btnDemo').addEventListener('click', async () => {
    const [emp, est] = await Promise.all([fetch('data/demo-payroll.csv').then(r => r.text()), fetch('data/demo-establishments.csv').then(r => r.text())]);
    loadEstsTable(P.parseCSV(est));
    loadEmployeesTable(P.parseCSV(emp), 'demo-payroll.csv (synthetic)');
  });

  // ---------- column map (copied from original, minus paid-button refresh) ----------
  function renderMap() {
    const opts = ['<option value="">(not in my file)</option>', ...S.headers.map(h => `<option>${esc(h)}</option>`)].join('');
    $('mapGrid').innerHTML = P.FIELDS.map(([k, label, req]) => `<label>${esc(label)}${req ? ' <span class="req">required</span>' : ''}<select data-field="${k}">${opts}</select></label>`).join('');
    $('mapGrid').querySelectorAll('select').forEach(s => { s.value = S.map[s.dataset.field] || ''; });
  }
  function applyMap() {
    $('mapGrid').querySelectorAll('select').forEach(s => { if (s.value) S.map[s.dataset.field] = s.value; else delete S.map[s.dataset.field]; });
    const out = P.prepareEmployees(S.raw, S.map);
    S.employees = out.employees; S.issues = out.issues;
    for (const e of S.employees) if (e.est && !S.ests[e.est]) S.ests[e.est] = { name: e.est };
    buildSocMap();
    renderIssues($('validation'), S.issues, `Checked ${S.employees.length.toLocaleString()} employees.`);
  }
  $('btnApplyMap').addEventListener('click', applyMap);

  function renderIssues(el, issues, prefix) {
    const errs = issues.filter(i => i.level === 'error'), warns = issues.filter(i => i.level === 'warning');
    const list = (arr) => arr.slice(0, 200).map(i => `<li>${i.line ? 'Row ' + esc(i.line) + ' ' : ''}${i.id ? '(' + esc(i.id) + ') ' : ''}${esc(i.msg)}</li>`).join('') + (arr.length > 200 ? `<li>…and ${arr.length - 200} more</li>` : '');
    el.innerHTML = `<div class="status">${esc(prefix || '')} <span class="${errs.length ? 'bad' : 'ok'}">${errs.length} error(s)</span>, <span class="${warns.length ? 'warn' : 'ok'}">${warns.length} warning(s)</span></div>` +
      (errs.length ? `<details open><summary>Errors</summary><ul class="issues">${list(errs)}</ul></details>` : '') +
      (warns.length ? `<details><summary>Warnings</summary><ul class="issues">${list(warns)}</ul></details>` : '');
  }

  // ---------- headline (free) ----------
  function renderHeadline() {
    if (!S.employees.length) { $('headline').innerHTML = '<p class="muted">Load data first.</p>'; return; }
    const eu = P.euMetrics(S.employees, { categoryOf: euCategoryFn() });
    const o = eu.overall;
    const pending = Object.values(S.socMap).filter(d => d.status === 'pending').length;
    $('headline').innerHTML = `
      <div class="card big"><div class="k">Mean gap</div><div class="v">${fmtPct(o.meanGap)}</div><div class="s">men ${fmtMoney(o.meanM)}/hr · women ${fmtMoney(o.meanF)}/hr</div></div>
      <div class="card big"><div class="k">Median gap</div><div class="v">${fmtPct(o.medianGap)}</div><div class="s">${o.nM} men · ${o.nF} women${eu.excludedNonBinary ? ` · ${eu.excludedNonBinary} non-binary counted separately` : ''}</div></div>
      <div class="card"><div class="k">Categories at 5% or more</div><div class="v">${eu.flagged} of ${eu.categories.length}</div><div class="s">by ${esc($('euCatSource').selectedOptions[0].text.toLowerCase())}</div></div>
      <div class="card"><div class="k">Job titles to review</div><div class="v">${pending}</div><div class="s">of ${Object.keys(S.socMap).length} unique titles</div></div>
      <div class="card"><div class="k">Data check</div><div class="v">${S.issues.filter(i => i.level === 'error').length} errors</div><div class="s">${S.issues.filter(i => i.level === 'warning').length} warnings</div></div>`;
  }

  // ---------- Job title → CA job category mapping ----------
  function buildSocMap() {
    const counts = {};
    for (const e of S.employees) if (e.title) counts[e.title] = (counts[e.title] || 0) + 1;
    ensureMatcher().then(m => {
      for (const [title, n] of Object.entries(counts)) {
        if (S.socMap[title]) { S.socMap[title].headcount = n; continue; }
        const s = m.suggest(title);
        S.socMap[title] = { title, headcount: n, suggestedMajor: s.major || '', suggestedCategory: s.category || '',
          suggestedSoc: s.soc || '', suggestedOccupation: s.soc ? (m.occupations[s.soc] || '') : '',
          matchedTitle: s.matchedTitle || '', confidence: s.confidence, method: s.method, alternatives: s.alternatives || [], final: '', status: 'pending', note: '', decidedAt: '' };
      }
      for (const t of Object.keys(S.socMap)) if (!counts[t]) delete S.socMap[t];
      if (document.querySelector('#step-soc.active')) renderSoc();
      if (document.querySelector('#step-headline.active')) renderHeadline();
    });
  }
  function decide(d, category, how) {
    d.final = category; d.status = category === d.suggestedCategory ? 'confirmed' : 'overridden'; d.decidedAt = new Date().toISOString(); d.decidedHow = how;
  }
  const categoryOpts = (sel) => ['<option value="">Choose…</option>', ...P.CA_JOB_CATEGORIES.map(([c, n]) => `<option value="${c}"${c === sel ? ' selected' : ''}>${c} ${esc(n)}</option>`)].join('');
  function catLabel(code) { return code ? `${code} ${P.CA_JOB_CATEGORY_NAME[code] || ''}` : ''; }
  function renderSoc() {
    const all = Object.values(S.socMap).sort((a, b) => b.headcount - a.headcount || a.title.localeCompare(b.title));
    const f = $('socFilter').value.toLowerCase(), st = $('socStatusFilter').value;
    const rows = all.filter(d => (!f || d.title.toLowerCase().includes(f)) && (!st || d.status === st));
    const c = { pending: 0, confirmed: 0, overridden: 0 }; all.forEach(d => c[d.status]++);
    $('socSummary').innerHTML = `${all.length} unique titles · <span class="ok">${c.confirmed} confirmed</span> · <span class="ok">${c.overridden} changed by you</span> · <span class="${c.pending ? 'warn' : 'ok'}">${c.pending} need review</span>`;
    $('socTable').innerHTML = `<thead><tr><th>Job title</th><th>People</th><th>Suggested category</th><th>Closest O*NET title / occupation</th><th>Confidence</th><th>Your decision</th><th>Note</th><th>Status</th></tr></thead><tbody>` +
      rows.map(d => `<tr data-title="${esc(d.title)}" class="st-${d.status}">
        <td>${esc(d.title)}</td><td class="num">${d.headcount}</td>
        <td>${d.suggestedCategory ? esc(catLabel(d.suggestedCategory)) : '<span class="muted">none</span>'}${d.alternatives && d.alternatives.length ? `<br><span class="muted small">Also possible: ${d.alternatives.map(a => `<abbr title="${esc(P.CA_JOB_CATEGORY_NAME[a] || '')}">${esc(a)}</abbr>`).join(', ')}</span>` : ''}</td>
        <td class="small">${esc(d.matchedTitle)}${d.suggestedSoc ? `<br><span class="muted">${esc(d.suggestedSoc)} ${esc(d.suggestedOccupation)}</span>` : ''}</td>
        <td><span class="conf ${d.confidence >= HIGH ? 'hi' : d.confidence >= 0.6 ? 'mid' : 'lo'}">${Math.round(d.confidence * 100)}%</span></td>
        <td><select class="socSel">${categoryOpts(d.final || d.suggestedCategory)}</select> <button class="small okbtn">Confirm</button></td>
        <td><input class="socNote" value="${esc(d.note)}" placeholder="Reason (optional)"></td>
        <td>${d.status === 'pending' ? '<span class="warn">Needs review</span>' : d.status === 'confirmed' ? '<span class="ok">Confirmed</span>' : '<span class="ok">Changed</span>'}</td></tr>`).join('') + '</tbody>';
  }
  $('socTable').addEventListener('click', (ev) => {
    if (!ev.target.classList.contains('okbtn')) return;
    const tr = ev.target.closest('tr'); const d = S.socMap[tr.dataset.title];
    const v = tr.querySelector('.socSel').value; if (!v) return;
    d.note = tr.querySelector('.socNote').value; decide(d, v, 'manual'); renderSoc();
  });
  $('socTable').addEventListener('change', (ev) => { if (ev.target.classList.contains('socNote')) S.socMap[ev.target.closest('tr').dataset.title].note = ev.target.value; });
  $('socFilter').addEventListener('input', renderSoc); $('socStatusFilter').addEventListener('change', renderSoc);
  $('btnConfirmHigh').addEventListener('click', () => { for (const d of Object.values(S.socMap)) if (d.status === 'pending' && d.suggestedCategory && d.confidence >= HIGH) decide(d, d.suggestedCategory, 'bulk-confirm >= 85%'); renderSoc(); });
  const MAP_HEADERS = ['job_title', 'headcount', 'suggested_category', 'suggested_category_name', 'suggested_major_group', 'suggested_soc_detailed', 'suggested_occupation', 'closest_onet_title', 'confidence', 'match_method', 'final_category', 'final_category_name', 'status', 'decided_how', 'decided_at', 'note'];
  $('btnExportMapping').addEventListener('click', () => {
    const rows = Object.values(S.socMap).sort((a, b) => a.title.localeCompare(b.title)).map(d => ({
      job_title: d.title, headcount: d.headcount, suggested_category: d.suggestedCategory, suggested_category_name: P.CA_JOB_CATEGORY_NAME[d.suggestedCategory] || '',
      suggested_major_group: d.suggestedMajor, suggested_soc_detailed: d.suggestedSoc, suggested_occupation: d.suggestedOccupation, closest_onet_title: d.matchedTitle, confidence: d.confidence,
      match_method: d.method, final_category: d.final, final_category_name: P.CA_JOB_CATEGORY_NAME[d.final] || '', status: d.status, decided_how: d.decidedHow || '', decided_at: d.decidedAt, note: d.note }));
    download('soc-mapping-record.csv', P.toCSV(MAP_HEADERS, rows));
  });
  $('fileMapping').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const t = P.parseCSV(await f.text()); let n = 0;
    for (const r of t.rows) {
      const d = S.socMap[r.job_title];
      const code = r.final_category || r.final_major_group;
      if (d && code && P.CA_JOB_CATEGORY_NAME[code]) {
        d.final = code; d.status = code === d.suggestedCategory ? 'confirmed' : 'overridden'; d.note = r.note || d.note; d.decidedAt = r.decided_at || new Date().toISOString(); d.decidedHow = 'imported: ' + (r.decided_how || 'prior record'); n++;
      }
    }
    $('socSummary').insertAdjacentHTML('afterend', `<div class="status ok">Applied ${n} saved decisions from ${esc(f.name)}.</div>`); renderSoc();
  });

  // ---------- establishments ----------
  const EST_FIELDS = [['name', 'Name'], ['address1', 'Address 1'], ['address2', 'Address 2'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['naics', 'NAICS'], ['activity', 'Major activity'], ['filedLastYear', 'Filed last year?'], ['hq', 'HQ?']];
  function renderEsts() {
    const ids = Object.keys(S.ests);
    const cnt = {}; S.employees.forEach(e => cnt[e.est] = (cnt[e.est] || 0) + 1);
    $('estTable').innerHTML = `<thead><tr><th>ID</th><th>People</th>${EST_FIELDS.map(f => `<th>${f[1]}</th>`).join('')}</tr></thead><tbody>` +
      ids.map(id => `<tr data-id="${esc(id)}"><td>${esc(id)}</td><td class="num">${cnt[id] || 0}</td>${EST_FIELDS.map(([k]) => `<td><input data-k="${k}" value="${esc(S.ests[id][k] ?? '')}"></td>`).join('')}</tr>`).join('') + '</tbody>';
    renderIssues($('estIssues'), P.validateEstablishments(S.ests), 'Establishment check:');
  }
  $('estTable').addEventListener('change', (ev) => { const i = ev.target; if (!i.dataset.k) return; S.ests[i.closest('tr').dataset.id][i.dataset.k] = i.value; renderIssues($('estIssues'), P.validateEstablishments(S.ests), 'Establishment check:'); });

  // ---------- California ----------
  function notifyBoxHtml() {
    return `<div class="notify-box" id="notifyOfficial">
      <h3>Get notified when the official 2027 filing export opens</h3>
      <p>This preview follows California CRD’s Nov 16, 2026 preliminary planning format. It is <strong>not a filing file</strong>. When CRD publishes the official Reporting Year 2026 template in February 2027, we’ll offer a matching export. Raise your hand and we’ll email you — we reply within one business day.</p>
      <p>Emailing us does not send your payroll. Everything you load here stays in this browser.</p>
      <p class="notify-actions">
        <a class="btn-mail" href="${NOTIFY_MAILTO}">Email hello@getsteadfeed.com</a>
        <button type="button" class="secondary copy-hello">Copy address</button>
        <span class="muted hello-addr">hello@getsteadfeed.com</span>
      </p>
    </div>`;
  }
  $('caSchema').innerHTML = Object.values(P.CA_SCHEMAS).map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
  $('caSchema').value = 'ca-ry2026-prelim';
  function renderCaSchemaInfo() {
    const s = P.CA_SCHEMAS[$('caSchema').value];
    if (s.status === 'preliminary' || s.doNotFile) {
      $('caAssumptions').innerHTML = `<div class="assume do-not-file"><strong>Preliminary planning format — do not file with CRD; official RY2026 filing template scheduled for Feb 2027.</strong><ul>${s.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul><p class="muted small">Source: ${esc(s.source)}</p></div>`;
    } else {
      $('caAssumptions').innerHTML = `<div class="status">Source: ${esc(s.source)}. Job Category uses EEO-1 codes 1–10 from your EEO-1 column.</div>`;
    }
    const prelim = s.id === 'ca-ry2026-prelim';
    if ($('btnCaCsv')) $('btnCaCsv').textContent = prelim ? 'Download preliminary planning preview (CSV)' : 'Download RY2025 layout (CSV)';
    if ($('btnCaXlsx')) $('btnCaXlsx').textContent = prelim ? 'Download preliminary planning preview (Excel)' : 'Download RY2025 layout (Excel)';
  }
  $('caSchema').addEventListener('change', renderCaSchemaInfo);
  $('btnBuildCa').addEventListener('click', () => {
    const id = $('caSchema').value;
    S.ca = P.buildCaReport(S.employees, S.ests, id, S.socMap);
    const st = S.ca.stats;
    $('caStats').innerHTML = `${st.included.toLocaleString()} California employees in ${st.groups} employee-group rows across ${st.establishments} establishment(s). ${st.excluded} employee(s) left out as not California employees.`;
    renderIssues($('caIssues'), S.ca.issues, 'Report check:');
    const H = S.ca.schema.headers;
    $('caTable').innerHTML = `<thead><tr>${H.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${S.ca.rows.map(r => `<tr>${H.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $('caLock').innerHTML = (S.ca.schema.doNotFile ? `<p class="do-not-file-banner">Preliminary planning format — do not file with CRD; official RY2026 filing template scheduled for Feb 2027. This preview has ${H.length} columns.</p>` : '') + notifyBoxHtml();
    bindNotify($('caLock'));
  });
  function caFileName(ext) {
    const id = $('caSchema').value;
    if (id === 'ca-ry2026-prelim') return `ca-ry2026-preliminary-planning-DO-NOT-FILE.${ext}`;
    return `ca-pay-data-${id}-payroll.${ext}`;
  }
  function caReady() { if (!S.ca) { alert('Build the report first.'); return false; } if (S.ca.issues.some(i => i.level === 'error')) { if (!confirm('The report still has errors. Download anyway for review?')) return false; } return true; }
  $('btnCaCsv').addEventListener('click', () => { if (caReady()) download(caFileName('csv'), '\uFEFF' + P.toCSV(S.ca.schema.headers, S.ca.rows)); /* UTF-8 BOM, as in CRD's own CSV example */ });
  $('btnCaXlsx').addEventListener('click', () => {
    if (!caReady()) return;
    const ws = XLSX.utils.json_to_sheet(S.ca.rows, { header: S.ca.schema.headers });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Payroll Employee Report');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(caFileName('xlsx'), new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  });

  // ---------- EU ----------
  function euCategoryFn() {
    const src = $('euCatSource').value;
    if (src === 'soc') return e => { const d = S.socMap[e.title]; const c = d && (d.final || d.suggestedCategory); return c ? `${c} ${P.CA_JOB_CATEGORY_NAME[c] || ''}` + (d.final ? '' : ' (unconfirmed)') : 'Unmapped'; };
    if (src === 'title') return e => e.title || 'Untitled';
    return e => e.workerCategory || 'All workers';
  }
  function renderEuFilters() {
    const ids = Object.keys(S.ests);
    if ($('euEstFilter').dataset.ids === ids.join('|')) return;
    $('euEstFilter').dataset.ids = ids.join('|');
    $('euEstFilter').innerHTML = 'Establishments: ' + ids.map(id => `<label class="chip"><input type="checkbox" value="${esc(id)}" checked> ${esc(S.ests[id].name || id)}</label>`).join('');
  }
  function euFilter() { const on = new Set([...$('euEstFilter').querySelectorAll('input:checked')].map(i => i.value)); return e => on.has(e.est); }
  $('euCatSource').addEventListener('change', () => { if (document.querySelector('#step-headline.active')) renderHeadline(); });
  $('btnBuildEu').addEventListener('click', () => {
    S.eu = P.euMetrics(S.employees, { categoryOf: euCategoryFn(), filter: euFilter() });
    const m = S.eu, o = m.overall;
    const cats = m.categories;
    $('euOut').innerHTML = `
      <p class="muted">First EU reports are due <strong>June 7, 2027</strong> (yearly for 250+ workers; every three years for 150–249). A category gets the 5% flag when the mean gap is 5% or more either way.</p>
      <h3>Organisation-wide (${m.n} workers${m.excludedNonBinary ? `; ${m.excludedNonBinary} non-binary counted separately` : ''})</h3>
      <table class="data"><tbody>
      <tr><th>(a) Gender pay gap, mean</th><td>${fmtPct(o.meanGap)}</td></tr>
      <tr><th>(c) Gender pay gap, median</th><td>${fmtPct(o.medianGap)}</td></tr>
      <tr><th>(b) Variable pay gap, mean (recipients only)</th><td>${fmtPct(o.varMeanGap)} <span class="muted">· across all workers ${fmtPct(o.varAllMeanGap)}</span></td></tr>
      <tr><th>(d) Variable pay gap, median (recipients only)</th><td>${fmtPct(o.varMedianGap)}</td></tr>
      <tr><th>(e) Share receiving variable pay</th><td>women ${isFinite(o.shareVarF) ? o.shareVarF.toFixed(1) + '%' : 'n/a'} · men ${isFinite(o.shareVarM) ? o.shareVarM.toFixed(1) + '%' : 'n/a'}</td></tr>
      </tbody></table>
      <h3>(f) Quartile pay bands</h3>
      <table class="data"><thead><tr><th>Quartile</th><th>Women</th><th>Men</th><th>% women</th><th>% men</th></tr></thead><tbody>
      ${m.quartiles.map(q => `<tr><td>Q${q.q}${q.q === 1 ? ' (lowest)' : q.q === 4 ? ' (highest)' : ''}</td><td class="num">${q.F}</td><td class="num">${q.M}</td><td class="num">${q.pctF.toFixed(1)}%</td><td class="num">${q.pctM.toFixed(1)}%</td></tr>`).join('')}</tbody></table>
      <h3>(g) By category of workers <span class="pill ${m.flagged ? 'bad' : 'ok'}">${m.flagged} at 5% or more</span></h3>
      <table class="data"><thead><tr><th>Category</th><th>Women</th><th>Men</th><th>Mean gap (total)</th><th>Median gap</th><th>Basic pay gap (mean)</th><th>Variable gap (mean)</th><th>5% flag</th></tr></thead><tbody>
      ${cats.map(c => `<tr class="${c.flag5 ? 'flag' : ''}"><td>${esc(c.category)}${c.smallSample ? ' <span class="muted small">(small group)</span>' : ''}</td><td class="num">${c.nF}</td><td class="num">${c.nM}</td><td class="num">${fmtPct(c.meanGap)}</td><td class="num">${fmtPct(c.medianGap)}</td><td class="num">${fmtPct(c.baseMeanGap)}</td><td class="num">${fmtPct(c.varMeanGap)}</td><td>${c.flag5 ? '<span class="bad">5% or more</span>' : (isFinite(c.meanGap) ? 'under 5%' : 'n/a')}</td></tr>`).join('')}
      </tbody></table>
      <p class="muted small">"Small group" means fewer than 5 women or 5 men. Check national rules on publishing small cells. A gap of n/a means one sex isn't present. This is an analysis aid — it does not file with any EU authority.</p>`;
  });
  const EU_HEADERS = ['category', 'women', 'men', 'mean_gap_pct', 'median_gap_pct', 'basic_mean_gap_pct', 'basic_median_gap_pct', 'variable_mean_gap_pct_recipients', 'variable_median_gap_pct_recipients', 'share_women_variable_pct', 'share_men_variable_pct', 'flag_5pct', 'small_group'];
  const f2 = (x) => isFinite(x) ? x.toFixed(2) : '';
  $('btnEuCsv').addEventListener('click', () => {
    if (!S.eu) return alert('Calculate first.');
    const row = (name, c) => ({ category: name, women: c.nF, men: c.nM, mean_gap_pct: f2(c.meanGap), median_gap_pct: f2(c.medianGap), basic_mean_gap_pct: f2(c.baseMeanGap), basic_median_gap_pct: f2(c.baseMedianGap),
      variable_mean_gap_pct_recipients: f2(c.varMeanGap), variable_median_gap_pct_recipients: f2(c.varMedianGap), share_women_variable_pct: f2(c.shareVarF), share_men_variable_pct: f2(c.shareVarM), flag_5pct: c.flag5 === undefined ? '' : (c.flag5 ? 'YES' : 'no'), small_group: c.smallSample ? 'yes' : '' });
    const rows = [row('ORGANISATION TOTAL', S.eu.overall), ...S.eu.categories.map(c => row(c.category, c))];
    const q = S.eu.quartiles.map(x => ({ category: `QUARTILE ${x.q}`, women: x.F, men: x.M, mean_gap_pct: '', share_women_variable_pct: '', flag_5pct: '', small_group: '' }));
    download('eu-article9-indicators.csv', P.toCSV(EU_HEADERS, [...rows, ...q]));
  });
  function printHtml(html) { $('printArea').innerHTML = html; document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); }
  $('btnEuPrint').addEventListener('click', () => { if (!S.eu) return alert('Calculate first.'); printHtml(`<h1>EU Pay Transparency Directive: Article 9 indicators</h1><p>Prepared ${new Date().toLocaleDateString()} with the Steadfeed Pay Data Report Builder. Analysis aid, not legal advice. Does not file with any EU authority. First reports due June 7, 2027.</p>${$('euOut').innerHTML}`); });

  // ---------- methodology ----------
  function methodHtml() {
    const s = P.CA_SCHEMAS[$('caSchema').value]; const soc = Object.values(S.socMap);
    const c = { pending: 0, confirmed: 0, overridden: 0 }; soc.forEach(d => c[d.status]++);
    const bulk = soc.filter(d => d.decidedHow === 'bulk-confirm >= 85%').length;
    const box1 = S.employees.filter(e => e.usedBox1).length;
    return `<h1>Pay data methodology summary</h1>
      <p><strong>Prepared:</strong> ${new Date().toLocaleString()} · <strong>Source file:</strong> ${esc(S.loadedName || 'n/a')} · <strong>Employees:</strong> ${S.employees.length}</p>
      <h3>California pay data report</h3>
      <ul><li>Layout: ${esc(s.label)}. ${esc(s.source)}.</li>
      ${s.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}
      <li>Snapshot period: ${esc($('snapStart').value || 'not entered')} to ${esc($('snapEnd').value || 'not entered')}.</li>
      <li>Annual earnings come from W-2 Box 5. Box 1 was used for ${box1} employee(s) with no Box 5 amount, noted in row remarks.</li>
      <li>Hourly rate = annual earnings ÷ annual hours worked, including paid time off. Means and medians are per employee group, rounded to two decimals. Hours and weeks are summed per group and rounded to whole numbers.</li>
      <li>Employee groups are establishment × job category × race/ethnicity/sex × pay band × exemption status × employment type.</li>
      <li>California employees are everyone assigned to a California establishment, plus people assigned elsewhere who work remotely in California.</li>
      ${S.ca ? `<li>Result: ${S.ca.stats.included} employees, ${S.ca.stats.groups} rows, ${S.ca.issues.filter(i => i.level === 'error').length} unresolved errors.</li>` : ''}</ul>
      <h3>Job category classification</h3>
      <ul><li>${soc.length} unique job titles. ${c.confirmed} confirmed as suggested (${bulk} of them by bulk confirmation at 85% confidence or higher), ${c.overridden} changed by a reviewer, ${c.pending} still pending.</li>
      <li>Suggestions come from O*NET 30.0 occupation, alternate and reported titles (CC BY 4.0), mapped to California CRD’s Nov 16, 2026 preliminary job categories (11-1010, 11-M000, then 13-0000 through 53-0000). A person decides every final category, and the record is exported as soc-mapping-record.csv.</li></ul>
      <h3>EU Article 9 indicators</h3>
      <ul><li>Hourly pay = (base + variable) ÷ annual hours. Gap = (men − women) ÷ men. Quartiles split everyone into four equal-sized groups ranked by total hourly pay. A category gets the 5% flag when its mean gap is 5% or more either way. Non-binary employees are reported separately. First reports due June 7, 2027.</li></ul>
      <p><strong>Analysis aid, not legal advice.</strong> This tool does not file with CRD or any EU authority, and it does not yet build the labor-contractor employee report. Check against the official CRD handbook and template, your national transposition law, and your counsel.</p>`;
  }
  function renderMethod() { $('methodOut').innerHTML = methodHtml(); }
  $('btnMethodPrint').addEventListener('click', () => printHtml(methodHtml()));

  bindNotify(document);
  renderCaSchemaInfo();
  ensureMatcher();
})();
