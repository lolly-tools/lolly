/**
 * Deterministic vernacular + hidden-unicode gate for user-facing docs sources.
 *
 * No model in the loop, ever: this is character and substring scanning with an
 * explicit, literal allowlist. It exists because banned AI-vernacular phrases
 * and fingerprint unicode kept reappearing in copy, and a list in a memory file
 * only binds whoever reads it. A script binds everyone.
 *
 * Enforced twice: `tests/docs-vernacular.test.ts` (so `npm test` and the
 * `loldev ship` gate fail on a violation) and as a standalone CLI:
 *
 *   node scripts/check-docs-vernacular.ts
 *
 * Scope: the ENGLISH sources only (docs/*.md, docs/site/*, the figure HTML,
 * README.md). Locale twins are generated from these by the translate pipeline,
 * which carries its own punctuation rules.
 *
 * Two ban layers, both deterministic:
 *  - UNICODE: no exemptions for PROSE. Em-dash, zero-width characters,
 *    joiners, bidi controls, BOM, soft hyphen, NBSP, line/para separators,
 *    non-breaking hyphen, plus their HTML entity spellings. (The en-dash is
 *    deliberately NOT banned: numeric ranges use it legitimately.) The one
 *    exemption is VERBATIM below: a transcript of output the shipping code
 *    actually prints. Rewriting those would make the docs misreport the tool.
 *  - PHRASES: the hard-ban list (owner-mandated). Judgment-call words
 *    (crucial, robust, navigate…) are NOT here — a script cannot judge, so
 *    those stay in the writing guidance. A phrase ban may carry ALLOW entries:
 *    exact substrings of lines where the literal (non-tic) use is sanctioned.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

export interface Violation {
  file: string;
  line: number;
  kind: 'unicode' | 'phrase';
  what: string;
  excerpt: string;
}

/** Character bans. Key = the character, value = its name for the report. */
const BANNED_CHARS: Record<string, string> = {
  '—': 'EM DASH',
  '​': 'ZERO WIDTH SPACE',
  '‌': 'ZERO WIDTH NON-JOINER',
  '‍': 'ZERO WIDTH JOINER',
  '⁠': 'WORD JOINER',
  '﻿': 'BOM / ZERO WIDTH NO-BREAK SPACE',
  '­': 'SOFT HYPHEN',
  '‪': 'BIDI LRE', '‫': 'BIDI RLE', '‬': 'BIDI PDF',
  '‭': 'BIDI LRO', '‮': 'BIDI RLO',
  '⁦': 'BIDI LRI', '⁧': 'BIDI RLI', '⁨': 'BIDI FSI', '⁩': 'BIDI PDI',
  ' ': 'LINE SEPARATOR',
  ' ': 'PARAGRAPH SEPARATOR',
  ' ': 'NO-BREAK SPACE',
  '‑': 'NON-BREAKING HYPHEN',
};

/** Entity spellings of banned characters (checked case-insensitively). */
const BANNED_ENTITIES = ['&mdash;', '&#8212;', '&#x2014;', '&nbsp;', '&#160;'];

