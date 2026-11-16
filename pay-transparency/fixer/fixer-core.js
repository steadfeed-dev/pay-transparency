// Steadfeed Job Ad Fixer: deterministic rewrite engine. No AI, no network calls, no storage.
// Shared by the free browser page (/pay-transparency/fixer/) and the paid Apify actor (copied verbatim).
// It never invents pay: every number in the output comes from the owner's input or from the posting itself.
// Posting-rule facts below were re-read from the official source linked on each entry on 2026-11-15.
// This is a drafting aid that helps you meet posting rules. It is not legal advice and not a compliance determination.
import { analyze, preprocess } from '../checker/engine.js';
import { RULES, inForce } from '../checker/lib/rules.js';
import { applicableLaws } from '../checker/lib/audit.js';
import { textRanges } from '../checker/lib/pay.js';
import { US_LOCAL } from '../checker/lib/jurisdictions.js';

export const FIXER_VERSION = '0.1.0';
export const FIXER_REVIEWED_ON = '2026-11-15';
export const DISCLAIMER = 'This tool helps you meet the job-posting pay rules we track, as we read them on the date shown. It is not legal advice, it does not certify anything, and it only knows what you tell it. Employer-size counts, remote-work coverage and exceptions vary: check the linked official source or ask an employment lawyer before you rely on it.';

// ---- Albany County, NY (Local Law E of 2022). Read 2026-11-15 on the county Legistar text. Fold back into the PTCM actor. ----
const ALBANY = { code: 'US-NY-ALB', name: 'Albany County, New York', level: 'county', effectiveDate: '2023-03-09', employerCoverage: 'Employers covered by the Albany County Human Rights Law (the local law states no separate size threshold)', requirement: 'Minimum and maximum salary or hourly wage in every job, promotion or transfer advertisement for a position in Albany County.', sourceUrl: 'https://albanycounty.legistar.com/LegislationDetail.aspx?FullText=1&GUID=B5994553-D7BE-4553-82B3-599AA966FA46&ID=5639308', status: 'in_force' };
if (!US_LOCAL.some((l) => l.law.code === ALBANY.code)) US_LOCAL.push({ test: /\b(?:albany(?:,\s*(?:ny|new york)\b|\s+county\b)|colonie|cohoes|watervliet|guilderland)\b/i, law: ALBANY });
RULES[ALBANY.code] = { ...ALBANY, min: 1, openEnded: 'prohibited', ruleCaveat: 'Effective date is 90 days after enactment (reported as Mar 9, 2023); the employer-size threshold comes from the county Human Rights Law definition, which we did not re-read. Verify.' };

/**
 * What each law asks a posting to show, as the fixer uses it. All entries checked 2026-11-15 against `source`.
 * fixedOk: true = the source says a single fixed rate is acceptable when pay does not vary.
 * commissionOnly: 'statement' = a commission-only role may say so instead of giving a range.
 * commissionPartial: 'disclose' = roles paid partly on commission must say so (VT, DE).
 * tipped: 'base_plus_tips' = state the base wage and that the job is tipped.
 */
