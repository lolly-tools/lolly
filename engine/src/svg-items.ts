// SPDX-License-Identifier: MPL-2.0
/**
 * A drawing as bounded, paint-ordered items (plan 275 decision 32, "vectors stay
 * vectors"), and those items as Design rows.
 *
 * A deck carries a chart as an SVG picture, and a freeform as custom geometry.
 * Both are drawings a person may want to restyle shape by shape, so neither
 * should reach Design as one flat picture. This module reads the structure of
 * such a drawing into `VectorItemsV1` (the contract field a source object
 * carries) and turns those items into Design `box`, `path` and `text` rows that
 * share one group, so the drawing arrives as one unit a single Ungroup takes
 * apart.
 *
 * Three entry points:
 *
 *   - `svgItemsOf` reads SVG text through an injected XML parser (the one the
 *     pptx reader already takes), with no DOM and no layout: every ancestor
 *     transform is composed into absolute path data, fills and strokes are
 *     resolved to hex with their opacities kept apart, and `<title>` / `<desc>`
 *     are kept as the drawing's own name and credits.
 *   - `custGeomItems` states a shape's custom geometry (read by `pptx-read.ts`)
 *     as the same items, one per `a:path`.
 *   - `vectorItemsToRows` places items in a box as rows. The rebrand compile and
 *     Design's own pptx import both call it, so the two cannot drift.
 *
 * What stays out, each with its reason, so a person is told rather than left to
 * find a gap: paint by `url()` (gradients, patterns), clip paths, masks,
 * filters, blend modes, `<image>`, `<foreignObject>`, `<switch>`, animation,
 * `<use>` of a target outside the file, `<textPath>`, text whose glyphs are
 * placed one by one, and a shape whose geometry states a length or path data
 * this reading cannot resolve. An item that paints nothing (no fill and no
 * stroke, zero opacity, zero area with no stroke) is dropped without a record,
 * so a chart's empty background rectangle does not count against it.
 * Annotations (`data-*`, `<metadata>`, foreign namespaces such as a C2PA
 * manifest) are read for names and otherwise ignored, never refused: the job
 * here is to read structure, not to admit bytes as pinned artwork.
 *
 * A `<style>` sheet is applied the way a browser applies it, for the rules this
 * reading can match: type, class and id selectors, compounds of them, and the
 * descendant and child combinators, ranked by specificity and order between the
 * presentation attributes and `style=`, with `!important` above both. That is how
 * Illustrator's default export and Office's recolourable icons paint their shapes.
 * A rule this reading cannot match (a pseudo-class, an attribute selector, a
 * sibling combinator, a media query) that sets paint refuses the whole drawing
 * with `unsupported-paint`, so it stays its picture rather than arriving in the
 * wrong colours; one that sets only the face text is set in is passed over.
 *
 * Bounds, from the contract: `VECTOR_ITEMS_MAX` items and `VECTOR_ITEMS_MAX_CHARS`
 * characters of path data per drawing, one `d` within the SVG tokenizer's own
 * ceiling and every item encodable as one Design path value. Past one of them
 * the reading stops, `items` is empty and `omitted` says `cap-reached`: the
 * drawing stays a picture, and the archive copy of the SVG is what a person
 * takes apart by hand. The walk itself is bounded by the tag and character caps
 * the SVG to custom geometry lowering uses, and `<use>` by depth and a visited
 * count, so a hostile file cannot make it loop.
 *
 * Outlined labels (plan 275 section 9.3). A chart tool that outlines its text writes
 * each label as filled glyph outlines, not `<text>`, and those outlines are most of a
 * chart's path data. `glyphRunsOf` finds them among the items: small filled subpaths
 * standing on one baseline, one path or a few neighbouring ones, and returns each run
 * with its box, baseline and ink. `svgLabelHintsOf` reads the words the file states
 * for itself (category names, title, description) so a reading of a run can be
 * checked against them. `vector-text.ts` turns a run and its reading into a text item.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */

import {
  VECTOR_ITEMS_MAX,
  VECTOR_ITEMS_MAX_CHARS,
  type DesignBoxRowV1,
  type SourceColorV1,
  type VectorItemsV1,
  type VectorItemV1,
  type VectorOmitReasonV1,
  type VectorPathItemV1,
  type VectorTextItemV1,
} from '@lolly-tools/core';

import { colorToSrgb8, parseColor } from './css-color.ts';
import { designTextFromPlain } from './design-text.ts';
import { encodeAuthoredPaths } from './geom/authored-url.ts';
import { pathBounds, pathFromSubPaths, type Contour } from './geom/path.ts';
import type { AuthoredPath } from './geom/spline.ts';
import type { PptxCustGeom } from './pptx-read.ts';
import { SVG_CUSTGEOM_MAX_CHARS, SVG_CUSTGEOM_MAX_TAGS } from './svg-custgeom.ts';
import { parseSvgPath, SVG_PATH_MAX_CHARS, type PathSegment, type SubPath } from './svg-path.ts';
import { multiplyVectorMatrix, vectorMatrix, type VectorMatrix } from './vector-paint.ts';

/** DOMParser-shaped adapter, the same one `readPptx` takes. */
export type SvgItemsXmlParser = (xml: string) => Document;

/** Nodes one Design path value may hold (the authored-path ceiling, `geom/authored-url.ts`). */
export const VECTOR_ITEM_MAX_NODES = 20_000;
/** Characters one encoded Design path value may hold (the authored-path ceiling). */
export const VECTOR_ITEM_MAX_ENCODED = 400_000;
/** Rows a compile places for one drawing. Items past it stay stored for a later fold into one painted row. */
export const MAX_VECTOR_ROWS_PER_OBJECT = 400;
/** Rows one frame takes from drawings, so a slide stays a canvas a person can select in. */
export const MAX_VECTOR_ROWS_PER_FRAME = 1200;
/**
 * Characters of encoded path values one document takes from drawings, summed over
 * every row. Design keeps an automatic history snapshot of a document up to 4 MiB
 * (`MAX_REVISION_SNAPSHOT` in the web shell), and outlined chart labels are most of
 * a chart's weight: past this, further drawings stay pictures, and the document
 * keeps its history with room for its text, pictures and frames.
 */
export const MAX_VECTOR_PATH_CHARS_PER_DOCUMENT = 2_500_000;
/** How deep `<use>` may nest, and how many elements a walk may visit in all, `<use>` expansions included. */
const MAX_USE_DEPTH = 8;
/** Container nesting a walk follows before it stops. */
const MAX_DEPTH = 64;
const MAX_TITLE = 120;
const MAX_DESC = 500;
const MAX_SERIES = 64;
const MAX_GROUPS = 8;
const MAX_GROUP_NAME = 64;
/** A `d` past this length is encoded once to check it fits one Design path value. */
const ENCODE_CHECK_CHARS = 20_000;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Elements that draw nothing themselves and are not walked. */
const SILENT = new Set([
  'defs', 'title', 'desc', 'metadata', 'style', 'script', 'symbol', 'clipPath', 'mask', 'pattern',
  'linearGradient', 'radialGradient', 'marker', 'filter', 'font', 'font-face', 'cursor', 'view',
]);
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']);
const ANIMATION = new Set(['animate', 'animateMotion', 'animateTransform', 'animateColor', 'set', 'discard', 'mpath']);

export interface SvgItemsOptsV1 {
  /** Items kept at most. Defaults to `VECTOR_ITEMS_MAX`. */
  maxItems?: number;
  /** Characters of path data kept at most, summed. Defaults to `VECTOR_ITEMS_MAX_CHARS`. */
  maxChars?: number;
}

/** What a walk inherits from its ancestors. */
interface Inherited {
  m: VectorMatrix;
  fill: string;
  fillOpacity: number;
  fillRule: 'nonzero' | 'evenodd';
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  dash?: number[];
  color: string;
  opacity: number;
  visible: boolean;
  fontFamily?: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  anchor?: 'start' | 'middle' | 'end';
  /** The nearest viewport's size in its own user units, which a percentage length resolves against. */
  vw: number;
  vh: number;
  /** Set when an ancestor states an effect a flat row cannot carry. */
  blocked?: VectorOmitReasonV1;
  series?: string;
  groups: string[];
}

class CapReached extends Error {}

/** The element's local name, with no prefix. */
function localOf(el: Element): string {
  const raw = el.localName || el.nodeName || '';
  const at = raw.indexOf(':');
  return at >= 0 ? raw.slice(at + 1) : raw;
}

/** Direct element children. */
function kids(el: Element): Element[] {
  const out: Element[] = [];
  const list = el.childNodes;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (n && n.nodeType === 1) out.push(n as Element);
  }
  return out;
}

/** One declaration: a lower-cased name, its value and whether it was marked `!important`. */
type Decl = [name: string, value: string, important: boolean];

/** The declarations of a `style` attribute or a rule body, lower-cased names. */
function declsOf(raw: string): Decl[] {
  const out: Decl[] = [];
  for (const decl of raw.slice(0, 16_384).split(';')) {
    const at = decl.indexOf(':');
    if (at <= 0) continue;
    const name = decl.slice(0, at).trim().toLowerCase();
    let value = decl.slice(at + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
    if (name && value) out.push([name, value, important]);
  }
  return out;
}

// ─── the style sheet ─────────────────────────────────────────────────────────

/** Properties a sheet rule may set that this reading applies. */
const CASCADED = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'opacity', 'visibility', 'display', 'color', 'clip-path', 'mask',
  'filter', 'mix-blend-mode', 'vector-effect', 'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor',
]);
/** Of those, the ones that change only the face text is set in, never what a part paints or where. */
const FACE_ONLY = new Set(['font-family', 'font-weight', 'font-style']);
/** At-rules whose blocks never style a drawn element. */
const INERT_AT_RULES = new Set(['font-face', 'keyframes', 'page', 'counter-style', 'font-feature-values', 'property']);
const MAX_SHEET_CHARS = 64_000;
const MAX_SHEET_RULES = 512;
const MAX_CHAIN = 6;
/** Steps every selector match of one reading may take in all, so a hostile sheet cannot make matching slow. */
const MAX_MATCH_STEPS = 2_000_000;

/** One compound selector: a type, ids and classes, all of which an element must have. */
interface Compound {
  tag?: string;
  ids: string[];
  classes: string[];
}