/** Hard-banned phrases, matched case-insensitively as regexes. */
const BANNED_PHRASES: { what: string; re: RegExp }[] = [
  { what: '"load-bearing"', re: /load-bearing/i },
  { what: '"earns its keep"', re: /earns its keep/i },
  { what: '"heavy lifting"', re: /heavy lifting/i },
  { what: '"physically cannot"', re: /physically cannot/i },
  { what: '"deep dive"', re: /deep[ -]dive/i },
  { what: 'prose "smoke test"', re: /smoke[ -]test/i },
  { what: '"it deserves"', re: /\bit deserves\b/i },
  { what: 'abstract "shape of"', re: /\bshape of\b/i },
  { what: '"where X fits" framing', re: /\bwhere \S+ fits\b/i },
  { what: 'abstract "landscape"', re: /\b(existing|wider|current|competitive|creative-tools) landscape\b/i },
  { what: '"a testament to"', re: /\ba testament to\b/i },
  { what: '"tapestry"', re: /tapestry/i },
  { what: '"delve"', re: /\bdelve/i },
  { what: '"treasure trove"', re: /treasure trove/i },
  { what: '"game-changer"', re: /game-chang/i },
  { what: '"at its core"', re: /\bat its core\b/i },
  { what: '"in today\'s world/era"', re: /\bin today'?s (world|era|fast)/i },
];

/**
 * Literal-use exemptions: a phrase hit passes when its LINE contains one of
 * these substrings. Keep entries exact and minimal — every entry is a
 * conscious, reviewable decision, and a stale entry fails loudly when the
 * line it sanctioned goes away (see the test's stale-allow assertion).
 */
const ALLOW: Record<string, string[]> = {
  'docs/animating.md': ['follow the shape of the artwork'],
  'docs/ai-features.md': ['actual shape of the audio'],
  'docs/url-mode.md': ['actual shape of the catalogue track'],
  'docs/using.md': ['filled shape of the same outline'],
};

/**
 * VERBATIM transcripts: the ONLY unicode exemption, and the bar is high.
 * An entry is admissible only when the shipping code emits that exact text,
 * so editing the doc would make it lie about what the tool prints. Every
 * entry below cites the source line it transcribes; check it before adding
 * one, and never use this list for prose that merely sits in a code fence.
 * Stale entries fail loudly, same as ALLOW (see staleAllows).
 */
const VERBATIM: Record<string, string[]> = {
  // The CLI's own verdict reporter joins slug and message with an em dash,
  // and splits back on it: packages/node-shell/src/verdict-report.ts:64.
  'docs/cli-signing.md': [
    '✦ Made with Lolly — credential intact',                                   // node-shell/src/verdict-slugs.ts:29
    ' — verified by ',                                                          // node-shell/src/verdict-report.ts:111
    '.match — hashed uri matched:',                                             // engine/src/c2pa-verify.ts:1268
    'claimSignature.validated — claim signature valid',                         // engine/src/c2pa-verify.ts:1322
    'claimSignature.insideValidity — signing certificate within its validity window', // c2pa-verify.ts:1329
    'assertion.dataHash.match — data hash valid',                               // engine/src/c2pa-verify.ts:1550
    'signingCredential.trusted — signing certificate chains to a pinned CA root — verified identity:', // c2pa-verify.ts:1594
    'signingCredential.untrusted — signing certificate untrusted —',            // engine/src/c2pa-verify.ts:476-478
    'has no C2PA container — Content Credentials skipped.',                     // shells/cli/src/run.ts:1058
  ],
  'docs/cli.md': [
    '✦ Made with Lolly — credential intact',                                   // node-shell/src/verdict-slugs.ts:29
    'signingCredential.untrusted — signing certificate untrusted —',            // engine/src/c2pa-verify.ts:476-478
  ],
};

function targets(): string[] {
  const out: string[] = ['README.md'];
  for (const f of readdirSync(join(ROOT, 'docs'))) {
    if (f.endsWith('.md')) out.push(`docs/${f}`);
  }
  if (existsSync(join(ROOT, 'docs/site'))) {
    for (const f of readdirSync(join(ROOT, 'docs/site'))) {
      if (f.endsWith('.md') || f.endsWith('.json')) out.push(`docs/site/${f}`);
    }
  }
  if (existsSync(join(ROOT, 'docs/figures'))) {
    for (const f of readdirSync(join(ROOT, 'docs/figures'))) {
      if (f.endsWith('.html')) out.push(`docs/figures/${f}`);
    }
  }
  return out.sort();
}

export function scan(): Violation[] {
  const violations: Violation[] = [];
  for (const rel of targets()) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const lines = readFileSync(abs, 'utf8').split('\n');
    const allowed = ALLOW[rel] ?? [];
    const verbatim = VERBATIM[rel] ?? [];
    lines.forEach((text, i) => {
      const isVerbatim = verbatim.some(v => text.includes(v));
      for (const [ch, name] of Object.entries(BANNED_CHARS)) {
        if (text.includes(ch) && !isVerbatim) {
          violations.push({ file: rel, line: i + 1, kind: 'unicode', what: name, excerpt: text.trim().slice(0, 90) });
        }
      }
      const lower = text.toLowerCase();
      for (const ent of BANNED_ENTITIES) {
        if (lower.includes(ent)) {
          violations.push({ file: rel, line: i + 1, kind: 'unicode', what: `entity ${ent}`, excerpt: text.trim().slice(0, 90) });
        }
      }
      for (const { what, re } of BANNED_PHRASES) {
        if (re.test(text) && !allowed.some(a => text.includes(a))) {
          violations.push({ file: rel, line: i + 1, kind: 'phrase', what, excerpt: text.trim().slice(0, 90) });
        }
      }
    });
  }
  return violations;
}