export const POSTING_RULES = {
    'US-CA': { show: 'A good-faith pay scale (the salary or hourly wage range you reasonably expect to pay at hire).', size: '15 or more employees', source: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=432.3', salaryHistoryBan: true },
    'US-CO': { show: 'Pay or a pay range, a general description of benefits and other compensation (bonuses, commissions, tips), how to apply and the application deadline.', size: 'Any employer with an employee in Colorado', source: 'https://cdle.colorado.gov/sites/cdle/files/info_%239a_transparency_in_pay_and_job_opportunities_the_colorado_epewa_part_2_05.29.24.pdf', fixedOk: true, benefits: true, otherComp: true, closeDate: true, howToApply: true, tipped: 'base_plus_tips' },
    'US-CT': { show: 'The wage or wage range and a general description of benefits (health, retirement, fringe benefits, paid leave and other non-wage compensation).', size: 'One or more employees', source: 'https://www.cga.ct.gov/2026/ACT/PA/PDF/2026PA-00012-R00HB-05003-PA.PDF', fixedOk: true, benefits: true, salaryHistoryBan: true },
    'US-DE': { show: 'An hourly or salary range and a general description of benefits and other compensation. Commission roles say so; tipped roles say so and give the base wage.', size: '26 or more employees', source: 'https://legis.delaware.gov/SessionLaws/Chapter?id=42391', benefits: true, otherComp: true, commissionOnly: 'statement', commissionPartial: 'disclose', tipped: 'base_plus_tips' },
    'US-DC': { show: 'The minimum and maximum projected salary or hourly pay. Applicants must also learn whether healthcare benefits come with the job before the first interview.', size: 'At least one employee in the District', source: 'https://code.dccouncil.gov/us/dc/council/code/sections/32-1453.01', healthcareBeforeInterview: true },
    'US-HI': { show: 'An hourly rate or salary range that reasonably reflects expected pay.', size: '50 or more employees', source: 'https://labor.hawaii.gov/hcrc/files/2023/11/Act-203-Pay-Transparency-FAQs.pdf' },
    'US-IL': { show: 'The wage or salary (or range), how it is paid, a general description of all benefits, and the fact that tips, bonuses or commissions are available (amounts not required).', size: '15 or more employees', source: 'https://labor.illinois.gov/faqs/equal-pay-act-salary-transparency-faq.html', fixedOk: true, benefits: true, otherComp: true, linkAllowed: true },
    'US-ME': { show: 'The prospective range of pay, or a statement that pay is based solely on commission.', size: '10 or more employees', source: 'https://legislature.maine.gov/statutes/26/title26sec622-A.html', commissionOnly: 'statement' },
    'US-MD': { show: 'The minimum and maximum wage, a general description of benefits, and any other compensation offered.', size: 'All employers', source: 'https://labor.maryland.gov/labor/wages/esswagerangefaq.shtml', benefits: true, otherComp: true },
    'US-MA': { show: 'The annual salary range or hourly wage range you reasonably and in good faith expect to pay.', size: '25 or more employees in Massachusetts', source: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter149/Section105F' },
    'US-MN': { show: 'The starting salary range (not open-ended) or a fixed pay rate, and a general description of all benefits and other compensation.', size: '30 or more employees in Minnesota', source: 'https://www.revisor.mn.gov/statutes/cite/181.173', fixedOk: true, benefits: true, otherComp: true },
    'US-NJ': { show: 'The hourly wage or salary (or a range), a general description of benefits, and other compensation programs.', size: '10 or more employees', source: 'https://www.nj.gov/labor/myworkrights/wages/pay-transparency', fixedOk: true, benefits: true, otherComp: true },
    'US-NY': { show: 'The pay or a good-faith pay range (no open-ended figures), and the job description if one exists. A commission-only role may say pay is based on commission.', size: '4 or more employees', source: 'https://dol.ny.gov/pay-transparency-act-frequently-asked-questions', fixedOk: true, commissionOnly: 'statement', tipped: 'base_plus_tips' },
    'US-VT': { show: 'The pay or pay range. Commission roles (in whole or part) say so; tipped roles say so and give the base wage.', size: '5 or more employees', source: 'https://legislature.vermont.gov/statutes/section/21/005/00495p', fixedOk: true, commissionOnly: 'statement', commissionPartial: 'disclose', tipped: 'base_plus_tips' },
    'US-VA': { show: 'The wage, salary or wage/salary range, as a good-faith estimate.', size: 'All employers', source: 'https://law.lis.virginia.gov/vacode/title40.1/chapter3/section40.1-28.7:12/', fixedOk: true, salaryHistoryBan: true },
    'US-WA': { show: 'The wage scale or salary range (or the fixed wage if there is no range), and a general description of all benefits and other compensation.', size: '15 or more employees', source: 'https://app.leg.wa.gov/RCW/default.aspx?cite=49.58.110', fixedOk: true, benefits: true, otherComp: true },
    'US-NY-NYC': { show: 'A good-faith minimum and maximum salary or hourly wage. Benefits and other pay are separate and optional.', size: '4 or more employees, one in NYC', source: 'https://www.nyc.gov/assets/cchr/downloads/pdf/publications/Salary-Transparency-Factsheet.pdf' },
    'US-NY-WES': { show: 'The minimum and maximum salary.', size: '4 or more employees', source: 'https://humanrights.westchestercountyny.gov/salary-transparency-amendment' },
    'US-NY-ITH': { show: 'The minimum and maximum hourly or salary pay (a flat rate is fine when min and max are the same).', size: '4 or more employees in Ithaca', source: 'https://www.cityofithacany.gov/m/faq?cat=50', fixedOk: true },
    'US-NY-ALB': { show: 'The minimum and maximum salary or hourly wage.', size: 'Covered employers (no separate size threshold stated)', source: ALBANY.sourceUrl },
    'US-NJ-JC': { show: 'The minimum and maximum base salary or hourly wage, and the benefits offered.', size: '5 or more employees, including contractors', source: 'https://www.jerseycitynj.gov/residentresources/inclusion/paytransparency', benefits: true },
    'US-OH-CLE': { show: 'A salary range or pay scale in every formal job posting.', size: '15 or more employees in Cleveland', source: 'https://www.clevelandohio.gov/city-hall/boards-commissions/fair-employment-wage-board/laws-procedures', salaryHistoryBan: true },
    'US-OH-CMH': { show: 'A reasonable salary range or scale in every job posting (enforced from Jan 1, 2027).', size: '15 or more employees in Columbus', source: 'https://columbus.legistar.com/LegislationDetail.aspx?ID=7713138&GUID=E97F7B48-94C8-4C0D-8A56-CA886949C0CF&FullText=1', salaryHistoryBan: true },
};

export const BENEFIT_OPTIONS = [
    ['health', 'medical insurance'], ['dental', 'dental insurance'], ['vision', 'vision insurance'],
    ['retirement', '401(k) or other retirement plan'], ['retirementMatch', '401(k) with employer match'],
    ['pto', 'paid time off'], ['sick', 'paid sick leave'], ['holidays', 'paid holidays'],
    ['parental', 'paid parental leave'], ['life', 'life insurance'], ['disability', 'disability insurance'],
    ['hsa', 'HSA or FSA'], ['tuition', 'tuition or training support'], ['discount', 'employee discount'],
];
export const OTHER_COMP_OPTIONS = [['bonus', 'bonus'], ['commission', 'commission'], ['tips', 'tips'], ['overtime', 'overtime pay'], ['equity', 'equity or stock options'], ['shiftDiff', 'shift differential']];
const PERIODS = { hour: 'per hour', year: 'per year', week: 'per week', month: 'per month', day: 'per day' };

const VAGUE_PAY = /\b(DOE|D\.O\.E\.|depending on (?:experience|qualifications)|depends on experience|commensurate with (?:experience|qualifications)|competitive (?:salary|pay|wages?|compensation|base|package|rate)|salary (?:is )?negotiable|negotiable (?:salary|pay)|market[- ]rate|pay\s*:\s*TBD|salary\s*:\s*TBD)\b/i;
const PAY_LABEL = /^\s*[•*\-–]?\s*(?:(?:base\s+)?salary(?:\s+range)?|pay(?:\s+(?:range|rate|scale))?|compensation(?:\s+range)?|wages?|hourly\s+(?:rate|pay|wage)|rate\s+of\s+pay|starting\s+(?:pay|wage|salary))\s*[:\-–]/i;
const OPEN_ENDED = /(?:\bup to\s*\$|\bstarting (?:at|from)\s*\$|\bfrom\s*\$|\$\s?\d[\d,.]*\s*[kK]?\s*\+|\$\s?\d[\d,.]*\s*[kK]?\s*(?:and up|or more|plus\b(?!\s+(?:tips|commission|bonus|benefits))))/i;
const VAGUE_BENEFITS_LINE = /^\s*[•*\-–]?\s*(?:great|competitive|excellent|full|generous|amazing|comprehensive|attractive)\s+(?:benefits?|benefits package|package)\b[^\n]{0,60}$/i;
const STRICT_BENEFITS = /\b(health(?:care)?|medical|dental|vision|401\s?\(?k\)?|403\(b\)|retirement|pension|paid time off|\bpto\b|vacation|parental leave|sick (?:leave|days?|time)|life insurance|disability|\bhsa\b|\bfsa\b|paid holidays?)\b/i;
const OTHER_COMP_WORDS = /\b(bonus(?:es)?|commissions?|tips|gratuit(?:y|ies)|equity|stock options?|profit[- ]sharing|overtime|shift differential)\b/i;
const OPEN_UNTIL_FILLED = /\b(?:open until filled|until (?:the )?position is filled|open until (?:the )?(?:role|job) is filled)\b/i;
const CLOSE_DATE = /(applications?\b[^.\n]{0,60}\b(clos\w*|accepted|due|deadline|through|until|by)\b|\bapply (?:by|before|until)\b|\bclosing date\b|\bdeadline\b|\bongoing basis\b|\bposting (?:will )?(?:close|end|expire)s?\b)/i;
const HOW_TO_APPLY = /\b(apply (?:at|on|online|here|via|through|by (?:email|sending)|in person)|to apply\b|send (?:your |a )?(?:resume|cv|application)|email (?:your |a )?(?:resume|cv)|submit (?:your |an? )?(?:resume|cv|application)|application link|how to apply|@[a-z0-9-]+\.[a-z]{2,}|https?:\/\/)/i;
const SALARY_HISTORY = /\b(?:salary|pay|wage|compensation|earnings)\s+history\b|\b(?:current|previous|prior|past|last)\s+(?:salary|pay|wages?|compensation|earnings)\b|\bwhat you (?:currently |used to )?(?:make|earn)\b|\bW-?2s?\s+from (?:your )?(?:current|previous|prior)\b/i;
const SALARY_EXPECTATION_OK = /\b(?:salary|pay|compensation)\s+(?:expectations?|requirements?)\b|\bdesired (?:salary|pay)\b/i;

const esc2 = (s) => String(s ?? '').trim();
const money = (n, period) => {
    if (n == null || !Number.isFinite(n)) return '$___';
    const hourlyish = period === 'hour' || period === 'day' || (n < 1000 && n % 1 !== 0);
    return '$' + (hourlyish ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US'));
};
const joinList = (a) => (a.length <= 1 ? a.join('') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const names = (codes) => joinList(codes.map((c) => RULES[c]?.name ?? c));
const v = (codes, one, many) => (codes.length === 1 ? one : many);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '')); if (!m) return null; return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };
const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[$,\s]/g, '').replace(/k$/i, '000')); return Number.isFinite(n) && n > 0 ? n : null; };
const lawRef = (code) => { const r = RULES[code]; const p = POSTING_RULES[code]; return { code, name: r?.name ?? code, sourceUrl: p?.source ?? r?.sourceUrl ?? null, checkedOn: FIXER_REVIEWED_ON }; };
const asList = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/\s*[,;|]\s*/)).map((s) => String(s).trim()).filter(Boolean);

