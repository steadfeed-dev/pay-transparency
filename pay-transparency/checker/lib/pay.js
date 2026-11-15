// Copied from the Steadfeed Pay Transparency Compliance Monitor actor (src/pay.js) by ptcm-site-build/sync_checker_lib.py.
// Do not edit here; edit the actor source and re-run the sync.
import { decodeEntities, htmlToText } from './text.js';
export const plain = s => htmlToText(decodeEntities(decodeEntities(s ?? '')));
export function period(value) {
    if (!value) return null;
    const s=String(value).toLowerCase();
    if (/hour|\bhr\b|\bph\b|\/h\b/.test(s)) return 'hour';
    if (/year|annual|annum|\byr\b|\bp\.?a\.?(?!\w)/.test(s)) return 'year';
    if (/month/.test(s)) return 'month';
    if (/week/.test(s)) return 'week';
    if (/\bday|daily/.test(s)) return 'day';
    return null;
}
const ISO = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : CODES_FALLBACK());
function CODES_FALLBACK(){return 'USD CAD AUD NZD EUR GBP CHF INR JPY SGD HKD SEK NOK DKK PLN CZK BRL MXN ZAR CNY KRW AED SAR ILS TRY THB MYR IDR PHP VND HUF RON BGN ISK COP ARS CLP PEN NGN KES EGP TWD'.split(' ');}
function currency(value) { const c=String(value??'').toUpperCase(); return ISO.has(c)?c:null; }
function num(v) { if (v==null || v==='') return null; const n=Number(v); return Number.isFinite(n)&&n>0?n:null; }
// Annualization assumptions: full-time 2,080 h/yr (40 h x 52 wk), 260 days/yr, 52 weeks/yr, 12 months/yr. No currency conversion.
export const ANNUAL_FACTOR={year:1,month:12,week:52,day:260,hour:2080};
const money2=v=>v==null?null:Math.round(v*100)/100;
export function normalizeAmounts(min,max,payPeriod) {
    const f=ANNUAL_FACTOR[payPeriod];
    if(!f)return {annualMin:null,annualMax:null,hourlyMin:null,hourlyMax:null,normalization:null};
    const annual=v=>v==null?null:money2(v*f);
    const hourly=v=>v==null?null:money2(v*f/2080);
    return {annualMin:annual(min),annualMax:annual(max),hourlyMin:hourly(min),hourlyMax:hourly(max),normalization:payPeriod==='year'?'stated as annual; hourly = annual / 2080 h':`annual = amount x ${f} per year (${payPeriod}); hourly = annual / 2080 h; full-time assumption, same currency`};
}
const NO_NORM={annualMin:null,annualMax:null,hourlyMin:null,hourlyMax:null,normalization:null};
let NORMALIZE=true;
export function setNormalize(v){NORMALIZE=v!==false;}
function rangeKind(min,max){return min!=null&&max!=null?(min===max?'fixed':'range'):min!=null?'minimum_only':'maximum_only';}
function makeRange({min,max,currency:cur,payPeriod,source,rawPayText,label=null}) {
    min=num(min); max=num(max);
    if (min==null && max==null) return null;
    if (min!=null && max!=null && min>max) return null;
    const per=period(payPeriod);
    return {payMin:min,payMax:max,currency:currency(cur),payPeriod:per,rangeType:rangeKind(min,max),...(NORMALIZE?normalizeAmounts(min,max,per):NO_NORM),compensationBasis:/\bOTE\b|on.target earnings/i.test(rawPayText??'')?'ote':/base salary|base pay/i.test(rawPayText??'')?'base_salary':'unspecified',source,rawPayText:String(rawPayText??'').slice(0,1200),label};
}
function numericText(s, otherSuffix='') {
    const suffix=(s.match(/[kKmM]\s*$/)?.[0]??otherSuffix).trim().toLowerCase();
    let val=s.replace(/[kKmM]\s*$/,'').trim().replace(/(?<=\d)[\u00a0\u202f ](?=\d{3}\b)/g,'');
    // Decimal comma with two digits, otherwise comma/dot groups of three are thousands.
    if (/^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(val)) {
        const decimal=val.match(/[.,]\d{1,2}$/)?.[0];
        val=decimal ? val.slice(0,-decimal.length).replace(/[.,]/g,'')+'.'+decimal.slice(1) : val.replace(/[.,]/g,'');
    } else val=val.replace(',','.');
    const n=Number(val)* (suffix==='k'?1000:suffix==='m'?1000000:1);
    return Number.isFinite(n)&&n>0?n:null;
}
const CODES='USD|CAD|AUD|NZD|EUR|GBP|CHF|INR|JPY|SGD|HKD|SEK|NOK|DKK|PLN|CZK|BRL|MXN|ZAR|CNY|RMB|KRW|AED|SAR|ILS|TRY|THB|MYR|IDR|PHP|VND|HUF|RON|BGN|ISK|COP|ARS|CLP|PEN|NGN|KES|EGP|TWD';
const MONEY=`(?:(?:${CODES})\\s?\\$|US\\$|CA\\$|AU\\$|NZ\\$|HK\\$|S\\$|R\\$|C\\$|A\\$|${CODES}|\\$|€|£|₹|¥|zł|Kč)`;
const AMOUNT='(?:[0-9]{1,3}(?:[\\u00a0\\u202f ][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]+)*)(?:\\s*[kKmM]\\b)?';
const RANGE=new RegExp(`(?<![\\w])(${MONEY})?\\s*(${AMOUNT})\\s*(${MONEY})?\\s*(?:[–—−-]|\\bto\\b|\\band\\b)\\s*(${MONEY})?\\s*(${AMOUNT})\\s*(${MONEY})?`,'gi');
function textCurrency(tokens, context) {
    const codes=(tokens.join(' ')+' '+context).match(new RegExp(`\\b(?:${CODES})\\b`,'gi'))??[];
    const named=[...new Set(codes.map(c=>c.toUpperCase()))];
    if(named.length===1) return named[0];
    if(named.length>1) return null;
    const marks=tokens.join(' ');
    for(const [symbol,c] of [['US$','USD'],['CA$','CAD'],['AU$','AUD'],['NZ$','NZD'],['HK$','HKD'],['S$','SGD'],['R$','BRL'],['C$','CAD'],['A$','AUD'],['€','EUR'],['£','GBP'],['₹','INR'],['zł','PLN'],['Kč','CZK']]) if(marks.includes(symbol)) return c;
    return null; // bare $ or ¥ is ambiguous, never invent a currency.
}
export function textRanges(text) {
    const ranges=[];
    for(const m of text.matchAll(RANGE)) {
        const start=m.index;
        // Capture the source line(s) as evidence, with nearby label/context.
        const before=text.slice(Math.max(0,start-120),start), after=text.slice(start+m[0].length,start+m[0].length+120);
        const tokens=[m[1],m[3],m[4],m[6]].filter(Boolean);
        const context=before+m[0]+after;
        if (!tokens.length) continue; // require currency evidence attached to the numeric range
        const suffix2=m[5].match(/[kKmM]\s*$/)?.[0]??'';
        const min=numericText(m[2],suffix2),max=numericText(m[5]);
        if (min==null || max==null || min>max) continue;
        const nb0=before.slice(-80),nearBefore=nb0.slice(nb0.lastIndexOf('\n')+1),nearAfter=after.slice(0,45).split('\n')[0];
        const explicitPay=/salary|\bpay\s*:|pay rate|hourly rate|compensation\s*:|base pay|base range|base compensation|pay range|wage|\bOTE\b|cash compensation|compensation range|range for this (?:position|role|job)/i.test(nearBefore);
        if(!explicitPay && /bonus|equity|stock|shares|relocation|stipend|allowance|reimbursement|travel budget|benefit|\bARR\b|\bMRR\b|revenue|customers?|valuation|funding|raised|deal size|quota|headcount|employees/i.test(nearBefore+' '+nearAfter))continue;
        const r=makeRange({min,max,currency:textCurrency(tokens,context),payPeriod:period(after.slice(0,70))??period(before.slice(-70)),source:'description',rawPayText:context.trim()});
        if(r) ranges.push(r);
    }
    return ranges;
}

