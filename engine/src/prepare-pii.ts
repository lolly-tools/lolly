// SPDX-License-Identifier: MPL-2.0
/** Typed adaptation of community/_shared/pii.js. Behavioral parity is tested;
 * keep patterns aligned with Redact. Additional size/match bounds protect batch jobs. */
export interface PiiMatch { kind: string; label?: string; text: string; maybe: boolean; start: number; end: number }
// Plain regular expressions over ONE line of text. Everything here is a GUESS
// offered to a person, never a decision: the caller shows what was found and
// the person confirms it. Nothing in this region acts on its own.
//
// Matchers run in order and CLAIM the characters they match, so a later, looser
// pattern cannot re-read a span a stricter one already explained. Two entries
// claim without reporting: a URL and a version string are digit runs that would
// otherwise read as a phone number.
//
// `maybe: true` marks a pattern loose enough to be wrong on ordinary text (a
// capitalised word pair, a five-digit number). The caller has to present those
// as questions rather than findings.
//
// Deliberately NOT here: a national identity number, a passport number or a
// medical code. Their formats differ per country and a wrong guess about one of
// those is a worse failure than missing it, so they stay a manual mark.

function piiDigits(s: string) {
  return String(s).replace(/[^0-9]/g, '');
}

// The check digit every payment card carries. Cheap, and it turns "a long run
// of digits" into something specific enough to name: an order number, a serial
// or a phone number written without spaces almost never passes.
function luhnOk(digits: string) {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Words that start a capitalised pair without a person being anywhere near it.
// Short on purpose: the name matcher is already flagged `maybe`, so the list
// only has to catch the pairs common enough to be noise on every document.
const PII_STOP = {
  january: 1, february: 1, march: 1, april: 1, may: 1, june: 1, july: 1,
  august: 1, september: 1, october: 1, november: 1, december: 1,
  monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1,
  sunday: 1, the: 1, this: 1, that: 1, dear: 1, from: 1, sent: 1, page: 1,
  total: 1, invoice: 1, receipt: 1, account: 1, date: 1, name: 1, address: 1,
  phone: 1, email: 1, subject: 1, note: 1, notes: 1, terms: 1, please: 1,
  thank: 1, thanks: 1, best: 1, kind: 1, yours: 1, new: 1, united: 1,
  north: 1, south: 1, east: 1, west: 1, all: 1, rights: 1, reserved: 1,
  copyright: 1, content: 1, credentials: 1, general: 1, public: 1, private: 1,
};

const PII_MONTH = '(?:January|February|March|April|September|October|November|December|'
  + 'Jan|Feb|Mar|Apr|May|June|Jun|July|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\\.?';

function piiNameOk(m: string) {
  const parts = String(m).split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i]!.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (w && Object.hasOwn(PII_STOP, w)) return false;
  }
  return true;
}

function piiPhoneOk(m: string) {
  const d = piiDigits(m);
  return d.length >= 7 && d.length <= 15;
}

const PII_MATCHERS: { kind: string; label?: string; maybe?: boolean; re: RegExp; test?: (value: string) => boolean }[] = [
  // Claim-only, kind '': a URL and a version string are digit runs with
  // separators, which is exactly what the phone matchers look for.
  { kind: '', re: /\bhttps?:\/\/\S+/g },
  {
    kind: '', re: /\bv?\d+\.\d+(?:\.\d+)+/g,
    // 12.03.1980 is a version string by shape and a date of birth in most of
    // Europe. Three dotted numbers whose last part is a 2-to-4 digit year are
    // left unclaimed so the date matcher below reports them; a real version
    // (v1.77.0, 1.149.0, 10.15.7.2024) does not fit that shape and is claimed.
    test: (m: string) => !/^\d{1,4}\.\d{1,2}\.\d{2,4}$/.test(m),
  },

  { kind: 'email', label: 'Email address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },

  {
    kind: 'iban', label: 'Bank account (IBAN)',
    re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g,
    test: (m: string) => { const n = m.replace(/\s/g, '').length; return n >= 15 && n <= 34; },
  },
  {
    kind: 'card', label: 'Card number',
    re: /\b\d[\d\s-]{11,21}\d\b/g,
    test: (m: string) => luhnOk(piiDigits(m)),
  },

  // Dates before phones: 12.03.1980 is seven digits with separators.
  { kind: 'date', label: 'Date', maybe: true, re: /\b\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}\b/g },
  {
    kind: 'date', label: 'Date', maybe: true,
    re: new RegExp('\\b\\d{1,2}(?:st|nd|rd|th)?\\s+' + PII_MONTH + '\\s+(?:19|20)\\d{2}\\b', 'g'),
  },
  {
    kind: 'date', label: 'Date', maybe: true,
    re: new RegExp('\\b' + PII_MONTH + '\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+(?:19|20)\\d{2}\\b', 'g'),
  },

  {
    kind: 'phone', label: 'Phone number',
    re: /\+\d[\d\s().-]{5,18}\d/g,
    test: piiPhoneOk,
  },
  {
    kind: 'phone', label: 'Phone number', maybe: true,
    re: /\(?\b0?\d[\d\s().-]{5,18}\d\b/g,
    test: piiPhoneOk,
  },

  {
    kind: 'address', label: 'Street address',
    re: /\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][A-Za-z.'-]+\s+){1,4}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Highway|Hwy|Way|Close|Court|Ct|Place|Pl|Terrace|Parade|Crescent|Square|Sq|Strasse|Straße)\b\.?/g,
  },
  { kind: 'postcode', label: 'Postcode', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },
  { kind: 'postcode', label: 'Postcode', maybe: true, re: /\b\d{5}(?:-\d{4})?\b/g },

  {
    kind: 'name', label: 'Name', maybe: true,
    re: /\b[A-Z][a-z]{1,15}\s+(?:[A-Z][a-z]?\.?\s+)?[A-Z][a-z]{1,15}\b/g,
    test: piiNameOk,
  },
];

// Every classified span in `text`, in reading order:
// [{ kind, label, text, maybe, start, end }]. Claim-only matches report
// nothing; a span already claimed is skipped rather than re-read.
export function piiFindings(text: string): PiiMatch[] {
  const s = String(text == null ? '' : text);
  if (!s) return [];
  const claimed: [number, number][] = [];
  const out: PiiMatch[] = [];
  function free(a: number, b: number) {
    for (let c = 0; c < claimed.length; c++) {
      if (a < claimed[c]![1] && claimed[c]![0] < b) return false;
    }
    return true;
  }
  for (let i = 0; i < PII_MATCHERS.length; i++) {
    const spec = PII_MATCHERS[i]!;
    const re = spec.re;
    re.lastIndex = 0;
    for (const m of s.matchAll(re)) {
      if (out.length >= 2001 || claimed.length >= 10000) return out;
      const hit = m[0];
      if (!hit) { re.lastIndex++; continue; }
      const a = m.index;
      const b = a + hit.length;
      if (!free(a, b)) continue;
      if (spec.test && !spec.test(hit)) continue;
      claimed.push([a, b]);
      if (!spec.kind) continue;
      out.push({
        kind: spec.kind, label: spec.label, text: hit,
        maybe: spec.maybe === true, start: a, end: b,
      });
    }
  }
  out.sort((x, y) => x.start - y.start);
  return out;
}
