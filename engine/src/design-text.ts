// SPDX-License-Identifier: MPL-2.0
/**
 * Formatted source text to Design's text subset and back (plan 275 section 7.2).
 *
 * Design's text boxes read a small markdown subset: `**bold**`, `*italic*` (and
 * `_italic_`), one attribute run `{#rrggbb wNNN mono u s|...}` for colour, an
 * explicit weight, the mono face, underline and strike, and a line that starts
 * with `- ` or `N. ` is a list item, with leading spaces for its level. The
 * oracle is what Design draws, `inlineMd` and `richLine` in
 * `community/_shared/design-renderer.js`, and this module follows its regular
 * expressions exactly, so a serialised string renders the runs it was made from:
 *
 *   - `\*\*([^*]+)\*\*` means a bold run holds no bare `*`, so every literal `*`
 *     and `_` is written with a backslash, which the renderer parks before it
 *     reads emphasis;
 *   - `\{([^|{}]+)\|([^{}]*)\}` means an attribute run holds no brace, so a run
 *     with attributes is cut at every literal brace, and a literal `{u|x}` in
 *     plain text has its pipe written as `{wNNN||}` so it stays text;
 *   - a line that is not a list item but starts like one has its marker wrapped
 *     the same way, so it stays text.
 *
 * `designTextOf` writes the subset from `SourceParaV1` paragraphs,
 * `designTextFromPlain` writes a person's corrected text in place of the source
 * runs, and `parseDesignText` reads the subset back into lines of runs for the
 * preview and the pptx lowerings. `escapeMarkup` and `hugMarkers` are the escape
 * and emphasis helpers `deck-md.ts` shares, so the two emitters cannot drift.
 *
 * Pure: no DOM, no clock, no network. The same input gives the same string.
 */

import type { SourceParaV1, SourceRunV1 } from '@lolly-tools/core';

// ─── shared helpers ──────────────────────────────────────────────────────────

/**
 * Escape the characters that change parsing in one target.
 *
 * `gfm` is GitHub markdown and deck-studio's `parseRuns`: the backslash itself
 * and `*` (a lone `_` is inert there). `design` is Design's renderer, which
 * parks `\*` and `\_` and has no escape for the backslash, so there `*` and `_`
 * are escaped and a backslash is left as it is.
 */
export function escapeMarkup(s: string, target: 'gfm' | 'design'): string {
  if (target === 'gfm') return s.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');
  return s.replace(/([*_])/g, '\\$1');
}

/**
 * Wrap text in a pair of markers with its leading and trailing white space kept
 * outside, which is what both GFM (no space inside the emphasis) and Design's
 * renderer (formatting on white space draws nothing) want. Text that is only
 * white space comes back unwrapped.
 */
export function hugMarkers(text: string, open: string, close: string = open): string {
  if (!open && !close) return text;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const core = m?.[2] ?? text;
  if (!core) return text;
  return `${m?.[1] ?? ''}${open}${core}${close}${m?.[3] ?? ''}`;
}

// ─── the renderer's own grammar ──────────────────────────────────────────────

const HEX_TOKEN = /^#[0-9a-fA-F]{3,8}$/;
const WEIGHT_TOKEN = /^w[1-9]00$/;

/** Would Design read this attribute list as an attribute run? The rule of `inlineMd`. */
function validAttrs(attrs: string): boolean {
  const toks = attrs.trim().split(/\s+/);
  if (toks.length === 0 || (toks.length === 1 && toks[0] === '')) return false;
  for (const tok of toks) {
    if (HEX_TOKEN.test(tok) || WEIGHT_TOKEN.test(tok) || tok === 'mono' || tok === 'sans' || tok === 'u' || tok === 's') continue;
    return false;
  }
  return true;
}

const BULLET_LINE = /^(\s*)[-*•]\s+([\s\S]*)$/;
const NUMBER_LINE = /^(\s*)(\d{1,3})\.\s+([\s\S]*)$/;
const ATTR_RUN = /\{([^|{}]+)\|([^{}]*)\}/g;

// ─── writing the subset ──────────────────────────────────────────────────────

