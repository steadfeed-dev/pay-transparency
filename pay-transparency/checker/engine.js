// Free Pay Transparency Checker: analysis engine. Runs entirely in the browser; nothing is sent anywhere.
// Uses the same rule table, pay-range parser and screening logic as the paid
// Pay Transparency Compliance Monitor (copied into ./lib by ptcm-site-build/sync_checker_lib.py).
import { extractPay } from './lib/pay.js';
import { postingSignals } from './lib/signals.js';
import { jurisdictionContext, US_STATES, US_LOCAL } from './lib/jurisdictions.js';
import { RULES, inForce } from './lib/rules.js';
import { auditPosting } from './lib/audit.js';

export const CHECKER_REVIEWED_ON = '2026-11-15';

// ---- Checker-only rule updates (re-verified 2026-11-15; to be folded back into the actor source) ----
// Virginia: effective date and all-employer scope confirmed by the Virginia DOLI notice and Code s.40.1-28.7:12.
if (RULES['US-VA']) RULES['US-VA'].ruleCaveat = 'The statute does not say whether postings for remote roles outside Virginia are covered; verify.';
// Westchester County: the county Human Rights Law covers employers with 4 or more employees (county law and 2022 summaries).
if (RULES['US-NY-WES']) Object.assign(RULES['US-NY-WES'], { min: 4, employerCoverage: '4 or more employees (the county government is excluded)', remoteNote: 'Covers jobs performed in whole or in part in Westchester County, including remotely (summaries of the 2022 amendment).' });
// Ithaca, NY (City Code s.215-3(F)), in force since 2022-09-01. New York State law also covers Ithaca.
const ITHACA = { code: 'US-NY-ITH', name: 'Ithaca, New York', level: 'city', effectiveDate: '2022-09-01', employerCoverage: '4 or more employees whose standard work location is in the City of Ithaca', requirement: 'Minimum and maximum hourly or salary compensation in every job, promotion or transfer advertisement for positions whose standard work location is in Ithaca.', sourceUrl: 'https://www.cityofithacany.gov/m/faq?cat=50', status: 'in_force' };
if (!US_LOCAL.some((l) => l.law.code === ITHACA.code)) US_LOCAL.push({ test: /\bithaca\b/i, law: ITHACA });
RULES[ITHACA.code] = { ...ITHACA, min: 4, openEnded: 'prohibited', remoteNote: 'Applies to positions whose standard work location is in Ithaca; remote roles are not addressed.' };

export const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };

const VAGUE_PAY = /\b(DOE|D\.O\.E\.|depending on (?:experience|qualifications)|depends on experience|commensurate with (?:experience|qualifications)|competitive (?:salary|pay|wages?|compensation|base)|salary (?:is )?negotiable|negotiable salary|market[- ]rate|TBD)\b/i;
const REMOTE_YES = /\b(fully remote|100% remote|remote[- ]first|remote (?:role|position|job|opportunity|eligible)|work from (?:home|anywhere)|(?:location|workplace)\s*[:\-–]\s*remote|remote\s*\((?:us|usa|united states)\)|remote,?\s+(?:us|usa|united states))\b|^\s*remote\s*$/im;
const REMOTE_NO = /\b(not (?:a )?remote|no remote|this is not a remote|on-?site only|in-office only)\b/i;

/** Pre-clean pasted text: "$22/hr - $28/hr" style ranges (period repeated on both ends) become "$22 - $28 per hour". */
export function preprocess(text) {
    let s = String(text ?? '').replace(/\r\n?/g, '\n').replace(/[\u2012\u2013\u2014\u2212]/g, '–');
    const PER = '(?:\\/\\s*(?:hr|hour|h|yr|year|yr\\.)|per\\s+(?:hour|year|annum)|an?\\s+(?:hour|year)|hourly|annually|\\s*\\/\\s*hr\\.?)';
    s = s.replace(new RegExp(`(\\$\\s?[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s*[kK]?)\\s*(${PER})\\s*(–|-|to)\\s*(\\$\\s?[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s*[kK]?)\\s*(${PER})`, 'gi'), (m, a, p1, sep, b, p2) => `${a} – ${b} ${p2}`);
    return s;
}