/** Normalize the owner's facts. Accepts the browser form shape and the actor's flat CSV/JSON shape. */
export function normalizeFacts(input = {}) {
    const p = input.pay ?? {};
    const type = String(p.type ?? input.payType ?? 'auto').toLowerCase().replace(/[\s-]+/g, '_');
    const benefitsIn = input.benefits ?? {};
    const benefitKeys = Array.isArray(benefitsIn) || typeof benefitsIn === 'string' ? asList(benefitsIn) : Object.entries(benefitsIn).filter(([k, v]) => v === true && k !== 'none').map(([k]) => k);
    const benefitsNone = benefitsIn === 'none' || benefitsIn?.none === true || benefitKeys.map((k) => k.toLowerCase()).includes('none') || input.noBenefits === true;
    const known = new Map(BENEFIT_OPTIONS);
    const benefitLabels = [];
    for (const k of benefitKeys) { if (k.toLowerCase() === 'none') continue; benefitLabels.push(known.get(k) ?? k); }
    const extraBenefits = esc2(benefitsIn?.other ?? input.benefitsOther ?? '');
    if (extraBenefits) benefitLabels.push(extraBenefits);
    const ocIn = input.otherComp ?? {};
    const ocKeys = Array.isArray(ocIn) || typeof ocIn === 'string' ? asList(ocIn) : Object.entries(ocIn).filter(([k, v]) => v === true && k !== 'none').map(([k]) => k);
    const ocKnown = new Map(OTHER_COMP_OPTIONS);
    const otherComp = ocKeys.filter((k) => k.toLowerCase() !== 'none').map((k) => ocKnown.get(k) ?? k);
    const ocExtra = esc2(ocIn?.other ?? input.otherCompOther ?? ''); if (ocExtra) otherComp.push(ocExtra);
    const tipped = p.tipped === true || input.tipped === true || String(input.tipped).toLowerCase() === 'true' || otherComp.includes('tips');
    const period = String(p.period ?? input.payPeriod ?? '').toLowerCase().replace(/^(hourly|hr)$/, 'hour').replace(/^(annual|annually|yearly|yr|salary)$/, 'year').replace(/^weekly$/, 'week').replace(/^monthly$/, 'month').replace(/^daily$/, 'day');
    return {
        payType: ['range', 'fixed', 'commission_only', 'auto'].includes(type) ? type : 'auto',
        payMin: num(p.min ?? input.payMin), payMax: num(p.max ?? input.payMax), payPeriod: PERIODS[period] ? period : null,
        tipped, otherComp: [...new Set(otherComp.filter((x) => x !== 'tips' || !tipped))], otherCompNone: ocIn === 'none' || ocIn?.none === true || ocKeys.map((k) => k.toLowerCase()).includes('none'),
        benefits: [...new Set(benefitLabels)], benefitsNone, benefitsLink: esc2(input.benefitsLink ?? ''),
        applyBy: esc2(input.applyBy ?? input.applicationDeadline ?? ''), howToApply: esc2(input.howToApply ?? ''),
    };
}