export interface DesignTextOptsV1 {
  /**
   * Write run colours at all. False on the renovated path, where the archetype
   * ink is the base colour; there a run in another colour is emphasis, and it is
   * carried only when `mapColour` answers for it.
   */
  carryColour?: boolean;
  /**
   * The colour a source hex becomes (the plan's use to target), or undefined for
   * a colour nothing maps. Called with a lowercase `#rrggbb`.
   */
  mapColour?: (hex: string) => string | undefined;
  /**
   * The row weight the text is drawn at. A marker wrapped to stay text is drawn
   * at it, and a bold run needs no marker when the row is already this bold.
   * Defaults to 400.
   */
  rowWeight?: number;
  /**
   * The target master's slot sets the type: its sizes, its paragraph spacing and its
   * bullet glyph. True on the renovated path, where the source's own sizes, spacing
   * and glyph are replaced on purpose, so they are not listed in `dropped`: listing
   * them on nearly every object would bury the entries that matter.
   */
  masterSetsType?: boolean;
}

/** What `designTextOf` found and wrote. */
export interface DesignTextResultV1 {
  /** The text in Design's subset. */
  text: string;
  /** The same text with no markup, one line per paragraph and per soft line break: what an estimate measures. */
  plain: string;
  /** The alignment most of the characters are set in, when the source states one. */
  align?: 'left' | 'center' | 'right' | 'justify';
  /** The colour most of the characters are set in, lowercase `#rrggbb`, when every run states one. */
  baseColour?: string;
  /**
   * Source properties Design's subset has no token for, in plain words and in the
   * fixed order of `DROPPED_ORDER`. Empty when everything was carried.
   */
  dropped: string[];
}

/**
 * The order the dropped words are listed in, so two hosts write the same sentence.
 * `bold`, `italic`, `underline` and `strike` are only ever dropped by a correction,
 * which writes plain words in place of the source runs.
 */
export const DROPPED_ORDER = [
  'bold', 'italic', 'underline', 'strike',
  'sizes', 'superscript', 'subscript', 'letter case', 'links', 'spacing', 'underline style',
  'numbering style', 'bullet glyph', 'colours',
] as const;
export type DroppedFormattingV1 = (typeof DROPPED_ORDER)[number];
type DroppedV1 = DroppedFormattingV1;

/** The numbering Design draws: `1.`, `2.`, in arabic figures with a period. */
const DRAWN_NUMBER_STYLE = 'arabicPeriod';

/** Bullet glyphs Design's round bullet stands for without a visible change. */
const PLAIN_BULLETS: ReadonlySet<string> = new Set(['\u2022', '\u25cf', '\u00b7', '\u2219']);

interface RunFormatV1 {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string | null;
}

function hexOf(run: SourceRunV1): string | null {
  const hex = run.color?.hex;
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{6})/.exec(hex.trim());
  return m?.[1] ? `#${m[1].toLowerCase()}` : null;
}

/** The value most characters carry, first seen on a tie; undefined when nothing carries one. */
function dominant<T>(pairs: Array<{ value: T | undefined; weight: number }>): T | undefined {
  const tally = new Map<T, number>();
  let best: T | undefined;
  let bestN = 0;
  for (const { value, weight } of pairs) {
    if (value === undefined) continue;
    const n = (tally.get(value) ?? 0) + weight;
    tally.set(value, n);
    if (n > bestN) {
      best = value;
      bestN = n;
    }
  }
  return best;
}

/** One run's text with every literal `{a|b}` Design would read as markup broken at its pipe. */
function breakLiteralRuns(text: string, weight: number): string {
  return text.replace(ATTR_RUN, (whole: string, attrs: string, inner: string) =>
    (validAttrs(attrs) ? `{${attrs}{w${weight}||}${inner}}` : whole));
}

/**
 * An empty attribute run. It draws nothing and the parser reads no run from it,
 * but it stands between two characters the grammar would otherwise read together:
 * the closing marker of one emphasis and the opening marker of the next (`*A*`
 * then `***B***` would read as `*A****B***`), or a literal backslash and the
 * marker after it, which the renderer would read as an escaped star.
 */
function separator(weight: number): string {
  return `{w${weight}|}`;
}

/** Serialise one run of text in one format. `lineStart` protects a list marker the text starts with. */
function serialiseSegment(text: string, fmt: RunFormatV1, rowWeight: number, lineStart: boolean): string {
  const emphasis = fmt.bold && fmt.italic ? '***' : fmt.bold ? '**' : fmt.italic ? '*' : '';
  const weight = fmt.bold ? 700 : rowWeight;
  const attrs: string[] = [];
  if (fmt.color) attrs.push(fmt.color);
  if (fmt.underline) attrs.push('u');
  if (fmt.strike) attrs.push('s');
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const lead = m?.[1] ?? '';
  const core = m?.[2] ?? text;
  const tail = m?.[3] ?? '';
  if (!core) return text;

  if (attrs.length === 0) {
    let body = breakLiteralRuns(escapeMarkup(core, 'design'), weight);
    if (!emphasis) {
      // A plain line that starts like a list item would be read as one.
      if (lineStart) {
        const bullet = /^([-•])(\s)/.exec(body);
        const number = /^(\d{1,3})(\.\s)/.exec(body);
        if (bullet?.[1]) body = `{w${rowWeight}|${bullet[1]}}${body.slice(1)}`;
        else if (number?.[1]) body = `{w${rowWeight}|${number[1]}}${body.slice(number[1].length)}`;
      }
    } else if (body.endsWith('\\')) {
      // A backslash right before the closing marker would escape it.
      body += separator(weight);
    }
    return `${lead}${emphasis}${body}${emphasis}${tail}`;
  }

  // An attribute run holds no brace, so the core is cut at every literal brace:
  // each piece of words gets its own attribute run and the braces stay bare between
  // them. The emphasis wraps the whole core from outside. Both parsers read the
  // attribute runs first, so the markers see only the runs between them, and a
  // backslash at the end of a piece is followed by the run's closing brace, never
  // by a marker.
  const head = `{${attrs.join(' ')}|`;
  let out = '';
  for (const piece of core.split(/([{}])/)) {
    if (!piece) continue;
    if (piece === '{' || piece === '}') {
      out += piece;
      continue;
    }
    const m2 = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece);
    const inner = m2?.[2] ?? piece;
    if (!inner) {
      out += piece;
      continue;
    }
    out += `${m2?.[1] ?? ''}${head}${escapeMarkup(inner, 'design')}}${m2?.[3] ?? ''}`;
  }
  return `${lead}${emphasis}${out}${emphasis}${tail}`;
}

function sameFormat(a: RunFormatV1, b: RunFormatV1): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.color === b.color;
}

/**
 * A paragraph's runs as lines of the subset: its first line, then one more line
 * for every soft line break (a `\n` inside a run, which is how the reader writes
 * `a:br`). Two neighbouring segments whose markers would touch are kept apart by
 * an empty attribute run.
 */
function serialiseRuns(runs: readonly SourceRunV1[], formatOf: (run: SourceRunV1) => RunFormatV1, rowWeight: number): string[] {
  const lines: Array<Array<{ text: string; fmt: RunFormatV1 }>> = [[]];
  for (const run of runs) {
    const parts = run.text.replace(/\r\n?/g, '\n').split('\n');
    const fmt = formatOf(run);
    parts.forEach((text, k) => {
      if (k > 0) lines.push([]);
      if (!text) return;
      const segments = lines[lines.length - 1] as Array<{ text: string; fmt: RunFormatV1 }>;
      const last = segments[segments.length - 1];
      if (last && sameFormat(last.fmt, fmt)) last.text += text;
      else segments.push({ text, fmt });
    });
  }
  return lines.map((segments) => {
    let out = '';
    segments.forEach((seg, i) => {
      const piece = serialiseSegment(seg.text, seg.fmt, rowWeight, i === 0);
      if (piece.startsWith('*') && (out.endsWith('*') || out.endsWith('\\'))) out += separator(rowWeight);
      out += piece;
    });
    return out;
  });
}

/**
 * Serialise source paragraphs to Design's subset.
 *
 * A `bullet` paragraph is written `- `, a `number` one `N. ` with its number
 * counted per list and level (restarting after a paragraph that is not in the
 * list), and every level past the first adds two leading spaces. A soft line
 * break starts a new line that carries no marker: under the words of a list item,
 * one level in, and at the paragraph's own indent otherwise. Bold, italic,
 * underline and strike travel per run; a colour travels per run on the faithful
 * path and, on the renovated path, only when the plan maps it. What has no token
 * is listed in `dropped` for one report entry per object.
 */
