// SPDX-License-Identifier: MPL-2.0
/**
 * IDML story text: paragraph and character ranges resolved through named styles into the
 * runs `designTextOf` writes, plus the box-level type a Design text frame carries.
 *
 * Order of precedence, lowest first: paragraph style chain, local paragraph attributes,
 * character style chain, local character attributes.
 */
import { safeColor } from './design-map.ts';
import { designTextOf } from './design-text.ts';
import type { SourceParaV1, SourceRunV1 } from '@lolly-tools/core';
import { ownProps, textAttrs, tally, type StyleBook, type IdmlStats, type TextAttrs } from './idml-styles.ts';

export interface StoryStyle {
  text: string; fontSize: number; fg: string; font: string; weight: number; align: string;
  /** Unitless line height and letter spacing in px, when the story states them. */
  lineHeight?: number; tracking?: number;
  /** Tables anchored in the story, with the paragraph count before each. */
  tables?: { el: Element; before: number; chars: number }[];
}
export interface TextEnv {
  book: StyleBook;
  colour: (ref: string | undefined, tint: number | undefined) => string;
  warn: (message: string) => void;
  stats?: IdmlStats;
}

const NORMAL = 'ParagraphStyle/$ID/NormalParagraphStyle';
const OBJECTS = new Set(['Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'TextFrame', 'Group']);
const SKIP = new Set([...OBJECTS, 'Table', 'Footnote', 'Note', 'Properties', 'Image', 'EPS', 'PDF']);
const MAX_RUNS = 200000;

function collect(el: Element, name: string, out: Element[], depth = 0): void {
  if (depth > 16) return;
  for (const c of Array.from(el.children)) {
    if (c.localName === name) out.push(c);
    else if (!SKIP.has(c.localName)) collect(c, name, out, depth + 1);
  }
}

export function weightFromFontStyle(style: string | null | undefined): number {
  const s = String(style || '');
  if (/black|heavy/i.test(s)) return 900;
  if (/extra[\s-]*bold|ultra/i.test(s)) return 800;
  if (/semi[\s-]*bold|demi/i.test(s)) return 600;
  if (/bold/i.test(s)) return 700;
  if (/medium/i.test(s)) return 500;
  if (/light/i.test(s)) return 300;
  return 400;
}

type Align = 'left' | 'center' | 'right' | 'justify';
function alignOf(j: string | undefined): { align: Align; justified: boolean } {
  const s = String(j || '');
  if (/Justified/i.test(s) || /^To(?:Binding)?/i.test(s)) return { align: 'justify', justified: true };
  if (/Center/i.test(s)) return { align: 'center', justified: false };
  if (/Right/i.test(s) || /Away/i.test(s)) return { align: 'right', justified: false };
  return { align: 'left', justified: false };
}

function dominant<T>(pairs: { v: T | undefined; w: number }[]): T | undefined {
  const tally = new Map<T, number>(); let best: T | undefined, bestN = 0;
  for (const { v, w } of pairs) {
    if (v === undefined) continue;
    const n = (tally.get(v) ?? 0) + w; tally.set(v, n);
    if (n > bestN) { best = v; bestN = n; }
  }
  return best;
}

interface Piece { text: string; a: TextAttrs; weight: number; hex: string }

/** Build one text container (a story or a table cell) from its direct paragraph ranges. */
export function buildText(container: Element, env: TextEnv): StoryStyle {
  const { book, stats } = env;
  const paras: SourceParaV1[] = [], pieces: Piece[][] = [], paraAttrs: TextAttrs[] = [];
  const psrs: Element[] = []; collect(container, 'ParagraphStyleRange', psrs);
  const tables: { el: Element; before: number; chars: number }[] = [];
  let runCount = 0, chars = 0;
  for (const psr of psrs) {
    const pref = psr.getAttribute('AppliedParagraphStyle') || NORMAL;
    if (!book.has('paragraph', pref) && pref !== NORMAL) tally(stats, 'style.unresolved', 'dropped');
    else tally(stats, 'style.paragraph', 'mapped');
    const pstyle = book.resolve('paragraph', pref), plocal = ownProps(psr, 'paragraph');
    const pa = textAttrs(pstyle, plocal);
    const { align, justified } = alignOf(pa.justification);
    const makePara = (): SourceParaV1 => {
      const para: SourceParaV1 = { runs: [], align };
      if (pa.bullet && pa.bullet !== 'none') para.bullet = pa.bullet;
      if (pa.bulletChar && pa.bullet === 'bullet') para.bulletChar = pa.bulletChar;
      if ((pa.spaceBefore ?? 0) > 0) para.spaceBeforePt = pa.spaceBefore;
      if ((pa.spaceAfter ?? 0) > 0) para.spaceAfterPt = pa.spaceAfter;
      return para;
    };
    let para = makePara(), group: Piece[] = [];
    const finish = () => {
      paras.push(para); pieces.push(group); paraAttrs.push(pa);
      if (justified) tally(stats, 'text.justified', 'approximated');
      if ((pa.spaceBefore ?? 0) > 0 || (pa.spaceAfter ?? 0) > 0) tally(stats, 'text.paragraph-spacing', 'dropped');
      if (pa.leftIndent || pa.firstIndent || pa.rightIndent) tally(stats, 'text.indents', 'dropped');
      if (pa.bullet && pa.bullet !== 'none') tally(stats, 'text.bullets', 'mapped');
      para = makePara(); group = [];
    };
    const csrs: Element[] = []; collect(psr, 'CharacterStyleRange', csrs);
    for (const csr of csrs) {
      const cref = csr.getAttribute('AppliedCharacterStyle') || '';
      const resolved = book.has('character', cref);
      if (cref && !resolved && !/\$ID\//.test(cref)) tally(stats, 'style.unresolved', 'dropped');
      else if (resolved) tally(stats, 'style.character', 'mapped');
      const a = textAttrs(pstyle, plocal, book.resolve('character', cref), ownProps(csr, 'character'));
      const weight = weightFromFontStyle(a.fontStyle), hex = safeColor(env.colour(a.fill, a.fillTint), '');
      const flat = (node: Element, depth: number): void => {
        for (const child of Array.from(node.children)) {
          const name = child.localName;
          if (name === 'Content') {
            runCount++; chars += (child.textContent || '').length;
            if (runCount > MAX_RUNS || chars > 16 * 1024 * 1024) throw new Error('IDML story text exceeds the import limits.');
            const text = child.textContent || '';
            if (!text) continue;
            const run: SourceRunV1 = {
              text, bold: weight >= 600 || /Bold|Black|Heavy/i.test(a.fontStyle || ''), italic: /Italic|Oblique/i.test(a.fontStyle || ''),
              underline: a.underline === true, strike: a.strike === true,
              ...(a.size ? { sizePt: a.size } : {}), ...(a.font ? { font: a.font } : {}), ...(hex ? { color: { hex } } : {}),
            };
            if (/Super/i.test(a.position || '')) run.baseline = 'super'; else if (/Sub/i.test(a.position || '')) run.baseline = 'sub';
            if (/AllCaps/i.test(a.capitalization || '')) run.case = 'upper'; else if (/SmallCaps/i.test(a.capitalization || '')) run.case = 'small-caps';
            if (run.baseline || run.case) tally(stats, 'text.letter-case-position', 'dropped');
            if (a.distorted) tally(stats, 'text.distortion', 'dropped');
            para.runs.push(run); group.push({ text, a, weight, hex });
          } else if (name === 'Br') finish();
          else if (name === 'Table') tables.push({ el: child, before: paras.length, chars });
          else if (name === 'Footnote' || OBJECTS.has(name)) tally(stats, 'text.anchored-objects', 'dropped');
          else if (!SKIP.has(name) && depth < 8) flat(child, depth + 1);
        }
      };
      flat(csr, 0);
    }
    if (para.runs.length) finish();
  }

  const weighted = pieces.flat().filter(p => p.text.trim());
  const w = (p: Piece) => p.text.trim().length;
  const size = dominant(weighted.map(p => ({ v: p.a.size, w: w(p) })));
  const font = dominant(weighted.map(p => ({ v: p.a.font, w: w(p) })));
  const hex = dominant(weighted.map(p => ({ v: p.hex || undefined, w: w(p) })));
  const tracking = dominant(weighted.map(p => ({ v: p.a.tracking, w: w(p) })));
  const leading = dominant(weighted.map(p => ({ v: p.a.leading !== undefined ? p.a.leading : p.a.autoLeading !== undefined ? -p.a.autoLeading : undefined, w: w(p) })));
  // A bold row needs every run bold; otherwise the row is regular and the bold runs are marked.
  const weights = weighted.map(p => p.weight);
  const allBold = weights.length > 0 && weights.every(x => x >= 600);
  const weight = allBold ? (dominant(weighted.map(p => ({ v: p.weight, w: w(p) }))) ?? 700)
    : (dominant(weighted.filter(p => p.weight < 600).map(p => ({ v: p.weight, w: w(p) }))) ?? 400);
  if (new Set(weighted.map(p => p.a.size)).size > 1 || new Set(weighted.map(p => p.a.font)).size > 1) tally(stats, 'text.mixed-type', 'approximated');
  else if (weighted.length) tally(stats, 'text.type', 'mapped');

  const formatted = designTextOf(paras, { carryColour: true, rowWeight: weight });
  const text = formatted.text;
  const out: StoryStyle = { text, fontSize: size || 0, fg: hex || '', font: font || '', weight, align: formatted.align === 'justify' ? 'left' : (formatted.align || 'left') };
  const baseSize = size || 12;
  if (leading !== undefined) out.lineHeight = Math.max(0.5, Math.min(4, Math.round((leading > 0 ? leading / baseSize : -leading / 100) * 100) / 100));
  else if (weighted.length) out.lineHeight = 1.2;
  if (tracking) out.tracking = Math.round(tracking / 1000 * baseSize * 100) / 100;
  if (tracking !== undefined || leading !== undefined) tally(stats, 'text.leading-tracking', 'mapped');
  if (tables.length) out.tables = tables;
  return out;
}