/**
 * Layer 3 — the BUILT output. Sources can be clean while a generator assembles
 * a banned character into the page (the credential label join and the theme
 * tooltip both did exactly that), so the built English pages are scanned too:
 * reader-visible text plus the spoken/hover attribute strings (aria-label,
 * title). Styles, scripts, inlined SVGs and code samples are stripped first —
 * their em-dashes are third-party licence comments, captured app chrome and
 * the VERBATIM CLI transcripts, not our copy. English pages only: locale pages
 * are translated output with their own punctuation rules.
 */
export function scanBuilt(): Violation[] {
  const dir = join(ROOT, 'shells/web/public/info');
  if (!existsSync(dir)) return [];
  const violations: Violation[] = [];
  const STRIP = /<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>/g;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    const rel = `shells/web/public/info/${f}`;
    const stripped = readFileSync(join(dir, f), 'utf8').replace(STRIP, ' ');
    const spoken = [...stripped.matchAll(/(?:aria-label|title)="([^"]*)"/g)].map(m => m[1]!).join('\n');
    const visible = stripped.replace(/<[^>]*>/g, ' ');
    for (const [where, text] of [['visible text', visible], ['aria-label/title', spoken]] as const) {
      for (const [ch, name] of Object.entries(BANNED_CHARS)) {
        let idx = text.indexOf(ch);
        while (idx !== -1) {
          violations.push({ file: rel, line: 0, kind: 'unicode', what: `${name} in built ${where}`, excerpt: text.slice(Math.max(0, idx - 45), idx + 45).replace(/\s+/g, ' ').trim() });
          idx = text.indexOf(ch, idx + 1);
        }
      }
    }
  }
  return violations;
}

/** Allow/verbatim entries whose sanctioned line no longer exists — stale. */
export function staleAllows(): string[] {
  const stale: string[] = [];
  for (const [label, table] of [['ALLOW', ALLOW], ['VERBATIM', VERBATIM]] as const) {
    for (const [rel, subs] of Object.entries(table)) {
      const abs = join(ROOT, rel);
      const body = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      for (const sub of subs) {
        if (!body.includes(sub)) stale.push(`${label} ${rel}: "${sub}"`);
      }
    }
  }
  return stale;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  const v = [...scan(), ...scanBuilt()];
  const stale = staleAllows();
  for (const x of v) console.error(`✗ ${x.file}${x.line ? ':' + x.line : ''} [${x.kind}] ${x.what} - ${x.excerpt}`);
  for (const s of stale) console.error(`✗ stale allow entry: ${s}`);
  if (v.length || stale.length) {
    console.error(`\n${v.length} violation(s), ${stale.length} stale allow(s).`);
    process.exit(1);
  }
  console.log(`✓ vernacular + unicode clean across ${targets().length} source files and the built pages`);
}