/** Pull location hints out of the posting text: "Location: Denver, CO" lines. */
export function detectLocations(text) {
    const out = [];
    for (const m of String(text ?? '').matchAll(/^[ \t•*-]*(?:job |work |office |primary )?(?:locations?|based in|work site|worksite|office)\s*[:\-–]\s*(.{2,140})$/gim)) {
        for (const part of m[1].split(/\s*(?:;|\||\/| or )\s*/)) if (part.trim()) out.push(part.trim().replace(/[.)]+$/, ''));
    }
    return [...new Set(out)].slice(0, 8);
}
export function detectRemote(text) {
    const t = String(text ?? '');
    if (REMOTE_NO.test(t)) return false;
    return REMOTE_YES.test(t);
}

/**
 * @param {{text:string, state?:string, locationsText?:string, remote?:'auto'|'yes'|'no', employees?:number|null, asOf?:string}} input
 */
export function analyze({ text, state = '', locationsText = '', remote = 'auto', employees = null, asOf = new Date().toISOString() }) {
    const description = preprocess(text);
    const pay = extractPay('text', {}, description);
    // Checker refinement: "Competitive salary, DOE" with no money figure anywhere is simply missing pay, not unreadable pay.
    if (pay.extractionStatus === 'unparseable' && !/(?:\$|US\$|USD|€|£)\s?\d|\d\s?(?:USD|dollars)\b/i.test(description)) pay.extractionStatus = 'missing';
    const signals = postingSignals(description);
    // Locations: what the visitor typed wins; otherwise "Location:" lines from the posting.
    let locations = String(locationsText ?? '').split(/\s*(?:;|\n|\|)\s*/).map((s) => s.trim()).filter(Boolean);
    let locationSource = locations.length ? 'entered' : null;
    const st = String(state || '').toUpperCase();
    if (st && STATE_NAMES[st]) {
        // A city typed without a state gets the picked state, so "Columbus" + OH reads as Columbus, Ohio.
        locations = locations.map((l) => (/,\s*[A-Za-z]{2}\b|\b(?:new york|washington|ohio|california)\b/i.test(l) ? l : `${l}, ${st}`));
        if (!locations.length) locations = [STATE_NAMES[st]];
        locationSource = 'entered';
    }
    if (!locations.length) { locations = detectLocations(description); if (locations.length) locationSource = 'posting'; }
    const remoteDetected = detectRemote(description);
    const isRemote = remote === 'yes' ? true : remote === 'no' ? false : remoteDetected;
    const ctx0 = jurisdictionContext(locations, [], isRemote);
    const usHit = ctx0.matches.some((m) => m.code.startsWith('US-')) || (st && STATE_NAMES[st]);
    const countries = usHit || (isRemote && !locations.length) ? ['US'] : [];
    const row = { ...pay, locations, remote: isRemote, countries, postingSignals: signals, jurisdictionContext: jurisdictionContext(locations, countries, isRemote) };
    const emp = Number.isFinite(Number(employees)) && employees !== '' && employees != null ? Number(employees) : null;
    const audit = auditPosting(row, { asOf, employeeCount: emp });
    const vague = description.match(VAGUE_PAY);
    const upcoming = [...Object.values(RULES)].filter((r) => !inForce(r, asOf) && row.jurisdictionContext.matches.some((m) => m.code === r.code));
    if (isRemote) for (const r of Object.values(RULES)) if (r.level === 'state' && !inForce(r, asOf) && !upcoming.includes(r)) upcoming.push(r);
    return { audit, pay, signals, row, locations, locationSource, isRemote, remoteDetected, vagueTerm: vague ? vague[0] : null, upcoming, employees: emp, verdict: verdictOf(audit, pay, locations, isRemote) };
}

function verdictOf(audit, pay, locations, isRemote) {
    if (!locations.length && !isRemote) return 'need_location';
    return { potential_issue: 'likely_missing', review_suggested: 'review', no_issue_found: 'looks_good', no_law_identified: 'no_law' }[audit.status] ?? 'review';
}

