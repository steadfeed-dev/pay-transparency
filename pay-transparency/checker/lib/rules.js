// Copied from the Steadfeed Pay Transparency Compliance Monitor actor (src/rules.js) by ptcm-site-build/sync_checker_lib.py.
// Do not edit here; edit the actor source and re-run the sync.
// Compliance rule metadata layered on the law table in jurisdictions.js.
// Facts: statute summaries are the jurisdictions.js entries (official links, reviewed 2026-11-09).
// `exposureNote` text is summarized from public tracker pages (secondary sources) and always labeled so.
// This is posting-text screening, NOT legal advice or a compliance determination.
import { US_STATES, US_LOCAL, CANADA } from './jurisdictions.js';

export const PRIMARY_MARK = '(primary';
export const SECONDARY_NOTE = 'Penalty/cure summaries come from public compliance trackers (secondary sources); verify with the linked statute.';

// min: employer-size threshold (employees). benefits/closeDate: extra posting elements the law asks for.
// openEnded: 'prohibited' when the rule text excludes up-to/from-only figures, else 'review'.
const META = {
    // exposureNote text is labeled with its source tier. "primary" = statute or agency page read for the 2026-11-09 verification.
    'US-CA': { ruleCaveat: 'The penalty range comes from a compliance tracker (secondary source), not re-read from the statute; verify before relying on it.',  min: 15, exposureNote: 'Civil penalty $100-$10,000 per violation (tracker summary).', remoteNote: 'California Labor Commissioner reading: a posting is covered if the job may be filled by a California-based worker (at least one California employee is required).' },
    'US-CO': { min: 1, benefits: true, closeDate: true, exposureNote: 'Fines of $500-$10,000 per violation; all postings for one job count as one violation (CDLE INFO #9, primary).', remoteNote: 'CDLE: remote jobs are covered even if Coloradans are excluded; a narrow out-of-state, in-person-job carve-out exists for small employers through 2029-07-01.' },
    'US-CT': { min: 1, benefits: true, remoteNote: 'Applies to Connecticut positions and out-of-state positions that report to a Connecticut supervisor, office or worksite (law-firm summaries of Public Act 26-12; verify).' },
    'US-DE': { min: 26, benefits: true, openEnded: 'prohibited', remoteNote: 'Covers jobs located in Delaware and non-international remote positions offered by a Delaware-based employer (statute).' },
    'US-DC': { min: 1, openEnded: 'prohibited', remoteNote: 'The statute does not address remote roles; verify.' },
    'US-HI': { min: 50, remoteNote: 'The agency FAQ says the law does not specify where the 50 employees must be located; remote coverage is not addressed.' },
    'US-IL': { ruleCaveat: 'The penalty range comes from a compliance tracker (secondary source), not re-read from the statute; verify before relying on it.',  min: 15, benefits: true, openEnded: 'prohibited', exposureNote: 'Civil penalties up to $10,000 depending on offense (tracker summary).', remoteNote: 'Illinois DOL: covers jobs that will be performed at least in part in Illinois, or performed elsewhere but reporting to an Illinois supervisor, office or site.' },
    'US-ME': { min: 10, remoteNote: 'The statute does not address remote roles; verify.' },
    'US-MD': { min: 1, benefits: true, openEnded: 'prohibited', remoteNote: 'Maryland DOL FAQ: covers postings for work physically performed at least in part in Maryland, including remote roles that seek Maryland-based workers.' },
    'US-MA': { min: 25, exposureNote: 'Statute (G.L. c.149 s.105F, primary): a warning for a first violation, then $500, then $1,000; later violations are penalized under s.27C.', remoteNote: 'Remote coverage not verified from the statute; verify.' },
    'US-MN': { min: 30, benefits: true, openEnded: 'prohibited', remoteNote: 'Remote coverage not verified from the statute; verify.' },
    'US-NJ': { min: 10, benefits: true, openEnded: 'prohibited', exposureNote: 'NJDOL (primary): civil penalty of up to $300 for a first violation and up to $600 for each subsequent violation.', remoteNote: 'NJDOL: covers an employer that does business, employs persons or takes applications for employment in New Jersey.' },
    'US-NY': { min: 4, openEnded: 'prohibited', remoteNote: 'NYS DOL FAQ: covers jobs that will be performed at least in part in New York, or that report to a supervisor, office or worksite in New York.' },
    'US-VT': { min: 5, remoteNote: 'Statute: covers remote positions that predominantly work for a Vermont office or work location.' },
    'US-VA': { ruleCaveat: 'UNCERTAIN: the effective date (2026-07-01) and the employer-size threshold could not be confirmed from a primary source; the statute page read carries neither. Verify before relying on this screen for Virginia.',  min: 1, openEnded: 'prohibited', exposureNote: 'Statute (primary): Attorney General civil penalty up to $1,000 for a first and $5,000 for a later violation; a private action requires an opportunity to correct the posting first.', remoteNote: 'The statute does not address remote roles; verify.' },
    'US-WA': { ruleCaveat: 'Penalty amounts and the cure window come from compliance trackers and agency policy summaries (secondary sources); verify with the statute and L&I before relying on them.',  min: 15, benefits: true, privateRightOfAction: true, exposureNote: 'Private right of action: statutory damages of $100-$5,000 per violation; a 5-business-day cure window applies to postings through 2027-07-27 (tracker summary).', remoteNote: 'L&I policy treats remote postings that could be filled by a Washington-based worker as covered (secondary; verify).' },
    'US-NY-NYC': { min: 4, openEnded: 'prohibited', exposureNote: 'Commission (primary): civil penalty of up to $250,000, with a 30-day cure for a first complaint.', remoteNote: 'NYC Commission: covers positions that can or will be performed in whole or in part in New York City, including remotely from home.' },
    'US-OH-CLE': { min: 15 },
    'US-NY-WES': { min: 1, openEnded: 'prohibited' },
    'US-NJ-JC': { min: 5, benefits: true, exposureNote: 'City page (primary): fine of up to $2,000.', remoteNote: 'The city page describes employers in Jersey City; remote coverage is not addressed. Verify.' },
    'US-OH-CMH': { min: 15, ruleCaveat: 'The posting requirement is in Ordinance 2898-2025 but shall not be enforced until 2027-01-01 (Section 3).' },
    'CA-BC': { min: 1, openEnded: 'prohibited', remoteNote: 'BC guidance: applies to jobs open to BC residents that may be filled by someone living in BC, in person or remotely.' },
    'CA-ON': { min: 25, maxSpreadAnnual: 50000, exemptAboveAnnual: 200000 },
    'CA-PE': { ruleCaveat: 'Government page text was thin; the effective date comes from a summary of the Employment Standards Act amendment (secondary); verify.',  min: 1 },
    'CA-NB': { ruleCaveat: 'The posting duty is read as in force from Royal Assent (2026-06-12); enforcement provisions are not yet in force. Commencement reading is secondary; verify.',  min: 1 },
};

const ALL = [...Object.values(US_STATES), ...US_LOCAL.map((l) => l.law), ...CANADA.map((c) => c.law)];
export const RULES = Object.fromEntries(ALL.filter((l) => META[l.code]).map((l) => [l.code, { ...l, ...META[l.code] }]));

export function inForce(rule, asOf) {
    // Effective date is the source of truth so upcoming laws (Columbus, Delaware) switch on automatically.
    const day = asOf.slice(0, 10);
    if (rule.effectiveDate) return rule.effectiveDate <= day;
    return rule.status !== 'enacted_not_yet_effective';
}

/** US state/district laws that can reach a remote role anywhere (not city/county rules). */
export const REMOTE_EXPOSURE_CODES = Object.values(US_STATES).map((l) => l.code);

export const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };
