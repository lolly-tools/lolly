// SPDX-License-Identifier: MPL-2.0
/**
 * Measure a plain Design text layer before it is drawn (plan 291, W5): where its
 * lines break, how tall the text is, and whether its box clips the text.
 *
 * Design draws a plain text layer with the DOM: a `.lolly-box` flex container
 * holding a `.lolly-box-text` block with `white-space: pre-wrap`,
 * `overflow-wrap: anywhere` and a unitless line height, styled by `textCss` in
 * `community/_shared/design-renderer.js`. This module is that layout written out:
 *
 *   - the renderer's defaults and clamps (size 48 rounded, weight 700 rounded to
 *     100 and capped at 800 for mono, line height 1.12 clamped to 0.5 to 4, padding
 *     8 rounded and clamped to 0 to 400, tracking clamped to -100 to 400, valign
 *     middle), and a border inside the box for a stroke;
 *   - the text subset read by `parseDesignText`, the twin of the renderer's
 *     `richRuns`: a list line draws its indent and `•  ` or `N.  `, bold is CSS
 *     `bolder` of the layer weight, `{wNNN|}` sets a weight, `{mono|}` and
 *     `{sans|}` a face, and an italic run uses the brand italic face in every box
 *     (the shell's `em` rule reaches the canvas);
 *   - each run shaped as a whole by the injected shaper, ligatures off when
 *     tracking is set (Chromium does that) or when the layer turns them off;
 *   - greedy breaking at Chromium's line break opportunities (`chromiumBreakOffsets`:
 *     its ASCII pair table, then UAX #14 wherever a character is not ASCII), with
 *     trailing spaces hanging, and a word wider than the line cut between graphemes;
 *   - Chromium's line box: `floor(lineHeight * size * 64) / 64`, ascent and descent
 *     rounded to whole px, the top half-leading floored, so the last line's glyphs
 *     can reach below its line box and into `scrollHeight`, which is what the
 *     mounted audit compares with the box's `clientHeight`.
 *
 * Shaping and font files are the host's: `measureDesignText(spec, shaper)` takes a
 * `TextShaperV1`, and `@lolly-tools/node-shell/text-measure` supplies one over
 * HarfBuzz and the faces the canvas loads. Against the real Design tool the breaks
 * agreed on 375 of 376 boxes, with `scrollHeight` equal wherever the breaks agreed.
 *
 * Pure: no DOM, no clock, no I/O beyond the shaper. Text story layers are composed
 * by `composeText` and are not measured here.
 */

import type {
  TextMeasureBreakV1,
  TextMeasureFaceV1,
  TextMeasureFontsV1,
  TextMeasureLineV1,
  TextMeasureSpecV1,
  TextMeasureV1,
  TextMeasureValignV1,
} from '@lolly-tools/core';
import { parseDesignText } from './design-text.ts';
import { textBreakOpportunities } from './text-unicode.ts';
import { textBoundaries } from './text-source.ts';

/** One run to shape: a face, a size and the run's text. */
export interface TextShapeRunV1 {
  text: string;
  family: string;
  weight: number;
  italic: boolean;
  size: number;
  /** Letter spacing in px, added after every character, the last included, as Chromium does. */
  tracking: number;
  /** OpenType feature settings as `tag=value` (`liga=0`, `salt=1`). */
  features: string[];
}

/** A face's vertical metrics in font units: `ascent` above the baseline and `descent` under the baseline, both positive. */
export interface TextFontMetricsV1 {
  upem: number;
  ascent: number;
  descent: number;
}

/** What a shaper returns for one run. */
export interface TextShapeResultV1 {
  /** The advance of each UTF-16 index, px, a cluster's advance on its first index and 0 on the rest. */
  advances: number[];
  total: number;
  /**
   * UTF-16 indices of characters the face has no glyph for. A browser draws those in
   * a fallback face, so their advances here are the face's missing-glyph box.
   */
  missing?: number[];
  font: {
    file: string;
    variations?: Record<string, number>;
    /** The face's vertical metrics as Chromium reads them (typo metrics when the face says to use them, else hhea). */
    metrics?: TextFontMetricsV1;
  };
}

/**
 * Shapes one run. A face that cannot be found is a `TextMeasureError` with code
 * `font.unavailable`, never a silent substitute.
 */
export type TextShaperV1 = (run: TextShapeRunV1) => Promise<TextShapeResultV1>;

export type TextMeasureErrorCode = 'input.invalid' | 'font.unavailable';

/** A measure that cannot be taken, with a stable code a caller branches on. */
export class TextMeasureError extends Error {
  readonly code: TextMeasureErrorCode;
  constructor(code: TextMeasureErrorCode, message: string) {
    super(message);
    this.name = 'TextMeasureError';
    this.code = code;
  }
}

/**
 * The platform faces, as the web shell's `--font-*` variables fall back to them
 * (`FONT_SLOTS` in shells/web/src/brand-vars.ts): the faces a canvas with no design
 * system draws in. Both are OFL faces shipped under shells/web/public/fonts.
 */
export const TEXT_MEASURE_DEFAULT_FONTS: Readonly<TextMeasureFontsV1> = Object.freeze({ brand: 'SUSE', mono: 'SUSE Mono' });

/** The renderer's defaults for a field a row leaves out (`textCss`, `weightOf`, `boxCss`). */
export const TEXT_MEASURE_DEFAULTS = Object.freeze({ size: 48, weight: 700, lineHeight: 1.12, pad: 8, valign: 'middle' as TextMeasureValignV1 });

/** Longest text one measure takes, in UTF-16 units: the Unicode tables' own limit. */
export const TEXT_MEASURE_MAX_UNITS = 65536;

const EPSILON = 0.01;
const VALIGNS: readonly string[] = ['top', 'middle', 'bottom'];
/** Space that hangs at a line end in `pre-wrap`; no-break spaces do not. */
const HANGING = /[\t   -  -  　]/;

/** A number read the way the renderer's `num` reads one: `parseFloat`, so `'60px'` is 60. */
const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;
/** CSS `font-weight: bolder` of a numeric weight. */
const bolder = (weight: number): number => (weight < 350 ? 400 : weight < 550 ? 700 : 900);

/** The layer weight, read the way `weightOf` reads a row's weight. */
function layerWeight(weight: unknown, font: string): number {
  let w = clamp(Math.round(num(weight, TEXT_MEASURE_DEFAULTS.weight) / 100) * 100, 100, 900);
  if (/mono/i.test(font) && w > 800) w = 800;
  return w;
}

/** A border width as Chromium paints it at 1x: whole px, anything thinner than one becoming one. */
function borderWidth(strokeW: unknown): number {
  const sw = Math.round(num(strokeW, 0) * 100) / 100;
  if (!(sw > 0)) return 0;
  return sw < 1 ? 1 : Math.floor(sw);
}

interface Face {
  token: string;
  family: string;
  weight: number;
  italic: boolean;
}

const faceKey = (f: Face): string => `${f.family}\u0000${f.weight}\u0000${f.italic ? 1 : 0}`;

/** The family for a font token, resolved the way `fontFamily` and the shell's font variables resolve tokens. */
function familyOf(token: string, fonts: TextMeasureFontsV1): string {
  if (token === 'sans' || token === '') return fonts.brand;
  if (token === 'display') return fonts.display || fonts.brand;
  if (token === 'mono') return fonts.mono || fonts.brand;
  const safe = token.replace(/[^\w -]/g, '').trim();
  return safe || fonts.brand;
}

interface Segment {
  text: string;
  face: Face;
  /** The authored run the segment draws, for its colour and decoration; a list marker has none. */
  run?: ReturnType<typeof parseDesignText>[number]['runs'][number];
}

interface ShapedFace {
  file: string;
  variations?: Record<string, number>;
  metrics?: TextFontMetricsV1;
}

