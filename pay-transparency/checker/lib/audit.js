// Copied from the Steadfeed Pay Transparency Compliance Monitor actor (src/audit.js) by ptcm-site-build/sync_checker_lib.py.
// Do not edit here; edit the actor source and re-run the sync.
import { RULES, inForce, REMOTE_EXPOSURE_CODES, SECONDARY_NOTE, PRIMARY_MARK, PRIORITY_ORDER } from './rules.js';

const WIDE_REVIEW = 2;  // max/min at or above this: "good faith" review flag
const WIDE_MEDIUM = 3;

const US_WORDS = /\b(united states|usa|u\.s\.a?\.?|us|north america|americas|west coast|east coast|pacific|mountain|central time|eastern time)\b/i;
const NON_US_WORDS = /\b(europe|emea|apac|asia|africa|latam|latin america|oceania|canada|uk|united kingdom|ireland|germany|france|spain|italy|netherlands|poland|india|singapore|japan|australia|new zealand|brazil|mexico|israel|uae|dubai)\b/i;

/** True when a remote role could be filled from the US (so state laws can reach it). */
export function remoteUsExposure(row) {
    const locs = row.locations ?? [];
    const remoteLocs = locs.filter((l) => /\b(remote|anywhere|work from home|distributed)\b/i.test(l));
    if (locs.some((l) => /^(?:united states(?: of america)?|usa|u\.s\.a?\.?|us)$/i.test(l.trim()))) return true;
    if (row.remote !== true && !remoteLocs.length) return false;
    if (locs.some((l) => /^(?:united states(?: of america)?|usa|u\.s\.a?\.?|us)$/i.test(l.trim()))) return true; // country-only US location: could be filled in any state
    if (remoteLocs.some((l) => US_WORDS.test(l))) return true;
    if (row.remote === true && locs.some((l) => US_WORDS.test(l))) return true;
    const countries = row.countries ?? [];
    if (countries.includes('US')) return remoteLocs.length ? !remoteLocs.every((l) => NON_US_WORDS.test(l) && !US_WORDS.test(l)) : true;
    if (countries.length) return false;
    // no country evidence: only plain "Remote" / "Anywhere" counts, not a named non-US region
    return !locs.some((l) => NON_US_WORDS.test(l));
}

/**
 * Decide which laws a posting is screened against and why.
 * basis: listed_location (law named by the location text), remote_exposure (remote US role, screened
 * against the states you hire in or every in-force US state), country (EU directive).
 */
export function applicableLaws(row, { asOf, hiringStates = null, employeeCount = null }) {
    const out = [], skipped = [];
    const add = (code, basis) => {
        const rule = RULES[code];
        if (!rule || out.some((o) => o.rule.code === code)) return;
        if (!inForce(rule, asOf)) { skipped.push({ code, reason: 'not_yet_in_force' }); return; }
        if (employeeCount != null && rule.min > employeeCount) { skipped.push({ code, reason: `employer_below_${rule.min}_employees` }); return; }
        out.push({ rule, basis });
    };
    const ctx = row.jurisdictionContext?.matches ?? [];
    for (const m of ctx) add(m.code, 'listed_location');
    if (remoteUsExposure(row)) {
        const codes = hiringStates ? hiringStates : REMOTE_EXPOSURE_CODES;
        for (const code of codes) add(code, 'remote_exposure');
    }
    const eu = ctx.filter((m) => m.level === 'eu');
    return { laws: out, skipped, euCountries: eu.map((m) => m.code) };
}

const finding = (rule, basis, type, reviewPriority, message, evidence = null) => ({
    jurisdiction: rule.code, jurisdictionName: rule.name, basis, type, reviewPriority, message, evidence,
    statuteSummary: rule.requirement, sourceUrl: rule.sourceUrl,
    exposureNote: rule.exposureNote ? (rule.exposureNote.includes(PRIMARY_MARK) ? rule.exposureNote : `${rule.exposureNote} ${SECONDARY_NOTE}`) : null,
    ruleCaveat: rule.ruleCaveat ?? null,
    privateRightOfAction: rule.privateRightOfAction === true,
    remoteNote: rule.remoteNote ?? null,
    requiresHumanReview: true,
});

function ranges(row) {
    return (row.payRanges ?? []).filter((r) => r.payMin != null || r.payMax != null);
}