interface SheetRule {
  /** Compounds from the outermost to the one the element itself matches. */
  chain: Compound[];
  /** `child[i]` is true when the combinator after `chain[i]` is `>`. */
  child: boolean[];
  spec: number;
  order: number;
  decls: Decl[];
}

interface Sheet {
  rules: SheetRule[];
  /** Keyed by the last compound's first id (`#x`), class (`.x`) or type, else `*`. */
  byKey: Map<string, SheetRule[]>;
  /** Set when a rule this reading cannot match sets paint. */
  unsupported: boolean;
}

function compoundOf(token: string): Compound | null {
  const m = /^(\*|[A-Za-z][\w-]*)?((?:[.#][A-Za-z_-][\w-]*)*)$/.exec(token);
  if (!m || token === '') return null;
  const out: Compound = { ids: [], classes: [] };
  if (m[1] && m[1] !== '*') out.tag = m[1];
  for (const part of m[2]!.match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '#') out.ids.push(part.slice(1));
    else out.classes.push(part.slice(1));
  }
  return out;
}

/** A selector this reading can match, or null for one it cannot. */
function selectorOf(text: string): Pick<SheetRule, 'chain' | 'child' | 'spec'> | null {
  const tokens = text.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/).filter(Boolean);
  const chain: Compound[] = [];
  const child: boolean[] = [];
  let pending = false;
  for (const token of tokens) {
    if (token === '>') {
      if (!chain.length || pending) return null;
      pending = true;
      continue;
    }
    const compound = compoundOf(token);
    if (!compound) return null;
    if (chain.length) child.push(pending);
    pending = false;
    chain.push(compound);
  }
  if (pending || !chain.length || chain.length > MAX_CHAIN) return null;
  let spec = 0;
  for (const c of chain) spec += c.ids.length * 10_000 + c.classes.length * 100 + (c.tag ? 1 : 0);
  return { chain, child, spec };
}

function keyOf(c: Compound): string {
  if (c.ids.length) return `#${c.ids[0]}`;
  if (c.classes.length) return `.${c.classes[0]}`;
  return c.tag ?? '*';
}

/** Read every `<style>` of a document into the rules this reading applies. */
function sheetOf(doc: Document): Sheet {
  const sheet: Sheet = { rules: [], byKey: new Map(), unsupported: false };
  let budget = MAX_SHEET_CHARS;
  let order = 0;
  for (const style of Array.from(doc.getElementsByTagName('style')).slice(0, 8)) {
    const raw = (style.textContent ?? '').slice(0, budget);
    budget -= raw.length;
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--|-->/g, '');
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf('{', i);
      if (open < 0) break;
      let depth = 1;
      let j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth += 1;
        else if (css[j] === '}') depth -= 1;
        j += 1;
      }
      // A statement at-rule (`@import ...;`) ends at its semicolon, before the next prelude.
      const prelude = css.slice(i, open).replace(/^(?:\s*@[^;{]*;)+/, '').trim();
      const body = css.slice(open + 1, depth === 0 ? j - 1 : j);
      i = j;
      if (prelude.startsWith('@')) {
        const name = (/^@(?:-[a-z]+-)?([\w-]+)/i.exec(prelude)?.[1] ?? '').toLowerCase();
        if (INERT_AT_RULES.has(name)) continue;
        // A conditional block (`@media`, `@supports`) this reading cannot evaluate.
        if (/(?:^|[;{\s])(fill|stroke|opacity|display|visibility|color|clip-path|mask|filter|mix-blend-mode)[\w-]*\s*:/i.test(body)) sheet.unsupported = true;
        continue;
      }
      const decls = declsOf(body).filter(([name]) => CASCADED.has(name));
      if (!decls.length) continue;
      const paints = decls.some(([name]) => !FACE_ONLY.has(name));
      for (const part of prelude.split(',')) {
        const sel = selectorOf(part);
        if (!sel) {
          if (paints) sheet.unsupported = true;
          continue;
        }
        if (sheet.rules.length >= MAX_SHEET_RULES) {
          sheet.unsupported = true;
          break;
        }
        const rule: SheetRule = { ...sel, order: order++, decls };
        sheet.rules.push(rule);
        const key = keyOf(sel.chain[sel.chain.length - 1]!);
        const list = sheet.byKey.get(key);
        if (list) list.push(rule);
        else sheet.byKey.set(key, [rule]);
      }
    }
  }
  return sheet;
}

function matchesCompound(el: Element, c: Compound): boolean {
  if (c.tag && localOf(el) !== c.tag) return false;
  if (c.ids.length) {
    const id = el.getAttribute('id');
    if (c.ids.some((x) => x !== id)) return false;
  }
  if (c.classes.length) {
    const own = (el.getAttribute('class') ?? '').split(/\s+/);
    if (!c.classes.every((x) => own.includes(x))) return false;
  }
  return true;
}

function parentOf(el: Element): Element | null {
  const p = el.parentNode;
  return p && p.nodeType === 1 ? (p as Element) : null;
}

/** A presentation property: the `style` declaration wins over the attribute. */
function prop(el: Element, style: Map<string, string>, name: string): string | undefined {
  const fromStyle = style.get(name);
  if (fromStyle !== undefined) return fromStyle;
  const attr = el.getAttribute(name);
  return attr == null ? undefined : attr.trim();
}

/** A length in user units: a bare number, px, pt, pc, mm, cm, in or em. */
function lengthOf(value: string | undefined, fontSize: number): number | undefined {
  if (value === undefined) return undefined;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|ex|%)?$/.exec(value.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  switch (m[2]) {
    case 'pt': return (n * 4) / 3;
    case 'pc': return n * 16;
    case 'mm': return (n * 96) / 25.4;
    case 'cm': return (n * 96) / 2.54;
    case 'in': return n * 96;
    case 'em': return n * fontSize;
    case 'ex': return (n * fontSize) / 2;
    case '%': return undefined;
    default: return n;
  }
}

/** The viewport a percentage length is read against. */
interface Viewport {
  fontSize: number;
  vw: number;
  vh: number;
}

/**
 * A length that may be a percentage of the nearest viewport: of its width for an
 * `x` length, its height for a `y` length, and its normalised diagonal for a `d`
 * length (a radius, a stroke width), as SVG resolves each.
 */