/** Validate and normalise a spec the way the renderer reads a row. */
function settle(spec: TextMeasureSpecV1) {
  if (!spec || typeof spec !== 'object') throw new TextMeasureError('input.invalid', 'A text measure needs a spec object with text and width.');
  if (typeof spec.text !== 'string') throw new TextMeasureError('input.invalid', 'text must be a string.');
  if (spec.text.length > TEXT_MEASURE_MAX_UNITS)
    throw new TextMeasureError('input.invalid', `text is ${spec.text.length} characters long; a measure takes up to ${TEXT_MEASURE_MAX_UNITS}.`);
  const width = num(spec.width, NaN);
  if (!Number.isFinite(width) || width <= 0) throw new TextMeasureError('input.invalid', 'width must be a positive number of px.');
  const height = spec.height === undefined || spec.height === null ? undefined : num(spec.height, NaN);
  if (height !== undefined && (!Number.isFinite(height) || height <= 0)) throw new TextMeasureError('input.invalid', 'height must be a positive number of px.');
  if (spec.valign !== undefined && !VALIGNS.includes(spec.valign)) throw new TextMeasureError('input.invalid', 'valign must be top, middle or bottom.');
  const fonts = spec.fonts && typeof spec.fonts.brand === 'string' && spec.fonts.brand.trim() ? spec.fonts : TEXT_MEASURE_DEFAULT_FONTS;
  const token = typeof spec.font === 'string' && spec.font.trim() ? spec.font.trim() : 'sans';
  const tracking = round2(clamp(num(spec.tracking, 0), -100, 400));
  const ligatures = spec.ligatures !== false;
  const features: string[] = [];
  if (!ligatures || tracking !== 0) features.push('liga=0', 'clig=0');
  if (spec.alternates === true) features.push('salt=1');
  const border = borderWidth(spec.strokeW);
  const boxWidth = Math.max(1, Math.round(width));
  const pad = Math.round(clamp(num(spec.pad, TEXT_MEASURE_DEFAULTS.pad), 0, 400));
  return {
    text: spec.text.replace(/\r\n?/g, '\n'),
    fonts,
    token,
    family: familyOf(token, fonts),
    weight: layerWeight(spec.weight, token),
    italic: spec.italic === true,
    plain: spec.plain === true,
    size: Math.max(1, Math.round(num(spec.size, TEXT_MEASURE_DEFAULTS.size))),
    lineHeight: clamp(num(spec.lineHeight, TEXT_MEASURE_DEFAULTS.lineHeight), 0.5, 4),
    pad,
    tracking,
    features,
    border,
    boxWidth,
    boxHeight: height === undefined ? undefined : Math.max(1, Math.round(height)),
    available: Math.max(0, boxWidth - 2 * border - 2 * pad),
    valign: (spec.valign ?? TEXT_MEASURE_DEFAULTS.valign) as TextMeasureValignV1,
  };
}

/**
 * A paragraph's drawn segments: the list marker, then each run in its face.
 *
 * Italic is the shell's `em` rule, `font-family: var(--font-italic, var(--font-brand))`,
 * so the innermost element sets the family: `*{mono|x}*` (a font run inside the
 * emphasis) draws mono italic, `{mono|*x*}` draws the italic face. `spec.italic` sets
 * every run in emphasis, the way an italic style lowers to `*...*` with the list marker
 * outside it; the layer's own face stays upright, since a layer has no italic of its own.
 * A plain text layer (`plainText`) draws its text verbatim in the layer's face.
 */
function segmentsOf(line: ReturnType<typeof parseDesignText>[number], s: ReturnType<typeof settle>): Segment[] {
  const base: Face = { token: s.token, family: s.family, weight: s.weight, italic: false };
  const italicFamily = s.fonts.italic || s.fonts.brand;
  const out: Segment[] = [];
  if (line.list) out.push({ text: `${' '.repeat(line.indent)}${line.list === 'bullet' ? '•  ' : `${line.number}.  `}`, face: base });
  for (const run of line.runs) {
    if (!run.text) continue;
    let face: Face;
    const weight = run.weight ?? (run.bold ? bolder(s.weight) : s.weight);
    if (run.italic || s.italic) {
      const fontInner = !!run.font && (run.italic ? run.fontInsideItalic === true : true);
      face = fontInner
        ? { token: run.font!, family: familyOf(run.font!, s.fonts), weight, italic: true }
        : { token: 'italic', family: italicFamily, weight, italic: true };
    } else if (run.font) face = { token: run.font, family: familyOf(run.font, s.fonts), weight, italic: false };
    else face = { ...base, weight };
    out.push({ text: run.text, face, run });
  }
  return out;
}

/** Letters, digits and most symbols: what Chromium lets a line break before after `-` or `?`. */
const PAIR_WORD = '%&(*+-0123456789<=>@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\^_`abcdefghijklmnopqrstuvwxyz{|~';
/**
 * Chromium's ASCII line break table (`kAsciiLineBreakTable` in Blink's
 * text_break_iterator.cc), read back from Chromium itself: for a printable ASCII
 * character, the printable ASCII characters that may start the next line after that
 * character. A character with no row allows no break: none after `/` (so `and/or`
 * and paths stay whole), none inside `C++`, none after a letter or digit.
 */
const ASCII_BREAK_AFTER: Readonly<Record<string, string>> = (() => {
  const rows: Record<string, string> = { '-': `"#'${PAIR_WORD}`, '?': `#$${PAIR_WORD}` };
  for (const c of '!"#%&)*+,.:;=>\\]|}~') rows[c] = '(<[{';
  return rows;
})();
const isPrintableAscii = (c: string | undefined): boolean => c !== undefined && c > ' ' && c <= '~';
const isBreakableSpace = (c: string | undefined): boolean => c === ' ' || c === '\t';

/**
 * Line break opportunities as Chromium finds them, as UTF-16 offsets inside the text.
 * Blink decides a pair of ASCII characters with its own table, breaks after a run of
 * spaces whatever follows, lets a hyphen break before a digit only after a letter or
 * digit (`2026-10-03` and `UTF-8` break, `-5` does not), and asks ICU (UAX #14 here)
 * wherever either character is not ASCII.
 */