export function designTextOf(paras: readonly SourceParaV1[], opts: DesignTextOptsV1 = {}): DesignTextResultV1 {
  const rowWeight = typeof opts.rowWeight === 'number' && opts.rowWeight > 0 ? Math.round(opts.rowWeight / 100) * 100 : 400;
  const dropped = new Set<DroppedV1>();
  const masterSetsType = opts.masterSetsType === true;

  // The base colour and the base size: what most characters carry.
  const weighted = paras.flatMap((para) => para.runs.map((run) => ({ run, weight: run.text.trim().length })));
  const baseColour = weighted.every(({ run, weight }) => weight === 0 || hexOf(run) !== null)
    ? dominant(weighted.map(({ run, weight }) => ({ value: hexOf(run) ?? undefined, weight })))
    : undefined;
  const sizes = new Set(weighted.filter(({ weight }) => weight > 0).map(({ run }) => run.sizePt).filter((pt): pt is number => typeof pt === 'number'));
  if (sizes.size > 1 && !masterSetsType) dropped.add('sizes');
  // A paragraph that states no alignment is set left, which is the format's own default.
  const stated = paras.some((para) => para.align !== undefined);
  const align = stated
    ? dominant(paras.map((para) => ({ value: para.align ?? 'left', weight: para.runs.reduce((n, run) => n + run.text.length, 0) })))
    : undefined;

  const formatOf = (run: SourceRunV1): RunFormatV1 => {
    let color: string | null = null;
    const hex = hexOf(run);
    if (hex && hex !== baseColour) {
      if (opts.carryColour) color = opts.mapColour?.(hex) ?? hex;
      else {
        const mapped = opts.mapColour?.(hex);
        if (mapped) color = mapped;
        else if (run.text.trim()) dropped.add('colours');
      }
      if (color) {
        const m = /^#?([0-9a-fA-F]{6})/.exec(color);
        color = m?.[1] ? `#${m[1].toLowerCase()}` : null;
      }
    }
    if (run.text.trim()) {
      if (run.baseline === 'super') dropped.add('superscript');
      if (run.baseline === 'sub') dropped.add('subscript');
      if (run.case) dropped.add('letter case');
      if (run.href) dropped.add('links');
      if (run.underlineStyle) dropped.add('underline style');
    }
    return {
      bold: run.bold === true && rowWeight < 600,
      italic: run.italic === true,
      underline: run.underline === true,
      strike: run.strike === true,
      color,
    };
  };

  const counters: number[] = [];
  const lines: string[] = [];
  const plain: string[] = [];
  for (const para of paras) {
    const level = Math.max(0, Math.min(8, para.lvl ?? 0));
    counters.length = Math.min(counters.length, level + 1);
    let prefix = '';
    if (para.bullet === 'number') {
      const next = counters[level] !== undefined ? (counters[level] as number) + 1 : Math.max(1, para.numberStart ?? 1);
      counters[level] = next;
      prefix = `${next}. `;
    } else {
      counters.length = Math.min(counters.length, level);
      if (para.bullet === 'bullet') prefix = '- ';
    }
    const worded = para.runs.some((run) => run.text.trim());
    if (worded && !masterSetsType && ((para.spaceBeforePt ?? 0) > 0 || (para.spaceAfterPt ?? 0) > 0
      || (para.lineSpacingPct !== undefined && Math.abs(para.lineSpacingPct - 100) > 0.5))) {
      dropped.add('spacing');
    }
    // Design draws `1.` and a round bullet. Another numbering (`a)`, `iv.`) says
    // something about the list, so it is named on both paths; another glyph is the
    // master's to set on the renovated path.
    if (worded && para.bullet === 'number' && para.numberStyle && para.numberStyle !== DRAWN_NUMBER_STYLE) dropped.add('numbering style');
    if (worded && !masterSetsType && para.bullet === 'bullet' && para.bulletChar && !PLAIN_BULLETS.has(para.bulletChar)) dropped.add('bullet glyph');
    const indent = '  '.repeat(level);
    const [first = '', ...rest] = serialiseRuns(para.runs, formatOf, rowWeight);
    // A list item keeps its marker even when its text is empty; a plain empty line stays empty.
    lines.push(prefix ? `${indent}${prefix}${first}` : first ? `${indent}${first}` : '');
    const hang = prefix ? '  '.repeat(Math.min(9, level + 1)) : indent;
    for (const more of rest) lines.push(more ? `${hang}${more}` : '');
    plain.push(para.runs.map((run) => run.text).join('').replace(/\r\n?/g, '\n'));
  }

  const result: DesignTextResultV1 = {
    text: lines.join('\n'),
    plain: plain.join('\n'),
    dropped: DROPPED_ORDER.filter((word) => dropped.has(word)),
  };
  if (align) result.align = align;
  if (baseColour) result.baseColour = baseColour;
  return result;
}