const SINGLE=new RegExp(`(?<![\\w])(${MONEY})?\\s*(${AMOUNT})\\s*(${MONEY})?(?![\\w%])`,'gi');
const NON_SALARY=/\bARR\b|\bMRR\b|revenue|valuation|funding|raised|customers?|bonus|equity|stock|shares|relocation|stipend|allowance|reimbursement|travel budget|benefit|signing|referral|401|per diem|budget|fee|deductible|tuition|learning|wellness|insurance|retirement|match/i;
const SALARY_LABEL=/salary|base pay|base rate|pay rate|rate of pay|wage|hourly rate|compensation|pay range|pay:|pay is|pays|earn|remuneration|\bOTE\b|\bbase\b/i;
const PERIOD_AFTER=/^\s*(?:\/\s*(?:h|hr|hour|y|yr|year|mo|month|wk|week|day)\b|per\s+(?:hour|year|annum|month|week|day)\b|an?\s+(?:hour|year|month|week|day)\b|p\.?\s?[ah]\.?(?!\w)|annually|yearly|hourly|monthly|weekly|daily)/i;
/** Single pay figures: fixed ("$25/hour"), minimum-only ("from $90,000") or maximum-only ("up to $60 per hour"). */
export function textSingles(text) {
    const spans=[];
    for(const m of text.matchAll(RANGE)) {const toks=[m[1],m[3],m[4],m[6]].filter(Boolean);if(toks.length)spans.push([m.index,m.index+m[0].length]);}
    const out=[];
    for(const m of text.matchAll(SINGLE)) {
        const start=m.index,end=start+m[0].length;
        if(spans.some(([a,b])=>start<b&&end>a))continue;
        const tokens=[m[1],m[3]].filter(Boolean);
        if(!tokens.length)continue; // require currency evidence
        const before=text.slice(Math.max(0,start-80),start),after=text.slice(end,end+60);
        const nearBefore=before.slice(-60),nearAfter=after.slice(0,40);
        const periodHere=PERIOD_AFTER.test(after);
        if(!periodHere&&!SALARY_LABEL.test(nearBefore))continue;
        const directLabel=/(?:salary|base pay|base rate|pay rate|wage|\bOTE\b|cash compensation|pays?|pay is)\W{0,6}(?:of|is|at|:|range)?\W{0,6}$/i.test(nearBefore.slice(-28));
        if(!directLabel&&NON_SALARY.test(nearBefore.slice(-35).split('\n').pop()+' '+nearAfter.split('\n')[0]))continue;
        const suffix=m[2].match(/[kKmM]\s*$/)?.[0]??'';
        const v=numericText(m[2],suffix);
        if(v==null)continue;
        const lead=nearBefore.slice(-30).toLowerCase();
        const kind=/(?:up to|maximum of|max\.?|not to exceed|no more than|as high as|capped at)\s*$/.test(lead)?'max':/(?:from|starting at|starts at|starting from|minimum of|min\.?|at least|as low as|and up|base of)\s*$/.test(lead)||/^\s*(?:\+|and up|and above|or more|minimum)/i.test(after)?'min':'fixed';
        const period_=period(after.slice(0,45))??(periodHere?null:period(nearBefore.slice(-45)));
        const r=makeRange({min:kind==='max'?null:v,max:kind==='min'?null:v,currency:textCurrency(tokens,before+m[0]+after),payPeriod:period_,source:'description',rawPayText:(before+m[0]+after).trim()});
        if(r)out.push(r);
    }
    return out;
}
export function structuredRanges(ats,raw) {
    const out=[];
    const add=(r)=>{const v=makeRange({...r,source:'structured'});if(v)out.push(v);};
    if(ats==='greenhouse') for(const r of raw.pay_input_ranges??[]) {
        add({min:r.min_cents==null?null:r.min_cents/100,max:r.max_cents==null?null:r.max_cents/100,currency:r.currency_type,payPeriod:r.interval,rawPayText:JSON.stringify(r),label:r.title??null});
    }
    if(ats==='lever' && raw.salaryRange) {
        const r=raw.salaryRange;
        add({min:r.min,max:r.max,currency:r.currency,payPeriod:r.interval,rawPayText:JSON.stringify(r)});
    }
    if(ats==='ashby') {
        const c=raw.compensation??{};
        // Tiers carry distinct geographic/level ranges. Never collapse them into one envelope.
        const tiers=c.compensationTiers?.length ? c.compensationTiers : [{title:null,components:c.summaryComponents??[]}];
        for(const tier of tiers) for(const r of tier.components??[]) {
            if(!/^(salary|wage|hourly)$/i.test(r.compensationType??'')) continue; // not bonus/equity; source-labelled Salary can still be OTE (see evidence/basis)
            add({min:r.minValue,max:r.maxValue,currency:r.currencyCode,payPeriod:r.interval,rawPayText:r.summary??JSON.stringify(r),label:tier.title??null});
        }
    }
    return out;
}
export function extractPay(ats,raw,description,{detailError=false,normalize=true}={}) {
    setNormalize(normalize);
    const structured=structuredRanges(ats,raw);
    const fromText=(()=>{const r=textRanges(description);return r.length?r:textSingles(description);})();
    const dedup=new Map();
    for(const r of structured.length?structured:fromText) dedup.set(JSON.stringify([r.payMin,r.payMax,r.currency,r.payPeriod,r.label]),r);
    const payRanges=[...dedup.values()];
    const disclosed=payRanges.some(r=>r.payMin!=null&&r.payMax!=null);
    const payFound=payRanges.length>0;
    const ambiguous=/salary|compensation|pay range|wage|remuneration/i.test(description) && /\d/.test(description.slice(Math.max(0,description.search(/salary|compensation|pay range|wage|remuneration/i))));
    const status=disclosed?'parsed_range':payFound?'single_value':detailError?'source_error':ambiguous?'unparseable':'missing';
    // Flatten only when there is exactly one range. Never merge different locations/tiers.
    const primary=payRanges.length===1?payRanges[0]:null;
    return {payRangeDisclosed:disclosed,payFound,extractionStatus:status,paySource:payFound?(structured.length?'structured':'description'):null,payMin:primary?.payMin??null,payMax:primary?.payMax??null,currency:primary?.currency??null,payPeriod:primary?.payPeriod??null,rangeType:primary?.rangeType??null,annualMin:primary?.annualMin??null,annualMax:primary?.annualMax??null,hourlyMin:primary?.hourlyMin??null,hourlyMax:primary?.hourlyMax??null,normalization:primary?.normalization??null,compensationBasis:primary?.compensationBasis??null,rawPayText:primary?.rawPayText??(payRanges.length?payRanges.map(r=>r.rawPayText).join('\n').slice(0,2400):null),payRanges,structuredCheckComplete:!detailError};
}