/** One remote role can touch ~17 state laws; report each problem type once, listing the states. */
export function collapseRemote(findings) {
    const keep = [], groups = new Map();
    for (const f of findings) {
        if (f.basis !== 'remote_exposure') { keep.push(f); continue; }
        const g = groups.get(f.type) ?? [];
        g.push(f); groups.set(f.type, g);
    }
    for (const [type, g] of groups) {
        const sev = g.reduce((m, f) => (PRIORITY_ORDER[f.reviewPriority] > PRIORITY_ORDER[m] ? f.reviewPriority : m), 'low');
        const codes = g.map((f) => f.jurisdiction);
        const noted = g.find((f) => f.privateRightOfAction) ?? g.find((f) => f.exposureNote) ?? g[0];
        keep.push({
            jurisdiction: 'US-REMOTE', jurisdictionName: `Remote US role: ${g.length} state law${g.length === 1 ? '' : 's'} may reach it`,
            jurisdictions: codes, basis: 'remote_exposure', type, reviewPriority: sev,
            message: `${g[0].message} A remote role open to applicants in these states can be screened against each state's law.`,
            evidence: g[0].evidence, statuteSummary: null, sourceUrl: null,
            exposureNote: noted.exposureNote ? `${noted.jurisdiction}: ${noted.exposureNote}` : null, privateRightOfAction: g.some((f) => f.privateRightOfAction),
            jurisdictionSources: Object.fromEntries(g.map((f) => [f.jurisdiction, { sourceUrl: f.sourceUrl, statuteSummary: f.statuteSummary }])),
            ruleCaveats: Object.fromEntries(g.filter((f) => f.ruleCaveat).map((f) => [f.jurisdiction, f.ruleCaveat])),
            requiresHumanReview: true, remoteApplicability: Object.fromEntries(g.filter((f) => f.remoteNote).map((f) => [f.jurisdiction, f.remoteNote])),
        });
    }
    return keep;
}

