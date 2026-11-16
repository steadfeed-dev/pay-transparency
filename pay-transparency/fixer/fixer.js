// Free Job Ad Fixer UI. Everything runs in this browser tab: the ad text is never uploaded, stored or sent
// anywhere (no fetch/XHR in this file or the engine). Deterministic rules, no AI.
import { fixJobAd, BENEFIT_OPTIONS, OTHER_COMP_OPTIONS, FIXER_REVIEWED_ON } from './fixer-core.js';
import { STATE_NAMES } from '../checker/engine.js';

// Set to the public Apify Store URL at go-live; null shows "coming soon".
const BULK_URL = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const fmtDate = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const BEN_SHOWN = ['health', 'dental', 'vision', 'retirement', 'retirementMatch', 'pto', 'sick', 'holidays', 'life', 'disability'];
const OC_SHOWN = ['bonus', 'commission', 'overtime', 'equity'];

const EXAMPLES = {
    denver: { label: 'Denver café, “DOE”', text: 'Barista – Example Café\nLocation: Denver, CO\n\nCompetitive pay, DOE.\nGreat benefits!\nOpen until filled.\n\nMake great coffee and great days for our regulars. Weekend shifts required.', state: 'CO', city: 'Denver', remote: 'no', employees: 12, payType: 'range', min: '18.50', max: '21', period: 'hour', tipped: true, benefits: ['health', 'pto', 'sick'], ocNone: false, applyBy: '2026-12-15', howToApply: 'Apply at example.com/jobs' },
    brooklyn: { label: 'Brooklyn, no pay yet', text: 'Office Coordinator – Example Co.\nLocation: Brooklyn, NY\n\nCompetitive salary, DOE.\nBenefits: medical and dental insurance, 401(k), paid time off.\n\nKeep our 8-person office running smoothly.', state: 'NY', city: 'Brooklyn', remote: 'no', employees: 8, payType: 'range' },
    chicago: { label: 'Chicago “$80k+”', text: 'Account Executive – Example Co.\nLocation: Chicago, IL\n\nBase salary: $80k+ plus uncapped commission.\nBenefits: medical and dental insurance, 401(k), paid time off.\n\nOwn a book of small-business accounts.', state: 'IL', city: 'Chicago', remote: 'no', employees: 40, payType: 'range', min: '80000', max: '95000', period: 'year', oc: ['commission'] },
    columbus: { label: 'Columbus, Ohio', text: 'Line Cook – Example Diner\nLocation: Columbus, OH\n\nPay depends on experience.\n\nJoin a friendly breakfast-and-lunch kitchen. No late nights.', state: 'OH', city: 'Columbus', remote: 'no', employees: 18, payType: 'range', min: '17', max: '20', period: 'hour' },
    remote: { label: 'Remote, US', text: 'Customer Success Manager – Example Co.\nLocation: Remote (US)\n\nWe offer a competitive package and great culture.\n\nHelp 200 small-business customers get value from our software.', state: '', city: '', remote: 'yes', employees: 30, payType: 'range', min: '62000', max: '74000', period: 'year', benefits: ['health', 'retirementMatch', 'pto'], ocNone: true, ongoing: true, howToApply: 'Send your resume through example.com/careers' },
};