function findLines(lines) {
    const pay = [], benefitsVague = [], untilFilled = [], history = [];
    lines.forEach((line, i) => {
        const t = line.trim(); if (!t) return;
        const hasMoney = /\$\s?\d/.test(t);
        const ranges = hasMoney ? textRanges(t) : [];
        if ((PAY_LABEL.test(t) && (hasMoney || VAGUE_PAY.test(t) || /\b(TBD|negotiable|competitive)\b/i.test(t))) || (VAGUE_PAY.test(t) && t.length < 160) || (ranges.length && /salary|pay|wage|hour|\/hr|per year|annual|compensation/i.test(t)) || (hasMoney && OPEN_ENDED.test(t) && /salary|pay|wage|compensation|hour|year|base/i.test(t))) pay.push(i);
        if (VAGUE_BENEFITS_LINE.test(t) && !STRICT_BENEFITS.test(t)) benefitsVague.push(i);
        if (OPEN_UNTIL_FILLED.test(t)) untilFilled.push(i);
        if (SALARY_HISTORY.test(t) && !SALARY_EXPECTATION_OK.test(t.replace(SALARY_HISTORY, ''))) history.push(i);
    });
    return { pay, benefitsVague, untilFilled, history };
}

/** Pay found in the posting itself (only a complete min-max range or a single figure with a period counts). */
function postedPay(result) {
    const rs = result.pay.payRanges ?? [];
    const full = rs.find((r) => r.rangeType === 'range' && r.payMin != null && r.payMax != null);
    if (full) return { kind: 'range', min: full.payMin, max: full.payMax, period: full.payPeriod, currency: full.currency, raw: full.rawPayText };
    const open = rs.find((r) => r.rangeType === 'minimum_only' || r.rangeType === 'maximum_only');
    if (open) return { kind: 'open', raw: open.rawPayText };
    const fixed = rs.find((r) => r.rangeType === 'fixed');
    if (fixed) return { kind: 'single', min: fixed.payMin, max: fixed.payMin, period: fixed.payPeriod };
    return { kind: result.vagueTerm ? 'vague' : 'none' };
}

/**
 * Fix one job ad.
 * @param {object} input { text, state, city|locations, remote:'auto'|'yes'|'no', employees, asOf, hiringStates[], pay{type,min,max,period,tipped}, benefits, otherComp, applyBy, howToApply }
 */