export function chromiumBreakOffsets(text: string): number[] {
  const uax = new Set(textBreakOpportunities(text).map((b) => b.offset));
  const out: number[] = [];
  for (let i = 1; i < text.length; i++) {
    const a = text[i - 1]!;
    const b = text[i]!;
    let brk: boolean;
    if (isBreakableSpace(b)) brk = false;
    else if (isBreakableSpace(a)) brk = true;
    else if (a === '-' && b >= '0' && b <= '9') brk = /[0-9A-Za-z]/.test(text[i - 2] ?? '');
    else if (isPrintableAscii(a) && isPrintableAscii(b)) brk = (ASCII_BREAK_AFTER[a] ?? '').includes(b);
    else brk = uax.has(i);
    if (brk) out.push(i);
  }
  if (text.length) out.push(text.length);
  return out;
}

/**
 * Scripts the browser breaks between words by dictionary (UAX #14 class SA: Thai, Lao,
 * Myanmar, Khmer, Tai Tham, Tai Viet, Myanmar extended). Here they break only at spaces
 * or anywhere, so their lines are flagged.
 */
const DICTIONARY_SCRIPT = /[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u19E0-\u19FF\u1A20-\u1AAF\uA9E0-\uA9FF\uAA60-\uAADF]/;
/** Characters a measure lists as uncovered, at most. */
const UNCOVERED_LIST_MAX = 64;

const trimHanging = (text: string, a: number, z: number): number => {
  while (z > a && HANGING.test(text[z - 1]!)) z--;
  return z;
};

interface Span {
  start: number;
  end: number;
  anywhere: boolean;
  /** The line's width without hanging space, px. */
  width: number;
  /** How far the next word (or, for a cut word, the next character) missed the line by, px. */
  miss?: number;
  /** Shaping the line on its own would reverse the fit decision, so the break may land elsewhere. */
  fragile?: boolean;
}

/**
 * CSS pre-wrap greedy breaking over one paragraph's advances.
 *
 * Advances come from shaping each run whole, so a character's advance carries its
 * kerning with the next one. A line that ends at a break opportunity is fitted on
 * those advances, the way Chromium fits a line. A word cut between two characters
 * (`overflow-wrap: anywhere`) ends where shaping is not safe to cut, so Chromium
 * reshapes that line end; the cut is decided on the stretch shaped on its own
 * (`reshape`). Wherever the two widths would decide a fit differently, the break is
 * marked fragile.
 */
