// Copied from the Steadfeed Pay Transparency Compliance Monitor actor (src/signals.js) by ptcm-site-build/sync_checker_lib.py.
// Do not edit here; edit the actor source and re-run the sync.
// Cheap text signals from a posting body, used by compliance rules. Heuristic by design: a missing
// signal produces a "needs review" finding, never a legal conclusion.
const BENEFITS = /\b(benefits?|health(?:care)?|medical|dental|vision|401\s?\(?k\)?|403\(b\)|retirement|pension|paid time off|\bpto\b|vacation|parental leave|maternity|paternity|sick (?:leave|days?)|insurance|equity|stock options?|bonus|commission|life insurance|disability|hsa|fsa|tuition|wellness)\b/i;
const CLOSE_DATE = /(applications?\b[^.\n]{0,60}\b(clos\w*|accepted|received|reviewed|due|deadline|through|until|by)\b|\bapply (?:by|before|until)\b|\bclosing date\b|\bclose date\b|\bdeadline\b[^.\n]{0,30}\b(apply|application)|\bopen (?:until|through)\b|\baccepting applications\b[^.\n]{0,40}\b(until|through|by)\b|\bposting (?:will )?(?:close|end|expire)s?\b)/i;

const BENEFITS_STRICT = /\b(health(?:care)?|medical|dental|vision|401\s?\(?k\)?|403\(b\)|retirement|pension|paid time off|\bpto\b|parental leave|maternity|paternity|sick (?:leave|days?)|life insurance|disability|\bhsa\b|\bfsa\b|health insurance)\b/i;
/** strictBenefits: for whole-page text (navigation and footers say "Benefits" everywhere), only concrete benefit terms count. */
export function postingSignals(description, { strictBenefits = false } = {}) {
    const text = String(description ?? '');
    const benefit = text.match(strictBenefits ? BENEFITS_STRICT : BENEFITS);
    const closeDate = text.match(CLOSE_DATE);
    return {
        descriptionLength: text.length,
        mentionsBenefits: Boolean(benefit),
        benefitsEvidence: benefit ? text.slice(Math.max(0, benefit.index - 30), benefit.index + benefit[0].length + 40).replace(/\s+/g, ' ').trim() : null,
        mentionsApplicationClose: Boolean(closeDate),
        closeEvidence: closeDate ? text.slice(Math.max(0, closeDate.index - 20), closeDate.index + closeDate[0].length + 40).replace(/\s+/g, ' ').trim() : null,
    };
}
