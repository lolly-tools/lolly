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
 *    exemption is VERBATIM below: a quote of output the shipping code
 *    actually prints. Rewriting those would make the docs misreport the tool.
 *  - PHRASES: the hard-ban list (owner-mandated). Judgment-call words
 *    (crucial, robust, navigate…) are NOT here - a script cannot judge, so
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
  // Section sign - say the word ("section 2", "step 2", "option 2") and link the
  // reference where you can. Not everyone knows the glyph. Formal spec citations
  // in CODE comments (C2PA/ISO section numbers) keep it as the standard notation;
  // that is the separate code-comment gate, which does not carry this list.
  '§': 'SECTION SIGN',
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
  // Unusual line terminators - the repo is LF-only; anything else is a
  // fingerprint or an editor accident.
  '\r': 'CARRIAGE RETURN (CR / CRLF line ending)',
  '\u000B': 'VERTICAL TAB',
  '\u000C': 'FORM FEED',
  '\u0085': 'NEXT LINE (NEL)',
  // Non-standard unicode spaces - every Zs character that is not a plain
  // U+0020 space. Invisible in most editors, loud in a diff, classic tell.
  '\u1680': 'OGHAM SPACE MARK',
  '\u180E': 'MONGOLIAN VOWEL SEPARATOR',
  '\u2000': 'EN QUAD', '\u2001': 'EM QUAD',
  '\u2002': 'EN SPACE', '\u2003': 'EM SPACE',
  '\u2004': 'THREE-PER-EM SPACE', '\u2005': 'FOUR-PER-EM SPACE',
  '\u2006': 'SIX-PER-EM SPACE', '\u2007': 'FIGURE SPACE',
  '\u2008': 'PUNCTUATION SPACE', '\u2009': 'THIN SPACE',
  '\u200A': 'HAIR SPACE',
  '\u202F': 'NARROW NO-BREAK SPACE',
  '\u205F': 'MEDIUM MATHEMATICAL SPACE',
  '\u3000': 'IDEOGRAPHIC SPACE',
};

/** Entity spellings of banned characters (checked case-insensitively). */
const BANNED_ENTITIES = ['&mdash;', '&#8212;', '&#x2014;', '&nbsp;', '&#160;',
  '&ensp;', '&emsp;', '&thinsp;', '&#8194;', '&#8195;', '&#8201;', '&#8239;'];

/** Hard-banned phrases, matched case-insensitively as regexes. Exported so the
 *  code-comment gate (scripts/check-code-comment-vernacular.ts) shares one list. */
