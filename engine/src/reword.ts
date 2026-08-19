// SPDX-License-Identifier: MPL-2.0
/**
 * Reword flagged text - the SEMANTIC half humanize.ts's header defers (plans/127).
 * Everything here is pure and deterministic; the model that proposes rewrites
 * lives shell-side (a worker). This module owns the four pieces every shell must
 * agree on:
 *
 *  - a table of DETERMINISTIC rewrite suggestions (deletions of filler openers,
 *    plain-word swaps) - offered for a person to accept, never auto-applied;
 *  - which sentences of an analysed text are worth offering to the model
 *    (`rewordableSpans` - the analyser's style marks, sentence-bounded);
 *  - the prompt (`buildRewordMessages`) - engine data so shells cannot drift;
 *  - the GATE (`rewordGate` / `rewordCandidates`): a model candidate is offered
 *    ONLY if it is no longer than the original, keeps every number/link/name,
 *    scores no hotter on the analyser, and carries no artifact tell. The model
 *    samples freely BEFORE this gate; the gate decides what a person ever sees.
 *
 * PROVENANCE: accepting a suggestion from the table is a deterministic edit (no
 * genAI flag - the humanize.ts rule). Accepting a MODEL candidate makes the
 * derived asset AI-assisted, and the shell MUST stamp `aiGenerated` on save.
 * This module never claims otherwise; it is the shell's save path that flags.
 */

import { analyzeTextSignals, quotedAt } from './text-signals.ts';
import type { TextSignalFinding } from './text-signals.ts';
import { humanizeText } from './humanize.ts';

// ── Deterministic suggestions ─────────────────────────────────────────────────

/** One offered rewrite: replace [index, index+length) with `replacement`. */
export interface RewordSuggestion {
  index: number;
  length: number;
  replacement: string;
  label: string;
  kind: 'delete' | 'swap';
}

interface SuggestEntry {
  re: RegExp;
  kind: 'delete' | 'swap';
  label: string;
  /** The replacement for a match. Case is fixed up afterwards for swaps. */
  replace: (m: RegExpExecArray) => string;
}

/** Inflect a matched verb onto a plain replacement's forms. */
function verbForm(matched: string, f: { base: string; s: string; ed: string; ing: string }): string {
  const w = matched.toLowerCase();
  if (w.endsWith('ing')) return f.ing;
  if (w.endsWith('ed')) return f.ed;
  if (w.endsWith('s')) return f.s;
  return f.base;
}