function lengthIn(value: string | undefined, at: Viewport, axis: 'x' | 'y' | 'd'): number | undefined {
  if (value === undefined) return undefined;
  const pct = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*%$/.exec(value.trim());
  if (!pct) return lengthOf(value, at.fontSize);
  const base = axis === 'x' ? at.vw : axis === 'y' ? at.vh : Math.sqrt((at.vw * at.vw + at.vh * at.vh) / 2);
  const n = (Number(pct[1]) / 100) * base;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A basic shape's outline as path data in its own user space. `''` when the shape
 * has no size and draws nothing (a bar of zero length); null when a length it states
 * cannot be read, which is a part left out, not a part that is empty.
 */
function outlineOf(el: Element, tag: string, at: Viewport): string | null {
  let unreadable = false;
  const len = (name: string, axis: 'x' | 'y' | 'd', fallback = 0): number => {
    const raw = el.getAttribute(name);
    if (raw == null || raw.trim() === '' || raw.trim() === 'auto') return fallback;
    const v = lengthIn(raw, at, axis);
    if (v === undefined) {
      unreadable = true;
      return 0;
    }
    return v;
  };
  let d = '';
  switch (tag) {
    case 'path':
      d = el.getAttribute('d') ?? '';
      break;
    case 'line':
      d = `M${len('x1', 'x')} ${len('y1', 'y')}L${len('x2', 'x')} ${len('y2', 'y')}`;
      break;
    case 'polygon':
    case 'polyline': {
      const raw = (el.getAttribute('points') ?? '').trim();
      if (!raw) return '';
      const points = raw.split(/[\s,]+/).map(Number);
      if (points.some((v) => !Number.isFinite(v))) return null;
      for (let i = 0; i + 1 < points.length; i += 2) d += `${i ? 'L' : 'M'}${points[i]} ${points[i + 1]}`;
      if (d && tag === 'polygon') d += 'Z';
      break;
    }
    case 'circle':
    case 'ellipse': {
      const x = len('cx', 'x');
      const y = len('cy', 'y');
      const rx = tag === 'circle' ? len('r', 'd') : len('rx', 'x', el.hasAttribute('ry') ? len('ry', 'y') : 0);
      const ry = tag === 'circle' ? rx : len('ry', 'y', el.hasAttribute('rx') ? len('rx', 'x') : 0);
      if (unreadable) return null;
      if (!(rx > 0) || !(ry > 0)) return '';
      d = `M${x - rx} ${y}A${rx} ${ry} 0 1 1 ${x + rx} ${y}A${rx} ${ry} 0 1 1 ${x - rx} ${y}Z`;
      break;
    }
    case 'rect': {
      const x = len('x', 'x');
      const y = len('y', 'y');
      const w = len('width', 'x');
      const h = len('height', 'y');
      const rx0 = el.hasAttribute('rx') ? len('rx', 'x') : el.hasAttribute('ry') ? len('ry', 'y') : 0;
      const ry0 = el.hasAttribute('ry') ? len('ry', 'y') : rx0;
      if (unreadable) return null;
      if (!(w > 0) || !(h > 0)) return '';
      const rx = Math.min(w / 2, Math.max(0, rx0));
      const ry = Math.min(h / 2, Math.max(0, ry0));
      d = !rx || !ry
        ? `M${x} ${y}H${x + w}V${y + h}H${x}Z`
        : `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
      break;
    }
    default:
      return null;
  }
  return unreadable ? null : d;
}

/** A 0 to 1 number, or a percentage. */
function unitOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(%)?$/.exec(value.trim());
  if (!m) return undefined;
  const n = Number(m[1]) / (m[2] ? 100 : 1);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : undefined;
}

/** The first family a `font-family` names, with a `var(--x, fallback)` read for its fallback. */
function familyOf(value: string): string | undefined {
  let list = value.trim();
  const v = /^var\(\s*--[\w-]+\s*,\s*(.*)\)$/s.exec(list);
  if (v) list = v[1]!;
  for (const raw of list.split(',')) {
    const name = raw.trim().replace(/^['"]|['"]$/g, '').trim();
    if (name && !/^var\(/.test(name)) return name.slice(0, 64);
  }
  return undefined;
}

function round3(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

/** A resolved paint: nothing, a colour with its alpha, or a paint this reading cannot carry. */
type Paint = { none: true } | { hex: string; alpha: number } | { unsupported: true };

function paintOf(value: string, currentColor: string): Paint {
  const v = value.trim();
  if (v === '' || v === 'none' || v === 'transparent') return { none: true };
  if (/^url\(/i.test(v) || /^context-/i.test(v)) return { unsupported: true };
  const source = /^currentcolor$/i.test(v) ? currentColor : v;
  const parsed = parseColor(source);
  if (!parsed) return { unsupported: true };
  if (parsed.alpha <= 0) return { none: true };
  const rgba = colorToSrgb8(parsed);
  const hex = `#${rgba.slice(0, 3).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return { hex, alpha: rgba[3] };
}

/** Apply an affine to every point of a parsed path. */
function transformSubPaths(subs: SubPath[], m: VectorMatrix): SubPath[] {
  const x = (px: number, py: number): number => m[0] * px + m[2] * py + m[4];
  const y = (px: number, py: number): number => m[1] * px + m[3] * py + m[5];
  return subs.map((sub) => ({
    closed: sub.closed,
    segments: sub.segments.map((seg): PathSegment => {
      if (seg.op === 'C') {
        return { op: 'C', x1: x(seg.x1, seg.y1), y1: y(seg.x1, seg.y1), x2: x(seg.x2, seg.y2), y2: y(seg.x2, seg.y2), x: x(seg.x, seg.y), y: y(seg.x, seg.y) };
      }
      return { op: seg.op, x: x(seg.x, seg.y), y: y(seg.x, seg.y) };
    }),
  }));
}

/** Absolute path data from parsed subpaths, three decimals. */
function dOf(subs: SubPath[]): string {
  const n = (v: number): string => String(round3(v));
  let out = '';
  for (const sub of subs) {
    for (const seg of sub.segments) {
      if (seg.op === 'C') out += `C${n(seg.x1)} ${n(seg.y1)} ${n(seg.x2)} ${n(seg.y2)} ${n(seg.x)} ${n(seg.y)}`;
      else out += `${seg.op}${n(seg.x)} ${n(seg.y)}`;
    }
    if (sub.closed) out += 'Z';
  }
  return out;
}

/** Nodes a set of contours will be as a Design path value. */
function nodeCount(contours: Contour[]): number {
  let n = 0;
  for (const c of contours) n += c.curves.length + (c.closed ? 0 : 1);
  return n;
}

/**
 * Read an SVG document's drawing into items. A file that cannot be parsed, or
 * whose root is not an `<svg>`, yields no items and one `unsupported-element`.
 */
export function svgItemsOf(svgText: string, parseXml: SvgItemsXmlParser, opts: SvgItemsOptsV1 = {}): VectorItemsV1 {
  const maxItems = Math.max(0, Math.min(VECTOR_ITEMS_MAX, opts.maxItems ?? VECTOR_ITEMS_MAX));
  const maxChars = Math.max(0, Math.min(VECTOR_ITEMS_MAX_CHARS, opts.maxChars ?? VECTOR_ITEMS_MAX_CHARS));
  const refused = (reason: VectorOmitReasonV1, count: number, viewBox = { x: 0, y: 0, w: 0, h: 0 }): VectorItemsV1 => ({
    version: 1, viewBox, items: [], omitted: [{ reason, count: Math.max(1, count) }],
  });
  if (typeof svgText !== 'string' || svgText.length === 0) return refused('unsupported-element', 1);
  if (svgText.length > SVG_CUSTGEOM_MAX_CHARS) return refused('cap-reached', 1);

  let doc: Document;
  try {
    doc = parseXml(svgText);
  } catch {
    return refused('unsupported-element', 1);
  }
  const root = doc?.documentElement;
  if (!root || localOf(root) !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    return refused('unsupported-element', 1);
  }

  const view = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const baseFont = 16;
  const rootW = lengthOf(root.getAttribute('width') ?? undefined, baseFont);
  const rootH = lengthOf(root.getAttribute('height') ?? undefined, baseFont);
  let viewBox = view.length === 4 && view.every(Number.isFinite) && view[2]! > 0 && view[3]! > 0
    ? { x: view[0]!, y: view[1]!, w: view[2]!, h: view[3]! }
    : rootW && rootH && rootW > 0 && rootH > 0 ? { x: 0, y: 0, w: rootW, h: rootH } : undefined;

  // Ids for `<use>`, read once. The id map is the only index built over the file.
  const byId = new Map<string, Element>();
  let tags = 0;
  const all = doc.getElementsByTagName('*');
  if (all.length > SVG_CUSTGEOM_MAX_TAGS) return refused('cap-reached', all.length, viewBox);
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const id = el?.getAttribute('id');
    if (el && id && !byId.has(id)) byId.set(id, el);
  }

  const items: VectorItemV1[] = [];
  const omitted = new Map<VectorOmitReasonV1, number>();
  const omit = (reason: VectorOmitReasonV1): void => {
    omitted.set(reason, (omitted.get(reason) ?? 0) + 1);
  };
  let chars = 0;
  let seen = 0;

  // The document's style sheet, applied per element between its attributes and its
  // `style=`. A rule this reading cannot match that sets paint refuses the drawing:
  // read without it, every part would arrive in the wrong colour and still claim to
  // be editable.
  const sheet = sheetOf(doc);
  if (sheet.unsupported) return refused('unsupported-paint', 1, viewBox);
  let steps = 0;
  const matchChain = (el: Element, rule: SheetRule, index: number): boolean => {
    if (++steps > MAX_MATCH_STEPS) throw new CapReached();
    if (!matchesCompound(el, rule.chain[index]!)) return false;
    if (index === 0) return true;
    if (rule.child[index - 1]) {
      const p = parentOf(el);
      return p !== null && matchChain(p, rule, index - 1);
    }
    for (let p = parentOf(el); p; p = parentOf(p)) if (matchChain(p, rule, index - 1)) return true;
    return false;
  };
  /** The declarations that apply to one element: sheet rules by specificity, then `style=`, then the important ones. */
  const styleOf = (el: Element): Map<string, string> => {
    const out = new Map<string, string>();
    const inline = declsOf(el.getAttribute('style') ?? '');
    if (!sheet.rules.length) {
      for (const [name, value] of inline) out.set(name, value);
      return out;
    }
    const id = el.getAttribute('id');
    const keys = ['*', localOf(el), ...(el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).map((c) => `.${c}`), ...(id ? [`#${id}`] : [])];
    const matched = new Set<SheetRule>();
    for (const key of keys) {
      for (const rule of sheet.byKey.get(key) ?? []) {
        if (!matched.has(rule) && matchChain(el, rule, rule.chain.length - 1)) matched.add(rule);
      }
    }
    const ranked = [...matched].sort((a, b) => a.spec - b.spec || a.order - b.order);
    for (const rule of ranked) for (const [name, value, important] of rule.decls) if (!important) out.set(name, value);
    for (const [name, value, important] of inline) if (!important) out.set(name, value);
    for (const rule of ranked) for (const [name, value, important] of rule.decls) if (important) out.set(name, value);
    for (const [name, value, important] of inline) if (important) out.set(name, value);
    return out;
  };

  const push = (item: VectorItemV1, dLength: number): void => {
    seen += 1;
    if (items.length >= maxItems) throw new CapReached();
    chars += dLength;
    if (chars > maxChars) throw new CapReached();
    items.push(item);
  };

  const inherit = (el: Element, parent: Inherited, style: Map<string, string>): Inherited => {
    const own: Inherited = { ...parent, groups: parent.groups };
    const get = (name: string): string | undefined => {
      const v = prop(el, style, name);
      return v === 'inherit' ? undefined : v;
    };
    const color = get('color');
    if (color) own.color = color;
    const fill = get('fill');
    if (fill !== undefined) own.fill = fill;
    const stroke = get('stroke');
    if (stroke !== undefined) own.stroke = stroke;
    const fontSize = lengthOf(get('font-size'), parent.fontSize);
    if (fontSize !== undefined && fontSize > 0) own.fontSize = fontSize;
    const sw = lengthIn(get('stroke-width'), own, 'd');
    if (sw !== undefined && sw >= 0) own.strokeWidth = sw;
    const fo = unitOf(get('fill-opacity'));
    if (fo !== undefined) own.fillOpacity = fo;
    const so = unitOf(get('stroke-opacity'));
    if (so !== undefined) own.strokeOpacity = so;
    const rule = get('fill-rule');
    if (rule === 'evenodd' || rule === 'nonzero') own.fillRule = rule;
    const cap = get('stroke-linecap');
    if (cap === 'butt' || cap === 'round' || cap === 'square') own.cap = cap;
    const join = get('stroke-linejoin');
    if (join === 'miter' || join === 'round' || join === 'bevel') own.join = join;
    else if (join === 'miter-clip' || join === 'arcs') own.join = 'miter';
    const dash = get('stroke-dasharray');
    if (dash !== undefined) {
      const list = dash === 'none' ? [] : dash.split(/[\s,]+/).map((v) => lengthOf(v, own.fontSize)).filter((v): v is number => v !== undefined && v >= 0);
      own.dash = list.length > 0 && list.some((v) => v > 0) ? (list.length % 2 ? [...list, ...list] : list) : undefined;
    }
    const opacity = unitOf(get('opacity'));
    if (opacity !== undefined) own.opacity = parent.opacity * opacity;
    const visibility = get('visibility');
    if (visibility === 'hidden' || visibility === 'collapse') own.visible = false;
    else if (visibility === 'visible') own.visible = true;
    const family = get('font-family');
    if (family) own.fontFamily = familyOf(family) ?? own.fontFamily;
    const weight = get('font-weight');
    if (weight) own.bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
    const fontStyle = get('font-style');
    if (fontStyle) own.italic = fontStyle === 'italic' || fontStyle === 'oblique';
    const anchor = get('text-anchor');
    if (anchor === 'start' || anchor === 'middle' || anchor === 'end') own.anchor = anchor;
    for (const effect of ['clip-path', 'mask', 'filter']) {
      const v = get(effect);
      if (v && v !== 'none') own.blocked = 'unsupported-paint';
    }
    const blend = get('mix-blend-mode');
    if (blend && blend !== 'normal') own.blocked = 'unsupported-paint';
    const series = el.getAttribute('data-series') ?? el.getAttribute('data-recolor') ?? el.getAttribute('data-name');
    if (series?.trim()) own.series = series.trim().slice(0, MAX_SERIES);
    return own;
  };

  const transformOf = (el: Element, parent: VectorMatrix): VectorMatrix | null => {
    const raw = el.getAttribute('transform');
    if (!raw?.trim()) return parent;
    try {
      return multiplyVectorMatrix(parent, vectorMatrix(raw.trim()));
    } catch {
      return null;
    }
  };

  const shapeItem = (el: Element, tag: string, state: Inherited, style: Map<string, string>): void => {
    if (!state.visible || state.opacity <= 0) return;
    if (state.blocked) {
      omit(state.blocked);
      return;
    }
    // A length this reading cannot resolve, or path data that parses to nothing, is a
    // part left out and counted, so the drawing says it is approximate.
    const d0 = outlineOf(el, tag, state);
    if (d0 === null || /NaN|Infinity/.test(d0)) {
      omit('unsupported-element');
      return;
    }
    if (!d0.trim()) return;
    if (d0.length > SVG_PATH_MAX_CHARS) throw new CapReached();
    const subs = transformSubPaths(parseSvgPath(d0), state.m);
    if (!subs.length) {
      omit('unsupported-element');
      return;
    }
    const contours = pathFromSubPaths(subs);
    const bounds = pathBounds(contours);
    if (!bounds) return;
    const box = { x: round3(bounds.x0), y: round3(bounds.y0), w: round3(bounds.x1 - bounds.x0), h: round3(bounds.y1 - bounds.y0) };
    const fillPaint = paintOf(state.fill, state.color);
    const strokePaint = paintOf(state.stroke, state.color);
    if ('unsupported' in fillPaint || 'unsupported' in strokePaint) {
      omit('unsupported-paint');
      return;
    }
    const lineLike = tag === 'line' || tag === 'polyline';
    // A non-scaling stroke keeps the width it states whatever the transforms above it,
    // read here in the drawing's own units (its width as drawn at its viewBox size).
    // `vector-effect` is not inherited, so only the element's own counts.
    const nonScaling = prop(el, style, 'vector-effect') === 'non-scaling-stroke';
    const scale = nonScaling ? 1 : Math.sqrt(Math.abs(state.m[0] * state.m[3] - state.m[1] * state.m[2]));
    const fillAlpha = 'hex' in fillPaint ? fillPaint.alpha * state.fillOpacity : 0;
    const strokeAlpha = 'hex' in strokePaint ? strokePaint.alpha * state.strokeOpacity : 0;
    const strokeWidth = state.strokeWidth * scale;
    const fills = !lineLike && fillAlpha > 0 && box.w > 0 && box.h > 0;
    const strokes = strokeAlpha > 0 && strokeWidth > 0;
    // Nothing painted: dropped without a record, so an empty background rect or a
    // bar of zero length does not count against the drawing.
    if (!fills && !strokes) return;

    const d = dOf(subs);
    if (d.length > SVG_PATH_MAX_CHARS) throw new CapReached();
    if (nodeCount(contours) > VECTOR_ITEM_MAX_NODES) throw new CapReached();
    if (d.length > ENCODE_CHECK_CHARS && !encodable(subs, box)) throw new CapReached();

    const item: VectorPathItemV1 = { kind: 'path', d, box };
    const axisAligned = Math.abs(state.m[1]) < 1e-9 && Math.abs(state.m[2]) < 1e-9;
    if (axisAligned && tag === 'rect') {
      item.shape = 'rect';
      const rx = lengthIn(el.getAttribute('rx') ?? el.getAttribute('ry') ?? undefined, state, 'x') ?? 0;
      const scaled = Math.min(rx * Math.min(Math.abs(state.m[0]), Math.abs(state.m[3])), box.w / 2, box.h / 2);
      if (scaled > 0) item.rx = round3(scaled);
    } else if (axisAligned && (tag === 'ellipse' || tag === 'circle')) {
      item.shape = 'ellipse';
    } else if (tag === 'line') {
      item.shape = 'line';
    }
    item.fill = fills && 'hex' in fillPaint ? { hex: fillPaint.hex } : { none: true };
    if (fills && fillAlpha < 1) item.fillOpacity = round3(fillAlpha);
    if (fills && state.fillRule === 'evenodd') item.fillRule = 'evenodd';
    if (strokes && 'hex' in strokePaint) {
      const stroke: NonNullable<VectorPathItemV1['stroke']> = { color: { hex: strokePaint.hex }, width: round3(strokeWidth) };
      if (strokeAlpha < 1) stroke.opacity = round3(strokeAlpha);
      if (state.cap) stroke.cap = state.cap;
      if (state.join) stroke.join = state.join;
      if (state.dash) stroke.dash = state.dash.slice(0, 16).map((v) => round3(v * scale));
      item.stroke = stroke;
    }
    if (state.opacity < 1) item.opacity = round3(state.opacity);
    if (state.series) item.series = state.series;
    if (state.groups.length) item.groups = state.groups.slice(0, MAX_GROUPS);
    push(item, d.length);
  };

  const textItem = (el: Element, state: Inherited): void => {
    if (!state.visible || state.opacity <= 0) return;
    if (state.blocked) {
      omit(state.blocked);
      return;
    }
    // One run at one place: a `<textPath>`, a `textLength`, or a `<tspan>` that
    // places itself has glyphs a single text row cannot put back.
    const positioned = (node: Element): boolean => ['x', 'y', 'dx', 'dy', 'rotate'].some((a) => {
      const v = node.getAttribute(a);
      return v != null && v.trim().split(/[\s,]+/).length > (node === el && (a === 'x' || a === 'y') ? 1 : 0);
    });
    const descendants = Array.from(el.getElementsByTagName('*'));
    if (el.getAttribute('textLength') || descendants.some((n) => localOf(n) === 'textPath' || n.getAttribute('textLength') || positioned(n)) || positioned(el)) {
      omit('unsupported-text');
      return;
    }
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
    if (!text) return;
    const m = state.m;
    if (Math.abs(m[1]) > 1e-9 || Math.abs(m[2]) > 1e-9 || m[0] <= 0 || m[3] <= 0) {
      omit('unsupported-text');
      return;
    }
    const fillPaint = paintOf(state.fill, state.color);
    if ('unsupported' in fillPaint) {
      omit('unsupported-paint');
      return;
    }
    if (!('hex' in fillPaint) || fillPaint.alpha * state.fillOpacity <= 0) return;
    const x0 = lengthIn(el.getAttribute('x') ?? '0', state, 'x');
    const y0 = lengthIn(el.getAttribute('y') ?? '0', state, 'y');
    if (x0 === undefined || y0 === undefined) {
      omit('unsupported-text');
      return;
    }
    const item: VectorTextItemV1 = {
      kind: 'text',
      text,
      x: round3(m[0] * x0 + m[4]),
      y: round3(m[3] * y0 + m[5]),
      size: round3(state.fontSize * m[3]),
      fill: { hex: fillPaint.hex },
    };
    if (state.anchor && state.anchor !== 'start') item.anchor = state.anchor;
    if (state.fontFamily) item.font = state.fontFamily;
    if (state.bold) item.bold = true;
    if (state.italic) item.italic = true;
    const alpha = fillPaint.alpha * state.fillOpacity * state.opacity;
    if (alpha < 1) item.opacity = round3(alpha);
    if (state.series) item.series = state.series;
    if (state.groups.length) item.groups = state.groups.slice(0, MAX_GROUPS);
    push(item, 0);
  };

  let useVisits = 0;
  const walk = (el: Element, parent: Inherited, depth: number, useDepth: number, trail: ReadonlySet<Element>): void => {
    if (++tags > SVG_CUSTGEOM_MAX_TAGS) throw new CapReached();
    const ns = el.namespaceURI;
    // A foreign namespace (a C2PA manifest, an editor's own metadata) is annotation.
    if (ns && ns !== SVG_NS) return;
    const tag = localOf(el);
    if (SILENT.has(tag)) return;
    const style = styleOf(el);
    const display = prop(el, style, 'display');
    if (display === 'none') return;
    if (ANIMATION.has(tag)) {
      omit('unsupported-element');
      return;
    }
    const m = transformOf(el, parent.m);
    if (!m) {
      omit('unsupported-element');
      return;
    }
    const state = inherit(el, { ...parent, m }, style);

    if (tag === 'g' || tag === 'a' || tag === 'svg') {
      if (depth > MAX_DEPTH) throw new CapReached();
      let inner = state;
      if (tag === 'svg' && depth > 0) {
        // A nested viewport: its own place and, when it states one, its own viewBox.
        const x = lengthIn(el.getAttribute('x') ?? undefined, state, 'x') ?? 0;
        const y = lengthIn(el.getAttribute('y') ?? undefined, state, 'y') ?? 0;
        const w = lengthIn(el.getAttribute('width') ?? '100%', state, 'x');
        const h = lengthIn(el.getAttribute('height') ?? '100%', state, 'y');
        const vb = (el.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
        let local: VectorMatrix = [1, 0, 0, 1, x, y];
        const hasViewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0;
        if (hasViewBox && w && h) {
          local = multiplyVectorMatrix(local, [w / vb[2]!, 0, 0, h / vb[3]!, -vb[0]! * (w / vb[2]!), -vb[1]! * (h / vb[3]!)]);
        }
        inner = {
          ...state,
          m: multiplyVectorMatrix(state.m, local),
          vw: hasViewBox ? vb[2]! : (w ?? state.vw),
          vh: hasViewBox ? vb[3]! : (h ?? state.vh),
        };
      }
      if (tag === 'g' && depth > 0) {
        const name = (el.getAttribute('id') ?? '').trim() || (el.getAttribute('class') ?? '').trim().split(/\s+/)[0] || '';
        if (name) inner = { ...inner, groups: [...inner.groups, name.slice(0, MAX_GROUP_NAME)] };
      }
      for (const child of kids(el)) walk(child, inner, depth + 1, useDepth, trail);
      return;
    }
    if (SHAPES.has(tag)) {
      shapeItem(el, tag, state, style);
      return;
    }
    if (tag === 'text') {
      textItem(el, state);
      return;
    }
    if (tag === 'use') {
      const href = (el.getAttribute('href') ?? el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '').trim();
      const target = href.startsWith('#') ? byId.get(href.slice(1)) : undefined;
      if (!target || trail.has(target) || useDepth >= MAX_USE_DEPTH) {
        omit('unsupported-element');
        return;
      }
      if (++useVisits > SVG_CUSTGEOM_MAX_TAGS) throw new CapReached();
      const x = lengthIn(el.getAttribute('x') ?? undefined, state, 'x') ?? 0;
      const y = lengthIn(el.getAttribute('y') ?? undefined, state, 'y') ?? 0;
      const placed = { ...state, m: multiplyVectorMatrix(state.m, [1, 0, 0, 1, x, y]) };
      const next = new Set(trail);
      next.add(target);
      // A symbol is walked as a group: it draws only where a use places it.
      if (localOf(target) === 'symbol') {
        for (const child of kids(target)) walk(child, placed, depth + 1, useDepth + 1, next);
      } else {
        walk(target, placed, depth + 1, useDepth + 1, next);
      }
      return;
    }
    // `<image>`, `<foreignObject>`, `<switch>`, `<textPath>` on its own, anything else.
    omit('unsupported-element');
  };

  const initial: Inherited = {
    m: [1, 0, 0, 1, 0, 0],
    fill: '#000000',
    fillOpacity: 1,
    fillRule: 'nonzero',
    stroke: 'none',
    strokeWidth: 1,
    strokeOpacity: 1,
    color: '#000000',
    opacity: 1,
    visible: true,
    fontSize: baseFont,
    bold: false,
    italic: false,
    vw: viewBox?.w ?? Number.NaN,
    vh: viewBox?.h ?? Number.NaN,
    groups: [],
  };

  let title: string | undefined;
  let desc: string | undefined;
  for (const child of kids(root)) {
    const tag = localOf(child);
    if (tag === 'title' && title === undefined) title = (child.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || undefined;
    if (tag === 'desc' && desc === undefined) desc = (child.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DESC) || undefined;
  }

  try {
    // The root's own transform is part of the drawing's user space; its paint and
    // opacity are inherited like a group's.
    const rootTransform = root.getAttribute('transform');
    if (rootTransform?.trim()) {
      try {
        initial.m = vectorMatrix(rootTransform.trim());
      } catch {
        return refused('unsupported-element', 1, viewBox);
      }
    }
    const state = inherit(root, initial, styleOf(root));
    for (const child of kids(root)) walk(child, state, 1, 0, new Set());
  } catch (err) {
    if (err instanceof CapReached) return refused('cap-reached', Math.max(seen, items.length + 1), viewBox ?? { x: 0, y: 0, w: 0, h: 0 });
    throw err;
  }

  if (!viewBox) {
    // No viewBox and no size: the drawing's user space is what its items cover.
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const item of items) {
      const b = item.kind === 'path' ? item.box : { x: item.x, y: item.y - item.size, w: 0, h: item.size };
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    viewBox = Number.isFinite(x0) && x1 > x0 && y1 > y0 ? { x: round3(x0), y: round3(y0), w: round3(x1 - x0), h: round3(y1 - y0) } : { x: 0, y: 0, w: 0, h: 0 };
  }

  const out: VectorItemsV1 = { version: 1, viewBox, items };
  if (omitted.size) out.omitted = [...omitted.entries()].map(([reason, count]) => ({ reason, count }));
  if (title) out.title = title;
  if (desc) out.desc = desc;
  return out;
}

/** True when these contours, placed in their own box, encode as one Design path value within its ceiling. */
function encodable(subs: SubPath[], box: { x: number; y: number; w: number; h: number }): boolean {
  const w = box.w > 0 ? box.w : 1;
  const h = box.h > 0 ? box.h : 1;
  try {
    const paths = authoredNodes(subs, box.x, box.y, 1, 1, w, h);
    return paths.length > 0 && encodeAuthoredPaths(paths).length <= VECTOR_ITEM_MAX_ENCODED;
  } catch {
    return false;
  }
}

/** Smallest detail a row keeps, in px of the row: finer than this nobody sees, and every digit is URL weight. */
const ROW_PRECISION_PX = 0.05;

/** Decimals a fraction of a `span` px axis keeps so a step on it stays under `ROW_PRECISION_PX`. */
function decimalsFor(span: number): number {
  return Math.max(2, Math.min(6, Math.ceil(Math.log10(Math.max(span, 1) / ROW_PRECISION_PX))));
}

/**
 * Parsed subpaths as Design path nodes, normalised to a `w` by `h` box whose origin
 * is `(ox, oy)` after scaling by `(sx, sy)`. A straight segment carries no handles,
 * which Design draws as a straight line, and a node's handles are written only where
 * a curve needs them, with no continuity stated (a node that states none is a corner,
 * which is what a drawn outline's nodes are); each axis keeps as many decimals as
 * `ROW_PRECISION_PX` asks at its own size, so a wide, short run of outlined label
 * glyphs writes its heights with fewer digits than its widths. Outlined glyph runs
 * are most of a chart's weight, so this is what keeps a deck of charts inside what a
 * Design document holds.
 */
function authoredNodes(subs: SubPath[], ox: number, oy: number, sx: number, sy: number, w: number, h: number): AuthoredPath[] {
  const qx = 10 ** decimalsFor(w);
  const qy = 10 ** decimalsFor(h);
  const nx = (x: number): number => Math.round(((x * sx - ox) / w) * qx) / qx;
  const ny = (y: number): number => Math.round(((y * sy - oy) / h) * qy) / qy;
  const out: AuthoredPath[] = [];
  for (const sub of subs) {
    const first = sub.segments[0];
    if (first?.op !== 'M') continue;
    const nodes: AuthoredPath['nodes'] = [{ x: nx(first.x), y: ny(first.y) }];
    for (const seg of sub.segments.slice(1)) {
      const prev = nodes[nodes.length - 1]!;
      if (seg.op === 'C') {
        const px = nx(seg.x);
        const py = ny(seg.y);
        const outX = Math.round((nx(seg.x1) - prev.x) * qx) / qx;
        const outY = Math.round((ny(seg.y1) - prev.y) * qy) / qy;
        const inX = Math.round((nx(seg.x2) - px) * qx) / qx;
        const inY = Math.round((ny(seg.y2) - py) * qy) / qy;
        if (outX || outY) { prev.hOutX = outX; prev.hOutY = outY; }
        const node: AuthoredPath['nodes'][number] = { x: px, y: py };
        if (inX || inY) { node.hInX = inX; node.hInY = inY; }
        nodes.push(node);
      } else {
        nodes.push({ x: nx(seg.x), y: ny(seg.y) });
      }
    }
    // A closed run that ends where it began names its start once: the last node's
    // incoming handle moves onto the first node, and the wrap closes the loop.
    const last = nodes[nodes.length - 1]!;
    if (sub.closed && nodes.length > 2 && Math.abs(last.x - nodes[0]!.x) < 1 / qx && Math.abs(last.y - nodes[0]!.y) < 1 / qy) {
      nodes.pop();
      if (last.hInX !== undefined) { nodes[0]!.hInX = last.hInX; nodes[0]!.hInY = last.hInY; }
    }
    if (nodes.length >= 2) out.push({ kind: 'cubic', closed: sub.closed, nodes });
  }
  return out;
}

// ─── outlined labels ─────────────────────────────────────────────────────────

/**
 * A run of outlined glyphs: one label drawn as filled paths rather than set as
 * text. Not a stored item kind: a run names the path items it covers, so a
 * reading can replace them with one text item, and a run nobody read stays as
 * the paths it was.
 */
export interface GlyphRunV1 {
  kind: 'glyph-run';
  /** Indices into `VectorItemsV1.items`, in paint order. Every one is a `path` item. */
  items: number[];
  /** The ink box of every glyph, in viewBox units. */
  box: { x: number; y: number; w: number; h: number };
  /** The line most glyphs stand on, in viewBox units. */
  baseline: number;
  /** How far the taller glyphs on the baseline reach above it (a digit, a capital, an ascender). */
  ascent: number;
  /** Glyphs, each counted once however many outlines it has (an `o` and its counter are one). */
  glyphs: number;
  /** Gaps between glyphs wide enough to be a word space. */
  spaces: number;
  /** The words those gaps part, left to right, each as its span across in viewBox units. */
  words: Array<{ x: number; w: number }>;
  /** Each glyph's ink box, left to right. */
  glyphBoxes: Array<{ x: number; y: number; w: number; h: number }>;
  /** The fill every glyph shares, `#rrggbb`. */
  fill: string;
  /** The fill opacity and the item opacity, multiplied, when under one. */
  opacity?: number;
  /** The source's group names around the run, outermost first. */
  groups?: string[];
  /** True when one of those groups names an axis, a legend, a label, a title or a tick. */
  labelGroup: boolean;
}

/** Group names that hold labels in the chart and diagram tools this reading has met. */
const LABEL_GROUP = /(axis|label|legend|tick|title|caption|annot|note|key|text)/i;
/** Subpaths one item may have and still be read as glyphs. */
const MAX_GLYPH_SUBPATHS = 4000;
/** A glyph taller than this share of the drawing's short side is artwork, not a label (a logo's wordmark). */
const MAX_GLYPH_SHARE = 0.25;

/** True when a group name reads as a place labels are kept. */
export function isLabelGroup(name: string): boolean {
  return LABEL_GROUP.test(name);
}

interface GlyphLine {
  box: { x0: number; y0: number; x1: number; y1: number };
  baseline: number;
  ascent: number;
  glyphs: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  fill: string;
  alpha: number;
  groupKey: string;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** The control-point box of one subpath. */
function subBox(sub: SubPath): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const at = (x: number, y: number): void => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const seg of sub.segments) {
    if (seg.op === 'C') { at(seg.x1, seg.y1); at(seg.x2, seg.y2); }
    at(seg.x, seg.y);
  }
  return Number.isFinite(x0) && x1 >= x0 && y1 >= y0 ? { x0, y0, x1, y1 } : null;
}

/**
 * One path item read as a line of glyphs, or null when it is not one: it must be a
 * plain filled path with no stroke, no series and no basic-shape origin; its
 * outlines, gathered into glyphs by where they overlap across, must mostly stand on
 * one baseline, none reaching far above or below it, none much wider than tall, with
 * no gap wider than a word space and a half; and its glyphs must be small against
 * the drawing, so a logo's lettering stays artwork.
 */
function glyphLineOf(item: VectorItemV1, short: number): GlyphLine | null {
  if (item.kind !== 'path' || item.shape || item.series || item.stroke) return null;
  if (!item.fill || !('hex' in item.fill) || !item.fill.hex) return null;
  let subs: SubPath[];
  try {
    subs = parseSvgPath(item.d);
  } catch {
    return null;
  }
  if (!subs.length || subs.length > MAX_GLYPH_SUBPATHS) return null;
  const boxes = subs.map(subBox).filter((b): b is NonNullable<typeof b> => b !== null).sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  if (!boxes.length) return null;
  // Outlines that overlap across and sit close one above the other are one glyph: a
  // counter, the dot of an i, the parts of a %. A mark a line away is not.
  const glyphs: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const b of boxes) {
    const last = glyphs[glyphs.length - 1];
    if (last) {
      const overlap = Math.min(last.x1, b.x1) - Math.max(last.x0, b.x0);
      const apart = Math.max(last.y0, b.y0) - Math.min(last.y1, b.y1);
      const near = apart <= Math.max(last.y1 - last.y0, b.y1 - b.y0);
      if (near && (overlap > 0.3 * Math.min(last.x1 - last.x0, b.x1 - b.x0) || (b.x0 >= last.x0 && b.x1 <= last.x1))) {
        last.x0 = Math.min(last.x0, b.x0); last.y0 = Math.min(last.y0, b.y0);
        last.x1 = Math.max(last.x1, b.x1); last.y1 = Math.max(last.y1, b.y1);
        continue;
      }
    }
    glyphs.push({ ...b });
  }
  const height = median(glyphs.map((g) => g.y1 - g.y0));
  if (!(height > 0)) return null;
  const baseline = median(glyphs.map((g) => g.y1));
  const tol = Math.max(0.12 * height, 1e-3);
  const onBase = glyphs.filter((g) => Math.abs(g.y1 - baseline) <= tol);
  if (onBase.length * 2 < glyphs.length) return null;
  // The tall glyphs standing on the line (capitals, digits, ascenders), not the x-height ones.
  const tallest = Math.max(...onBase.map((g) => baseline - g.y0));
  const ascent = median(onBase.map((g) => baseline - g.y0).filter((v) => v >= 0.8 * tallest));
  if (!(ascent > 0) || ascent > MAX_GLYPH_SHARE * short) return null;
  for (const g of glyphs) {
    if (g.y0 < baseline - 1.5 * ascent || g.y1 > baseline + 0.6 * ascent) return null;
    if (g.x1 - g.x0 > 2.2 * ascent) return null;
  }
  for (let i = 1; i < glyphs.length; i++) if (glyphs[i]!.x0 - glyphs[i - 1]!.x1 > 1.6 * ascent) return null;
  const box = {
    x0: Math.min(...glyphs.map((g) => g.x0)), y0: Math.min(...glyphs.map((g) => g.y0)),
    x1: Math.max(...glyphs.map((g) => g.x1)), y1: Math.max(...glyphs.map((g) => g.y1)),
  };
  const alpha = (item.fillOpacity ?? 1) * (item.opacity ?? 1);
  return {
    box, baseline, ascent, glyphs, fill: item.fill.hex.toLowerCase(), alpha,
    groupKey: (item.groups ?? []).join('\u001f'),
  };
}

/**
 * The runs of outlined glyphs in a drawing, in paint order. A run is one path item
 * whose outlines read as a line of glyphs, joined with the path items after it that
 * read the same way on the same baseline, in the same ink and group, close enough to
 * be the next glyph or word (an editor that writes one path per letter). A run of one
 * glyph counts only inside a label group (an axis tick of "0"); elsewhere a run needs
 * two, so a lone mark is not taken for a letter. A drawing of no size has none.
 */
export function glyphRunsOf(items: VectorItemsV1): GlyphRunV1[] {
  const short = Math.min(items.viewBox.w, items.viewBox.h);
  if (!(short > 0)) return [];
  const runs: GlyphRunV1[] = [];
  let open: { indices: number[]; line: GlyphLine; glyphs: GlyphLine['glyphs'] } | null = null;
  const close = (): void => {
    if (!open) return;
    const first = items.items[open.indices[0]!]!;
    const groups = first.groups;
    const labelGroup = (groups ?? []).some(isLabelGroup);
    const glyphs = [...open.glyphs].sort((a, b) => a.x0 - b.x0);
    if (glyphs.length >= 2 || labelGroup) {
      const { box, baseline, ascent, fill, alpha } = open.line;
      const words: Array<{ x0: number; x1: number }> = [];
      for (const g of glyphs) {
        const last = words[words.length - 1];
        if (last && g.x0 - last.x1 <= 0.22 * ascent) last.x1 = Math.max(last.x1, g.x1);
        else words.push({ x0: g.x0, x1: g.x1 });
      }
      const run: GlyphRunV1 = {
        kind: 'glyph-run',
        items: open.indices,
        box: { x: round3(box.x0), y: round3(box.y0), w: round3(box.x1 - box.x0), h: round3(box.y1 - box.y0) },
        baseline: round3(baseline),
        ascent: round3(ascent),
        glyphs: glyphs.length,
        spaces: words.length - 1,
        words: words.map((w) => ({ x: round3(w.x0), w: round3(w.x1 - w.x0) })),
        glyphBoxes: glyphs.map((g) => ({ x: round3(g.x0), y: round3(g.y0), w: round3(g.x1 - g.x0), h: round3(g.y1 - g.y0) })),
        fill,
        labelGroup,
      };
      if (alpha < 1) run.opacity = round3(alpha);
      if (groups?.length) run.groups = [...groups];
      runs.push(run);
    }
    open = null;
  };
  items.items.forEach((item, index) => {
    const line = glyphLineOf(item, short);
    if (!line) {
      close();
      return;
    }
    if (open) {
      const a = open.line;
      const gap = line.box.x0 - a.box.x1;
      const same = line.fill === a.fill && Math.abs(line.alpha - a.alpha) < 1e-3 && line.groupKey === a.groupKey
        && Math.abs(line.baseline - a.baseline) <= 0.15 * a.ascent && Math.abs(line.ascent - a.ascent) <= 0.25 * a.ascent
        && gap >= -0.3 * a.ascent && gap <= 1.6 * a.ascent;
      if (same) {
        open.indices.push(index);
        open.glyphs.push(...line.glyphs);
        a.box = { x0: Math.min(a.box.x0, line.box.x0), y0: Math.min(a.box.y0, line.box.y0), x1: Math.max(a.box.x1, line.box.x1), y1: Math.max(a.box.y1, line.box.y1) };
        a.ascent = Math.max(a.ascent, line.ascent);
        return;
      }
      close();
    }
    open = { indices: [index], line: { ...line, box: { ...line.box } }, glyphs: [...line.glyphs] };
  });
  close();
  return runs;
}

/** The words a drawing states about itself, which a reading of its outlined labels is checked against. */
export interface SvgLabelHintsV1 {
  /** Category and series names, from `data-recolor`, `data-series` and `data-name`, in document order, each once. */
  names: string[];
  title?: string;
  desc?: string;
}

const MAX_HINT_NAMES = 256;
const MAX_HINT_NAME = 300;

/**
 * The names an SVG states on its elements and its own title and description, read in
 * full (an item's `series` keeps 64 characters; a category name can be longer). A file
 * that cannot be parsed states none.
 */
export function svgLabelHintsOf(svgText: string, parseXml: SvgItemsXmlParser): SvgLabelHintsV1 {
  const out: SvgLabelHintsV1 = { names: [] };
  if (typeof svgText !== 'string' || !svgText || svgText.length > SVG_CUSTGEOM_MAX_CHARS) return out;
  let doc: Document;
  try {
    doc = parseXml(svgText);
  } catch {
    return out;
  }
  const root = doc?.documentElement;
  if (!root || localOf(root) !== 'svg') return out;
  const all = doc.getElementsByTagName('*');
  if (all.length > SVG_CUSTGEOM_MAX_TAGS) return out;
  const seen = new Set<string>();
  for (let i = 0; i < all.length && out.names.length < MAX_HINT_NAMES; i++) {
    const el = all[i];
    if (!el) continue;
    for (const attr of ['data-recolor', 'data-series', 'data-name']) {
      const raw = el.getAttribute(attr);
      const name = raw?.replace(/\s+/g, ' ').trim().slice(0, MAX_HINT_NAME);
      if (name && !seen.has(name)) {
        seen.add(name);
        out.names.push(name);
      }
    }
  }
  for (const child of kids(root)) {
    const tag = localOf(child);
    const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (tag === 'title' && out.title === undefined && text) out.title = text.slice(0, MAX_TITLE);
    if (tag === 'desc' && out.desc === undefined && text) out.desc = text.slice(0, MAX_DESC);
  }
  return out;
}

// ─── custom geometry ─────────────────────────────────────────────────────────

/** Paint a custom shape states, in the reference pixel space of its box. */
export interface CustGeomPaintV1 {
  fill?: SourceColorV1;
  line?: { color?: SourceColorV1; widthPx?: number };
}

/**
 * A shape's custom geometry as items in its own box, `0..w` by `0..h` in
 * reference px: one `path` item per `a:path`, each stretched from the path's
 * own space onto the box the way DrawingML stretches it. A path marked
 * `fill="none"` is outline only and one marked `stroke="0"` fill only; a path
 * that ends up painting nothing is dropped without a record, like every invisible
 * item. A box of no size on one axis is a straight freeform line: its outline
 * keeps that axis at 0 and the rows widen it by the stroke.
 */
export function custGeomItems(geom: PptxCustGeom, box: { w: number; h: number }, paint: CustGeomPaintV1): VectorItemsV1 {
  const w = Number.isFinite(box.w) && box.w > 0 ? box.w : 0;
  const h = Number.isFinite(box.h) && box.h > 0 ? box.h : 0;
  const out: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: round3(w), h: round3(h) }, items: [] };
  if (!w && !h) return out;
  let chars = 0;
  for (const path of geom.paths) {
    if (out.items.length >= VECTOR_ITEMS_MAX) break;
    const subs = transformSubPaths(parseSvgPath(path.d), [path.w > 0 ? w / path.w : 0, 0, 0, path.h > 0 ? h / path.h : 0, 0, 0]);
    if (!subs.length) continue;
    const bounds = pathBounds(pathFromSubPaths(subs));
    if (!bounds) continue;
    const itemBox = { x: round3(bounds.x0), y: round3(bounds.y0), w: round3(bounds.x1 - bounds.x0), h: round3(bounds.y1 - bounds.y0) };
    const fills = !path.noFill && Boolean(paint.fill?.hex) && itemBox.w > 0 && itemBox.h > 0;
    const strokeW = paint.line?.widthPx ?? (paint.line?.color?.hex ? 1 : 0);
    const strokes = !path.noStroke && Boolean(paint.line?.color?.hex) && strokeW > 0;
    if (!fills && !strokes) continue;
    const d = dOf(subs);
    chars += d.length;
    if (chars > VECTOR_ITEMS_MAX_CHARS) {
      return { ...out, items: [], omitted: [{ reason: 'cap-reached', count: geom.paths.length }] };
    }
    const item: VectorPathItemV1 = { kind: 'path', d, box: itemBox };
    item.fill = fills && paint.fill ? { ...paint.fill } : { none: true };
    if (fills && typeof paint.fill?.alpha === 'number' && paint.fill.alpha < 1) item.fillOpacity = round3(paint.fill.alpha);
    if (strokes && paint.line?.color) {
      const stroke: NonNullable<VectorPathItemV1['stroke']> = { color: { ...paint.line.color }, width: round3(strokeW) };
      if (typeof paint.line.color.alpha === 'number' && paint.line.color.alpha < 1) stroke.opacity = round3(paint.line.color.alpha);
      item.stroke = stroke;
    }
    out.items.push(item);
  }
  return out;
}

