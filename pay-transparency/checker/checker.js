// Free Pay Transparency Checker UI. Everything happens in this browser tab: the posting text is never
// uploaded, stored or sent anywhere (no fetch/XHR in this file or the engine).
import { analyze, fixes, describeRange, STATE_NAMES, CHECKER_REVIEWED_ON } from './engine.js';
import { RULES } from './lib/rules.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ic = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const APIFY = 'https://apify.com/steadfeed/pay-transparency-compliance-monitor?utm_source=steadfeed-site&amp;utm_medium=website&amp;utm_campaign=free-checker&amp;utm_content=';

const BEN = 'Benefits: medical, dental and vision insurance, 401(k) with match, and paid time off.';
const EXAMPLES = {
    pass: { state: 'CO', city: 'Denver', remote: 'no', text: `Senior Accountant – Example Co.\nLocation: Denver, CO\n\nSalary range: $95,000 – $115,000 per year, based on experience.\n${BEN}\nApplications accepted through December 15, 2026.` },
    doe: { state: 'NY', city: 'Brooklyn', remote: 'no', text: `Office Coordinator – Example Co.\nLocation: Brooklyn, NY\n\nCompetitive salary, DOE.\n${BEN}` },
    plus: { state: 'IL', city: 'Chicago', remote: 'no', text: `Account Executive – Example Co.\nLocation: Chicago, IL\n\nBase salary: $80k+ plus uncapped commission.\n${BEN}` },
    hourly: { state: 'CA', city: 'San Diego', remote: 'no', text: `Warehouse Associate – Example Co.\nLocation: San Diego, CA\n\nPay rate: $22/hr - $28/hr\n${BEN}` },
    remote: { state: '', city: '', remote: 'yes', text: `Customer Success Manager – Example Co.\nLocation: Remote (US)\n\nWe offer a competitive package and great culture.\n${BEN}` },
};

function stateOptions() {
    const sel = $('pc-state');
    for (const [abbr, name] of Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]))) {
        const o = document.createElement('option'); o.value = abbr; o.textContent = name; sel.appendChild(o);
    }
}

const VERDICT = {
    looks_good: ['status-ok', 'Looks good', 'We found a pay range and nothing else this check looks for is missing.'],
    review: ['status-review', 'Worth a second look', 'The basics are there, but something may need a small fix.'],
    likely_missing: ['status-issue', 'Likely missing required pay info', 'This posting probably doesn’t meet at least one pay-transparency law that applies to it.'],
    no_law: ['status-none', 'No posting law found for this location', 'We didn’t find a pay-range posting law for the location you gave. Showing pay is still a good idea, and it gets more applicants.'],
    need_location: ['status-none', 'Where is this job?', 'Add a state or city, or mark the job as remote, so we know which laws to check.'],
};
const MSG = { missing_pay_range: 'No pay range was found in the text you pasted.', pay_text_unparseable: 'Pay wording is there, but no clear dollar range could be read from it.' };
const TYPE_LABEL = { missing_pay_range: 'No pay range', open_ended_pay: 'Open-ended pay (“from” / “up to” / “+”)', single_figure_pay: 'Single figure, not a range', pay_text_unparseable: 'Pay wording unclear', wide_pay_range: 'Very wide range', range_exceeds_legal_cap: 'Range wider than allowed', missing_benefits: 'No benefits description', missing_application_close: 'No application close date' };

function lawCard(rule, own, basis) {
    const issues = own.filter((f) => f.reviewPriority !== 'low');
    const st = issues.some((f) => f.reviewPriority === 'high') ? ['status-issue', 'Likely missing'] : issues.length ? ['status-review', 'Review'] : ['status-ok', 'Looks OK'];
    return `<article class="pc-law">
      <div class="pc-law-top"><h4>${esc(rule.name)}</h4><span class="status ${st[0]}">${st[1]}</span></div>
      <p class="pc-law-meta">In force since ${esc(fmtDate(rule.effectiveDate))} · Applies to: ${esc(rule.employerCoverage)}${basis === 'remote_exposure' ? ' · Reaches this job because it is remote' : ''}</p>
      <p class="pc-law-req"><b>The law asks for:</b> ${esc(rule.requirement)}</p>
      ${issues.length ? `<ul class="pc-law-issues">${issues.map((f) => `<li>${ic('i-alert')}<span><b>${esc(TYPE_LABEL[f.type] ?? f.type)}.</b> ${esc(MSG[f.type] ?? f.message.replace(/ A remote role open to applicants in these states can be screened against each state's law\./, ''))}</span></li>`).join('')}</ul>` : ''}
      ${rule.ruleCaveat && !/penalt/i.test(rule.ruleCaveat) ? `<p class="pc-law-note">${esc(rule.ruleCaveat)}</p>` : ''}
      <a class="pc-src" href="${esc(rule.sourceUrl)}" rel="noopener" target="_blank">Official source ${ic('i-arrow')}</a>
    </article>`;
}