export const fmtMoney = (n, cur) => {
    if (n == null) return '';
    const s = n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return (cur === 'USD' || !cur ? '$' : `${cur} `) + s;
};
export function describeRange(r) {
    const per = r.payPeriod ? ` per ${r.payPeriod}` : '';
    if (r.rangeType === 'range') return `${fmtMoney(r.payMin, r.currency)} – ${fmtMoney(r.payMax, r.currency)}${per}`;
    if (r.rangeType === 'fixed') return `${fmtMoney(r.payMin, r.currency)}${per} (single figure)`;
    if (r.rangeType === 'minimum_only') return `From ${fmtMoney(r.payMin, r.currency)}${per} (no maximum)`;
    return `Up to ${fmtMoney(r.payMax, r.currency)}${per} (no minimum)`;
}

/** Plain-English fixes, de-duplicated across laws. */
export function fixes(result) {
    const out = [];
    const f = result.audit.findings;
    const has = (t) => f.some((x) => x.type === t && x.reviewPriority !== 'low');
    const hasAny = (t) => f.some((x) => x.type === t);
    const names = (t) => [...new Set(f.filter((x) => x.type === t).flatMap((x) => (x.jurisdictions ?? [x.jurisdiction]).map((c) => RULES[c]?.name ?? x.jurisdictionName)))];
    const firstRange = result.pay.payRanges.find((r) => r.payPeriod) ?? result.pay.payRanges[0];
    const hourly = firstRange?.payPeriod === 'hour';
    const example = hourly ? 'Pay range: $24.00 – $30.00 per hour' : 'Pay range: $85,000 – $105,000 per year';
    if (hasAny('missing_pay_range')) out.push({ title: 'Add a pay range', body: `${result.vagueTerm ? `Words like “${result.vagueTerm}” don’t count as pay information. ` : ''}Add the lowest and highest pay you in good faith expect to offer, for example “${example}”.` });
    if (hasAny('open_ended_pay')) out.push({ title: 'Give both a minimum and a maximum', body: `An open-ended figure like “from $X”, “up to $X” or “$80k+” is not a range. Replace it with a real top and bottom, for example “${example}”. ${names('open_ended_pay').length ? `This matters most for ${names('open_ended_pay').join(', ')}.` : ''}`.trim() });
    if (hasAny('single_figure_pay')) out.push({ title: 'Consider a range instead of one number', body: 'A single fixed rate is accepted in some places (for example New York State when pay is truly fixed), but most laws ask for a minimum and maximum. If pay can vary, show the range.' });
    if (hasAny('pay_text_unparseable')) out.push({ title: 'Make the pay line easy to read', body: `Pay wording was found but no clear dollar range. Write it as one line with a currency symbol and a period, for example “${example}”.` });
    if (hasAny('missing_benefits')) out.push({ title: 'Add a short benefits line', body: `${names('missing_benefits').slice(0, 6).join(', ')}${names('missing_benefits').length > 6 ? ' and others' : ''} also ask for a general description of benefits and other pay. One sentence is enough, for example “Benefits: medical, dental and vision insurance, 401(k) with match, paid time off and an annual bonus.”` });
    if (hasAny('missing_application_close')) out.push({ title: 'Add the application close date (Colorado)', body: 'Colorado asks for the date applications are expected to close, for example “Applications accepted through December 15, 2026.”' });
    if (hasAny('wide_pay_range')) out.push({ title: 'Check that the range is a good-faith estimate', body: 'The top of the range is at least twice the bottom. Very wide ranges can be challenged as not being a good-faith estimate; narrow it to what you would actually pay a new hire if you can.' });
    if (hasAny('range_exceeds_legal_cap')) out.push({ title: 'Narrow the range (Ontario)', body: 'Ontario caps the spread of a posted range at $50,000 a year.' });
    if (result.verdict === 'need_location') out.push({ title: 'Tell us where the job is', body: 'Pick the state (and city, if you know it) or mark the role as remote. Pay-transparency laws depend on where the work is done.' });
    return out;
}
