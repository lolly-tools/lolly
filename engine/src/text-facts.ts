// SPDX-License-Identifier: MPL-2.0
/**
 * Document facts - a NEUTRAL census of what a text observably contains, for
 * the verify and catalog panels' interrogation surface. Pure observation, no
 * scoring and no verdict: the analyser (text-signals.ts) decides what counts
 * as a signal; this module only counts what is there, so a person judging a
 * text from a variable-trust source has the raw material - hidden characters
 * by name, which scripts the letters belong to, where its links point, how it
 * is structured, what its line endings say about where it has been. The
 * judgement stays with the reader; everything here is checkable offline
 * against the bytes themselves.
 *
 * Also the ONE home of invisible-character naming: the shells' chip renderers
 * (shells/web lib/invisible-chars.ts) import `invisibleCharName` from here, so
 * the census, the verify extract and the catalog preview can never disagree
 * about what a codepoint is called.
 */

// \u-escaped on purpose: raw invisible characters in SOURCE are exactly the
// artifact this module exists to expose.
const INVISIBLE_NAME: Record<string, string> = {
  '\u00A0': 'NBSP', '\u00AD': 'SHY', '\u034F': 'CGJ', '\u061C': 'ALM', '\u180E': 'MVS',
  '\u200B': 'ZWSP', '\u200C': 'ZWNJ', '\u200D': 'ZWJ', '\u200E': 'LRM', '\u200F': 'RLM',
  '\u202A': 'LRE', '\u202B': 'RLE', '\u202C': 'PDF', '\u202D': 'LRO', '\u202E': 'RLO',
  '\u202F': 'NNBSP', '\u2028': 'LS', '\u2029': 'PS', '\u2060': 'WJ',
  '\u2061': 'FA', '\u2062': 'IT', '\u2063': 'IS', '\u2064': 'IP',
  '\u2066': 'LRI', '\u2067': 'RLI', '\u2068': 'FSI', '\u2069': 'PDI',
  '\u3000': 'IDSP', '\uFEFF': 'BOM', '\uFFF9': 'IAA', '\uFFFA': 'IAS', '\uFFFB': 'IAT',
  '\uFFFC': 'OBJ',
};

/** Short display name for an invisible/format character, null for anything a
 *  reader can already see. Covers every range the analyser's byte tier flags. */
export function invisibleCharName(ch: string): string | null {
  const named = INVISIBLE_NAME[ch];
  if (named) return named;
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0x2000 && cp <= 0x200A) return 'SP';       // width-variant spaces
  if (cp >= 0xFE00 && cp <= 0xFE0F) return `VS${cp - 0xFE00 + 1}`;
  if (cp >= 0xE0100 && cp <= 0xE01EF) return `VS${cp - 0xE0100 + 17}`;
  if (cp >= 0xE0000 && cp <= 0xE007F) return 'TAG';    // tag chars - invisible ASCII smuggling
  if (cp >= 0xE000 && cp <= 0xF8FF) return 'PUA';      // private use (leaked model delimiters live here)
  return null;
}

/** One census entry: a named hidden character and how often it appears.
 *  `severity` keeps danger reading as danger even inside a neutral census:
 *  'severe' = characters that can disguise, reorder or smuggle content past a
 *  reader (bidi overrides, tag characters, private-use glyphs, supplementary
 *  variation selectors); 'note' = the merely-unusual (NBSP, soft hyphens,
 *  width-variant spaces) a paste trail ordinarily leaves. */
export interface HiddenCharCount { name: string; count: number; severity: 'severe' | 'note' }

const SEVERE_HIDDEN = new Set(['RLO', 'LRO', 'RLE', 'LRE', 'TAG', 'PUA', 'BOM']);

/** The census's danger grade for a named hidden character. */
export function hiddenCharSeverity(name: string): 'severe' | 'note' {
  if (SEVERE_HIDDEN.has(name)) return 'severe';
  // Supplementary variation selectors (VS17+) are a byte-smuggling scheme;
  // VS1-16 legitimately select emoji/CJK glyph variants.
  const vs = /^VS(\d+)$/.exec(name);
  if (vs && Number(vs[1]) >= 17) return 'severe';
  return 'note';
}

/** One script's share of the letters, as an integer percentage (>=1). */
export interface ScriptShare { script: string; pct: number }

/** One link destination and how often it is pointed at. */
export interface LinkHost { host: string; count: number }