function render(res) {
    const out = $('pc-results');
    const [cls, head, sub] = VERDICT[res.verdict];
    const a = res.audit;
    const own = (code) => a.findings.filter((f) => f.jurisdiction === code || (f.jurisdictions ?? []).includes(code));
    const named = a.lawsScreened.filter((l) => l.basis !== 'remote_exposure');
    const remote = a.lawsScreened.filter((l) => l.basis === 'remote_exposure');
    const fx = fixes(res);
    const pay = res.pay;
    let payHtml;
    if (pay.payRanges.length) {
        payHtml = `<ul class="pc-pay-list">${pay.payRanges.map((r) => `<li><b>${esc(describeRange(r))}</b>${r.payPeriod && r.payPeriod !== 'year' && r.annualMin ? `<small>About ${esc('$' + Math.round(r.annualMin).toLocaleString('en-US'))}${r.annualMax && r.annualMax !== r.annualMin ? ' – $' + esc(Math.round(r.annualMax).toLocaleString('en-US')) : ''} a year at full time</small>` : ''}${r.payPeriod ? '' : '<small>No pay period found. Adding “per year” or “per hour” makes it clearer.</small>'}</li>`).join('')}</ul>`;
    } else {
        payHtml = `<p class="pc-none">${ic('i-x')} No pay range found${res.vagueTerm ? `. “${esc(res.vagueTerm)}” isn’t a pay range` : ''}.</p>`;
    }
    const locLine = res.locations.length ? `${res.locations.map(esc).join('; ')}${res.locationSource === 'posting' ? ' (read from the posting)' : ''}` : 'none given';
    const skipped = a.lawsSkipped.filter((s) => s.reason !== 'not_yet_in_force').map((s) => `${RULES[s.code]?.name ?? s.code} (applies only to employers with ${RULES[s.code]?.min}+ employees)`);
    const upcoming = res.upcoming.map((r) => `${r.name}: starts ${fmtDate(r.effectiveDate)}`);
    out.innerHTML = `
      <h2 class="sr-only">Your result</h2>
      <div class="pc-verdict ${cls}" role="status">
        <span class="status ${cls}">${esc(head)}</span>
        <p>${esc(sub)}</p>
        <p class="pc-verdict-meta">Location checked: ${locLine} · Remote: ${res.isRemote ? 'yes' : 'no'}${res.employees != null ? ` · Employees: ${esc(res.employees)}` : ''}</p>
      </div>
      <div class="pc-cols">
        <section class="pc-box"><h3>${ic('i-dollar')}Pay we found</h3>${payHtml}</section>
        <section class="pc-box"><h3>${ic('i-check')}What to fix</h3>${fx.length ? `<ol class="pc-fixes">${fx.map((f) => `<li><b>${esc(f.title)}</b><span>${esc(f.body)}</span></li>`).join('')}</ol>` : '<p class="pc-none ok">Nothing to fix from this check. Keep the range a good-faith estimate of what you’d really pay.</p>'}</section>
      </div>
      ${named.length ? `<h3 class="pc-sub">Laws that apply to this location</h3><div class="pc-laws">${named.map((l) => lawCard(RULES[l.code], own(l.code), l.basis)).join('')}</div>` : ''}
      ${remote.length ? `<details class="pc-remote"${named.length ? '' : ' open'}><summary>${ic('i-globe')}<span><b>Remote role:</b> ${remote.length} state laws may reach it, because someone in those states could take the job</span>${ic('i-plus')}</summary>
        <p class="pc-remote-note">${a.findings.some((f) => f.basis === 'remote_exposure' && f.reviewPriority !== 'low') ? 'Each state below can apply if someone there could take the job. Fixing the items above covers all of them.' : 'Nothing this check looks for is missing for these states.'} Some states only count employers of a certain size; add your employee count above to narrow the list.</p>
        <div class="pc-laws">${remote.map((l) => lawCard(RULES[l.code], own(l.code).length ? own(l.code) : a.findings.filter((f) => f.jurisdiction === 'US-REMOTE' && f.jurisdictions.includes(l.code)), l.basis)).join('')}</div></details>` : ''}
      ${skipped.length || upcoming.length ? `<p class="pc-small">${skipped.length ? `Not counted because of your employee count: ${skipped.map(esc).join('; ')}. ` : ''}${upcoming.length ? `Coming soon: ${upcoming.map(esc).join('; ')}.` : ''}</p>` : ''}
      <div class="pc-upsell">
        <div><b>Hiring for more than one role?</b><p>The Pay Transparency Compliance Monitor runs this same check on every public Greenhouse, Lever and Ashby posting a company has, re-checks weekly and flags when a pay range disappears. From $0.02 per posting, pay per use.</p></div>
        <div class="pc-upsell-btns"><a class="btn" href="${APIFY}result-cta">Try the monitor on Apify ${ic('i-arrow')}</a><a class="btn btn-outline" href="../">How the monitor works</a></div>
      </div>
      <p class="pc-small">Screening only, not legal advice. Laws reviewed ${esc(fmtDate(CHECKER_REVIEWED_ON))}. Employer-size rules, remote-work rules and exceptions vary; check the official source for each law or ask an employment lawyer.</p>`;
    out.hidden = false;
}

function run(e) {
    e?.preventDefault();
    const text = $('pc-text').value;
    if (!text.trim()) { $('pc-text').focus(); $('pc-text').setAttribute('aria-invalid', 'true'); $('pc-err').hidden = false; return; }
    $('pc-text').removeAttribute('aria-invalid'); $('pc-err').hidden = true;
    const emp = $('pc-emp').value.trim();
    const res = analyze({ text, state: $('pc-state').value, locationsText: $('pc-city').value, remote: $('pc-remote').value, employees: emp === '' ? null : Number(emp), asOf: today() });
    render(res);
    $('pc-results').focus({ preventScroll: true });
    $('pc-results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function loadExample(key) {
    const ex = EXAMPLES[key]; if (!ex) return;
    $('pc-text').value = ex.text; $('pc-state').value = ex.state; $('pc-city').value = ex.city; $('pc-remote').value = ex.remote; $('pc-emp').value = '';
    run();
}

stateOptions();
$('pc-form').addEventListener('submit', run);
$('pc-clear').addEventListener('click', () => { $('pc-form').reset(); $('pc-results').hidden = true; $('pc-results').innerHTML = ''; $('pc-text').focus(); });
document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => loadExample(b.dataset.example)));
document.documentElement.classList.add('pc-ready');