/**
 * A person's corrected text in Design's subset: plain words with no formatting,
 * each line keeping the list kind and level of the source line in the same place,
 * so a corrected bullet list is still a list. The source's lines are its
 * paragraphs and, inside one, its soft line breaks, which is how a correction
 * field shows the words; a line in the place of a soft break stays a line of the
 * paragraph above it, with no marker. Lines past the source's take the kind of
 * its last paragraph.
 */
export function designTextFromPlain(text: string, paras: readonly SourceParaV1[] = [], rowWeight = 400): string {
  const slots: Array<{ para: number; continues: boolean }> = [];
  paras.forEach((para, p) => {
    const breaks = para.runs.reduce((n, run) => n + (run.text.replace(/\r\n?/g, '\n').match(/\n/g)?.length ?? 0), 0);
    slots.push({ para: p, continues: false });
    for (let k = 0; k < breaks; k += 1) slots.push({ para: p, continues: true });
  });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const rebuilt: SourceParaV1[] = [];
  lines.forEach((line, i) => {
    const slot = slots[i];
    const last = rebuilt[rebuilt.length - 1];
    if (slot?.continues && last?.runs[0]) {
      last.runs[0].text += `\n${line}`;
      return;
    }
    const kind = paras[slot ? slot.para : paras.length - 1];
    const para: SourceParaV1 = { runs: [{ text: line }] };
    if (kind?.bullet) para.bullet = kind.bullet;
    if (kind && (kind.lvl ?? 0) > 0) para.lvl = kind.lvl;
    if (kind?.numberStart !== undefined) para.numberStart = kind.numberStart;
    rebuilt.push(para);
  });
  return designTextOf(rebuilt, { rowWeight }).text;
}

/**
 * What a correction leaves behind: the formatting the source runs carry that a
 * correction's plain words do not, in the words and order of `dropped`. Empty when
 * the source was plain.
 */
export function correctionDrops(paras: readonly SourceParaV1[]): string[] {
  const found = new Set<DroppedV1>();
  const worded = paras.flatMap((para) => para.runs).filter((run) => run.text.trim());
  const hexes = new Set(worded.map((run) => hexOf(run) ?? ''));
  for (const run of worded) {
    if (run.bold) found.add('bold');
    if (run.italic) found.add('italic');
    if (run.underline) found.add('underline');
    if (run.strike) found.add('strike');
    if (run.href) found.add('links');
  }
  if (hexes.size > 1) found.add('colours');
  return DROPPED_ORDER.filter((word) => found.has(word));
}

// ─── reading the subset ──────────────────────────────────────────────────────

/** One run of a parsed line, as Design draws it. */
export interface DesignTextRunV1 {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** A colour an attribute run states, as written (`#rrggbb` or a short hex). */
  color?: string;
  /** An explicit weight an attribute run states, 100 to 900. */
  weight?: number;
  /** `mono` or `sans`, when an attribute run names one. */
  font?: 'mono' | 'sans';
}

/**
 * One parsed line: its list marker, its level and its runs. A list line's runs
 * leave out the marker and the indent before it; a plain line's runs keep its
 * leading spaces, because Design draws them.
 */
export interface DesignTextLineV1 {
  /** `bullet` for a `- `, `* ` or `• ` line, `number` for an `N. ` line. */
  list?: 'bullet' | 'number';
  /** The number an `N. ` line states. */
  number?: number;
  /** Leading spaces before the marker, or before the text of a plain line. */
  indent: number;
  /** `indent` as an outline level: two spaces per level. */
  level: number;
  runs: DesignTextRunV1[];
}

// Sentinels for the tags the renderer would emit. Private-use code points, which
// the input is stripped of first, so text can never forge one.
const PARK_STAR = '\u0001';
const PARK_UNDERSCORE = '\u0002';
const B_OPEN = '\uE000';
const B_CLOSE = '\uE001';
const I_OPEN = '\uE002';
const I_CLOSE = '\uE003';
const S_OPEN = '\uE004';
const S_CLOSE = '\uE005';
const SENTINELS: ReadonlySet<string> = new Set([PARK_STAR, PARK_UNDERSCORE, B_OPEN, B_CLOSE, I_OPEN, I_CLOSE, S_OPEN, S_CLOSE]);

/** The text with every sentinel character taken out, so input can never forge one. */
function withoutSentinels(text: string): string {
  let out = '';
  for (const ch of text) if (!SENTINELS.has(ch)) out += ch;
  return out;
}

interface SpanFormatV1 {
  color?: string;
  weight?: number;
  font?: 'mono' | 'sans';
  underline?: boolean;
  strike?: boolean;
}