async function breakParagraph(
  text: string,
  advances: readonly number[],
  available: number,
  window: number,
  reshape: (a: number, z: number) => Promise<number>,
): Promise<Span[]> {
  const prefix = new Float64Array(text.length + 1);
  for (let i = 0; i < text.length; i++) prefix[i + 1] = prefix[i]! + (advances[i] ?? 0);
  const inContext = (a: number, z: number): number => prefix[z]! - prefix[a]!;
  const alone = new Map<string, number>();
  const aloneWidth = async (a: number, z: number): Promise<number> => {
    const key = `${a}:${z}`;
    let w = alone.get(key);
    if (w === undefined) {
      w = await reshape(a, z);
      alone.set(key, w);
    }
    return w;
  };
  const over = (w: number): boolean => w > available + EPSILON;
  const width = (a: number, z: number): number => inContext(a, trimHanging(text, a, z));
  const fits = (a: number, z: number): boolean => !over(width(a, z));
  /** Would the stretch, shaped on its own, be decided the other way? */
  const fragile = async (a: number, z: number): Promise<boolean> => {
    const t = trimHanging(text, a, z);
    const w = inContext(a, t);
    if (t <= a || Math.abs(w - available) > window) return false;
    return over(await aloneWidth(a, t)) !== over(w);
  };
  /**
   * A cut stretch's width: shaped on its own near the line end, where kerning across the
   * cut could decide the fit; in context well clear of it, where it cannot. A cut inside
   * a shaped cluster (a ligature) is always shaped on its own, since the cluster's whole
   * advance sits on its first character.
   */
  const clear = 2 * window;
  const atCluster = (k: number): boolean => k >= text.length || (advances[k] ?? 0) !== 0;
  const cutWidth = async (a: number, k: number): Promise<number> => {
    const w = inContext(a, k);
    return Math.abs(w - available) > clear && atCluster(k) ? w : aloneWidth(a, k);
  };
  const cutFits = async (a: number, k: number): Promise<boolean> => !over(await cutWidth(a, k));
  const graphemes = [...textBoundaries(text)].sort((x, y) => x - y);
  /** The index in `graphemes` of the first boundary after `x` (`graphemes.length` when none is). */
  const boundaryAfter = (x: number): number => {
    let lo = 0;
    let hi = graphemes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (graphemes[mid]! <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const spans: Span[] = [];
  let start = 0;
  let lastFit = 0;
  for (const o of chromiumBreakOffsets(text)) {
    if (fits(start, o)) {
      lastFit = o;
      continue;
    }
    if (lastFit > start) {
      spans.push({
        start,
        end: lastFit,
        anywhere: false,
        width: width(start, lastFit),
        miss: width(start, o) - available,
        fragile: (await fragile(start, lastFit)) || (await fragile(start, o)),
      });
      start = lastFit;
    }
    // overflow-wrap: anywhere, for a word that does not fit a line of its own.
    while (!fits(start, o)) {
      let ki = boundaryAfter(start);
      const first = graphemes[ki] ?? o;
      let k = first;
      for (let gi = ki + 1; gi < graphemes.length; gi++) {
        const g = graphemes[gi]!;
        if (g >= o || over(inContext(start, g))) break;
        k = g;
        ki = gi;
      }
      while (k > first && !(await cutFits(start, k))) k = graphemes[--ki]!;
      if (k >= o) break;
      const next = graphemes[boundaryAfter(k)] ?? o;
      spans.push({ start, end: k, anywhere: true, width: await cutWidth(start, k), miss: (await cutWidth(start, next)) - available });
      start = k;
    }
    lastFit = o;
  }
  if (start < text.length) spans.push({ start, end: text.length, anywhere: false, width: width(start, text.length), fragile: await fragile(start, text.length) });
  return spans;
}

/** One run of a drawn line: its text, where it starts on the line, and its face and paint. */
export interface DesignTextDrawRunV1 {
  text: string;
  /** From the line's start, px. */
  x: number;
  width: number;
  face: TextMeasureFaceV1;
  color?: string;
  underline?: boolean;
  strike?: boolean;
}
/** One drawn line, in the box's own coordinates: the baseline and the line's left edge after alignment. */
export interface DesignTextDrawLineV1 { baseline: number; x: number; width: number; runs: DesignTextDrawRunV1[] }
/** A text layer laid out for drawing, with the measure it was laid out by. */
export interface DesignTextDrawV1 { measure: TextMeasureV1; lines: DesignTextDrawLineV1[] }

/**
 * Measure one plain text layer. Rejects with a `TextMeasureError` for a spec it
 * cannot read (`input.invalid`) and passes on the shaper's own errors
 * (`font.unavailable`).
 */
export async function measureDesignText(spec: TextMeasureSpecV1, shaper: TextShaperV1): Promise<TextMeasureV1> {
  return (await measureCore(spec, shaper, false)).result;
}

/**
 * Lay a plain Design text layer out for drawing (plan 295, phase 3): every line's
 * baseline and runs, from the same breaks, faces and line boxes as the measure, placed
 * in the box the way the canvas places them (inside the border and pad, aligned by
 * `align`, the block placed by `valign` when the spec gives a height). As in the
 * renderer, any alignment other than `left` or `right` is `center`.
 */
export async function drawDesignText(spec: TextMeasureSpecV1, shaper: TextShaperV1, opts: { align?: string } = {}): Promise<DesignTextDrawV1> {
  const { result, drawn } = await measureCore(spec, shaper, true);
  const align = opts.align === 'left' || opts.align === 'right' ? opts.align : 'center';
  const client = result.box ? result.box.clientHeight : result.height;
  const offset = result.box ? (spec.valign === 'top' ? 0 : spec.valign === 'bottom' ? client - result.height : (client - result.height) / 2) : 0;
  const border = borderWidth(spec.strokeW);
  return {
    measure: result,
    lines: drawn.map((line) => {
      const free = result.availableWidth - line.width;
      const shift = align === 'center' ? free / 2 : align === 'right' ? free : 0;
      return {
        baseline: round2(border + offset + line.baseline),
        x: round2(border + result.pad + shift),
        width: line.width,
        runs: line.runs,
      };
    }),
  };
}

async function measureCore(spec: TextMeasureSpecV1, shaper: TextShaperV1, draw: boolean): Promise<{ result: TextMeasureV1; drawn: Array<{ baseline: number; width: number; runs: DesignTextDrawRunV1[] }> }> {
  const s = settle(spec);
  const notes: string[] = [];
  const shaped = new Map<string, ShapedFace>();
  const shape = async (text: string, face: Face): Promise<TextShapeResultV1> => {
    const result = await shaper({ text, family: face.family, weight: face.weight, italic: face.italic, size: s.size, tracking: s.tracking, features: s.features });
    if (!shaped.has(faceKey(face))) shaped.set(faceKey(face), { file: result.font.file, ...(result.font.variations ? { variations: result.font.variations } : {}), ...(result.font.metrics ? { metrics: result.font.metrics } : {}) });
    return result;
  };

  // A newline that ends the text draws no line of its own in pre-wrap, and no text draws none at all.
  const paragraphs = s.text === '' ? [] : s.text.split('\n');
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1] === '') paragraphs.pop();

  const base: Face = { token: s.token, family: s.family, weight: s.weight, italic: false };
  const lines: TextMeasureLineV1[] = [];
  const lineFaces: Face[][] = [];
  const pendingRuns: Array<{ width: number; runs: Array<{ text: string; x: number; width: number; face: Face; seg: Segment }> }> = [];
  const baselines: number[] = [];
  const margin = Math.max(3, 0.04 * s.size);
  let overWide = false;
  /** Characters a face had no glyph for, by the family that lacked them. */
  const uncovered = new Map<string, Set<string>>();
  let dictionaryLines = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const parsed = s.plain ? { indent: 0, level: 0, runs: [{ text: paragraphs[p]! }] } : parseDesignText(paragraphs[p]!)[0]!;
    const segments = segmentsOf(parsed, s);
    const drawn = segments.map((seg) => seg.text).join('');
    const advances: number[] = [];
    const faceAt: Face[] = [];
    const segAt: number[] = [];
    const segStart: number[] = [];
    const missingAt = new Set<number>();
    for (const [n, seg] of segments.entries()) {
      segStart.push(advances.length);
      const result = await shape(seg.text, seg.face);
      for (const i of result.missing ?? []) {
        if (!Number.isInteger(i) || i < 0 || i >= seg.text.length) continue;
        missingAt.add(advances.length + i);
        const ch = String.fromCodePoint(seg.text.codePointAt(i)!);
        let set = uncovered.get(seg.face.family);
        if (!set) {
          set = new Set();
          uncovered.set(seg.face.family, set);
        }
        set.add(ch);
      }
      for (let i = 0; i < seg.text.length; i++) {
        advances.push(Number.isFinite(result.advances[i]) ? result.advances[i]! : 0);
        faceAt.push(seg.face);
        segAt.push(n);
      }
    }
    /** A stretch of the paragraph shaped on its own, run by run. */
    const reshape = async (a: number, z: number): Promise<number> => {
      let total = 0;
      for (let k = a; k < z;) {
        const n = segAt[k]!;
        const stop = Math.min(z, segStart[n]! + segments[n]!.text.length);
        const result = await shape(drawn.slice(k, stop), segments[n]!.face);
        for (const adv of result.advances) total += Number.isFinite(adv) ? adv : 0;
        k = stop;
      }
      return total;
    };
    let spans: Span[] = [{ start: 0, end: 0, anywhere: false, width: 0 }];
    if (drawn) {
      try {
        spans = await breakParagraph(drawn, advances, s.available, margin, reshape);
      } catch (err) {
        if (err instanceof TextMeasureError) throw err;
        if (err instanceof Error && err.name === 'TextSourceError') throw new TextMeasureError('input.invalid', err.message);
        throw err;
      }
    }
    spans.forEach((span, i) => {
      const last = i === spans.length - 1;
      const z = trimHanging(drawn, span.start, span.end);
      const w = span.width;
      const slack = s.available - w;
      if (w > s.available + 0.5) overWide = true;
      const brk: TextMeasureBreakV1 = last
        ? p === paragraphs.length - 1 ? 'end' : 'forced'
        : span.anywhere ? 'anywhere' : HANGING.test(drawn[span.end - 1] ?? '') ? 'space' : 'opportunity';
      // A fallback face draws a character this face lacks, and the browser breaks
      // dictionary scripts between words: neither line is laid out here as it is there.
      let fallback = false;
      for (let k = span.start; k < span.end && !fallback; k++) fallback = missingAt.has(k);
      const dictionary = DICTIONARY_SCRIPT.test(drawn.slice(span.start, span.end));
      if (dictionary) dictionaryLines++;
      const nearEdge = (brk !== 'anywhere' && slack < margin) || (span.miss !== undefined && span.miss < margin) || span.fragile === true || fallback || dictionary;
      lines.push({
        index: lines.length,
        paragraph: p,
        text: drawn.slice(span.start, span.end),
        start: span.start,
        end: span.end,
        width: round2(w),
        slack: round2(slack),
        break: brk,
        nearEdge,
      });
      const faces = new Map<string, Face>([[faceKey(base), base]]);
      for (let k = span.start; k < z; k++) faces.set(faceKey(faceAt[k]!), faceAt[k]!);
      lineFaces.push([...faces.values()]);
      if (draw) {
        // The line's runs, each a stretch of one segment, placed by the paragraph's advances.
        const runs: Array<{ text: string; x: number; width: number; face: Face; seg: Segment }> = [];
        let x = 0;
        for (let k = span.start; k < z;) {
          const n = segAt[k]!;
          const stop = Math.min(z, segStart[n]! + segments[n]!.text.length);
          let width = 0;
          for (let i = k; i < stop; i++) width += advances[i]!;
          runs.push({ text: drawn.slice(k, stop), x, width, face: segments[n]!.face, seg: segments[n]! });
          x += width;
          k = stop;
        }
        pendingRuns.push({ width: round2(w), runs });
      }
    });
  }

  // The layer's own face is the strut of every line, so its metrics are needed even
  // when no run is drawn in that face, and the result gives the face's file.
  if (!shaped.has(faceKey(base))) await shape(' ', base);
  const L = Math.floor(s.lineHeight * s.size * 64) / 64;
  let missingMetrics = false;
  const extents = (face: Face): { top: number; ascent: number; descent: number } => {
    const m = shaped.get(faceKey(face))?.metrics;
    let ascent: number;
    let descent: number;
    if (m && m.upem > 0) {
      ascent = Math.round((m.ascent * s.size) / m.upem);
      descent = Math.round((Math.abs(m.descent) * s.size) / m.upem);
    } else {
      missingMetrics = true;
      ascent = Math.round(0.8 * s.size);
      descent = Math.round(0.2 * s.size);
    }
    const halfLeading = Math.floor((L - (ascent + descent)) / 2);
    return { top: ascent + halfLeading, ascent, descent };
  };
  let y = s.pad;
  let reach = 0;
  /** Each line's glyph area, from its tallest ascent to its deepest descent. */
  const glyphs: Array<{ top: number; bottom: number }> = [];
  for (const faces of lineFaces) {
    const e = faces.map(extents);
    const top = Math.max(...e.map((x) => x.top));
    const bottom = Math.max(...e.map((x) => L - x.top));
    const ascent = Math.max(...e.map((x) => x.ascent));
    const descent = Math.max(...e.map((x) => x.descent));
    glyphs.push({ top: y + top - ascent, bottom: y + top + descent });
    baselines.push(y + top);
    reach = Math.max(reach, y + top + descent);
    y += top + bottom;
  }
  const uncoveredChars = [...new Set([...uncovered.values()].flatMap((set) => [...set]))];
  for (const [family, set] of uncovered) {
    const list = [...set].slice(0, 8).map((c) => `"${c}" (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`).join(', ');
    notes.push(`${family} has no glyph for ${set.size} character${set.size === 1 ? '' : 's'} (${list}${set.size > 8 ? ', ...' : ''}). The canvas draws them in a fallback font, so the lines that hold them may break and stand taller than measured here; they are marked near the edge.`);
  }
  if (dictionaryLines)
    notes.push('Thai, Lao, Khmer and Myanmar text breaks between words by dictionary in the browser; here it breaks only at spaces or anywhere, so the lines that hold it are marked near the edge.');
  if (missingMetrics) notes.push('The shaper gave no vertical metrics for a face, so its ascent and descent were taken as 0.8 and 0.2 of the size.');
  const contentHeight = y - s.pad;
  const height = 2 * s.pad + contentHeight;
  const scrollHeight = Math.round(Math.max(height, reach));

  const faceOf = (face: Face): TextMeasureFaceV1 => {
    const got = shaped.get(faceKey(face));
    return {
      token: face.token,
      family: face.family,
      weight: face.weight,
      italic: face.italic,
      file: got?.file ?? '',
      ...(got?.variations ? { variations: got.variations } : {}),
    };
  };
  const used = new Map<string, Face>([[faceKey(base), base]]);
  for (const faces of lineFaces) for (const f of faces) used.set(faceKey(f), f);

  const result: TextMeasureV1 = {
    format: 'lolly-text-measure',
    version: 1,
    method: 'harfbuzz-css-greedy',
    font: faceOf(base),
    faces: [...used.values()].map(faceOf),
    size: s.size,
    weight: s.weight,
    lineHeight: s.lineHeight,
    lineHeightPx: L,
    pad: s.pad,
    tracking: s.tracking,
    width: s.boxWidth,
    availableWidth: s.available,
    lines,
    lineCount: lines.length,
    height,
    scrollHeight,
    nearEdge: lines.some((l) => l.nearEdge),
    tolerance: { widthPx: 0.5, lineEndPx: 3, nearEdgePx: round2(margin) },
    ...(uncoveredChars.length ? { uncovered: uncoveredChars.slice(0, UNCOVERED_LIST_MAX) } : {}),
    notes,
  };

  if (s.boxHeight !== undefined) {
    const clientHeight = Math.max(0, s.boxHeight - 2 * s.border);
    const offset = s.valign === 'top' ? 0 : s.valign === 'bottom' ? clientHeight - height : (clientHeight - height) / 2;
    const clipped = scrollHeight > clientHeight + 0.5 || overWide;
    // Only a clipped box hides lines: a tight line height lets glyphs reach above the
    // first line box, which the canvas paints and the audit does not count.
    const hiddenLines = clipped
      ? glyphs
        .map((g, i) => ({ i, top: offset + g.top, bottom: offset + g.bottom }))
        .filter((g) => g.top < -0.5 || g.bottom > clientHeight + 0.5)
        .map((g) => g.i)
      : [];
    result.box = { width: s.boxWidth, height: s.boxHeight, clientHeight };
    result.overflow = { y: scrollHeight - clientHeight, x: overWide, clipped, hiddenLines };
  }
  if (s.border) notes.push(`A ${s.border} px border inside the box narrows the text area on both sides.`);
  if (/\t/.test(s.text)) notes.push('Tabs are measured as the face draws the tab character, not as tab stops.');
  const drawnLines = pendingRuns.map((line, i) => ({
    baseline: baselines[i] ?? 0,
    width: line.width,
    runs: line.runs.map((run): DesignTextDrawRunV1 => ({
      text: run.text, x: round2(run.x), width: round2(run.width), face: faceOf(run.face),
      ...(run.seg.run?.color ? { color: run.seg.run.color } : {}),
      ...(run.seg.run?.underline ? { underline: true } : {}),
      ...(run.seg.run?.strike ? { strike: true } : {}),
    })),
  }));
  return { result, drawn: drawnLines };
}