export interface TextFacts {
  words: number;
  sentences: number;
  paragraphs: number;
  /** Lines that read as list items. */
  bulletLines: number;
  /** Hidden/format characters by name, most frequent first. Empty = none. */
  hidden: HiddenCharCount[];
  /** Which scripts the LETTERS belong to, largest first. One entry ("Latin
   *  100%") is the ordinary case; several is itself worth a look. */
  scripts: ScriptShare[];
  /** Typographic counts a paste trail leaves behind. */
  punctuation: { emDash: number; curlyQuotes: number; ellipsisChar: number };
  /** Where the text's links point - the judgement aid for a variable-trust
   *  source. Hosts only, most frequent first; never fetched. */
  linkHosts: LinkHost[];
  /** Line-ending mix. A CRLF/LF mix inside ONE document is a splice trail. */
  lineEndings: { lf: number; crlf: number };
  /** A leading byte-order mark survived into the text. */
  bom: boolean;
}

const SCRIPTS: Array<[string, RegExp]> = [
  ['Latin', /\p{Script=Latin}/u],
  ['Cyrillic', /\p{Script=Cyrillic}/u],
  ['Greek', /\p{Script=Greek}/u],
  ['Arabic', /\p{Script=Arabic}/u],
  ['Hebrew', /\p{Script=Hebrew}/u],
  ['Han', /\p{Script=Han}/u],
  ['Hiragana', /\p{Script=Hiragana}/u],
  ['Katakana', /\p{Script=Katakana}/u],
  ['Hangul', /\p{Script=Hangul}/u],
  ['Devanagari', /\p{Script=Devanagari}/u],
  ['Bengali', /\p{Script=Bengali}/u],
  ['Thai', /\p{Script=Thai}/u],
];

/** Census a text. Pure and cheap (one pass for characters, small regex passes
 *  for structure); safe on any input including code - facts are facts. */
export function textFacts(text: string): TextFacts {
  const hiddenCounts = new Map<string, number>();
  const scriptCounts = new Map<string, number>();
  let letters = 0;
  let emDash = 0, curlyQuotes = 0, ellipsisChar = 0;
  // Structure counts run on the VISIBLE text: a period trailed by a zero-width
  // character must still end a sentence, or a stego-laden document reports
  // absurd counts right where accuracy matters most.
  let visible = '';
  for (const ch of text) {
    const hidden = invisibleCharName(ch);
    if (hidden) {
      hiddenCounts.set(hidden, (hiddenCounts.get(hidden) ?? 0) + 1);
      continue;
    }
    visible += ch;
    if (ch === '—') emDash++;
    else if (ch === '‘' || ch === '’' || ch === '“' || ch === '”') curlyQuotes++;
    else if (ch === '…') ellipsisChar++;
    if (/\p{L}/u.test(ch)) {
      letters++;
      for (const [name, re] of SCRIPTS) {
        if (re.test(ch)) { scriptCounts.set(name, (scriptCounts.get(name) ?? 0) + 1); break; }
      }
    }
  }

  const words = (visible.match(/\S+/g) ?? []).length;
  const sentences = (visible.match(/[.!?](?=\s|$)/g) ?? []).length;
  const paragraphs = visible.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const bulletLines = visible.split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s+/u.test(l)).length;

  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/\n/g) ?? []).length - crlf;

  const hostCounts = new Map<string, number>();
  for (const m of text.matchAll(/https?:\/\/([^\s/"'<>)\]]+)/gi)) {
    const host = m[1]!.replace(/^www\./i, '').toLowerCase().replace(/[:.,;!?]+$/, '');
    if (host) hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
  }

  const byCount = <K,>(m: Map<K, number>): Array<[K, number]> => [...m].sort((a, b) => b[1] - a[1]);
  return {
    words,
    sentences,
    paragraphs,
    bulletLines,
    hidden: byCount(hiddenCounts).map(([name, count]) => ({ name, count, severity: hiddenCharSeverity(name) })),
    scripts: byCount(scriptCounts)
      .map(([script, n]) => ({ script, pct: Math.round((n / Math.max(1, letters)) * 100) }))
      .filter((s) => s.pct >= 1),
    punctuation: { emDash, curlyQuotes, ellipsisChar },
    linkHosts: byCount(hostCounts).map(([host, count]) => ({ host, count })),
    lineEndings: { lf, crlf },
    bom: text.startsWith('\uFEFF'),
  };
}