export function fixJobAd(input = {}) {
    const text = String(input.text ?? '').slice(0, 20000);
    const asOf = /^\d{4}-\d{2}-\d{2}/.test(String(input.asOf ?? '')) ? `${String(input.asOf).slice(0, 10)}T12:00:00Z` : new Date().toISOString();
    const facts = normalizeFacts(input);
    const out = { fixerVersion: FIXER_VERSION, rulesCheckedOn: FIXER_REVIEWED_ON, asOf: asOf.slice(0, 10), disclaimer: DISCLAIMER, changes: [], needsInput: [], notes: [], inputErrors: [] };
    if (text.trim().length < 20) { out.status = 'invalid_input'; out.inputErrors.push('Paste the job ad text (at least a title and a few lines).'); out.fixedText = text; return out; }
    const employees = input.employees === '' || input.employees == null ? null : Number(input.employees);
    const result = analyze({ text, state: input.state ?? '', locationsText: input.city ?? input.locations ?? '', remote: input.remote ?? 'auto', employees: Number.isFinite(employees) ? employees : null, asOf });
    const hiring = asList(input.hiringStates ?? []).map((s) => (s.startsWith('US-') ? s : `US-${s.toUpperCase()}`));
    const { laws, skipped } = applicableLaws(result.row, { asOf, employeeCount: Number.isFinite(employees) ? employees : null, hiringStates: hiring.length ? hiring : null });
    const usLaws = laws.filter(({ rule }) => rule.code.startsWith('US-') && POSTING_RULES[rule.code]);
    out.locations = result.locations; out.remote = result.isRemote;
    out.lawsApplied = usLaws.map(({ rule, basis }) => ({ ...lawRef(rule.code), basis, shows: POSTING_RULES[rule.code].show, employerSize: POSTING_RULES[rule.code].size }));
    out.lawsSkipped = skipped.filter((s) => s.code.startsWith('US-')).map((s) => ({ ...lawRef(s.code), reason: s.reason.startsWith('employer_below') ? `Applies at ${s.reason.match(/\d+/)[0]}+ employees; you entered ${employees}.` : 'Not in force yet on this date.' }));
    out.upcoming = Object.values(RULES).filter((r) => r.code.startsWith('US-') && POSTING_RULES[r.code] && !inForce(r, asOf) && (result.row.jurisdictionContext.matches.some((m) => m.code === r.code) || (result.isRemote && r.level === 'state'))).map((r) => ({ ...lawRef(r.code), startsOn: r.effectiveDate, shows: POSTING_RULES[r.code].show }));
    const nonUs = (result.row.jurisdictionContext?.matches ?? []).filter((m) => !m.code.startsWith('US-'));
    if (nonUs.length) out.notes.push({ title: 'Outside the US', body: `This tool covers US state and city posting laws only. ${joinList(nonUs.map((m) => m.name))} ${nonUs.length > 1 ? 'have' : 'has'} its own rules we do not rewrite for; check them separately.`, laws: [] });
    if (!result.locations.length && !result.isRemote) { out.status = 'need_location'; out.needsInput.push({ field: 'location', question: 'Where is the job? Pick the state (and city if you know it), or mark it remote.', why: 'Pay-posting laws depend on where the work is done.', laws: [] }); out.fixedText = text; return out; }

    const has = (k) => usLaws.filter(({ rule }) => POSTING_RULES[rule.code][k]).map(({ rule }) => rule.code);
    const refs = (codes) => codes.map(lawRef);
    const allCodes = usLaws.map(({ rule }) => rule.code);
    const remoteNote = usLaws.some((l) => l.basis === 'remote_exposure');
    if (remoteNote) out.notes.push({ title: 'Remote role: several state laws can reach it', body: `Because the job is remote and open to US applicants, we applied the rules of every state law in force (${usLaws.filter((l) => l.basis === 'remote_exposure').length} of them). If you only hire in certain states, say which and the list gets shorter.`, laws: [] });
    if (employees == null || !Number.isFinite(employees)) out.notes.push({ title: 'Employer size not given', body: 'Many of these laws only apply above a headcount (for example 15 or more in California and Washington). We applied all of them. Enter your employee count to drop the ones that do not reach you.', laws: [] });

    const lines = preprocess(text).split('\n');
    const found = findLines(lines);
    const posted = postedPay(result);
    const remove = new Set();
    const block = [];

    // ---------- Pay ----------
    let payLine = null, payKind = null;
    const period = facts.payPeriod ?? posted.period ?? null;
    if (facts.payType === 'commission_only') {
        payKind = 'commission_only';
        payLine = 'Pay: This position is paid solely on commission.';
        const ok = has('commissionOnly'); const unclear = allCodes.filter((c) => !ok.includes(c));
        out.changes.push({ id: 'pay_commission_only', title: 'Stated that pay is commission only', why: `You told us this role is paid only on commission. ${ok.length ? `${names(ok)} ${v(ok,'accepts','accept')} a plain statement like this instead of a range.` : ''}`.trim(), laws: refs(ok) });
        if (unclear.length) out.needsInput.push({ field: 'pay', blocking: false, question: `Consider adding an expected earnings range for ${joinList(unclear.map((c) => RULES[c].name))}.`, why: 'The sources we read for these places do not say a commission-only statement is enough. Many employers add a good-faith range of expected earnings. Only add numbers you can stand behind.', laws: refs(unclear) });
    } else if (facts.payMin != null || facts.payMax != null) {
        const min = facts.payMin, max = facts.payMax ?? facts.payMin;
        if (!facts.payPeriod) out.inputErrors.push('Tell us whether the pay is per hour, per year, per week, per month or per day.');
        if (min == null) out.inputErrors.push('Add the lowest pay you expect to offer.');
        if (min != null && max != null && min > max) out.inputErrors.push('The lowest pay is higher than the highest pay. Swap them or fix the numbers.');
        if (!out.inputErrors.length) {
            payKind = min === max || facts.payType === 'fixed' ? 'fixed' : 'range';
            const per = PERIODS[facts.payPeriod];
            payLine = payKind === 'fixed' ? `Pay: ${money(min, facts.payPeriod)} ${per}${facts.tipped ? ' plus tips' : ''}` : `Pay range: ${money(min, facts.payPeriod)} – ${money(max, facts.payPeriod)} ${per}${facts.tipped ? ' plus tips' : ''}`;
        }
    } else if (posted.kind === 'range' && posted.period && allCodes.length && (!posted.currency || posted.currency === 'USD')) {
        payKind = 'range';
        payLine = `Pay range: ${money(posted.min, posted.period)} – ${money(posted.max, posted.period)} ${PERIODS[posted.period]}${facts.tipped ? ' plus tips' : ''}`;
    }
    if (payKind === 'range' || payKind === 'fixed') {
        const min = facts.payMin ?? posted.min, max = facts.payMax ?? posted.max ?? min;
        const fromOwner = facts.payMin != null;
        if (payKind === 'range') {
            const why = posted.kind === 'range' && !fromOwner ? 'Your ad already had a full range. We rewrote it as one clear line with both ends and how often it is paid.' : posted.kind === 'open' ? 'Your ad had an open-ended figure (like “up to”, “from” or “$80k+”). Posting laws ask for both a minimum and a maximum, so we replaced it with the range you gave us.' : posted.kind === 'vague' ? `Words like “${result.vagueTerm}” don’t count as pay. We replaced them with the range you gave us.` : 'Your ad had no pay range. We added the range you gave us, written with both ends and how often it is paid.';
            out.changes.push({ id: 'pay_range', title: posted.kind === 'range' && !fromOwner ? 'Made the pay range easy to read' : 'Added a clear pay range', why, laws: refs(allCodes) });
            if (min && max / min >= 2) out.notes.push({ title: 'Check the range is a good-faith estimate', body: `The top of the range is ${(max / min).toFixed(1)}× the bottom. Laws ask for the range you honestly expect to pay at hire; a very wide range can be challenged. Narrow it if you can.`, laws: [] });
        } else {
            const ok = has('fixedOk'); const unclear = allCodes.filter((c) => !ok.includes(c));
            out.changes.push({ id: 'pay_fixed', title: 'Stated the fixed pay rate', why: `You told us pay does not vary, so we wrote one rate.${ok.length ? ` ${names(ok)} ${v(ok,'says','say')} a single fixed rate is fine when pay doesn’t vary.` : ''}`, laws: refs(ok) });
            if (unclear.length) out.notes.push({ title: 'Fixed rate: check these places', body: `The sources we read for ${names(unclear)} ${v(unclear,'talks','talk')} about a minimum and maximum and don’t say whether one fixed rate is enough. If pay could vary at all, show the real range.`, laws: refs(unclear) });
        }
        if (facts.tipped) out.changes.push({ id: 'pay_tipped', title: 'Said the job is tipped', why: 'Tips are added on top of the base pay you pay, and the ad says so. Vermont and Delaware ask tipped jobs to state the base wage and that the job is tipped; New York and Colorado guidance use “$18 per hour plus tips” as an example.', laws: refs(has('tipped')) });
    }
    if (!payLine && !out.inputErrors.length && !allCodes.length) {
        if (posted.kind !== 'range') out.needsInput.push({ field: 'pay', blocking: false, question: 'Want to show pay anyway? Give the lowest and highest pay you expect to offer.', why: 'No posting law we track applies here today, but ads that show pay tend to get more qualified applicants, and some job boards rank them higher.', laws: [] });
    } else if (!payLine && !out.inputErrors.length) {
        const per = facts.payPeriod ? PERIODS[facts.payPeriod] : 'per hour / per year';
        payLine = `Pay range: [ADD LOWEST PAY] – [ADD HIGHEST PAY] ${per}`;
        const what = posted.kind === 'open' ? 'Your ad has an open-ended figure (like “up to”, “from” or “$80k+”), which is not a full range.' : posted.kind === 'vague' ? `Your ad says “${result.vagueTerm}”, which doesn’t count as pay.` : posted.kind === 'single' ? 'Your ad has one pay figure but we can’t tell if it is the whole range or how often it is paid.' : posted.kind === 'range' ? 'Your ad has a range but doesn’t say if it is per hour or per year.' : 'Your ad has no pay information.';
        out.needsInput.push({ field: 'pay', blocking: true, question: 'What is the lowest and highest pay you in good faith expect to offer, and is it per hour or per year?', why: `${what} We never guess pay: the numbers have to come from you.`, laws: refs(allCodes) });
    }
    if (payLine) { for (const i of found.pay) remove.add(i); block.push(payLine); }

    // ---------- Other compensation ----------
    const ocLaws = has('otherComp');
    const otherCompInAd = OTHER_COMP_WORDS.test(lines.filter((_, i) => !remove.has(i)).join('\n'));
    if (facts.otherComp.length) {
        block.push(`Other compensation: eligible for ${joinList(facts.otherComp)}.`);
        out.changes.push({ id: 'other_comp', title: 'Described other compensation', why: `You told us this job also offers ${joinList(facts.otherComp)}. ${ocLaws.length ? `${names(ocLaws)} ${v(ocLaws,'asks','ask')} for a general description of other pay; amounts are not required.` : 'Saying so up front is clear for applicants.'}`, laws: refs(ocLaws) });
    } else if (ocLaws.length && !facts.otherCompNone && !otherCompInAd && payKind !== 'commission_only') {
        out.needsInput.push({ field: 'otherComp', blocking: false, question: 'Does the job come with any bonus, commission, tips, overtime or equity? (Choose “none” if not.)', why: `${names(ocLaws)} ${v(ocLaws,'asks','ask')} for a general description of other compensation when there is any.`, laws: refs(ocLaws) });
    }
    const partial = has('commissionPartial');
    if (partial.length && facts.otherComp.includes('commission') && payKind !== 'commission_only') out.notes.push({ title: 'Commission is disclosed', body: `${names(partial)} ${v(partial,'asks','ask')} jobs paid partly on commission to say so. The other-compensation line does that.`, laws: refs(partial) });

    // ---------- Benefits ----------
    const benLaws = has('benefits');
    const keptText = lines.filter((_, i) => !remove.has(i) && !found.benefitsVague.includes(i)).join('\n');
    const concreteBenefitsInAd = STRICT_BENEFITS.test(keptText);
    if (facts.benefits.length) {
        if (!concreteBenefitsInAd || found.benefitsVague.length) {
            for (const i of found.benefitsVague) remove.add(i);
            block.push(`Benefits: ${cap(joinList(facts.benefits))}.`);
            out.changes.push({ id: 'benefits', title: found.benefitsVague.length ? 'Replaced “great benefits” with the actual benefits' : 'Added a benefits line', why: `${benLaws.length ? `${names(benLaws)} ${v(benLaws,'asks','ask')} for a general description of benefits. ` : ''}We listed the benefits you told us about${found.benefitsVague.length ? ' in place of the general phrase' : ''}. No dollar values are needed.`, laws: refs(benLaws) });
        }
    } else if (facts.benefitsNone && benLaws.length && !concreteBenefitsInAd) {
        for (const i of found.benefitsVague) remove.add(i);
        block.push('Benefits: This position does not include benefits beyond those required by law.');
        out.changes.push({ id: 'benefits_none', title: 'Said plainly that no extra benefits are offered', why: `You told us no benefits come with this job. ${names(benLaws)} ${v(benLaws,'asks','ask')} for a description of benefits, so we say so rather than leave it out. Check the wording fits your situation.`, laws: refs(benLaws) });
    } else if (benLaws.length && !concreteBenefitsInAd) {
        block.push('Benefits: [ADD BENEFITS, e.g. medical insurance, 401(k), paid time off]');
        out.needsInput.push({ field: 'benefits', blocking: true, question: 'Which benefits come with this job? (Choose “none” if there are none.)', why: `${names(benLaws)} ${v(benLaws,'asks','ask')} for a general description of benefits. ${found.benefitsVague.length ? 'Phrases like “great benefits” don’t say what they are.' : 'Your ad doesn’t list any.'}`, laws: refs(benLaws) });
    }
    const dc = has('healthcareBeforeInterview');
    if (dc.length) out.notes.push({ title: 'D.C.: healthcare benefits before the first interview', body: 'D.C. also asks you to tell applicants whether healthcare benefits come with the job before the first interview. Listing them in the ad is an easy way to do that.', laws: refs(dc) });

    // ---------- Application deadline and how to apply (Colorado) ----------
    const coLaws = has('closeDate');
    const tail = [];
    if (coLaws.length) {
        const bodyNoUntil = lines.filter((_, i) => !found.untilFilled.includes(i)).join('\n');
        const hasClose = CLOSE_DATE.test(bodyNoUntil);
        const date = fmtDate(facts.applyBy);
        if (facts.applyBy.toLowerCase() === 'ongoing') {
            for (const i of found.untilFilled) remove.add(i);
            tail.push('Applications are accepted on an ongoing basis.');
            out.changes.push({ id: 'close_date', title: 'Said applications are accepted on an ongoing basis', why: 'Colorado asks for the application deadline. For a job you always hire for, Colorado guidance says to state that applications are accepted on an ongoing basis. “Open until filled” is not enough.', laws: refs(coLaws) });
        } else if (date) {
            for (const i of found.untilFilled) remove.add(i);
            tail.push(`Applications accepted through ${date}.`);
            out.changes.push({ id: 'close_date', title: found.untilFilled.length ? 'Replaced “open until filled” with a deadline' : 'Added the application deadline', why: 'Colorado asks for a good-faith date when applications are expected to close (you can extend it later if you update the ad). “Open until filled” is not enough.', laws: refs(coLaws) });
        } else if (!hasClose || found.untilFilled.length) {
            tail.push('Applications accepted through [ADD DATE].');
            out.needsInput.push({ field: 'applyBy', blocking: true, question: 'When do you expect to stop taking applications? (Or say “ongoing” if you always hire for this job.)', why: `Colorado asks for the application deadline in the ad.${found.untilFilled.length ? ' “Open until filled” is not enough.' : ''}`, laws: refs(coLaws) });
        }
        if (has('howToApply').length && !HOW_TO_APPLY.test(text)) {
            if (facts.howToApply) { tail.push(`How to apply: ${facts.howToApply}`); out.changes.push({ id: 'how_to_apply', title: 'Added how to apply', why: 'Colorado asks every posting to say how to apply.', laws: refs(coLaws) }); }
            else { tail.push('How to apply: [ADD LINK, EMAIL OR ADDRESS]'); out.needsInput.push({ field: 'howToApply', blocking: true, question: 'How should people apply? (A link, an email address or “in person at …”.)', why: 'Colorado asks every posting to say how to apply.', laws: refs(coLaws) }); }
        }
    }

    // ---------- Salary history questions ----------
    if (found.history.length) {
        const ban = has('salaryHistoryBan');
        for (const i of found.history) remove.add(i);
        out.changes.push({ id: 'salary_history', title: 'Removed a request for pay history', why: `The ad asked about current or past pay. ${ban.length ? `${names(ban)} ${v(ban,'bars','bar')} asking applicants for pay history` : 'Many states and cities bar asking applicants for pay history'}. Asking what pay someone expects is generally still fine.`, laws: refs(ban) });
    }

    // ---------- Assemble ----------
    const firstPay = found.pay.find((i) => remove.has(i));
    const firstVague = found.benefitsVague.find((i) => remove.has(i));
    let at = firstPay ?? firstVague;
    if (at == null) {
        // After the header: the title plus any short location/type lines that follow it.
        at = 1;
        while (at < Math.min(lines.length, 6) && lines[at].trim() && lines[at].trim().length < 90 && !/[.!?]$/.test(lines[at].trim())) at++;
    }
    const outLines = [];
    lines.forEach((line, i) => {
        if (i === at) { if (outLines.length && outLines[outLines.length - 1].trim() && firstPay == null && firstVague == null) outLines.push(''); outLines.push(...block); if (firstPay == null && firstVague == null && line.trim()) outLines.push(''); }
        if (!remove.has(i)) outLines.push(line);
    });
    if (at >= lines.length) outLines.push('', ...block);
    if (tail.length) { while (outLines.length && !outLines[outLines.length - 1].trim()) outLines.pop(); outLines.push('', ...tail); }
    out.fixedText = outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    out.originalText = text;

    out.lawsApplied.length || out.notes.unshift({ title: 'No posting law found for this location today', body: 'We did not find a state or city pay-posting law in force for the places listed. Showing pay is still a good idea: it helps your ad get seen on job boards and saves everyone time.', laws: [] });
    for (const u of out.upcoming) out.notes.push({ title: `${u.name}: starts ${fmtDate(u.startsOn)}`, body: `${u.shows} ${payKind === 'range' || payKind === 'fixed' ? 'The fixed ad already shows pay.' : 'Add pay before then.'}`, laws: [u] });
    if (out.inputErrors.length) out.status = 'invalid_input';
    else if (out.needsInput.some((n) => n.blocking)) out.status = 'needs_input';
    else if (!out.lawsApplied.length) out.status = 'no_law_found';
    else out.status = 'ready';
    out.summary = summaryLine(out);
    return out;
}