/** The values `boolVal` in the renderer reads as on and off. */
function specFlag(v: unknown, dflt: boolean): boolean {
  if (v === true || v === false) return v;
  if (v === null || v === undefined || v === '') return dflt;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}

/** A stroke colour the renderer would paint (`safeColor`), so the border counts. */
function paintsStroke(v: unknown): boolean {
  const s = String(v ?? '').trim();
  if (!s) return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(s)
    || /^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)
    || (s.length <= 256 && /^(?:(?:ok)?(?:lab|lch)\([-+0-9.eE%\s/]+\)|color\((?:srgb|srgb-linear|display-p3|rec2020)\s+[-+0-9.eE%\s/]+\))$/i.test(s))
    || /^[a-zA-Z]+$/.test(s)
    || /^var\(\s*--[a-zA-Z0-9-]+\s*(,\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)))?\s*\)$/.test(s);
}

/** A number field read the way the renderer's `num` reads it: `parseFloat`, so `'60px'` is 60. */
const specNum = (v: unknown): number => (typeof v === 'number' ? v : parseFloat(String(v)));
const given = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

/**
 * A Design text row as a measure spec: the row's own fields, read as the renderer
 * reads them, and the renderer's defaults for the rest. A field the renderer cannot
 * read as a number is left out, so the default applies, as on the canvas.
 */
