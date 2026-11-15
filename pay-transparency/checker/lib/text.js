// Copied from the Steadfeed Pay Transparency Compliance Monitor actor (src/text.js) by ptcm-site-build/sync_checker_lib.py.
// Do not edit here; edit the actor source and re-run the sync.
// Text helpers: HTML entity decoding, HTML -> text, contact redaction, hashing.

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™' };

export function decodeEntities(str) {
    if (str == null) return str;
    return String(str).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
        if (code[0] === '#') {
            const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
        }
        const v = NAMED[code.toLowerCase()];
        return v ?? m;
    });
}

export function htmlToText(html) {
    if (!html) return '';
    let s = String(html)
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');
    s = decodeEntities(s);
    return s.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_RE = /<a\b[^>]*href=["']mailto:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
// Phone-like: optional +country, optional (area), then three digit groups split by space/dot/dash.
const PHONE_RE = /(?<![\w$€£.,])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]\d{3,4}|\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4})(?![\w,])/g;
// "Recruiter: Jane Doe" style lines (best effort, several languages).
const CONTACT_LINE_RE = /\b(recruiter|recruiting contact|talent partner|talent acquisition partner|hiring manager|contact person|your contact|point of contact|ansprechpartner(?:in)?|contactpersoon|personne de contact|persona de contacto|contact)\s*[:\-–]\s*[^\n<]{1,80}/gi;

/** Remove e-mail addresses, phone numbers and named recruiter/contact lines. */
export function redactContacts(str) {
    if (!str) return str;
    return String(str)
        .replace(MAILTO_RE, '[email removed]')
        .replace(EMAIL_RE, '[email removed]')
        .replace(CONTACT_LINE_RE, (m, label) => `${label}: [contact removed]`)
        .replace(PHONE_RE, '[phone removed]');
}


/** Deterministic JSON with sorted keys, used for comparing values. */
export function stableStringify(value) {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function toIso(value) {
    if (value == null || value === '') return null;
    let d;
    if (typeof value === 'number') d = new Date(value);
    else {
        // Recruitee uses "2026-10-06 14:54:28 UTC"
        const s = String(value).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/, '$1T$2Z');
        d = new Date(s);
    }
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normWorkplace(value, { remote, hybrid, onsite } = {}) {
    const v = String(value ?? '').toLowerCase().replace(/[\s_-]/g, '');
    if (v === 'remote') return 'remote';
    if (v === 'hybrid') return 'hybrid';
    if (v === 'onsite' || v === 'inoffice' || v === 'office') return 'onsite';
    if (hybrid) return 'hybrid';
    if (remote) return 'remote';
    if (onsite) return 'onsite';
    return null;
}

export function uniqStrings(arr) {
    const out = [];
    const seen = new Set();
    for (const v of arr) {
        const s = typeof v === 'string' ? v.trim() : '';
        if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
    }
    return out;
}