export function auditPosting(row, opts) {
    const { laws, skipped, euCountries } = applicableLaws(row, opts);
    const findings = [];
    const unchecked = row.extractionStatus === 'source_error';
    const sig = row.postingSignals ?? {};
    const rs = ranges(row);
    const full = rs.filter((r) => r.payMin != null && r.payMax != null && r.payMin !== r.payMax);
    const topAnnual = rs.reduce((m, r) => Math.max(m, r.annualMax ?? r.annualMin ?? 0), 0);
    for (const { rule, basis } of laws) {
        if (unchecked) break;
        if (rule.exemptAboveAnnual && topAnnual > rule.exemptAboveAnnual) continue; // Ontario: pay above CAD 200,000 is outside the duty
        if (!row.payRangeDisclosed && row.extractionStatus !== 'unparseable') {
            if (row.extractionStatus === 'single_value') {
                const open = rs.some((r) => r.rangeType === 'minimum_only' || r.rangeType === 'maximum_only');
                const sev = open && rule.openEnded === 'prohibited' ? 'high' : 'medium';
                findings.push(finding(rule, basis, open ? 'open_ended_pay' : 'single_figure_pay', sev,
                    open ? 'Only a minimum or maximum ("from"/"up to") figure was found, not a full range.' : 'A single pay figure was found, not a minimum-maximum range. Some laws accept a fixed rate; others ask for a range.', row.rawPayText));
            } else {
                findings.push(finding(rule, basis, 'missing_pay_range', rule.exemptAboveAnnual ? 'medium' : 'high', 'No pay range was found in the posting data this screen can read (ATS feed and description). Confirm on the live posting. A range shown only on a rendered page or in an attachment would not be seen here.' + (rule.exemptAboveAnnual ? ' This law does not apply to pay above CAD 200,000 a year, which cannot be ruled out without a figure.' : '')));
            }
        } else if (row.extractionStatus === 'unparseable') {
            findings.push(finding(rule, basis, 'pay_text_unparseable', 'medium', 'Compensation wording is present but no pay range could be parsed; a person should review.', row.rawPayText));
        }
        if (full.length && basis !== 'remote_exposure') {
            // good-faith width check, once per law that cares about a range
            for (const r of full) {
                const ratio = r.payMax / r.payMin;
                if (ratio >= WIDE_REVIEW) {
                    findings.push(finding(rule, basis, 'wide_pay_range', ratio >= WIDE_MEDIUM ? 'medium' : 'low', `Range spread is ${ratio.toFixed(1)}x (max/min). Wide ranges can draw "good-faith estimate" challenges.`, `${r.currency ?? ''} ${r.payMin}-${r.payMax} per ${r.payPeriod ?? '?'}`.trim()));
                    break;
                }
            }
        }
        if (rule.maxSpreadAnnual) {
            const wide = full.find((r) => r.annualMin != null && r.annualMax != null && r.annualMax - r.annualMin > rule.maxSpreadAnnual);
            if (wide) findings.push(finding(rule, basis, 'range_exceeds_legal_cap', 'medium', `The annualized range spread is about ${Math.round(wide.annualMax - wide.annualMin).toLocaleString('en-US')} (cap ${rule.maxSpreadAnnual.toLocaleString('en-US')} a year under this law). Annualization assumes full-time hours.`, `${wide.currency ?? ''} ${wide.payMin}-${wide.payMax} per ${wide.payPeriod ?? '?'}`.trim()));
        }
        if (rule.benefits && sig.mentionsBenefits === false) {
            findings.push(finding(rule, basis, 'missing_benefits', basis === 'remote_exposure' ? 'low' : 'medium', 'No benefits or other-compensation wording was detected in the posting text, which this law also asks for. The check is keyword-based; confirm on the live posting.'));
        }
        if (rule.closeDate && sig.mentionsApplicationClose === false) {
            findings.push(finding(rule, basis, 'missing_application_close', basis === 'remote_exposure' ? 'low' : 'medium', 'No application close date or window was detected; Colorado asks for the date applications are expected to close. The check is keyword-based; confirm on the live posting.'));
        }
    }
    if (!laws.length && euCountries.length && !unchecked && !row.payRangeDisclosed) {
        findings.push({ jurisdiction: 'EU-2023-970', jurisdictionName: 'EU Pay Transparency Directive (national law applies)', basis: 'country', type: 'missing_pay_range', reviewPriority: 'medium', message: `No pay range found in a posting located in ${euCountries.map((c) => c.replace('EU-', '')).join(', ')}. The directive requires pay information before the interview; national implementing law decides the details.`, evidence: null, statuteSummary: 'Directive (EU) 2023/970 Art. 5.', sourceUrl: 'https://eur-lex.europa.eu/eli/dir/2023/970/oj/eng', exposureNote: null, privateRightOfAction: false, remoteNote: null, requiresHumanReview: true });
    }
    findings.splice(0, findings.length, ...collapseRemote(findings));
    const top = findings.reduce((m, f) => Math.max(m, PRIORITY_ORDER[f.reviewPriority]), 0);
    let status;
    if (unchecked) status = 'unchecked';
    else if (!laws.length && !euCountries.length) status = 'no_law_identified';
    else if (top === 3) status = 'potential_issue';
    else if (top === 2) status = 'review_suggested';
    else status = 'no_issue_found'; // low-priority advisories alone do not trigger review; they stay in findings
    const states = [...new Set(findings.filter((f) => f.reviewPriority === 'high').flatMap((f) => f.jurisdictions ?? [f.jurisdiction]))];
    return {
        recordType: 'posting_audit',
        company: row.company, companySlug: row.companySlug, atsSource: row.atsSource, jobId: row.jobId, title: row.title, jobUrl: row.jobUrl,
        locations: row.locations, remote: row.remote, postedAt: row.postedAt, updatedAt: row.updatedAt, checkedAt: row.checkedAt,
        status,
        contentHash: row.contentHash ?? null,
        lawsScreened: laws.map(({ rule, basis }) => ({ code: rule.code, name: rule.name, basis })),
        lawsSkipped: skipped,
        findingCount: findings.length,
        advisoryCount: findings.filter((f) => f.reviewPriority === 'low').length,
        highPriorityJurisdictions: states,
        findings,
        pay: { disclosed: row.payRangeDisclosed, extractionStatus: row.extractionStatus, paySource: row.paySource, pageCheck: row.pageCheck ?? null, ranges: row.payRanges ?? [] },
        postingSignals: { mentionsBenefits: sig.mentionsBenefits ?? null, mentionsApplicationClose: sig.mentionsApplicationClose ?? null },
        structuredCheckComplete: row.structuredCheckComplete,
        scope: 'Potential compliance issue screen of public posting text. Every flagged item requires human review; it is not a finding of violation, not legal advice and not a compliance determination.',
    };
}

export const isBillableAudit = (a) => a.recordType === 'posting_audit' && a.status !== 'unchecked' && a.structuredCheckComplete === true;