export const BANNED_PHRASES: { what: string; re: RegExp }[] = [
  { what: '"load-bearing"', re: /load-bearing/i },
  { what: '"earns its keep"', re: /earns its keep/i },
  { what: '"bar is high"', re: /bar is high/i },
  { what: '"heavy lifting"', re: /heavy lifting/i },
  { what: '"physically cannot"', re: /physically cannot/i },
  { what: '"deep dive"', re: /deep[ -]dive/i },
  { what: 'prose "smoke test"', re: /smoke[ -]test/i },
  { what: '"it deserves"', re: /\bit deserves\b/i },
  { what: 'abstract "shape of"', re: /\bshape of\b/i },
  { what: '"where X sits/fits/stands" framing', re: /\bwhere (?:\S+ ){1,3}?(?:sits|fits|stands)\b/i },
  { what: '"in (X) terms" framing', re: /\bin \S+ terms\b/i },
  { what: 'abstract "landscape"', re: /\b(existing|wider|current|competitive|creative-tools) landscape\b/i },
  { what: '"a testament to"', re: /\ba testament to\b/i },
  // Figurative "lands/landed" (a change "lands", a file "lands on" a stack) -
  // house style rejects it outside the literal senses (property, distant
  // places), which the lookbehind carves out (Andy, 2026-08-21).
  { what: 'figurative "lands/landed"', re: /(?<!\b(?:distant|foreign|native|far-off|their|his|her|ancestral)\s)\b(?:lands|landed)\b/i },
  { what: '"tapestry"', re: /tapestry/i },
  { what: '"delve"', re: /\bdelve/i },
  { what: '"treasure trove"', re: /treasure trove/i },
  { what: '"game-changer"', re: /game-chang/i },
  { what: '"at its core"', re: /\bat its core\b/i },
  { what: '"in today\'s world/era"', re: /\bin today'?s (world|era|fast)/i },
  { what: '"admissible" (any variation)', re: /\badmissib\w*/i },
  { what: 'the bar metaphor ("bar is high", "raises the bar")', re: /\b(?:bar is (?:high|low|higher|lower)|rais\w+ the bar)\b/i },
  { what: '"transcribe" family as prose (say quote/copy; the speech feature and API names carry ALLOW entries)', re: /\btranscri\w*/i },
  { what: '"worth knowing"', re: /\bworth knowing\b/i },
  { what: '"worth naming"', re: /\bworth naming\b/i },
  { what: '"what X is worth" framing', re: /\bwhat\s+\S[^.?!\n]{0,60}?\bis worth\b/i },
  // DOCS-ONLY: carried in CODE_EXEMPT (check-code-comment-vernacular.ts) because
  // "survivable" is genuine fault-tolerance vocabulary in the collab/parse code
  // ("this failure is survivable"), but a prose tic in the docs.
  { what: '"survivable" (prose)', re: /\bsurvivab\w*/i },
  // --- claudisms.ai import (2026-08-16, curated) ------------------------
  // Source: https://claudisms.ai/. Only entries with NO legitimate use in
  // THESE technical docs are hard-banned. Judgment-call words that double as
  // domain terms are deliberately NOT here, because the script cannot tell the
  // metaphor from the term and the STE100 domain exemption keeps them: realm
  // (the JS page realm), harness (test/fuzz harness), surface, shape, hold,
  // carry, unpack (the tool), compound (control/path), mature (the comparison
  // axis), leverage-as-noun, real. Those stay in the writing guidance.
  { what: '"paradigm" / "paradigm shift"', re: /\bparadigm\b/i },
  { what: '"throughline"', re: /\bthroughline\b/i },
  { what: '"north star" / "true north"', re: /\b(?:north star|true north)\b/i },
  { what: '"pressure-test"', re: /\bpressure[- ]test/i },
  { what: '"right-size"', re: /\bright[- ]siz(?:e|es|ed|ing)\b/i },
  { what: '"strategic imperative"', re: /\bstrategic imperative\b/i },
  { what: '"shed light on"', re: /\bshed(?:s|ding)? light\b/i },
  { what: '"pave the way"', re: /\bpav(?:e|es|ed|ing) the way\b/i },
  { what: '"pivotal"', re: /\bpivotal\b/i },
  { what: '"transformative"', re: /\btransformative\b/i },
  { what: '"groundbreaking"', re: /\bground[- ]?breaking\b/i },
  { what: '"cutting-edge"', re: /\bcutting[- ]edge\b/i },
  { what: '"seamless"', re: /\bseamless/i },
  { what: '"holistic"', re: /\bholistic\b/i },
  { what: '"intricate"', re: /\bintricate\b/i },
  { what: '"worth noting"', re: /\bworth noting\b/i },
  { what: '"important to note"', re: /\bimportant to note\b/i },
  { what: '"when it comes to"', re: /\bwhen it comes to\b/i },
  { what: 'signposting ("let\'s break it down / explore / dive in")', re: /\blet'?s (?:break it down|explore|dive in|dive into|turn to|unpack)\b/i },
  { what: '"moving on to"', re: /\bmoving on to\b/i },
  { what: '"cannot be overstated"', re: /\bcannot be overstated\b/i },
  { what: '"great question"', re: /\bgreat question\b/i },
  { what: '"at the end of the day"', re: /\bat the end of the day\b/i },
  { what: '"lean into" / "lean out"', re: /\blean(?:s|ing|ed)? (?:into|out)\b/i },
  { what: 'totalising superlative ("the whole game", "the entire point")', re: /\b(?:the whole (?:game|ballgame)|the entire point|the only thing that matters)\b/i },
  { what: '"seen this movie before"', re: /\bseen this movie before\b/i },
  { what: '"lessons learned"', re: /\blessons learned\b/i },
  { what: '"key takeaway(s)"', re: /\bkey takeaways?\b/i },
  { what: '"reflecting a broader trend" / "marking a significant shift"', re: /\b(?:reflecting a broader trend|marking a significant shift)\b/i },
  { what: '"dive into" (figurative)', re: /\bdiv(?:e|es|ing) into\b/i },
  // Matches the verb form only (the word followed by a determiner like the, a or
  // our). It deliberately excludes the noun-plus-relative-clause form ("... that
  // expires with a card"), which is a legitimate noun use in status-quo.md.
  { what: '"leverage" as a verb', re: /\bleverag(?:e|es|ing|ed) (?:the|its|our|your|their|a|an)\b/i },
  { what: '"where it gets interesting"', re: /\bwhere it gets interesting\b/i },
  // Abstract-register nouns (Andy, 2026-08-21): bookkeeping and machine words
  // applied to ideas. The first two have no literal home in these docs, so
  // they ban outright; the third carves out the physics senses, and the last
  // two ban only the figurative frames - "state survives a reload" and "data
  // structure" are genuine technical vocabulary and stay legal.
  { what: 'abstract "ledger"', re: /\bledgers?\b/i },
  { what: 'abstract "machinery"', re: /\bmachiner(?:y|ies)\b/i },
  { what: 'abstract "mechanics of"', re: /(?<!\b(?:quantum|fluid|orbital|classical|statistical|celestial|auto)\s)\bmechanics of\b/i },
  { what: 'figurative "survives"', re: /\bsurviv(?:e|es|ed|ing) (?:contact with|scrutiny|translation|the (?:cut|edit|rewrite|transition|retelling|journey))\b|\bwhat survives\b/i },
  { what: 'abstract "structure of the argument"', re: /\bstructure of the (?:argument|essay|answer|response|conversation|thinking|reasoning|claim|story|prose|piece|writing|work|problem)\b/i },
  // "The (x) is (y) here." - the copula-flourish tic (owner-banned 2026-08-16):
  // a clause that redefines its subject and then hedges with a trailing "here".
  // Deterministic discriminators, calibrated against the whole owned corpus:
  // a determiner after "is" excludes the pervasive legitimate participles
  // ("is computed here", "is duplicated here"); requiring punctuation right
  // after "here" excludes locatives that flow on ("is a no-op here (nothing
  // buffered", "is a branch here plus an opener", "here too"); the lookbehinds
  // require a subject word before "is" (a declarative, so real questions like
  // "Is the extension here?" pass) and exclude existential and there/here pairs
  // ("there is a session here", "a rename there is a rename here").
  { what: '"the (x) is (y) here." copula flourish', re: /(?<=[\w'’] )(?<!there )is (?:not )?(?:the|a|an) [\w'’-]+(?: [\w'’-]+){0,2} here[.,!?:;]/i },
  { what: '"brings me/us back to"', re: /\bbrings? (?:me|us) back to\b/i },
  { what: '"underscores/underscoring the" (figurative)', re: /\bunderscor(?:es|ing) (?:the|how|that|a|an)\b/i },
  // --- owner additions 2026-08-17 ---------------------------------------
  // All four are DOCS-only (CODE_EXEMPT in the code-comment gate): each has a
  // real domain use in code - the gamut "honesty note" cross-reference, a PKI
  // "trust anchor" / CSS "object-position anchors it", a layout "the table
  // fits", and C2PA "structurally valid/invalid". In PROSE they are tics.
  { what: '"honesty note(s)" as a heading/aside', re: /\bhonesty notes?\b/i },
  // "anchors it" as a prose verb - say what actually holds what (a signature
  // chains to a root, an identity vouches for a key).
  { what: '"anchors it" (prose verb)', re: /\banchors? it\b/i },
  // "the X fits" - the "it all comes together" flourish; sibling of the
  // fits-framing ban above.
  { what: '"the X fits" framing', re: /\bthe \S+ fits\b/i },
  // "structurally X" - the adverb-hedge. Delete the adverb and keep the
  // adjective ("locked", not "structurally locked"); if the adverb carries
  // meaning, name the actual structure.
  { what: '"structurally X" adverb-hedge', re: /\bstructurally\b/i },
  // Self-referential annotation tics: comments/prose that narrate their own text
  // ("this line is the guard", "the boundary is the contract", "the API is
  // structural") instead of just stating the fact. Say what the code does, not
  // what the sentence/line "is".
  { what: 'self-referential "(that/the/this line is X)"', re: /\b(?:that|the|this) line is\b/i },
  { what: '"the boundary is X" self-reference', re: /\bthe boundary is\b/i },
  { what: '"the X is structural" adjective-hedge', re: /\bis structural\b/i },
];

/**
 * Literal-use exemptions: a phrase hit passes when its LINE contains one of
 * these substrings. Keep entries exact and minimal - every entry is a
 * conscious, reviewable decision, and a stale entry fails loudly when the
 * line it sanctioned goes away (see the test's stale-allow assertion).
 */
const ALLOW: Record<string, string[]> = {
  'docs/animating.md': ['follow the shape of the artwork'],
  'docs/ai-features.md': ['actual shape of the audio'],
  'docs/url-mode.md': ['actual shape of the catalogue track'],
  'docs/using.md': ['filled shape of the same outline',
    // the Ask view's transcript is that UI's real object, not prose flourish
    'The transcript is session memory:'],
  'docs/ask.md': ['Answers build up in the transcript above',
    'The transcript is a record of what you asked',
    'The transcript is session memory.'],
  // render.transcribe (engine 1.150): the literal MANIFEST KEY a tool author has
  // to type, in its heading and in the example block. The prose around them says
  // "speech to text" instead.
  'docs/authoring-tools.md': ['### Transcribing audio (`render.transcribe`)',
    '"transcribe": { "source": "clip"'],
  // `lolly transcribe` (plan 183): the literal SUBCOMMAND a script author types,
  // in the reserved-verb list, the two `--json` lists, its own paragraph, two
  // command examples and the verbatim `lolly models ls` output. The prose around
  // them says "speech to text" and "reads a clip back as text" instead.
  'docs/cli.md': ['`speak`, `transcribe`, `mix`',
    'npm run cli -- transcribe ./clip.wav --lang=en --json',
    '**`lolly transcribe <clip.wav>`** reads a clip back as text',
    '$ lolly transcribe ./interview.m4a',
    'whisper    transcription (lolly transcribe)',
    '`speak`, `transcribe`, `ocr`'],
  // host.speech transcription: the industry feature name and literal API names
  'docs/host-api.md': ['speech synthesis + transcription',
    'Transcription (v1.99) is the reverse',
    '`transcribeAvailable()`', '`transcribeCached()`',
    '`transcribeModelBytes()`', '`transcribe(src, opts?)`', 'SpeechTranscript',
    // plan 183: the two CLI subcommands that surface this API headlessly
    '`lolly speak` and `lolly transcribe` are its discovery surface'],
  'docs/overview.md': ['TTS/transcription',
    // Positioning prose that predates the self-reference ban - grandfathered like the
    // code ratchet; the ban stops NEW uses of "(this line is X)"/"the boundary is X"/
    // "the X is structural", it doesn't force a rewrite of meaningful existing copy.
    'The line is sharp on purpose'],
  'docs/faq.md': ['That line is drawn in the licence',
    'The boundary is structural rather than promised'],
  // The sequence editor's transcript: "Edit transcript" is the literal button label
  // and the transcript editor is that UI's real object (plans/174), not prose flourish.
  'docs/sequence-editor.md': ['### Subtitles and the transcript',
    '**Edit transcript** opens the transcript as flowing text'],
  'docs/parser-inventory.md': ['the boundary is what lets a reviewer'],
  'docs/threat-model.md': ['the boundary is simply gone'],
};

/**
 * VERBATIM output quotes: the ONLY unicode exemption, held to a strict test.
 * An entry is allowed only when the shipping code emits that exact text,
 * so editing the doc would make it lie about what the tool prints. Every
 * entry must cite the source line it quotes; check it before adding
 * one, and never use this list for prose that merely sits in a code fence.
 * Stale entries fail loudly, same as ALLOW (see staleAllows).
 *
 * EMPTIED 2026-08-16: every entry quoted the CLI's em-dash output, and plan
 * 122 item 8 swept the emitters themselves (terminal-shell string literals
 * now carry the same ban, ratcheted in check-code-comment-vernacular.ts), so
 * the docs quotes were updated to the real new output and nothing needs an
 * exemption. The mechanism stays for a future genuinely-verbatim need.
 */
const VERBATIM: Record<string, string[]> = {};

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
 * Layer 3 - the BUILT output. Sources can be clean while a generator assembles
 * a banned character into the page (the credential label join and the theme
 * tooltip both did exactly that), so the built English pages are scanned too:
 * reader-visible text plus the spoken/hover attribute strings (aria-label,
 * title). Styles, scripts, inlined SVGs and code samples are stripped first - 
 * their em-dashes are third-party licence comments, captured app chrome and
 * the VERBATIM CLI output quotes, not our copy. English pages only: locale pages
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

/** Allow/verbatim entries whose sanctioned line no longer exists - stale. */
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