function summaryLine(o) {
    if (o.status === 'invalid_input') return o.inputErrors.join(' ');
    if (o.status === 'need_location') return 'Tell us where the job is.';
    const n = o.changes.length, q = o.needsInput.filter((x) => x.blocking).length;
    const fill = `${q} thing${q === 1 ? '' : 's'} only you can fill in (marked [ADD …] in the ad).`;
    if (o.status === 'needs_input') return n ? `${n} change${n === 1 ? '' : 's'} made; ${fill}` : fill[0].toUpperCase() + fill.slice(1);
    const soon = (o.upcoming || []).map((u) => `${u.name} starts ${fmtDate(u.startsOn)}`).join('; ');
    if (o.status === 'no_law_found') return (n ? `${n} change${n === 1 ? '' : 's'} made. No posting law in force for this location today.` : 'No posting law in force for this location today; nothing to change.') + (soon ? ` Coming up: ${soon}.` : '');
    return n ? `${n} change${n === 1 ? '' : 's'} made to help the ad meet ${o.lawsApplied.length} posting law${o.lawsApplied.length === 1 ? '' : 's'}.` : `Nothing to change: the ad already shows what the ${o.lawsApplied.length} law${o.lawsApplied.length === 1 ? '' : 's'} we track ask for.`;
}
