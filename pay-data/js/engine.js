/* Steadfeed Pay Data Report Builder - calculation engine.
 * Pure functions, no network, no DOM. Works in the browser (window.PDR) and in Node (module.exports).
 * Analysis aid, not legal advice.
 */
(function (root) {
  'use strict';

  // ---------- Reference data ----------
  const SOC_MAJOR = [
    ['11', 'Management Occupations'],
    ['13', 'Business and Financial Operations Occupations'],
    ['15', 'Computer and Mathematical Occupations'],
    ['17', 'Architecture and Engineering Occupations'],
    ['19', 'Life, Physical, and Social Science Occupations'],
    ['21', 'Community and Social Service Occupations'],
    ['23', 'Legal Occupations'],
    ['25', 'Educational Instruction and Library Occupations'],
    ['27', 'Arts, Design, Entertainment, Sports, and Media Occupations'],
    ['29', 'Healthcare Practitioners and Technical Occupations'],
    ['31', 'Healthcare Support Occupations'],
    ['33', 'Protective Service Occupations'],
    ['35', 'Food Preparation and Serving Related Occupations'],
    ['37', 'Building and Grounds Cleaning and Maintenance Occupations'],
    ['39', 'Personal Care and Service Occupations'],
    ['41', 'Sales and Related Occupations'],
    ['43', 'Office and Administrative Support Occupations'],
    ['45', 'Farming, Fishing, and Forestry Occupations'],
    ['47', 'Construction and Extraction Occupations'],
    ['49', 'Installation, Maintenance, and Repair Occupations'],
    ['51', 'Production Occupations'],
    ['53', 'Transportation and Material Moving Occupations'],
    ['55', 'Military Specific Occupations'],
  ];
  const SOC_NAME = Object.fromEntries(SOC_MAJOR);

  // CRD RY2026 preliminary job categories (Job Category Mapping Table, Nov 16, 2026).
  // 11-1011 (Chief executives) -> 11-1010; other SOC 11 -> 11-M000; SOC 13-53 -> NN-0000; Military (55) is not a category.
  const CA_JOB_CATEGORIES = [
    ['11-1010', 'Chief executives'],
    ['11-M000', 'Management occupations, except chief executives'],
    ['13-0000', 'Business and financial operations occupations'],
    ['15-0000', 'Computer and mathematical occupations'],
    ['17-0000', 'Architecture and engineering occupations'],
    ['19-0000', 'Life, physical, and social science occupations'],
    ['21-0000', 'Community and social service occupations'],
    ['23-0000', 'Legal occupations'],
    ['25-0000', 'Educational instruction and library occupations'],
    ['27-0000', 'Arts, design, entertainment, sports, and media occupations'],
    ['29-0000', 'Healthcare practitioners and technical occupations'],
    ['31-0000', 'Healthcare support occupations'],
    ['33-0000', 'Protective service occupations'],
    ['35-0000', 'Food preparation and serving related occupations'],
    ['37-0000', 'Building and grounds cleaning and maintenance occupations'],
    ['39-0000', 'Personal care and service occupations'],
    ['41-0000', 'Sales and related occupations'],
    ['43-0000', 'Office and administrative support occupations'],
    ['45-0000', 'Farming, fishing, and forestry occupations'],
    ['47-0000', 'Construction and extraction occupations'],
    ['49-0000', 'Installation, maintenance, and repair occupations'],
    ['51-0000', 'Production occupations'],
    ['53-0000', 'Transportation and material moving occupations'],
  ];
  const CA_JOB_CATEGORY_NAME = Object.fromEntries(CA_JOB_CATEGORIES);

  function caCategoryFromSoc(soc) {
    if (soc === null || soc === undefined) return null;
    const s = String(soc).trim().replace(/\.00$/, '');
    if (!s) return null;
    const major = s.slice(0, 2);
    if (major === '55') return null;
    if (/^11-1011(\b|$)/.test(s) || /^11-1010(\b|$)/.test(s)) return '11-1010';
    if (major === '11') return '11-M000';
    const code = major + '-0000';
    return Object.prototype.hasOwnProperty.call(CA_JOB_CATEGORY_NAME, code) ? code : null;
  }

  const EEO1 = {
    1: 'Executive or senior level officials and managers', 2: 'First or mid-level officials and managers',
    3: 'Professionals', 4: 'Technicians', 5: 'Sales workers', 6: 'Administrative support workers',
    7: 'Craft workers', 8: 'Operatives', 9: 'Laborers and helpers', 10: 'Service workers',
  };

  // CRD Reporting Year 2025 pay bands (handbook RY2025, Gov. Code 12999(b)(2)). Upper bound inclusive.
  const PAY_BANDS_RY2025 = [
    [1, 0, 19239], [2, 19240, 24959], [3, 24960, 32239], [4, 32240, 41079], [5, 41080, 53039],
    [6, 53040, 68119], [7, 68120, 87359], [8, 87360, 112319], [9, 112320, 144559],
    [10, 144560, 186159], [11, 186160, 239199], [12, 239200, Infinity],
  ];

  const CRD_PAYROLL_HEADERS_RY2025 = [
    'Establishment Name*', 'Address Line 1*', 'Address Line 2', 'City*', 'State*', 'ZIP Code*', 'NAICS Code*',
    'Major Activity*', 'Total Number of California Payroll Employees at Establishment*',
    'Was a California Pay Data Report Filed for This Establishment Last Year?*',
    "Is This Establishment the Employer's Headquarters?*", 'Job Category*', 'Race/Ethnicity/Sex*', 'Pay Band*',
    'Exemption Status', 'Employment Type', 'Total Number of California Employees in This Employee Group*',
    'Total Annual Hours Worked*', 'Total Annual Weeks Worked', 'Mean Hourly Rate*', 'Median Hourly Rate*',
    'Number of California Employees That Do Not Work Remotely*',
    'Number of Remote California Employees Located Within California*',
    'Number of Remote California Employees Located Outside of California*', 'Row-Level Clarifying Remarks',
  ];

  // CRD RY2026 preliminary payroll employee template (Nov 16, 2026): 22 columns; three remote-work count fields removed.
  const CRD_PAYROLL_HEADERS_RY2026_PRELIM = [
    'Establishment Name*', 'Address Line 1*', 'Address Line 2', 'City*', 'State*', 'ZIP Code*', 'NAICS Code*',
    'Major Activity*', 'Total Number of California Payroll Employees at Establishment*',
    'Was a California Pay Data Report Filed for This Establishment Last Year?*',
    "Is This Establishment the Employer's Headquarters?*", 'Job Category*', 'Race/Ethnicity/Sex*', 'Pay Band*',
    'Exemption Status', 'Employment Type', 'Total Number of California Employees in This Employee Group*',
    'Total Annual Hours Worked*', 'Total Annual Weeks Worked', 'Mean Hourly Rate*', 'Median Hourly Rate*',
    'Row-Level Clarifying Remarks',
  ];

  // Pay-band codes are unchanged; only the lowest band label changed (CRD preliminary FAQ, Nov 16, 2026).
  const PAY_BAND_LABELS_RY2026 = {
    1: 'Under $19,240', 2: '$19,240 – $24,959', 3: '$24,960 – $32,239', 4: '$32,240 – $41,079',
    5: '$41,080 – $53,039', 6: '$53,040 – $68,119', 7: '$68,120 – $87,359', 8: '$87,360 – $112,319',
    9: '$112,320 – $144,559', 10: '$144,560 – $186,159', 11: '$186,160 – $239,199', 12: '$239,200 and over',
  };

  // Versioned report schemas. Swap/add an entry when CRD publishes the Reporting Year 2026 materials.
  const CA_SCHEMAS = {
    'ca-ry2025': {
      id: 'ca-ry2025', label: 'CRD Reporting Year 2025 (published, filed by May 13, 2026)', status: 'published',
      jobCategory: 'eeo1', payBands: PAY_BANDS_RY2025, headers: CRD_PAYROLL_HEADERS_RY2025,
      source: 'CRD 2025 Handbook + 2025 Payroll Employee CSV example (calcivilrights.ca.gov, published Jan 2026)',
      assumptions: [],
    },
    'ca-ry2026-prelim': {
      id: 'ca-ry2026-prelim',
      label: 'Reporting Year 2026 preliminary planning format (CRD, Nov 16, 2026) — do not file',
      status: 'preliminary',
      jobCategory: 'ca23', payBands: PAY_BANDS_RY2025, payBandLabels: PAY_BAND_LABELS_RY2026,
      headers: CRD_PAYROLL_HEADERS_RY2026_PRELIM, doNotFile: true,
      source: 'CRD RY2026 preliminary payroll employee template and job category mapping table, published Nov 16, 2026 (calcivilrights.ca.gov/paydatareporting/preliminary). Official RY2026 filing template scheduled for February 2027.',
      assumptions: [
        'Preliminary planning format — do not file with CRD; official RY2026 filing template scheduled for Feb 2027.',
        '22 payroll columns; the three remote-work count fields used in RY2025 were removed.',
        'Job Category* uses CRD preliminary codes: 11-1010 (Chief executives), 11-M000 (Management occupations, except chief executives), then 13-0000 through 53-0000. Military (SOC 55) is not a reporting category.',
        'Pay-band codes are unchanged from RY2025; the lowest band label is “Under $19,240”.',
        'This layout is subject to change when CRD publishes the official Reporting Year 2026 resources.',
      ],
    },
  };

  const RACE_CODES = { hispanic: null, white: 10, black: 20, nhpi: 30, asian: 40, aian: 50, multi: 60, mena: 70 };

  // ---------- Small helpers ----------
  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function num(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[$,\s]/g, '');
    if (s === '') return NaN;
    return Number(s);
  }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
  function median(a) {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function gapPct(m, f) { return (isFinite(m) && isFinite(f) && m !== 0) ? (m - f) / m * 100 : NaN; }
  function clean(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function low(v) { return clean(v).toLowerCase(); }

  function normSex(v) {
    const s = low(v);
    if (['m', 'male', 'man', 'men'].includes(s)) return 'M';
    if (['f', 'female', 'woman', 'women'].includes(s)) return 'F';
    if (['x', 'nb', 'non-binary', 'nonbinary', 'non binary'].includes(s)) return 'X';
    return null;
  }
  function normRace(v) {
    const s = low(v).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (/hispanic|latin/.test(s) && !/non hispanic|not hispanic/.test(s)) return 'hispanic';
    if (/two or more|multi/.test(s)) return 'multi';
    if (/middle eastern|north african|mena/.test(s)) return 'mena';
    if (/hawaiian|pacific/.test(s) || s === 'nhpi') return 'nhpi';
    if (/american indian|alaska/.test(s) || s === 'aian') return 'aian';
    if (/black|african/.test(s)) return 'black';
    if (/asian/.test(s)) return 'asian';
    if (/white/.test(s)) return 'white';
    return null;
  }
  function raceSexCode(race, sex) {
    if (!race || !sex) return null;
    if (race === 'hispanic') return { M: 'A10', F: 'A20', X: 'A30' }[sex];
    const letter = { M: 'B', F: 'C', X: 'D' }[sex];
    return letter + RACE_CODES[race];
  }
  function normYes(v) { const s = low(v); if (['y', 'yes', 'true', '1'].includes(s)) return true; if (['n', 'no', 'false', '0'].includes(s)) return false; return null; }
  function normExempt(v) { const s = low(v); if (!s) return ''; if (s.startsWith('non') || s === 'n' || s === 'no') return 'Non-exempt'; if (s.startsWith('ex') || s === 'y' || s === 'yes') return 'Exempt'; return null; }
  function normEmpType(v) { const s = low(v); if (!s) return ''; if (s.startsWith('full') || s === 'ft') return 'Full-time'; if (s.startsWith('part') || s === 'pt') return 'Part-time'; if (s.startsWith('inter') || s.startsWith('seas') || s.startsWith('temp')) return 'Intermittent'; return null; }
  function normWorkLoc(v) {
    const s = low(v).replace(/[^a-z]/g, '');
    if (!s || ['onsite', 'office', 'inperson', 'nonremote', 'no'].includes(s)) return 'onsite';
    if (['remoteinca', 'remoteca', 'remotewithinca', 'remotewithincalifornia', 'remoteincalifornia'].includes(s)) return 'remote_in_ca';
    if (['remoteoutsideca', 'remoteoutca', 'remoteoutsidecalifornia', 'remoteoutofstate'].includes(s)) return 'remote_out_ca';
    return null;
  }
  function payBand(earnings, bands) { for (const [code, lo, hi] of bands) if (earnings >= lo - 0.5 && earnings <= hi + 0.999999) return code; return null; }
  // Note: W-2 amounts can carry cents; a value like 19239.40 belongs in band 1 (upper bound inclusive to the dollar).

  // ---------- Input field mapping ----------
  const FIELDS = [
    ['employee_id', 'Employee ID', true, ['employee id', 'emp id', 'id', 'employee number', 'worker id']],
    ['job_title', 'Job title', true, ['job title', 'title', 'position', 'position title']],
    ['establishment_id', 'Establishment / worksite', true, ['establishment', 'establishment id', 'worksite', 'location', 'site']],
    ['sex', 'Sex (M/F/Non-binary)', true, ['sex', 'gender']],
    ['race_ethnicity', 'Race/ethnicity', true, ['race ethnicity', 'race', 'ethnicity', 'race/ethnicity']],
    ['w2_box5', 'W-2 Box 5 earnings', true, ['w2 box 5', 'w2 box5', 'box 5', 'medicare wages', 'annual earnings', 'w-2 box 5']],
    ['w2_box1', 'W-2 Box 1 (fallback)', false, ['w2 box 1', 'w2 box1', 'box 1', 'w-2 box 1']],
    ['annual_hours', 'Annual hours (incl. paid time off)', true, ['annual hours', 'hours', 'hours worked', 'total hours']],
    ['annual_weeks', 'Annual weeks', false, ['annual weeks', 'weeks', 'weeks worked']],
    ['exemption', 'Exemption status', false, ['exemption status', 'exempt', 'flsa', 'flsa status']],
    ['employment_type', 'Employment type', false, ['employment type', 'emp type', 'full part time', 'ft pt']],
    ['work_location', 'Work location (onsite / remote_in_ca / remote_out_ca)', false, ['work location', 'remote status', 'remote']],
    ['eeo1_category', 'EEO-1 job category 1-10 (RY2025 only)', false, ['eeo1', 'eeo 1', 'eeo-1 category', 'eeo1 category', 'eeo category', 'job category']],
    ['base_pay', 'Annual base pay (EU metrics)', false, ['base pay', 'base salary', 'annual base', 'basic pay']],
    ['variable_pay', 'Annual variable pay (EU metrics)', false, ['variable pay', 'bonus', 'variable', 'incentive']],
    ['worker_category', 'EU worker category (optional)', false, ['worker category', 'eu category', 'job family', 'grade']],
  ];
  function normHeader(h) { return low(h).replace(/[_\-/]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
  function autoMap(headers) {
    const map = {}; const used = new Set();
    const nh = headers.map(normHeader);
    for (const [key, , , syn] of FIELDS) {
      const cands = [normHeader(key), ...syn.map(normHeader)];
      let idx = nh.findIndex((h, i) => !used.has(i) && cands.includes(h));
      if (idx < 0) idx = nh.findIndex((h, i) => !used.has(i) && cands.some(c => c.length > 3 && h.includes(c)));
      if (idx >= 0) { map[key] = headers[idx]; used.add(idx); }
    }
    return map;
  }

  // ---------- Employee preparation ----------
  function prepareEmployees(rows, map) {
    const issues = []; const employees = [];
    const g = (r, k) => (map[k] ? r[map[k]] : undefined);
    rows.forEach((r, i) => {
      const line = i + 2; // header is line 1
      const e = { line };
      e.id = clean(g(r, 'employee_id')) || `row${line}`;
      e.title = clean(g(r, 'job_title'));
      e.est = clean(g(r, 'establishment_id'));
      e.sex = normSex(g(r, 'sex'));
      e.race = normRace(g(r, 'race_ethnicity'));
      const b5 = num(g(r, 'w2_box5')); const b1 = num(g(r, 'w2_box1'));
      e.usedBox1 = !(b5 > 0) && b1 > 0;
      e.earnings = b5 > 0 ? b5 : (b1 > 0 ? b1 : NaN);
      e.hours = num(g(r, 'annual_hours'));
      e.weeks = num(g(r, 'annual_weeks'));
      e.exempt = normExempt(g(r, 'exemption'));
      e.empType = normEmpType(g(r, 'employment_type'));
      e.workLoc = normWorkLoc(g(r, 'work_location'));
      e.eeo1 = map.eeo1_category ? parseInt(num(g(r, 'eeo1_category')), 10) : NaN;
      e.base = num(g(r, 'base_pay')); e.variable = num(g(r, 'variable_pay'));
      e.workerCategory = clean(g(r, 'worker_category'));
      const err = (m) => issues.push({ level: 'error', line, id: e.id, msg: m });
      const warn = (m) => issues.push({ level: 'warning', line, id: e.id, msg: m });
      if (!e.title) err('Missing job title');
      if (!e.est) err('Missing establishment');
      if (!e.sex) err(`Unrecognized sex value "${clean(g(r, 'sex'))}"`);
      if (!e.race) err(`Unrecognized race/ethnicity "${clean(g(r, 'race_ethnicity'))}"`);
      if (!(e.earnings > 0)) err('Missing or zero W-2 earnings (Box 5, or Box 1 fallback)');
      if (!(e.hours > 0)) err('Missing or zero annual hours');
      if (e.hours > 4000) warn(`Annual hours ${e.hours} look high (>4,000)`);
      if (isFinite(e.weeks) && (e.weeks < 0 || e.weeks > 53)) err(`Annual weeks ${e.weeks} out of range 0-53`);
      if (e.exempt === null) err(`Unrecognized exemption status "${clean(g(r, 'exemption'))}"`);
      if (e.empType === null) err(`Unrecognized employment type "${clean(g(r, 'employment_type'))}"`);
      if (e.workLoc === null) err(`Unrecognized work location "${clean(g(r, 'work_location'))}"`);
      if (e.usedBox1) warn('W-2 Box 5 empty; used Box 1 (note added to clarifying remarks)');
      if (e.earnings > 0 && e.hours > 0) {
        e.hourly = e.earnings / e.hours;
        if (e.hourly < 7.25) warn(`Hourly rate $${round2(e.hourly)} is below $7.25; check hours/earnings`);
        if (e.hourly > 2000) warn(`Hourly rate $${round2(e.hourly)} is above $2,000; check hours/earnings`);
      }
      employees.push(e);
    });
    return { employees, issues };
  }

  // ---------- SOC matcher ----------
  const ABBR = {
    sr: 'senior', jr: 'junior', mgr: 'manager', mngr: 'manager', dir: 'director', vp: 'vice president', svp: 'senior vice president',
    evp: 'executive vice president', asst: 'assistant', assoc: 'associate', admin: 'administrative', tech: 'technician',
    coord: 'coordinator', rep: 'representative', spec: 'specialist', eng: 'engineer', engr: 'engineer', dev: 'developer',
    acct: 'accountant', rn: 'registered nurse', lpn: 'licensed practical nurse', cna: 'nursing assistant', hr: 'human resources',
    it: 'information technology', qa: 'quality assurance', cs: 'customer service', csr: 'customer service representative',
    ops: 'operations', svc: 'service', svcs: 'service', cust: 'customer', mfg: 'manufacturing', prod: 'production', sls: 'sales', dept: 'department', mktg: 'marketing', supv: 'supervisor', supvr: 'supervisor', sup: 'supervisor', ceo: 'chief executive officer',
    cfo: 'chief financial officer', coo: 'chief operating officer', cto: 'chief technology officer', swe: 'software engineer',
    sde: 'software developer', ap: 'accounts payable', ar: 'accounts receivable', maint: 'maintenance', whse: 'warehouse',
  };
  const NOISE = new Set(['senior', 'junior', 'lead', 'staff', 'principal', 'i', 'ii', 'iii', 'iv', 'v', '1', '2', '3', '4', 'level', 'the', 'of', 'and', 'a', 'an', 'in', 'for', 'to', 'trainee', 'entry', 'temp', 'temporary', 'part', 'time', 'full', 'ft', 'pt', 'remote', 'hybrid', 'interim', 'acting']);
  function titleTokens(t) {
    let s = low(t).replace(/\(.*?\)/g, ' ').replace(/[-/,&.|]+/g, ' ').replace(/[^a-z0-9 ]/g, ' ');
    const out = [];
    for (const w of s.split(/\s+/)) { if (!w) continue; const ex = Object.prototype.hasOwnProperty.call(ABBR, w) ? ABBR[w] : null; if (ex) out.push(...ex.split(' ')); else out.push(w); }
    return out.map(stem).filter(w => !NOISE.has(w));
  }
  function stem(w) { if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'; if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1); return w; }

  class SocMatcher {
    constructor(dict) {
      this.occupations = dict.occupations || {};
      this.entries = []; this.exact = new Map(); this.index = new Map();
      for (const [title, soc, weight] of dict.titles) {
        const toks = titleTokens(title); if (!toks.length) continue;
        const key = toks.join(' ');
        const id = this.entries.length; this.entries.push({ title, soc, toks, key, w: weight || 1 });
        if (!this.exact.has(key)) this.exact.set(key, []);
        this.exact.get(key).push(id);
        for (const t of new Set(toks)) { if (!this.index.has(t)) this.index.set(t, []); this.index.get(t).push(id); }
      }
      const N = this.entries.length; this.idf = new Map();
      for (const [t, ids] of this.index) this.idf.set(t, Math.log(1 + N / ids.length));
    }
    _vote(ids) {
      const c = {}; for (const id of ids) { const s = this.entries[id].soc; c[s] = (c[s] || 0) + this.entries[id].w; }
      return Object.entries(c).sort((a, b) => b[1] - a[1]);
    }
    suggest(title) {
      const toks = titleTokens(title);
      if (!toks.length) return { title, major: null, soc: null, category: null, confidence: 0, method: 'none', alternatives: [] };
      const key = toks.join(' ');
      if (this.exact.has(key)) {
        const votes = this._vote(this.exact.get(key)); const total = votes.reduce((s, v) => s + v[1], 0);
        const cats = {}; for (const [soc, n] of votes) { const cat = caCategoryFromSoc(soc); if (cat) cats[cat] = (cats[cat] || 0) + n; }
        const ranked = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        if (!ranked.length) return { title, major: null, soc: votes[0] && votes[0][0], category: null, confidence: 0, method: 'no CA category', alternatives: [] };
        const agree = ranked[0][1] / total;
        const soc = (votes.find(v => caCategoryFromSoc(v[0]) === ranked[0][0]) || votes[0])[0];
        return {
          title, major: soc.slice(0, 2), soc, category: ranked[0][0], categoryName: CA_JOB_CATEGORY_NAME[ranked[0][0]],
          confidence: round2(agree >= 1 ? 0.97 : 0.75 + 0.2 * agree), method: 'exact O*NET title',
          matchedTitle: this.entries[this.exact.get(key)[0]].title,
          alternatives: ranked.slice(1, 3).map(([c]) => c),
        };
      }
      const qset = new Set(toks); const head = toks[toks.length - 1];
      const unk = Math.log(1 + this.entries.length); // unknown words count as rare, so they lower coverage
      const qw = [...qset].reduce((s, t) => s + (this.idf.get(t) || unk), 0) || 1;
      const scores = new Map();
      for (const t of qset) { const ids = this.index.get(t); if (!ids || ids.length > 6000) continue; const w = this.idf.get(t); for (const id of ids) scores.set(id, (scores.get(id) || 0) + w); }
      if (!scores.size) return { title, major: null, soc: null, category: null, confidence: 0, method: 'no match', alternatives: [] };
      const best = {}; // per CA job category: best score
      for (const [id, sc] of scores) {
        const e = this.entries[id];
        const cat = caCategoryFromSoc(e.soc);
        if (!cat) continue; // e.g. Military SOC 55 has no RY2026 preliminary category
        const ew = e.toks.reduce((s, t) => s + (this.idf.get(t) || 0), 0) || 1;
        let s = sc / Math.sqrt(qw * ew);               // cosine-like overlap
        if (e.toks[e.toks.length - 1] === head) s *= 1.25; // head noun ("engineer", "nurse") matters most
        s *= 1 + 0.04 * Math.min(e.w, 8);               // titles confirmed by more O*NET sources rank higher
        if (!best[cat] || s > best[cat].s) best[cat] = { s, id, cov: sc / qw };
      }
      if (!Object.keys(best).length) return { title, major: null, soc: null, category: null, confidence: 0, method: 'no CA category', alternatives: [] };
      const ranked = Object.entries(best).sort((a, b) => b[1].s - a[1].s);
      const [c0, b0] = ranked[0]; const s1 = ranked[1] ? ranked[1][1].s : 0;
      const margin = b0.s > 0 ? (b0.s - s1) / b0.s : 0;
      // Fuzzy matches never auto-qualify as "high confidence" (>= 0.85); coverage = share of the title's words that matched.
      const conf = Math.max(0.05, Math.min(0.8, 0.5 * Math.min(1, b0.s) * b0.cov + 0.3 * b0.cov + 0.2 * margin));
      const soc = this.entries[b0.id].soc;
      return {
        title, major: soc.slice(0, 2), soc, category: c0, categoryName: CA_JOB_CATEGORY_NAME[c0],
        confidence: round2(conf), method: 'fuzzy O*NET title',
        matchedTitle: this.entries[b0.id].title, alternatives: ranked.slice(1, 3).map(([c]) => c),
      };
    }
  }

  // ---------- California report ----------
  function caIncluded(e, est) {
    const inCA = est && clean(est.state).toUpperCase() === 'CA';
    return inCA || e.workLoc === 'remote_in_ca';
  }
  function validateEstablishments(ests) {
    const issues = [];
    for (const [id, s] of Object.entries(ests)) {
      const err = (m) => issues.push({ level: 'error', line: '', id: `Establishment ${id}`, msg: m });
      if (!clean(s.name)) err('Establishment name required');
      if (!clean(s.address1)) err('Address line 1 required');
      if (!clean(s.city)) err('City required');
      if (!/^[A-Z]{2}$/.test(clean(s.state).toUpperCase())) err('State must be a 2-letter abbreviation (or OT)');
      if (!/^\d{5}$/.test(clean(s.zip))) err('ZIP must be 5 digits');
      if (!/^\d{6}$/.test(clean(s.naics))) err('NAICS must be 6 digits');
      if (!clean(s.activity)) err('Major activity required');
      if (normYes(s.filedLastYear) === null) err('"Filed last year" must be Yes or No');
      if (normYes(s.hq) === null) err('"Headquarters" must be Yes or No');
    }
    return issues;
  }

  function buildCaReport(employees, ests, schemaId, socMap) {
    const schema = CA_SCHEMAS[schemaId];
    const issues = validateEstablishments(ests);
    const included = []; let excluded = 0; const unconfirmed = {}; const missingEeo = [];
    for (const e of employees) {
      if (!(e.hourly > 0) || !e.sex || !e.race) continue;
      const est = ests[e.est];
      if (!est) { issues.push({ level: 'error', line: e.line, id: e.id, msg: `Establishment "${e.est}" has no details` }); continue; }
      if (!caIncluded(e, est)) { excluded++; continue; }
      let job;
      if (schema.jobCategory === 'eeo1') {
        if (!(e.eeo1 >= 1 && e.eeo1 <= 10)) { missingEeo.push(e.line); continue; }
        job = String(e.eeo1);
      } else {
        const d = socMap[e.title];
        if (!d || d.status === 'pending' || !d.final || !CA_JOB_CATEGORY_NAME[d.final]) { unconfirmed[e.title] = (unconfirmed[e.title] || 0) + 1; continue; }
        job = d.final;
      }
      const band = payBand(e.earnings, schema.payBands);
      const isCAEst = clean(est.state).toUpperCase() === 'CA';
      if (!isCAEst && e.workLoc === 'remote_out_ca') { excluded++; continue; }
      included.push({ e, est, job, rs: raceSexCode(e.race, e.sex), band, isCAEst });
    }
    for (const [t, n] of Object.entries(unconfirmed)) issues.push({ level: 'error', line: '', id: '', msg: `Job category not confirmed for job title "${t}" (${n} employee${n > 1 ? 's' : ''} left out until confirmed)` });
    if (missingEeo.length) issues.push({ level: 'error', line: '', id: '', msg: `EEO-1 job category (1-10) missing for ${missingEeo.length} employee(s), rows ${missingEeo.slice(0, 15).join(', ')}${missingEeo.length > 15 ? '…' : ''}. It's required for the RY2025 layout` });
    const estCount = {}; for (const x of included) estCount[x.e.est] = (estCount[x.e.est] || 0) + 1;
    const groups = new Map();
    for (const x of included) {
      const k = [x.e.est, x.job, x.rs, x.band, x.e.exempt, x.e.empType].join('|');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(x);
    }
    const estIds = Object.keys(ests);
    const sortKey = (k) => { const p = k.split('|'); return [estIds.indexOf(p[0]), p[1], p[2], +p[3], p[4], p[5]]; };
    const keys = [...groups.keys()].sort((a, b) => { const A = sortKey(a), B = sortKey(b); for (let i = 0; i < A.length; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; });
    const rows = [];
    for (const k of keys) {
      const g = groups.get(k); const x0 = g[0]; const s = x0.est;
      const rates = g.map(x => x.e.hourly);
      const weeksKnown = g.every(x => isFinite(x.e.weeks));
      const remarks = [];
      const b1 = g.filter(x => x.e.usedBox1).length; if (b1) remarks.push(`${b1} employee(s) reported using W-2 Box 1 because Box 5 was not available.`);
      const fields = {
        'Establishment Name*': clean(s.name),
        'Address Line 1*': clean(s.address1),
        'Address Line 2': clean(s.address2),
        'City*': clean(s.city),
        'State*': clean(s.state).toUpperCase(),
        'ZIP Code*': clean(s.zip),
        'NAICS Code*': clean(s.naics),
        'Major Activity*': clean(s.activity),
        'Total Number of California Payroll Employees at Establishment*': estCount[x0.e.est],
        'Was a California Pay Data Report Filed for This Establishment Last Year?*': normYes(s.filedLastYear) ? 'Yes' : 'No',
        "Is This Establishment the Employer's Headquarters?*": normYes(s.hq) ? 'Yes' : 'No',
        'Job Category*': x0.job,
        'Race/Ethnicity/Sex*': x0.rs,
        'Pay Band*': x0.band,
        'Exemption Status': x0.e.exempt,
        'Employment Type': x0.e.empType,
        'Total Number of California Employees in This Employee Group*': g.length,
        'Total Annual Hours Worked*': Math.round(g.reduce((t, x) => t + x.e.hours, 0)),
        'Total Annual Weeks Worked': weeksKnown ? Math.round(g.reduce((t, x) => t + x.e.weeks, 0)) : '',
        'Mean Hourly Rate*': round2(mean(rates)).toFixed(2),
        'Median Hourly Rate*': round2(median(rates)).toFixed(2),
        'Row-Level Clarifying Remarks': remarks.join(' '),
      };
      if (schema.headers.indexOf('Number of California Employees That Do Not Work Remotely*') !== -1) {
        fields['Number of California Employees That Do Not Work Remotely*'] = x0.isCAEst ? g.filter(x => x.e.workLoc === 'onsite').length : 0;
        fields['Number of Remote California Employees Located Within California*'] = g.filter(x => x.e.workLoc === 'remote_in_ca').length;
        fields['Number of Remote California Employees Located Outside of California*'] = x0.isCAEst ? g.filter(x => x.e.workLoc === 'remote_out_ca').length : 0;
      }
      rows.push(Object.fromEntries(schema.headers.map((h) => [h, fields[h] ?? ''])));
    }
    if (!x0Guard(included)) issues.push({ level: 'error', line: '', id: '', msg: 'No California employees to report' });
    return { schema, rows, issues, stats: { included: included.length, excluded, groups: rows.length, establishments: Object.keys(estCount).length } };
  }
  function x0Guard(a) { return a.length > 0; }

  // ---------- EU Pay Transparency Directive (2023/970) Article 9 ----------
  function euMetrics(employees, opts = {}) {
    const catOf = opts.categoryOf || (e => e.workerCategory || 'All workers');
    const pop = employees.filter(e => e.hours > 0 && (e.sex === 'M' || e.sex === 'F') && (opts.filter ? opts.filter(e) : true));
    const excludedNonBinary = employees.filter(e => e.sex === 'X' && (opts.filter ? opts.filter(e) : true)).length;
    const p = pop.map(e => {
      const hasSplit = isFinite(e.base) && e.base >= 0;
      const base = hasSplit ? e.base : e.earnings;
      const variable = hasSplit && isFinite(e.variable) ? e.variable : 0;
      return { e, sex: e.sex, cat: catOf(e), base, variable, totalH: (base + variable) / e.hours, baseH: base / e.hours, varH: variable / e.hours };
    });
    const by = (arr, s) => arr.filter(x => x.sex === s);
    function block(arr) {
      const M = by(arr, 'M'), F = by(arr, 'F');
      const mt = M.map(x => x.totalH), ft = F.map(x => x.totalH);
      const mb = M.map(x => x.baseH), fb = F.map(x => x.baseH);
      const mrv = M.filter(x => x.variable > 0).map(x => x.varH), frv = F.filter(x => x.variable > 0).map(x => x.varH);
      return {
        nM: M.length, nF: F.length,
        meanM: mean(mt), meanF: mean(ft), meanGap: gapPct(mean(mt), mean(ft)), medianGap: gapPct(median(mt), median(ft)),
        baseMeanGap: gapPct(mean(mb), mean(fb)), baseMedianGap: gapPct(median(mb), median(fb)),
        varMeanGap: gapPct(mean(mrv), mean(frv)), varMedianGap: gapPct(median(mrv), median(frv)),
        varAllMeanGap: gapPct(mean(M.map(x => x.varH)), mean(F.map(x => x.varH))),
        shareVarM: M.length ? M.filter(x => x.variable > 0).length / M.length * 100 : NaN,
        shareVarF: F.length ? F.filter(x => x.variable > 0).length / F.length * 100 : NaN,
      };
    }
    const overall = block(p);
    // Quartile pay bands on total hourly pay: sort ascending, split by position into four equal-sized groups.
    const sorted = [...p].sort((a, b) => a.totalH - b.totalH || (a.e.id < b.e.id ? -1 : 1));
    const quartiles = [0, 1, 2, 3].map(q => ({ q: q + 1, M: 0, F: 0 }));
    sorted.forEach((x, i) => { const q = Math.min(3, Math.floor(i * 4 / sorted.length)); quartiles[q][x.sex]++; });
    for (const q of quartiles) { const n = q.M + q.F; q.pctF = n ? q.F / n * 100 : NaN; q.pctM = n ? q.M / n * 100 : NaN; }
    const cats = {};
    for (const x of p) (cats[x.cat] = cats[x.cat] || []).push(x);
    const categories = Object.entries(cats).map(([cat, arr]) => {
      const b = block(arr);
      const flag5 = isFinite(b.meanGap) && Math.abs(b.meanGap) >= 5;
      const small = b.nM < 5 || b.nF < 5;
      return { category: cat, ...b, flag5, smallSample: small };
    }).sort((a, b) => (b.nM + b.nF) - (a.nM + a.nF));
    return { n: p.length, excludedNonBinary, overall, quartiles, categories, flagged: categories.filter(c => c.flag5).length };
  }

  // ---------- CSV ----------
  function toCSV(headers, rows) {
    const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [headers.map(esc).join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n') + '\r\n';
  }
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const nonEmpty = rows.filter(r => r.some(x => x.trim() !== ''));
    const headers = nonEmpty.shift() || [];
    return { headers, rows: nonEmpty.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))) };
  }

  const api = { SOC_MAJOR, SOC_NAME, CA_JOB_CATEGORIES, CA_JOB_CATEGORY_NAME, caCategoryFromSoc, EEO1, PAY_BANDS_RY2025, PAY_BAND_LABELS_RY2026,
    CRD_PAYROLL_HEADERS_RY2025, CRD_PAYROLL_HEADERS_RY2026_PRELIM, CA_SCHEMAS, FIELDS, autoMap, prepareEmployees, SocMatcher, titleTokens,
    buildCaReport, validateEstablishments, euMetrics, toCSV, parseCSV, payBand, raceSexCode, normRace, normSex, round2, mean, median, gapPct };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PDR = api;
})(typeof window !== 'undefined' ? window : globalThis);