export function textMeasureSpecOfRow(row: Record<string, unknown>, fonts?: TextMeasureFontsV1): TextMeasureSpecV1 {
  const spec: TextMeasureSpecV1 = { text: String(row.text ?? ''), width: specNum(row.w) };
  const numeric = (key: 'height' | 'size' | 'lineHeight' | 'pad' | 'tracking', v: unknown): void => {
    if (!given(v)) return;
    const n = specNum(v);
    if (Number.isFinite(n)) spec[key] = n;
  };
  numeric('height', row.h);
  if (given(row.font)) spec.font = String(row.font);
  if (given(row.weight)) spec.weight = row.weight as string | number;
  numeric('size', row.fontSize);
  numeric('lineHeight', row.lineHeight);
  numeric('pad', row.pad);
  numeric('tracking', row.tracking);
  if (!specFlag(row.ligatures, true)) spec.ligatures = false;
  if (specFlag(row.alternates, false)) spec.alternates = true;
  if (specFlag(row.plainText, false)) spec.plain = true;
  if (paintsStroke(row.stroke) && specNum(row.strokeW) > 0) spec.strokeW = specNum(row.strokeW);
  spec.valign = row.valign === 'top' || row.valign === 'bottom' || row.valign === 'middle' ? row.valign : 'middle';
  if (fonts) spec.fonts = fonts;
  return spec;
}
