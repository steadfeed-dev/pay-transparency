// Copied from the Steadfeed Pay Transparency Compliance Monitor actor (src/jurisdictions.js) by ptcm-site-build/sync_checker_lib.py.
// Do not edit here; edit the actor source and re-run the sync.
// Informational pay-transparency law context keyed to a job's listed locations.
// NOT legal advice and NOT a compliance determination: it only says which laws are *relevant to the
// location text*, so a reader knows what to look up. Facts compiled from public summaries and official
// sources linked per entry; reviewed 2026-11-09; Jersey City, Columbus and added city maps checked 2026-11-10. Laws change; verify with the linked source.

export const REVIEWED_ON = '2026-11-10';
export const DISCLAIMER = 'Informational context from the job location text only. Not legal advice and not a compliance finding. Coverage thresholds, remote-work rules and dates change; verify with the linked source.';

const L = (code, name, level, effective, coverage, summary, sourceUrl, extra = {}) => ({ code, name, level, effectiveDate: effective, employerCoverage: coverage, requirement: summary, sourceUrl, status: 'in_force', ...extra });

export const US_STATES = {
    CA: L('US-CA', 'California', 'state', '2023-01-01', '15 or more employees, at least one in California', 'Pay scale (good-faith salary or hourly range) in every job posting.', 'https://www.dir.ca.gov/dlse/California_Equal_Pay_Act.htm'),
    CO: L('US-CO', 'Colorado', 'state', '2021-01-01', 'Any employer with at least one employee in Colorado', 'Pay or pay range and a general description of benefits and other compensation in every job opportunity notice; since 2024 also the date applications close.', 'https://content.leg.colorado.gov/sites/default/files/2023a_105_signed.pdf'),
    CT: L('US-CT', 'Connecticut', 'state', '2026-10-01', 'One or more employees', 'Wage or wage range and a general description of benefits in every internal or public job advertisement.', 'https://www.cga.ct.gov/2026/ACT/PA/PDF/2026PA-00012-R00HB-05003-PA.PDF'),
    DE: L('US-DE', 'Delaware', 'state', '2027-09-26', '26 or more employees', 'Hourly or salary range and a general description of benefits and other compensation in every posting.', 'https://legis.delaware.gov/SessionLaws/Chapter?id=42391', { status: 'enacted_not_yet_effective' }),
    DC: L('US-DC', 'District of Columbia', 'district', '2024-06-30', 'At least one employee in the District', 'Minimum and maximum projected pay in every job listing; the existence of healthcare benefits must be disclosed to prospective employees before the first interview (not necessarily in the posting).', 'https://code.dccouncil.gov/us/dc/council/code/sections/32-1453.01'),
    HI: L('US-HI', 'Hawaii', 'state', '2024-01-01', '50 or more employees', 'Hourly rate or salary range in every job listing; internal transfers and promotions excepted.', 'https://labor.hawaii.gov/hcrc/files/2023/11/Act-203-Pay-Transparency-FAQs.pdf'),
    IL: L('US-IL', 'Illinois', 'state', '2025-01-01', '15 or more employees, counted inside and outside Illinois', 'Pay scale and a general description of benefits in every posting.', 'https://labor.illinois.gov/faqs/equal-pay-act-salary-transparency-faq.html'),
    ME: L('US-ME', 'Maine', 'state', '2026-07-29', '10 or more employees', 'Prospective range of pay in every posting, or a statement that pay is commission only.', 'https://legislature.maine.gov/statutes/26/title26sec622-A.html'),
    MD: L('US-MD', 'Maryland', 'state', '2024-10-01', 'All employers', 'Pay range, a general description of benefits, and any other compensation in every posting.', 'https://labor.maryland.gov/labor/wages/esswagerangefaq.shtml'),
    MA: L('US-MA', 'Massachusetts', 'state', '2025-10-29', '25 or more employees in Massachusetts', 'Pay range in every job posting.', 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter149/Section105F'),
    MN: L('US-MN', 'Minnesota', 'state', '2025-01-01', '30 or more employees at sites in Minnesota', 'Starting salary range (or fixed rate) and a general description of benefits and other compensation in every posting.', 'https://www.revisor.mn.gov/statutes/cite/181.173'),
    NJ: L('US-NJ', 'New Jersey', 'state', '2025-06-01', '10 or more employees over 20 calendar weeks', 'Wage, salary or range, a general description of benefits, and other compensation programs in every posting.', 'https://www.nj.gov/labor/myworkrights/wages/pay-transparency'),
    NY: L('US-NY', 'New York', 'state', '2023-09-17', '4 or more employees', 'Pay range (or fixed pay) in every posting for a job, promotion or transfer, with the job description if one exists.', 'https://dol.ny.gov/pay-transparency-act-frequently-asked-questions'),
    VT: L('US-VT', 'Vermont', 'state', '2025-07-01', '5 or more employees', 'Pay or pay range in every advertisement of a Vermont job opening.', 'https://legislature.vermont.gov/statutes/section/21/005/00495p'),
    VA: L('US-VA', 'Virginia', 'state', '2026-07-01', 'All employers', 'Wage, salary or range in every public and internal posting for a job, promotion or transfer.', 'https://law.lis.virginia.gov/vacode/title40.1/chapter3/section40.1-28.7:12/'),
    WA: L('US-WA', 'Washington', 'state', '2023-01-01', '15 or more employees', 'Wage scale or salary range and a general description of benefits and other compensation in every posting.', 'https://app.leg.wa.gov/RCW/default.aspx?cite=49.58.110'),
};

export const US_LOCAL = [
    { test: /\b(?:new york city|nyc|manhattan|brooklyn|queens|the bronx|staten island)\b|new york,\s*(?:ny|new york)\b/i, law: L('US-NY-NYC', 'New York City', 'city', '2022-11-01', '4 or more employees, at least one in New York City', 'Good-faith minimum and maximum salary in every job, promotion or transfer advertisement.', 'https://www.nyc.gov/assets/cchr/downloads/pdf/publications/Salary-Transparency-Factsheet.pdf') },
    { test: /\bcleveland\b/i, law: L('US-OH-CLE', 'Cleveland, Ohio', 'city', '2025-10-27', '15 or more employees in Cleveland', 'Salary range or pay scale in every formal job posting.', 'https://www.clevelandohio.gov/city-hall/boards-commissions/fair-employment-wage-board/laws-procedures') },
    { test: /\b(?:westchester|white plains|yonkers|new rochelle|mount vernon, ny)\b/i, law: L('US-NY-WES', 'Westchester County, New York', 'county', '2022-11-06', 'All employers except the county government', 'Minimum and maximum salary in every job, promotion or transfer posting.', 'https://humanrights.westchestercountyny.gov/salary-transparency-amendment') },
    { test: /\bjersey city\b/i, law: L('US-NJ-JC', 'Jersey City, New Jersey', 'city', '2022-04-13', '5 or more employees in Jersey City, including staff and independent contractors', 'Minimum and maximum base salary or hourly wage, and job benefits, in every print or digital job posting.', 'https://www.jerseycitynj.gov/residentresources/inclusion/paytransparency') },
    // Columbus posting duty is in the ordinance but shall not be enforced until 2027-01-01 (Ord. 2898-2025 s.3). Require OH to avoid Columbus, GA and other cities.
    { test: /\bcolumbus(?:,\s*oh(?:io)?|\s+ohio)\b/i, law: L('US-OH-CMH', 'Columbus, Ohio', 'city', '2027-01-01', '15 or more employees in Columbus', 'Reasonable salary range or pay scale in job postings soliciting applicants for work in Columbus.', 'https://columbus.legistar.com/LegislationDetail.aspx?ID=7713138&GUID=E97F7B48-94C8-4C0D-8A56-CA886949C0CF&FullText=1', { status: 'enacted_not_yet_effective' }) },
];

export const CANADA = [
    { names: ['British Columbia'], code: 'BC', law: L('CA-BC', 'British Columbia', 'province', '2023-11-01', 'Provincially regulated employers advertising publicly', 'Expected salary or wage (or a range) on publicly advertised job postings; "up to" and "from" figures do not satisfy the rule.', 'https://www2.gov.bc.ca/gov/content/governments/about-the-bc-government/gender-equity/wage-or-salary-information-on-job-postings') },
    { names: ['Ontario'], code: 'ON', law: L('CA-ON', 'Ontario', 'province', '2026-01-01', 'Employers with 25 or more employees', 'Expected compensation or a range in public job postings; a range may not exceed $50,000 a year, and the duty does not apply when expected pay (or the top of the range) is above $200,000 a year.', 'https://www.ontario.ca/document/your-guide-employment-standards-act-0') },
    { names: ['Prince Edward Island'], code: 'PE', law: L('CA-PE', 'Prince Edward Island', 'province', '2022-06-01', 'Any employer advertising a specific job to the public', 'Expected pay or a pay range in publicly advertised job postings.', 'https://www.princeedwardisland.ca/en/information/workforce-and-advanced-learning/pay-transparency') },
    { names: ['New Brunswick'], code: 'NB', law: L('CA-NB', 'New Brunswick', 'province', '2026-06-12', 'Employers under provincial authority', 'Expected hourly wage or salary, or a range, in public and internal postings (posting rule in force; enforcement provisions not yet in force).', 'https://laws.gnb.ca/en/document/cs/2026%2C%20c.1', { status: 'in_force_partially' }) },
];

// EU Pay Transparency Directive (EU) 2023/970, Art. 5 (pay or range before interview / in the vacancy notice). Transposition deadline 7 June 2026.
export const EU_DIRECTIVE = { code: 'EU-2023-970', name: 'EU Pay Transparency Directive (EU) 2023/970', level: 'eu', effectiveDate: '2026-06-07', requirement: 'Applicants have the right to the initial pay or pay range, in the vacancy notice or before the interview; employers may not ask about pay history. Applies through national law.', sourceUrl: 'https://eur-lex.europa.eu/eli/dir/2023/970/oj/eng' };
export const EU_NATIONAL_STATUS = { // As reported by public trackers, early Nov 2026. Verify nationally.
    IT: 'complete', SK: 'complete', LT: 'complete', MT: 'complete', GR: 'complete',
    BE: 'partial', CZ: 'partial', EE: 'partial', PL: 'partial',
};

// ATS location strings often omit the state ("San Francisco", "Toronto, Canada"). Unambiguous metro names only.
export const CITY_TO_REGION = {
    'san francisco': 'CA', 'los angeles': 'CA', 'san diego': 'CA', 'oakland': 'CA', 'san jose': 'CA', 'mountain view': 'CA', 'palo alto': 'CA', 'sunnyvale': 'CA', 'menlo park': 'CA', 'redwood city': 'CA', 'santa clara': 'CA', 'sacramento': 'CA', 'irvine': 'CA', 'santa monica': 'CA', 'south san francisco': 'CA', 'cupertino': 'CA', 'fremont': 'CA',
    'seattle': 'WA', 'bellevue': 'WA', 'redmond': 'WA', 'kirkland': 'WA', 'denver': 'CO', 'boulder': 'CO', 'chicago': 'IL', 'boston': 'MA', 'minneapolis': 'MN', 'saint paul': 'MN', 'st. paul': 'MN', 'baltimore': 'MD', 'honolulu': 'HI', 'jersey city': 'NJ', 'newark': 'NJ', 'hoboken': 'NJ', 'burlington, vt': 'VT',
    'toronto': 'ON', 'ottawa': 'ON', 'mississauga': 'ON', 'waterloo, on': 'ON', 'vancouver, bc': 'BC', 'vancouver, british columbia': 'BC', 'victoria, bc': 'BC', 'burnaby': 'BC',
    'hartford': 'CT', 'new haven': 'CT', 'stamford': 'CT', 'bridgeport': 'CT',
    'portland, me': 'ME', 'portland, maine': 'ME', 'augusta, me': 'ME', 'bangor, me': 'ME',
    'charlottetown': 'PE',
    'moncton': 'NB', 'fredericton': 'NB', 'saint john, nb': 'NB', 'saint john, new brunswick': 'NB',
};
const CANADA_BY_CODE = { ON: 'Ontario', BC: 'British Columbia', PE: 'Prince Edward Island', NB: 'New Brunswick' };

const stateCodeRe = (c) => new RegExp(`,\\s*${c}(?:\\b|$)`);
function literal(hay, needle) {
    const n = needle.toLowerCase(); const s = hay.toLowerCase();
    let at = s.indexOf(n);
    while (at >= 0) {
        if ((at === 0 || !/[a-z0-9]/i.test(s[at - 1])) && (at + n.length === s.length || !/[a-z0-9]/i.test(s[at + n.length]))) return true;
        at = s.indexOf(n, at + 1);
    }
    return false;
}

/**
 * @param {string[]} locations job location strings
 * @param {string[]} countries inferred ISO country codes
 * @param {boolean|null} remote
 */
export function jurisdictionContext(locations, countries, remote) {
    const text = (locations ?? []).join(' | ');
    const matches = [];
    const add = (law, basis) => { if (!matches.some((m) => m.code === law.code)) matches.push({ ...law, matchedOn: basis }); };

    for (const [abbr, law] of Object.entries(US_STATES)) {
        const nm = law.name;
        const hitName = abbr === 'WA' ? /\bwashington\b(?!,?\s*d\.?c)/i.test(text) && !/washington,?\s*d\.?c/i.test(text) : literal(text, nm);
        if (nm === 'District of Columbia') { if (/\bwashington,?\s*d\.?c\.?\b|\bdistrict of columbia\b/i.test(text)) add(law, 'location text'); continue; }
        if (hitName || stateCodeRe(abbr).test(text)) add(law, 'location text');
    }
    for (const [city, region] of Object.entries(CITY_TO_REGION)) {
        if (!literal(text, city)) continue;
        if (CANADA_BY_CODE[region]) { const c = CANADA.find((x) => x.code === region); if (c) add(c.law, 'location text'); }
        else if (US_STATES[region]) add(US_STATES[region], 'location text');
    }
    for (const { test, law } of US_LOCAL) if (test.test(text)) add(law, 'location text');
    for (const c of CANADA) {
        if (c.names.some((n) => literal(text, n)) || stateCodeRe(c.code).test(text)) add(c.law, 'location text');
    }
    const eu = (countries ?? []).filter((c) => ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'].includes(c));
    for (const c of eu) add({ ...EU_DIRECTIVE, code: `EU-${c}`, name: `${EU_DIRECTIVE.name} - ${c}`, status: 'directive_deadline_passed', nationalTransposition: EU_NATIONAL_STATUS[c] ?? 'pending_or_unknown', employerCoverage: 'Per national implementing law', note: 'The directive requires national law; check the member state\'s implementing law.' }, 'country');

    const noStateButUs = !matches.some((m) => m.code.startsWith('US-')) && (countries ?? []).includes('US');
    let note = null;
    if (!matches.length) note = 'No pay-transparency law identified from the location text. This is not a finding that none applies (for example, remote roles may be covered by the law of the state where the worker is located).';
    else if (remote) note = 'Remote role: coverage may depend on where the worker is based; verify.';
    else if (noStateButUs) note = 'Some US coverage may still apply to other states not named in the location text.';
    return { reviewedOn: REVIEWED_ON, disclaimer: DISCLAIMER, matches, note };
}