// ─── items as Design rows ────────────────────────────────────────────────────

/** Where a drawing's rows go, and what they are called. */
export interface VectorRowsOptsV1 {
  /** Row ids are `<idPrefix>.i<n>`, in paint order. */
  idPrefix: string;
  /** The group every row shares; one Ungroup in Design takes the drawing apart. */
  group: string;
  /** The frame the rows sit on, when they sit on one. */
  frame?: string;
  /** `contain` keeps the drawing's proportions inside the box (a slot); `fill` stretches it onto the box, as PowerPoint draws a picture. */
  fit: 'contain' | 'fill';
  /** Rows at most; past it no rows are made. Defaults to `MAX_VECTOR_ROWS_PER_OBJECT`. */
  maxRows?: number;
}

/** The box a drawing is placed in, with the pose a source object states. */
export interface VectorPlacementV1 {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export type VectorRowsResultV1 =
  | { rows: DesignBoxRowV1[]; box: { x: number; y: number; w: number; h: number } }
  | { refused: 'cap-reached' | 'empty' | 'unplaceable' };

/** English kind words a compile writes into a row's name. The handoff says them in the person's language. */
export const VECTOR_ROW_KIND_WORDS = ['Shape', 'Drawing', 'Line', 'Text'] as const;

function r2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/** `#rrggbb`, with an alpha pair when the opacity is under one. */
function hexWithAlpha(hex: string, alpha: number | undefined): string {
  const base = hex.trim().toLowerCase().replace(/^#/, '').slice(0, 6);
  if (alpha === undefined || alpha >= 1) return `#${base}`;
  return `#${base}${Math.round(Math.max(0, alpha) * 255).toString(16).padStart(2, '0')}`;
}

/** The name a row takes: the item's series, else the source's own group name, after a kind word. */
function rowName(kind: (typeof VECTOR_ROW_KIND_WORDS)[number], item: VectorItemV1): string {
  const label = item.series ?? item.groups?.at(-1);
  return label ? `${kind}: ${label}` : kind;
}

/**
 * Place a drawing's items in a box as Design rows, one per item, in paint order,
 * all in one group. A `rect` item becomes a `box` row (a bar a person rounds or
 * recolours as a box), a `text` item a `text` row with its face, and every other
 * item a `path` row whose nodes are normalised to its own box, the form Design's
 * path field stores. An `ellipse` item is a path row too: a deck has no ellipse in
 * the flat shapes Design lowers a box to, so a chart's dots and markers would come
 * back square from a round trip. Opacity is written 0 to 100, stroke caps and joins
 * are always written (SVG's butt and miter, where Design's own default is
 * round), a dash becomes Design's dashed stroke with the first dash and gap, and
 * a fill or stroke opacity rides on the colour as an alpha pair.
 *
 * A posed box (a rotated or mirrored source picture) turns every row about the
 * box centre: each row keeps its own shape and takes the same turn and mirror,
 * with its centre carried round, which is the same drawing. A line or a bar of
 * no width is widened by half its stroke on each side, so its box never divides
 * by zero. Refused, with the reason, when there are more items than rows allowed
 * or nothing drawable.
 */
export function vectorItemsToRows(items: VectorItemsV1, place: VectorPlacementV1, opts: VectorRowsOptsV1): VectorRowsResultV1 {
  const maxRows = opts.maxRows ?? MAX_VECTOR_ROWS_PER_OBJECT;
  const vb = items.viewBox;
  if (!items.items.length) return { refused: 'empty' };
  if (items.items.length > maxRows) return { refused: 'cap-reached' };
  const finite = [vb.x, vb.y, vb.w, vb.h, place.x, place.y, place.w, place.h].every(Number.isFinite);
  // A drawing of no size on one axis (a straight freeform line) keeps that axis as it
  // is; one of no size on both, or a box of no size on both, has nothing to place.
  const spanX = vb.w > 0;
  const spanY = vb.h > 0;
  if (!finite || vb.w < 0 || vb.h < 0 || place.w < 0 || place.h < 0 || (!spanX && !spanY)) return { refused: 'unplaceable' };

  let sx = spanX ? place.w / vb.w : 1;
  let sy = spanY ? place.h / vb.h : 1;
  let ox = place.x;
  let oy = place.y;
  if (opts.fit === 'contain') {
    const s = Math.min(spanX ? sx : Infinity, spanY ? sy : Infinity);
    sx = s;
    sy = s;
    ox = place.x + (place.w - vb.w * s) / 2;
    oy = place.y + (place.h - vb.h * s) / 2;
  }
  const realX = spanX && sx > 0;
  const realY = spanY && sy > 0;
  if (!realX && !realY) return { refused: 'unplaceable' };
  const drawn = { x: r2(ox), y: r2(oy), w: r2(vb.w * sx), h: r2(vb.h * sy) };
  const mapX = (x: number): number => ox + (x - vb.x) * sx;
  const mapY = (y: number): number => oy + (y - vb.y) * sy;
  const lineScale = realX && realY ? Math.sqrt(sx * sy) : realX ? sx : sy;
  const rot = place.rot ?? 0;
  const flipH = place.flipH === true;
  const flipV = place.flipV === true;
  const posed = rot !== 0 || flipH || flipV;
  const cx0 = place.x + place.w / 2;
  const cy0 = place.y + place.h / 2;
  const cos = Math.cos((rot * Math.PI) / 180);
  const sin = Math.sin((rot * Math.PI) / 180);

  const rows: DesignBoxRowV1[] = [];
  /** Set the row's box, carrying its centre round the placement's own pose. */
  const setBox = (row: DesignBoxRowV1, x: number, y: number, w: number, h: number): void => {
    if (!posed) {
      row.x = r2(x); row.y = r2(y); row.w = r2(w); row.h = r2(h);
      return;
    }
    // Mirror then turn about the placement's centre: the order the source pose and
    // Design's own row pose both use.
    let dx = x + w / 2 - cx0;
    let dy = y + h / 2 - cy0;
    if (flipH) dx = -dx;
    if (flipV) dy = -dy;
    const cx = cx0 + dx * cos - dy * sin;
    const cy = cy0 + dx * sin + dy * cos;
    row.x = r2(cx - w / 2); row.y = r2(cy - h / 2); row.w = r2(w); row.h = r2(h);
    if (rot !== 0) row.rot = r2(rot);
    if (flipH) row.flipH = true;
    if (flipV) row.flipV = true;
  };

  let n = 0;
  for (const item of items.items) {
    const id = `${opts.idPrefix}.i${n}`;
    const row: DesignBoxRowV1 = { id, group: opts.group };
    if (opts.frame) row.frame = opts.frame;
    if (item.kind === 'text') {
      const size = item.size * sy;
      if (!(size > 0)) continue;
      const width = Math.max(size, labelWidthEm(item.text) * size);
      const height = size * 1.25;
      const x = mapX(item.x);
      const left = item.anchor === 'middle' ? x - width / 2 : item.anchor === 'end' ? x - width : x;
      const top = mapY(item.y) - size * 0.95;
      row.kind = 'text';
      setBox(row, left, top, width, height);
      row.text = designTextFromPlain(item.text);
      row.fontSize = r2(size);
      row.align = item.anchor === 'middle' ? 'center' : item.anchor === 'end' ? 'right' : 'left';
      row.valign = 'top';
      row.weight = item.bold ? 700 : 400;
      row.pad = 0;
      if (item.font) row.font = item.font;
      if (item.fill?.hex) row.fg = hexWithAlpha(item.fill.hex, undefined);
      if (item.opacity !== undefined && item.opacity < 1) row.opacity = Math.round(item.opacity * 100);
      row.name = rowName('Text', item);
      rows.push(row);
      n += 1;
      continue;
    }
    const strokeW = item.stroke ? item.stroke.width * lineScale : 0;
    let x = mapX(item.box.x);
    let y = mapY(item.box.y);
    let w = item.box.w * sx;
    let h = item.box.h * sy;
    // A line or a bar of no width still draws its stroke, so its box is widened by
    // half the stroke each side rather than left to divide by zero.
    const pad = Math.max(strokeW / 2, 0.5);
    if (w < 1e-6) { x -= pad; w = pad * 2; }
    if (h < 1e-6) { y -= pad; h = pad * 2; }
    const fill = item.fill && 'hex' in item.fill && item.fill.hex ? hexWithAlpha(item.fill.hex, item.fillOpacity) : '';
    if (item.shape === 'rect') {
      row.kind = 'box';
      if (item.rx && item.rx > 0) {
        row.shape = 'rounded';
        row.radius = r2(item.rx * Math.min(sx, sy));
      } else row.shape = 'rect';
      row.name = rowName('Shape', item);
    } else {
      // The row box's origin in the item's own space, scaled: every point moves by it.
      const paths = authoredNodes(parseSvgPath(item.d), (x - ox) + vb.x * sx, (y - oy) + vb.y * sy, sx, sy, w, h);
      if (!paths.length) continue;
      let value: string;
      try {
        value = encodeAuthoredPaths(paths);
      } catch {
        return { refused: 'cap-reached' };
      }
      if (value.length > VECTOR_ITEM_MAX_ENCODED) return { refused: 'cap-reached' };
      row.kind = 'path';
      row.path = value;
      row.fillRule = item.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
      row.name = rowName(item.shape === 'line' ? 'Line' : 'Drawing', item);
    }
    setBox(row, x, y, w, h);
    row.bg = fill;
    if (item.stroke) {
      row.stroke = hexWithAlpha(item.stroke.color.hex ?? '#000000', item.stroke.opacity);
      row.strokeW = r2(Math.min(400, strokeW));
      // SVG's own defaults, written out: Design's are round.
      row.strokeCap = item.stroke.cap ?? 'butt';
      row.strokeJoin = item.stroke.join ?? 'miter';
      const dash = item.stroke.dash;
      if (dash && dash.length >= 2) {
        row.strokeDash = 'dashed';
        row.strokeDashLen = r2(Math.min(400, (dash[0] ?? 0) * lineScale));
        row.strokeGapLen = r2(Math.min(400, (dash[1] ?? 0) * lineScale));
      }
    } else {
      row.stroke = '';
      row.strokeW = 0;
    }
    if (item.opacity !== undefined && item.opacity < 1) row.opacity = Math.round(item.opacity * 100);
    rows.push(row);
    n += 1;
  }
  if (!rows.length) return { refused: 'empty' };
  return { rows, box: drawn };
}

/**
 * A generous width for a one-line label, in em: a narrow advance for thin glyphs, a
 * wide one for capitals, `%`, `@`, `m` and `w`, and a little slack, so the label does
 * not wrap in Design when the face that sets it is wider than the one that drew it.
 * A box a little wider than the words is harmless, since the row keeps the label's
 * anchor through its alignment. It is never narrower than the compile's own measure
 * (half an em a character, `AVERAGE_GLYPH_EM` in deck-compile.ts, plus one), so the
 * fit pass never counts a label as wrapped and cut when the drawing shows it whole.
 */
function labelWidthEm(text: string): number {
  const floor = ([...text].length + 1) * 0.5;
  let em = 0.2;
  for (const ch of text) {
    if (ch === ' ') em += 0.3;
    else if (/[.,:;'|!ijlI]/.test(ch)) em += 0.32;
    else if (/[%@mwMW]/.test(ch)) em += 0.95;
    else if (/[A-Z]/.test(ch)) em += 0.72;
    else if (/[0-9]/.test(ch)) em += 0.62;
    else em += 0.6;
  }
  return Math.max(em, floor);
}

/** Characters of encoded path values a set of rows holds, what `MAX_VECTOR_PATH_CHARS_PER_DOCUMENT` counts. */
export function vectorRowsPathChars(rows: readonly DesignBoxRowV1[]): number {
  let n = 0;
  for (const row of rows) if (row.kind === 'path' && typeof row.path === 'string') n += row.path.length;
  return n;
}

/**
 * A drawing row's name taken apart again: the English kind word the compile wrote
 * (one of `VECTOR_ROW_KIND_WORDS`) and the drawing's own label for the part, a series
 * or a group name, when it states one. Undefined for a name no drawing row carries.
 * The writer and this reader sit side by side, so a surface that says the kind word in
 * the person's language never parses a name the compile did not write.
 */
export function vectorRowNameParts(name: string): { kind: (typeof VECTOR_ROW_KIND_WORDS)[number]; label?: string } | undefined {
  const at = name.indexOf(': ');
  const head = at >= 0 ? name.slice(0, at) : name;
  const kind = VECTOR_ROW_KIND_WORDS.find((word) => word === head);
  if (!kind) return undefined;
  const label = at >= 0 ? name.slice(at + 2).trim() : '';
  return label ? { kind, label } : { kind };
}

/** A picture's crop, as fractions of its source cut from each edge (DrawingML `a:srcRect`); negative is a margin. */
export interface VectorCropV1 {
  l?: number;
  t?: number;
  r?: number;
  b?: number;
}

/** The part of a viewBox a crop leaves showing, or null when it leaves nothing. */
export function cropViewBox(vb: VectorItemsV1['viewBox'], crop: VectorCropV1): VectorItemsV1['viewBox'] | null {
  const f = (v: number | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-10, Math.min(1, v)) : 0);
  const l = f(crop.l);
  const t = f(crop.t);
  const r = f(crop.r);
  const b = f(crop.b);
  const w = vb.w * (1 - l - r);
  const h = vb.h * (1 - t - b);
  if (!(w > 0) || !(h > 0)) return null;
  return { x: round3(vb.x + vb.w * l), y: round3(vb.y + vb.h * t), w: round3(w), h: round3(h) };
}

/**
 * A drawing as its crop shows it: the viewBox cut to what the crop leaves, the parts
 * wholly outside dropped (the picture never showed them), and null when a part
 * crosses the crop's edge, because a row cannot be clipped and would draw past the
 * frame. A crop of nothing returns the drawing as it is.
 */
export function cropVectorItems(items: VectorItemsV1, crop: VectorCropV1): VectorItemsV1 | null {
  if (!crop.l && !crop.t && !crop.r && !crop.b) return items;
  const vb = cropViewBox(items.viewBox, crop);
  if (!vb) return null;
  const edge = 0.5;
  const kept: VectorItemV1[] = [];
  for (const item of items.items) {
    let x0: number; let y0: number; let x1: number; let y1: number;
    if (item.kind === 'text') {
      const width = Math.max(item.size, labelWidthEm(item.text) * item.size);
      x0 = item.anchor === 'middle' ? item.x - width / 2 : item.anchor === 'end' ? item.x - width : item.x;
      x1 = x0 + width;
      y0 = item.y - item.size * 0.95;
      y1 = item.y + item.size * 0.3;
    } else {
      x0 = item.box.x; y0 = item.box.y; x1 = item.box.x + item.box.w; y1 = item.box.y + item.box.h;
    }
    const outside = x1 <= vb.x || y1 <= vb.y || x0 >= vb.x + vb.w || y0 >= vb.y + vb.h;
    if (outside) continue;
    const inside = x0 >= vb.x - edge && y0 >= vb.y - edge && x1 <= vb.x + vb.w + edge && y1 <= vb.y + vb.h + edge;
    if (!inside) return null;
    kept.push(item);
  }
  if (!kept.length) return null;
  return { ...items, viewBox: vb, items: kept };
}

// ─── items as SVG markup ─────────────────────────────────────────────────────

/** XML-escape an attribute value or text. */
function escXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'));
}

/** A colour for markup: `#rrggbb` only, so nothing a file stated reaches an attribute unread. */
function markupHex(hex: string | undefined): string | undefined {
  const m = /^#?([0-9a-fA-F]{6})/.exec((hex ?? '').trim());
  return m ? `#${m[1]!.toLowerCase()}` : undefined;
}

/**
 * The items drawn as SVG elements in the drawing's own user space: one `<path>` per
 * path item and one `<text>` per text item, in paint order. Built from the items
 * alone, never from the source markup, so it holds no script, no style sheet, no
 * handler and no outside reference whatever the source held: a preview or a download
 * can show it as it is.
 */
export function vectorItemsSvg(items: VectorItemsV1): string {
  const out: string[] = [];
  for (const item of items.items) {
    if (item.kind === 'text') {
      const fill = markupHex(item.fill?.hex) ?? '#000000';
      const attrs = [`x="${round3(item.x)}"`, `y="${round3(item.y)}"`, `font-size="${round3(item.size)}"`, `fill="${fill}"`];
      if (item.anchor) attrs.push(`text-anchor="${item.anchor}"`);
      if (item.font) attrs.push(`font-family="${escXml(item.font)}"`);
      if (item.bold) attrs.push('font-weight="700"');
      if (item.italic) attrs.push('font-style="italic"');
      if (item.opacity !== undefined && item.opacity < 1) attrs.push(`opacity="${round3(item.opacity)}"`);
      out.push(`<text ${attrs.join(' ')}>${escXml(item.text)}</text>`);
      continue;
    }
    const fill = item.fill && 'hex' in item.fill ? markupHex(item.fill.hex) : undefined;
    const attrs = [`d="${escXml(item.d)}"`, `fill="${fill ?? 'none'}"`];
    if (fill && item.fillOpacity !== undefined && item.fillOpacity < 1) attrs.push(`fill-opacity="${round3(item.fillOpacity)}"`);
    if (fill && item.fillRule === 'evenodd') attrs.push('fill-rule="evenodd"');
    const stroke = item.stroke ? markupHex(item.stroke.color.hex) : undefined;
    if (item.stroke && stroke) {
      attrs.push(`stroke="${stroke}"`, `stroke-width="${round3(item.stroke.width)}"`);
      if (item.stroke.opacity !== undefined && item.stroke.opacity < 1) attrs.push(`stroke-opacity="${round3(item.stroke.opacity)}"`);
      if (item.stroke.cap) attrs.push(`stroke-linecap="${item.stroke.cap}"`);
      if (item.stroke.join) attrs.push(`stroke-linejoin="${item.stroke.join}"`);
      if (item.stroke.dash?.length) attrs.push(`stroke-dasharray="${item.stroke.dash.map(round3).join(' ')}"`);
    }
    if (item.opacity !== undefined && item.opacity < 1) attrs.push(`opacity="${round3(item.opacity)}"`);
    out.push(`<path ${attrs.join(' ')}/>`);
  }
  return out.join('');
}

/** The items as a standalone SVG document at their own viewBox, with the drawing's title when it states one. */
export function vectorItemsDocument(items: VectorItemsV1): string {
  const vb = items.viewBox;
  const w = round3(vb.w > 0 ? vb.w : 1);
  const h = round3(vb.h > 0 ? vb.h : 1);
  const title = items.title ? `<title>${escXml(items.title)}</title>` : '';
  const desc = items.desc ? `<desc>${escXml(items.desc)}</desc>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round3(vb.x)} ${round3(vb.y)} ${w} ${h}" width="${w}" height="${h}">${title}${desc}${vectorItemsSvg(items)}</svg>`;
}