/** `inlineMd`, with sentinels in place of tags, walked into runs. */
function parseInline(source: string): DesignTextRunV1[] {
  const spans: SpanFormatV1[] = [];
  let s = withoutSentinels(source).replace(/\\\*/g, PARK_STAR).replace(/\\_/g, PARK_UNDERSCORE);
  s = s.replace(ATTR_RUN, (whole: string, attrs: string, inner: string) => {
    if (!validAttrs(attrs)) return whole;
    const span: SpanFormatV1 = {};
    for (const tok of attrs.trim().split(/\s+/)) {
      if (HEX_TOKEN.test(tok)) span.color = tok;
      else if (WEIGHT_TOKEN.test(tok)) span.weight = Number(tok.slice(1));
      else if (tok === 'mono' || tok === 'sans') span.font = tok;
      else if (tok === 'u') span.underline = true;
      else if (tok === 's') span.strike = true;
    }
    spans.push(span);
    return `${S_OPEN}${String.fromCharCode(0xe100 + spans.length - 1)}${inner}${S_CLOSE}`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, `${B_OPEN}$1${B_CLOSE}`);
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, `$1${I_OPEN}$2${I_CLOSE}`);
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, `$1${I_OPEN}$2${I_CLOSE}`);

  const runs: DesignTextRunV1[] = [];
  let bold = 0;
  let italic = 0;
  let span: SpanFormatV1 | undefined;
  let text = '';
  const flush = (): void => {
    if (!text) return;
    const run: DesignTextRunV1 = { text: text.split(PARK_STAR).join('*').split(PARK_UNDERSCORE).join('_') };
    if (bold > 0) run.bold = true;
    if (italic > 0) run.italic = true;
    if (span?.underline) run.underline = true;
    if (span?.strike) run.strike = true;
    if (span?.color) run.color = span.color;
    if (span?.weight !== undefined) run.weight = span.weight;
    if (span?.font) run.font = span.font;
    const last = runs[runs.length - 1];
    if (last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...run, text: '' })) last.text += run.text;
    else runs.push(run);
    text = '';
  };
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i] as string;
    if (ch === B_OPEN || ch === B_CLOSE || ch === I_OPEN || ch === I_CLOSE || ch === S_OPEN || ch === S_CLOSE) {
      flush();
      if (ch === B_OPEN) bold += 1;
      else if (ch === B_CLOSE) bold = Math.max(0, bold - 1);
      else if (ch === I_OPEN) italic += 1;
      else if (ch === I_CLOSE) italic = Math.max(0, italic - 1);
      else if (ch === S_OPEN) {
        span = spans[(s.charCodeAt(i + 1) - 0xe100)];
        i += 1;
      } else span = undefined;
      continue;
    }
    text += ch;
  }
  flush();
  return runs;
}

/** Parse one line the way `richLine` reads it. */
export function parseDesignLine(line: string): DesignTextLineV1 {
  const bullet = BULLET_LINE.exec(line);
  if (bullet) {
    const indent = (bullet[1] ?? '').length;
    return { list: 'bullet', indent, level: Math.floor(indent / 2), runs: parseInline(bullet[2] ?? '') };
  }
  const number = NUMBER_LINE.exec(line);
  if (number) {
    const indent = (number[1] ?? '').length;
    return { list: 'number', number: Number(number[2]), indent, level: Math.floor(indent / 2), runs: parseInline(number[3] ?? '') };
  }
  // A plain line keeps its leading spaces as text, which is what Design draws.
  const indent = (/^ */.exec(line)?.[0] ?? '').length;
  return { indent, level: Math.floor(indent / 2), runs: parseInline(line) };
}

/** Parse Design text into lines of runs, one per `\n`. */
export function parseDesignText(text: string): DesignTextLineV1[] {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(parseDesignLine);
}

/** The words Design draws for a text, with no markup and no list markers: what a measure reads. */
export function plainOfDesignText(text: string): string {
  return parseDesignText(text).map((line) => line.runs.map((run) => run.text).join('')).join('\n');
}

/** Does this text use the subset's markup at all? A string without it draws exactly as written. */
export function hasDesignMarkup(text: string): boolean {
  const s = String(text ?? '');
  if (/[*_\\]/.test(s)) return true;
  if (/\{[^|{}]+\|[^{}]*\}/.test(s)) return true;
  return s.split('\n').some((line) => BULLET_LINE.test(line) || NUMBER_LINE.test(line));
}