function chips(containerId, options, shown, name) {
    const map = new Map(options);
    $(containerId).innerHTML = shown.map((k) => `<label class="fx-chip"><input type="checkbox" name="${name}" value="${k}"><span>${esc(map.get(k))}</span></label>`).join('');
}
function setup() {
    const sel = $('fx-state');
    for (const [abbr, name] of Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]))) { const o = document.createElement('option'); o.value = abbr; o.textContent = name; sel.appendChild(o); }
    chips('fx-benefits', BENEFIT_OPTIONS, BEN_SHOWN, 'benefit');
    chips('fx-oc', OTHER_COMP_OPTIONS, OC_SHOWN, 'oc');
    $('fx-paytype').addEventListener('change', syncPayType); syncPayType();
    $('fx-ben-none').addEventListener('change', () => { for (const c of document.querySelectorAll('input[name=benefit]')) { c.disabled = $('fx-ben-none').checked; if (c.disabled) c.checked = false; } });
    $('fx-ongoing').addEventListener('change', () => { $('fx-applyby').disabled = $('fx-ongoing').checked; });
    $('fx-form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
    $('fx-clear').addEventListener('click', () => { $('fx-form').reset(); syncPayType(); $('fx-results').hidden = true; $('fx-text').focus(); });
    for (const b of document.querySelectorAll('[data-example]')) b.addEventListener('click', () => loadExample(b.dataset.example));
}
function syncPayType() {
    const t = $('fx-paytype').value;
    $('fx-max-wrap').hidden = t !== 'range';
    for (const id of ['fx-min-wrap', 'fx-period-wrap']) $(id).hidden = t === 'commission_only';
    $('fx-min-label').textContent = t === 'fixed' ? 'Pay rate' : 'Lowest pay';
}
function loadExample(key) {
    const x = EXAMPLES[key]; $('fx-form').reset();
    $('fx-text').value = x.text; $('fx-state').value = x.state; $('fx-city').value = x.city; $('fx-remote').value = x.remote; $('fx-emp').value = x.employees ?? '';
    $('fx-paytype').value = x.payType ?? 'range'; syncPayType();
    $('fx-min').value = x.min ?? ''; $('fx-max').value = x.max ?? ''; $('fx-period').value = x.period ?? 'hour'; $('fx-tipped').checked = !!x.tipped;
    for (const c of document.querySelectorAll('input[name=benefit]')) c.checked = (x.benefits ?? []).includes(c.value);
    for (const c of document.querySelectorAll('input[name=oc]')) c.checked = (x.oc ?? []).includes(c.value);
    $('fx-oc-none').checked = !!x.ocNone; $('fx-ben-none').checked = false;
    $('fx-applyby').value = x.applyBy ?? ''; $('fx-ongoing').checked = !!x.ongoing; $('fx-applyby').disabled = !!x.ongoing; $('fx-howto').value = x.howToApply ?? '';
    run();
}
function readForm() {
    const checked = (n) => [...document.querySelectorAll(`input[name=${n}]:checked`)].map((c) => c.value);
    const t = $('fx-paytype').value;
    return {
        text: $('fx-text').value, state: $('fx-state').value, city: $('fx-city').value, remote: $('fx-remote').value, employees: $('fx-emp').value === '' ? null : Number($('fx-emp').value),
        pay: t === 'commission_only' ? { type: 'commission_only' } : { type: t, min: $('fx-min').value, max: t === 'fixed' ? $('fx-min').value : $('fx-max').value, period: ($('fx-min').value || $('fx-max').value) ? $('fx-period').value : null, tipped: $('fx-tipped').checked },
        benefits: $('fx-ben-none').checked ? 'none' : [...checked('benefit'), ...($('fx-ben-other').value.trim() ? [] : [])], benefitsOther: $('fx-ben-other').value.trim(),
        otherComp: $('fx-oc-none').checked ? 'none' : checked('oc'),
        applyBy: $('fx-ongoing').checked ? 'ongoing' : $('fx-applyby').value, howToApply: $('fx-howto').value.trim(),
    };
}
const STATUS = {
    ready: ['status-ok', 'Ready to post', 'Here is your ad with the changes below. Read it once, then copy it.'],
    needs_input: ['status-review', 'Almost there', 'We fixed what we could. Fill in the items marked [ADD …] (the questions below say what each one needs), then fix again.'],
    no_law_found: ['status-none', 'No posting law in force here today', 'We didn’t find a state or city pay-posting law in force for this location today. Showing pay still helps your ad.'],
    need_location: ['status-review', 'Where is the job?', 'Pick a state or city, or mark the job remote. The rules depend on where the work is done.'],
    invalid_input: ['status-issue', 'Something needs a fix', ''],
};
const lawChips = (laws) => (laws?.length ? `<span class="fx-laws">${laws.map((l) => `<a href="${esc(l.sourceUrl)}" rel="noopener" target="_blank">${esc(l.name)} ${ic('i-link')}</a>`).join('')}</span>` : '');
function highlight(text) { return esc(text).replace(/\[ADD [^\]]*\]/g, (m) => `<mark>${m}</mark>`); }
function run() {
    const text = $('fx-text').value.trim();
    if (!text) { $('fx-err').hidden = false; $('fx-text').setAttribute('aria-invalid', 'true'); $('fx-text').focus(); return; }
    $('fx-err').hidden = true; $('fx-text').removeAttribute('aria-invalid');
    const r = fixJobAd(readForm());
    const [cls, title, sub] = STATUS[r.status];
    const block = [];
    block.push(`<div class="pc-verdict ${cls}"><span class="status">${esc(title)}</span><p>${esc(r.status === 'invalid_input' ? r.inputErrors.join(' ') : sub)}</p><p class="pc-verdict-meta">${esc(r.summary)} Rules checked ${fmtDate(r.rulesCheckedOn)}.</p></div>`);
    if (r.status !== 'invalid_input' && r.status !== 'need_location') {
        block.push(`<div class="fx-out"><div class="fx-out-head"><h3>${ic('i-file')}Your fixed ad</h3><button type="button" class="btn btn-sm" id="fx-copy">Copy ad</button></div><pre id="fx-fixed" tabindex="0">${highlight(r.fixedText)}</pre>
<details class="fx-orig"><summary>Show the original</summary><pre>${esc(r.originalText ?? '')}</pre></details></div>`);
    }
    if (r.needsInput.length) block.push(`<h3 class="pc-sub">${ic('i-alert')}Only you can fill these in</h3><ul class="fx-list fx-ask">${r.needsInput.map((n) => `<li><b>${esc(n.question)}</b><span>${esc(n.why)}</span>${lawChips(n.laws)}</li>`).join('')}</ul>`);
    if (r.changes.length) block.push(`<h3 class="pc-sub">${ic('i-check')}What we changed, and why</h3><ol class="pc-fixes fx-changes">${r.changes.map((c) => `<li><b>${esc(c.title)}</b><span>${esc(c.why)}</span>${lawChips(c.laws)}</li>`).join('')}</ol>`);
    if (r.notes.length) block.push(`<h3 class="pc-sub">${ic('i-eye')}Good to know</h3><ul class="fx-list">${r.notes.map((n) => `<li><b>${esc(n.title)}</b><span>${esc(n.body)}</span>${lawChips(n.laws)}</li>`).join('')}</ul>`);
    if (r.lawsApplied?.length) block.push(`<details class="pc-remote"><summary>${ic('i-shield')}<span><b>Laws we applied (${r.lawsApplied.length})</b></span>${ic('i-plus')}</summary><div class="pc-laws">${r.lawsApplied.map((l) => `<div class="pc-law"><h4>${esc(l.name)}</h4><p class="pc-law-meta">${esc(l.employerSize)}</p><p class="pc-law-req"><b>Ads must show:</b> ${esc(l.shows)}</p><a class="pc-src" href="${esc(l.sourceUrl)}" rel="noopener" target="_blank">Official source, checked ${fmtDate(l.checkedOn)} ${ic('i-arrow')}</a></div>`).join('')}</div></details>`);
    if (r.lawsSkipped?.length) block.push(`<p class="pc-small">Not applied: ${r.lawsSkipped.map((s) => `${esc(s.name)} (${esc(s.reason)})`).join('; ')}</p>`);
    block.push(`<p class="fx-disclaimer">${ic('i-shield')}<span>${esc(r.disclaimer)}</span></p>`);
    block.push(`<div class="pc-upsell"><div><b>Fixing lots of ads?</b><p>The bulk Job Ad Fixer takes a spreadsheet of ads and returns every one fixed, with the same reasons and sources. About $0.02 per fixed ad, pay as you go.</p></div><div class="pc-upsell-btns">${BULK_URL ? `<a class="btn" href="${BULK_URL}">Fix ads in bulk ${ic('i-arrow')}</a>` : '<span class="fx-soon">Bulk version coming soon</span>'}<a class="btn btn-ghost" href="../../guides/pay-transparent-job-ads/">Read the guide</a></div></div>`);
    const res = $('fx-results'); res.innerHTML = block.join(''); res.hidden = false; res.focus({ preventScroll: true }); res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const copy = $('fx-copy'); if (copy) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(r.fixedText); copy.textContent = 'Copied'; } catch { const sel = window.getSelection(); const rg = document.createRange(); rg.selectNodeContents($('fx-fixed')); sel.removeAllRanges(); sel.addRange(rg); copy.textContent = 'Selected: press Ctrl+C'; } setTimeout(() => { copy.textContent = 'Copy ad'; }, 2500); });
}
setup();
const ex = new URLSearchParams(location.search).get('example'); if (ex && EXAMPLES[ex]) loadExample(ex);