/** Carry the match's leading capital onto the replacement. */
function matchCase(matched: string, replacement: string): string {
  if (/^[A-Z]/.test(matched) && /^[a-z]/.test(replacement)) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const OPENER = 'Filler opener';
const PLAINER = 'Plainer word';

/**
 * The table. Every entry is a SUGGESTION a person accepts or declines - so a
 * borderline match (a noun "leverage", a deliberate "robust") costs a shake of
 * the head, not a wounded sentence. Deletions target throat-clearing that
 * shortens for free; swaps target the stock inflated vocabulary the analyser
 * already flags. Kept OUTSIDE claudisms.ts's scoring lists on purpose:
 * LEXICON_VERSION does not move for a suggestion change, and no persisted
 * analysis is invalidated (plans/127 section 1).
 */
const SUGGEST_TABLE: SuggestEntry[] = [
  // Deletions - filler that carries no meaning.
  { re: /\b[Ii]t(?:(?:'|’)s| is) (?:also )?(?:important|worth|crucial|essential) (?:to (?:note|remember|mention|understand)|noting) that\s+/g, kind: 'delete', label: OPENER, replace: () => '' },
  { re: /\b[Ii]n today(?:'|’)s (?:fast-paced|ever-(?:changing|evolving)|rapidly (?:changing|evolving)|modern|digital|competitive) (?:world|landscape|environment|era|age|market)(?:,\s*|\s+)/g, kind: 'delete', label: OPENER, replace: () => '' },
  { re: /\b[Aa]t the end of the day,?\s+/g, kind: 'delete', label: OPENER, replace: () => '' },
  { re: /\b[Nn]eedless to say,?\s+/g, kind: 'delete', label: OPENER, replace: () => '' },
  { re: /\b[Ii]t goes without saying that\s+/g, kind: 'delete', label: OPENER, replace: () => '' },
  // Swaps - the same thing in fewer or plainer words.
  { re: /\b[Ff]irst and foremost\b/g, kind: 'swap', label: PLAINER, replace: () => 'first' },
  { re: /\butili[sz](?:es|ed|ing|e)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => verbForm(m[0]!, { base: 'use', s: 'uses', ed: 'used', ing: 'using' }) },
  { re: /\bleverag(?:es|ed|ing|e)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => verbForm(m[0]!, { base: 'use', s: 'uses', ed: 'used', ing: 'using' }) },
  { re: /\bin order to\b/gi, kind: 'swap', label: PLAINER, replace: () => 'to' },
  { re: /\bprior to\b/gi, kind: 'swap', label: PLAINER, replace: () => 'before' },
  { re: /\bsubsequently\b/gi, kind: 'swap', label: PLAINER, replace: () => 'later' },
  { re: /\bcommenc(?:es|ed|ing|e)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => verbForm(m[0]!, { base: 'start', s: 'starts', ed: 'started', ing: 'starting' }) },
  { re: /\bendeavou?rs? to\b/gi, kind: 'swap', label: PLAINER, replace: (m) => (/rs to$/i.test(m[0]!) ? 'tries to' : 'try to') },
  { re: /\b(?:is|are) able to\b/gi, kind: 'swap', label: PLAINER, replace: () => 'can' },
  { re: /\bin the event that\b/gi, kind: 'swap', label: PLAINER, replace: () => 'if' },
  { re: /\bdue to the fact that\b/gi, kind: 'swap', label: PLAINER, replace: () => 'because' },
  { re: /\b(?:with regard to|in regards? to)\b/gi, kind: 'swap', label: PLAINER, replace: () => 'about' },
  { re: /\ba (?:wide|broad) (?:range|array|variety) of\b/gi, kind: 'swap', label: PLAINER, replace: () => 'many' },
  { re: /\ba (?:multitude|plethora|myriad) of\b/gi, kind: 'swap', label: PLAINER, replace: () => 'many' },
  { re: /\b(delv(?:es|ed|ing|e)) into\b/gi, kind: 'swap', label: PLAINER, replace: (m) => `${verbForm(m[1]!, { base: 'dig', s: 'digs', ed: 'dug', ing: 'digging' })} into` },
  { re: /\bserves as (a|an)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => `is ${m[1]!.toLowerCase()}` },
  { re: /\bserve as (a|an)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => `are ${m[1]!.toLowerCase()}` },
  { re: /\bshowcas(?:es|ed|ing|e)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => verbForm(m[0]!, { base: 'show', s: 'shows', ed: 'showed', ing: 'showing' }) },
  { re: /\bgarner(?:s|ed|ing)?\b/gi, kind: 'swap', label: PLAINER, replace: (m) => verbForm(m[0]!, { base: 'earn', s: 'earns', ed: 'earned', ing: 'earning' }) },
  { re: /\bfacilitat(?:es|ed|ing|e)\b/gi, kind: 'swap', label: PLAINER, replace: (m) => verbForm(m[0]!, { base: 'help', s: 'helps', ed: 'helped', ing: 'helping' }) },
  { re: /\b(?:furthermore|moreover|additionally),\s/gi, kind: 'swap', label: PLAINER, replace: () => 'also, ' },
  { re: /\bnumerous\b/gi, kind: 'swap', label: PLAINER, replace: () => 'many' },
  { re: /\bseamlessly\b/gi, kind: 'swap', label: PLAINER, replace: () => 'smoothly' },
  { re: /\bseamless\b/gi, kind: 'swap', label: PLAINER, replace: () => 'smooth' },
];

/** True when `i` starts a sentence: start of text, of a line, or after . ! ? */
function atSentenceStart(text: string, i: number): boolean {
  let p = i - 1;
  while (p >= 0 && (text[p] === ' ' || text[p] === '\t')) p--;
  if (p < 0) return true;
  const ch = text[p]!;
  return ch === '\n' || ch === '.' || ch === '!' || ch === '?';
}

/**
 * Every deterministic suggestion for `text`, in document order, overlaps
 * dropped (first wins). A deletion at a sentence start swallows the following
 * letter and re-capitalises it, so accepting one never leaves a lowercase
 * sentence. Quoted matches are skipped - someone else's words stay theirs.
 */
export function suggestRewrites(text: string): RewordSuggestion[] {
  const found: RewordSuggestion[] = [];
  for (const e of SUGGEST_TABLE) {
    e.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = e.re.exec(text))) {
      if (m[0].length === 0) { e.re.lastIndex++; continue; }
      if (quotedAt(text, m.index, m[0].length)) continue;
      let length = m[0].length;
      let replacement = e.replace(m);
      if (e.kind === 'swap') replacement = matchCase(m[0], replacement);
      if (e.kind === 'delete' && atSentenceStart(text, m.index)) {
        const next = text[m.index + length];
        if (next && /[a-z]/.test(next)) { length += 1; replacement = next.toUpperCase(); }
      }
      found.push({ index: m.index, length, replacement, label: e.label, kind: e.kind });
    }
  }
  found.sort((a, b) => a.index - b.index || b.length - a.length);
  const kept: RewordSuggestion[] = [];
  let end = -1;
  for (const s of found) {
    if (s.index >= end) { kept.push(s); end = s.index + s.length; }
  }
  return kept;
}

/** Apply one suggestion. Indices refer to `text` as given - after applying,
 *  recompute (`suggestRewrites` again) rather than reusing stale offsets. */
export function applySuggestion(text: string, s: RewordSuggestion): string {
  return text.slice(0, s.index) + s.replacement + text.slice(s.index + s.length);
}

// ── Which sentences to offer the model ────────────────────────────────────────

/** A sentence worth offering: its slice, and the summed heat that ranked it. */
export interface RewordSpan {
  index: number;
  length: number;
  heat: number;
}

/** Sentence caps: below the floor there is nothing to shorten; above the
 *  ceiling the "sentence" is a wall the small model should not be fed. */
const SPAN_MIN_CHARS = 30;
const SPAN_MAX_CHARS = 320;
/** At most this many spans per document - a tell-dense wall must not queue
 *  fifty generations. The hottest win. */
const SPAN_CAP = 12;

/** Expand [from, to) to sentence bounds: stops at newlines and at . ! ?
 *  followed by whitespace (so decimals never split). */
function sentenceBounds(text: string, from: number, to: number): { start: number; end: number } {
  let start = from;
  while (start > 0) {
    const prev = text[start - 1]!;
    if (prev === '\n') break;
    if (/[.!?]/.test(prev) && /\s/.test(text[start] ?? ' ')) break;
    start--;
  }
  while (start < from && /[\s"'“”‘’)\]]/.test(text[start]!)) start++;
  let end = Math.max(to, start);
  while (end < text.length) {
    const ch = text[end]!;
    if (ch === '\n') break;
    if (/[.!?]/.test(ch) && (end + 1 >= text.length || /[\s"'“”‘’)\]]/.test(text[end + 1]!))) {
      end++;
      while (end < text.length && /["'“”‘’)\]]/.test(text[end]!)) end++;
      break;
    }
    end++;
  }
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return { start, end };
}

/**
 * The sentences of `text` worth offering the model, from an analysis's
 * findings: style-tier marks only (fingerprints are the deterministic strip's
 * job, and the `ai-span` region note would swallow whole paragraphs), expanded
 * to sentence bounds, same-sentence hits merged with their heats summed,
 * hottest `SPAN_CAP` kept, returned in document order.
 */
export function rewordableSpans(text: string, findings: readonly TextSignalFinding[]): RewordSpan[] {
  const raw: RewordSpan[] = [];
  for (const f of findings) {
    if (f.tier !== 'heuristic' || f.kind === 'ai-span') continue;
    for (const s of f.spans ?? []) {
      const b = sentenceBounds(text, s.index, s.index + s.length);
      const len = b.end - b.start;
      if (len < SPAN_MIN_CHARS || len > SPAN_MAX_CHARS) continue;
      raw.push({ index: b.start, length: len, heat: f.heat });
    }
  }
  raw.sort((a, b) => a.index - b.index);
  const merged: RewordSpan[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.index < last.index + last.length) {
      const end = Math.max(last.index + last.length, s.index + s.length);
      last.length = end - last.index;
      last.heat += s.heat;
    } else {
      merged.push({ ...s });
    }
  }
  return merged
    .sort((a, b) => b.heat - a.heat)
    .slice(0, SPAN_CAP)
    .sort((a, b) => a.index - b.index);
}

// ── The prompt ────────────────────────────────────────────────────────────────

/** The system prompt every shell's reword model runs under. Engine data so the
 *  behaviour cannot drift between shells; tuned in plans/127 WP4 (the one-shot
 *  example anchors both format and brevity for a 360M model, which otherwise
 *  echoes the sentence back or drifts into meta-instructions). */
export const REWORD_SYSTEM_PROMPT =
  'You rewrite sentences. Rewrite the sentence the user sends so it is shorter and plainer, '
  + 'the way a person would say it. Keep the meaning. Keep every name, number, date and link '
  + 'exactly as written. Do not add new information, opinions or hedges. '
  + 'Reply with the rewritten sentence only - no quotes, no preamble, no explanation.\n'
  + 'Example:\n'
  + 'Sentence: It is important to note that our solution leverages cutting-edge technology in order to deliver outstanding results for customers.\n'
  + 'Rewrite: Our solution uses new technology to get customers results.';

export interface RewordMessage {
  role: 'system' | 'user';
  content: string;
}

/** The chat messages for one sentence. */
export function buildRewordMessages(sentence: string): RewordMessage[] {
  return [
    { role: 'system', content: REWORD_SYSTEM_PROMPT },
    { role: 'user', content: sentence.trim() },
  ];
}

// ── The gate ──────────────────────────────────────────────────────────────────

/** Why a candidate was refused; empty `reasons` means it may be offered. */
export interface RewordVerdict {
  ok: boolean;
  reasons: string[];
  /** The candidate as judged (trimmed). */
  text: string;
  /** The candidate's analyser score, for ranking survivors. */
  score: number;
}

/** A gated, offerable candidate. */
export interface RewordCandidate {
  text: string;
  score: number;
}

/** First line of a model reply, minus wrapper noise (a label, quotes). */
export function normalizeRewordReply(raw: string): string {
  let s = raw.trim();
  const firstLine = s.split('\n').find((l) => l.trim().length > 0) ?? '';
  s = firstLine.trim();
  s = s.replace(/^(?:rewritten?|rewrite|answer|output|sentence|shorter(?: version)?)\s*[:\-–]\s*/i, '');
  const pairs: Array<[string, string]> = [['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’']];
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close) && s.length > 1) { s = s.slice(1, -1).trim(); break; }
  }
  return s;
}

const squash = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

const numbersOf = (s: string): string[] =>
  (s.match(/\d+(?:[.,]\d+)*%?/g) ?? []).map((n) => n.replace(/[.,]$/, ''));
const urlsOf = (s: string): string[] =>
  (s.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []).map((u) => u.replace(/[).,;!?]+$/, '').toLowerCase());
const emailsOf = (s: string): string[] =>
  (s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => e.toLowerCase());

/** Capitalised tokens that look like names/acronyms. Sentence-initial words -
 *  the first token, and any token following . ! ? or a newline - are skipped
 *  (sentence case, not identity) UNLESS all-caps acronyms; "I" and its
 *  contractions never count. */
function nameTokens(s: string): Set<string> {
  const out = new Set<string>();
  const re = /[A-Za-z][A-Za-z0-9'’-]*/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = re.exec(s))) {
    const tok = m[0];
    const between = s.slice(0, m.index);
    const atSentenceStart = first || /[.!?]["'“”‘’)\]]*\s*$|\n\s*$/.test(between);
    first = false;
    if (!/^[A-Z]/.test(tok)) continue;
    if (tok === 'I' || /^I['’]/.test(tok)) continue;
    if (atSentenceStart && !/^[A-Z0-9'’-]{2,}$/.test(tok)) continue;
    out.add(tok);
  }
  return out;
}

/** Lowercased content words (4+ letters) - the off-topic guard's vocabulary. */
function contentWords(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? []));
}

/**
 * Judge one CLEANED candidate against the sentence it would replace. Callers
 * run `normalizeRewordReply` + `humanizeText` first (sample → clean → gate);
 * `rewordCandidates` below does the whole pipeline. Checks, all required:
 * non-trivial, no longer, still ABOUT the same thing (a quarter of the
 * original's content words must survive, and the candidate can't collapse
 * below a quarter of the length - the guard that refuses a model's degenerate
 * meta-reply), numbers/links/emails unchanged (both directions - dropping one
 * loses meaning, inventing one is hallucination), names survive and none
 * appear, analyser score no hotter, and never an artifact-tier finding (a
 * model that leaks scaffolding or invisible characters is refused outright).
 */
export function rewordGate(original: string, candidate: string): RewordVerdict {
  const o = original.trim();
  const c = candidate.trim();
  const reasons: string[] = [];
  if (!c) return { ok: false, reasons: ['empty'], text: c, score: 0 };
  if (squash(c) === squash(o)) reasons.push('unchanged');
  if (c.length > o.length) reasons.push('longer');
  if (c.length < o.length * 0.25) reasons.push('too-short');
  const oWords = contentWords(o);
  if (oWords.size >= 4) {
    const cWords = contentWords(c);
    let kept = 0;
    for (const w of oWords) if (cWords.has(w)) kept++;
    if (kept / oWords.size < 0.25) reasons.push('off-topic');
  }
  if (
    !multisetEqual(numbersOf(o), numbersOf(c))
    || !multisetEqual(urlsOf(o), urlsOf(c))
    || !multisetEqual(emailsOf(o), emailsOf(c))
  ) reasons.push('facts-changed');
  const oNames = nameTokens(o);
  const cNames = nameTokens(c);
  if (![...oNames].every((n) => c.includes(n)) || ![...cNames].every((n) => oNames.has(n) || o.includes(n))) {
    reasons.push('names-changed');
  }
  const or = analyzeTextSignals(o, { source: 'digital' });
  const cr = analyzeTextSignals(c, { source: 'digital' });
  if (cr.findings.some((f) => f.tier === 'artifact')) reasons.push('artifact');
  if (cr.score > or.score) reasons.push('not-calmer');
  return { ok: reasons.length === 0, reasons, text: c, score: cr.score };
}

/**
 * The whole pipeline for a batch of raw model replies: normalise → deterministic
 * clean → gate → dedupe → rank (calmer first, then shorter). What comes back is
 * exactly what a shell may offer.
 */
export function rewordCandidates(original: string, raws: readonly string[]): RewordCandidate[] {
  const seen = new Set<string>();
  const out: RewordCandidate[] = [];
  for (const raw of raws) {
    const cleaned = humanizeText(normalizeRewordReply(raw)).text;
    const v = rewordGate(original, cleaned);
    if (!v.ok) continue;
    const key = squash(v.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: v.text, score: v.score });
  }
  return out.sort((a, b) => a.score - b.score || a.text.length - b.text.length);
}
