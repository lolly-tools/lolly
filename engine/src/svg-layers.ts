// SPDX-License-Identifier: MPL-2.0
/**
 * Lift layers — enumerate an SVG's own layers and derive a standalone document
 * for each one (plans/104 §7).
 *
 * The action a user sees is "Lift layers" on a box holding an SVG: the artwork
 * comes apart into N stacked boxes at staggered depth, so a camera move gets
 * real parallax over real vector groups instead of an ML-inferred depth map.
 * This module is the half of that which has to be right — everything the shell
 * does afterwards (mint ids, sanitise, write rows) is bookkeeping over what is
 * returned here.
 *
 * ## Why the engine owns it
 *
 * Wire formats and the maths every shell must agree on live in the engine, and
 * a lifted layer is both: the derived markup is what gets stored in a box, and
 * a headless posed still (the CLI's Tier-A path) has to be able to produce the
 * same layers from the same bytes. So this is DOM-free — no `DOMParser`, no
 * `getBBox` — which is also why the bounding boxes here are *analytic and
 * best-effort*: computed from geometry attributes and path control points, not
 * measured by a renderer. They are used for CLUSTERING and for the picker's
 * preview, never for placement (a derived layer keeps the ROOT coordinate
 * system verbatim, so placement is the source box's, unchanged).
 *
 * ## What a layer is
 *
 * The root's direct children, in paint order:
 *
 *   • every `<g>` is a layer — that is what a designer's "layer" already is;
 *   • stray leaves (`<path>`, `<rect>`, … dropped straight onto the root by a
 *     generator that never grouped anything) are clustered SPATIALLY, the
 *     `pdf-artwork.ts` posture verbatim: *group is a hint, never a
 *     requirement*. That module's reasoning applies unchanged here — an
 *     Illustrator export routinely wraps a whole drawing in one `<g>` while a
 *     plotter or a chart library emits fifty ungrouped paths;
 *   • a single wrapping `<g>` with nothing beside it is DESCENDED THROUGH
 *     (`<g id="Layer_1">` around the entire drawing is the most common shape of
 *     SVG there is, and lifting "1 layer" out of it is useless). The wrapper is
 *     reproduced as an ancestor in every derived document, so geometry and
 *     inherited paint are preserved exactly — and descent REFUSES a wrapper
 *     whose attributes composite its children as a unit (`opacity` below 1,
 *     `filter`, `mask`, `mix-blend-mode`, `isolation`), because splitting those
 *     changes the picture wherever children overlap.
 *
 * ## The identity property
 *
 * The layers are a PARTITION of the root's rendered children, in order, with
 * every non-rendering sibling (`<defs>`, `<style>`, paint servers) carried into
 * each derived document whole. So stacking the N derived documents in order
 * reproduces the original: `source-over` is associative, and a `<defs>` paints
 * nothing, so repeating it N times costs bytes and changes no pixel. That is
 * `plans/104` §7's "N lifted layers at z = 0 render byte-identical to the
 * un-lifted original", and it is asserted both ways — the structural partition
 * BYTE-EXACTLY in `tests/svg-layers.test.ts`, the rendered composite in a real
 * engine in `tests/svg-lift-identity.browser.test.ts`.
 *
 * ⚑ The rendered half is exact to within compositing rounding, not to the byte,
 * and the reason is not ours: a browser rasterises each layer into its own 8-bit
 * PREMULTIPLIED buffer before compositing, so it rounds twice where the
 * single-pass render rounds once. Measured (Chromium, 320×240): every channel
 * within ±1 except at most 0.025 % of them, worst single channel 56/255 — a
 * near-zero-coverage pixel at a star's spike, where premultiplied alpha cannot
 * carry a saturated colour. Structural identity is byte-exact and is the
 * property this module owes; the pixel bounds are in that test's header with
 * the full table.
 *
 * Two things keep that property true rather than merely hoped for:
 *
 *   1. **Paint-order safety.** Clustering may only merge leaves that nothing
 *      else paints between. A cluster that another layer's ink passes through
 *      is split back into its contiguous runs rather than reordered.
 *   2. **Cross-layer references.** `<use href="#p">` where `#p` lives inside a
 *      DIFFERENT layer is the pathological case §11 names. The referenced
 *      element is copied into the borrowing layer's own `<defs>` — where it
 *      paints nothing, so the copy cannot double-draw — and a warning says so.
 *
 * ## Names
 *
 * Labels are `Layer 1..N`, always. `data-name`/`inkscape:label` are stripped as
 * PII at ingest (`strip-metadata.ts`) and STAY stripped: this module never
 * reads a name out of the file, and the derived documents drop `<title>`,
 * `<desc>` and `<metadata>` at the top level for the same reason. The shell
 * localises by index; `label` is the untranslated fallback.
 *
 * ## Untrusted input
 *
 * The input is a user's uploaded SVG (already DOMPurify-sanitised by the shell,
 * but this module assumes nothing about that). Every bound is a named constant
 * below, work is linear in the input length, and NOTHING here throws: junk
 * yields fewer layers and more warnings. See `docs/parser-inventory.md`.
 */

import { parseSvgPath } from './svg-path.ts';

// ─── caps (untrusted SVG text — every one of these is a refusal, not a crash) ──

/** Longest document scanned, in chars. Beyond it: no layers, one warning. */
export const SVG_LAYERS_MAX_CHARS = 4_000_000;
/** Tag ceiling for one scan — the same bound `svg-custgeom.ts` uses. */
export const SVG_LAYERS_MAX_TAGS = 40_000;
/**
 * Most layers returned. A deeper stack is not a lift, it is a mess — and each
 * layer becomes a real box with its own plate at export time.
 *
 * At the ceiling the TAIL MERGES rather than truncating: trailing candidates are
 * always a contiguous run, so merging them preserves paint order and the
 * identity property survives the cap. A cap that dropped artwork would silently
 * produce a lift that no longer looks like the original.
 */
export const SVG_LAYERS_MAX = 64;
/**
 * Root children considered at all — `pdf-artwork.ts`'s `MAX_NODES` in a new
 * costume, and for the same reason: spatial clustering is a pairwise union-find,
 * so its cost is QUADRATIC in the number of stray leaves. Measured on this
 * module before the cap existed: 4 000 leaves 78 ms, 10 000 leaves 0.7 s,
 * 20 000 leaves 4.3 s, 39 000 leaves 16 s — a hang, on markup a stranger sends.
 *
 * Past the cap the tail is not dropped, it is ONE layer: a contiguous run at the
 * end of the document, so folding it together cannot reorder any ink. A 20 000
 * path map still lifts, it just lifts into "the first few thousand shapes,
 * clustered" plus "the rest".
 */
export const SVG_LAYERS_MAX_CANDIDATES = 4000;
/** Nesting depth beyond which a subtree is not descended (bbox + child scans). */
export const SVG_LAYERS_MAX_DEPTH = 64;
/** Single-child wrappers descended through before giving up. */
export const SVG_LAYERS_MAX_DESCENT = 8;
/** Cross-layer `#id` references repaired per derived document. */
export const SVG_LAYERS_MAX_REFS = 64;

// ─── clustering tunables (root user units; the pdf-artwork.ts shape) ─────────

/** Leaves closer than this are the same mark. */
const CLUSTER_GAP = 6;
/** …scaled by the typical shape, so big art tolerates bigger internal gaps. */
const GAP_FACTOR = 0.4;
/** …clamped, so sparse decoration cannot collapse into one blob. */
const MAX_CLUSTER_GAP = 48;

// ─── element vocabulary ─────────────────────────────────────────────────────

/**
 * Dropped from a derived document entirely. Three of these are names or
 * provenance (the PII posture), and `script` is defence in depth — the shell
 * sanitises before this module ever sees the markup, and a script is inert
 * inside an `<img>` anyway, but a lifted layer must not be the path that
 * reintroduces one.
 */
const DROP_TAGS = new Set(['title', 'desc', 'metadata', 'script']);

/**
 * Non-rendering top-level siblings, carried into EVERY derived layer whole.
 *
 * The plan's own call — "root attrs + the WHOLE `<defs>` per layer — cheap,
 * correct for cross-refs". Correct because a paint server, a clip path or a
 * `<style>` may be referenced from any layer; cheap because these bytes paint
 * nothing, so repeating them cannot change a pixel.
 */
const CARRY_TAGS = new Set([
  'defs', 'style', 'symbol', 'marker', 'pattern', 'filter', 'mask', 'clippath',
  'lineargradient', 'radialgradient', 'meshgradient', 'solidcolor',
  'font', 'font-face', 'color-profile', 'cursor', 'view',
]);

/** Groups whose children are the thing to enumerate, not the group itself. */
const CONTAINER_TAGS = new Set(['g', 'a', 'switch']);

/**
 * Properties that make a `<g>` composite its children AS A UNIT, whether they
 * arrive as attributes or inside `style`. A wrapper carrying any of them is not
 * transparent, so descent stops there: applying `opacity:.5` to each of three
 * overlapping children separately is a visibly different picture from applying
 * it once to the three together.
 *
 * `transform` and `clip-path` are deliberately NOT here. Both are idempotent
 * under the split — the wrapper is reproduced verbatim in every derived
 * document, and clipping each layer by the same path gives exactly the union of
 * the clipped layers — so refusing them would cost the descent for nothing.
 */
const UNIT_PROPS = ['opacity', 'filter', 'mask', 'mix-blend-mode', 'isolation'] as const;

// ─── public shape ───────────────────────────────────────────────────────────

/** A rectangle in the source's ROOT user units (viewBox space). */
export interface SvgLayerBox { x: number; y: number; w: number; h: number }

export interface SvgLayer {
  /**
   * A standalone `<svg>` document rendering ONLY this layer, in the source's
   * root coordinate system — same root attributes, same viewBox, so it drops
   * into a box of the source's geometry with no fix-up at all.
   */
  markup: string;
  /**
   * Analytic bounds of the layer's ink in root user units, or null when nothing
   * in it could be measured without a renderer (`<text>`, `<use>`, filter
   * spill). Advisory: for previews and clustering, never for placement.
   */
  bbox: SvgLayerBox | null;
  /** `Layer 1`… — an index, never a name from the file. Shells localise it. */
  label: string;
  /** 0-based position in paint order (bottom first). */
  index: number;
  /** How many of the source's own top-level nodes this layer carries. */
  nodes: number;
  /**
   * The walker's `data-box-id`, when the layer is a single node carrying one —
   * the §7 identity passthrough (`renderSvgFromHtml`'s `layerIds` option)
   * arriving at the other end. Absent for ordinary artwork.
   */
  boxId?: string;
}

export interface SvgLayersResult {
  layers: SvgLayer[];
  /** Everything refused, repaired or capped, in plain words. Never thrown. */
  warnings: string[];
}

export interface SvgLayerOptions {
  /** Lower the layer ceiling (never raises it above {@link SVG_LAYERS_MAX}). */
  maxLayers?: number;
}

// ─── a minimal, bounded tag scanner ─────────────────────────────────────────
//
// Not a parser and not a DOM: a flat list of element tags with their byte spans,
// which is all the derivation needs — every emitted fragment is a VERBATIM SLICE
// of the input, so nothing is re-serialised and nothing can be corrupted on the
// way through. (`strip-metadata.ts` has a tokenizer of its own with a different
// job: it REBUILDS tags to drop attributes, and carries no spans and no nesting.
// Two small scanners beat one shared one that has to do both.)

interface Tag {
  /** Lower-cased local name, namespace prefix removed — what logic tests. */
  name: string;
  /** The name exactly as written, prefix and case intact — what is re-emitted. */
  qname: string;
  /** Raw attribute text, exactly as written. */
  attrs: string;
  kind: 'open' | 'close' | 'self';
  /** Offsets of the tag itself in the source string. */
  start: number;
  end: number;
}

function localName(raw: string): string {
  const c = raw.indexOf(':');
  return (c > 0 ? raw.slice(c + 1) : raw).toLowerCase();
}

function scanTags(s: string): Tag[] | null {
  const tags: Tag[] = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (s.startsWith('<![CDATA[', lt)) { const e = s.indexOf(']]>', lt + 9); i = e < 0 ? n : e + 3; continue; }
    if (s.startsWith('<!', lt)) { const e = s.indexOf('>', lt); i = e < 0 ? n : e + 1; continue; }
    if (s.startsWith('<?', lt)) { const e = s.indexOf('?>', lt); i = e < 0 ? n : e + 2; continue; }

    // An element tag. Quote-aware scan to the closing '>' so an attribute value
    // containing '>' (a `d` written without spaces, a style declaration) cannot
    // end it early.
    let j = lt + 1;
    let quote = '';
    while (j < n) {
      const c = s[j]!;
      if (quote) { if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    const end = j < n ? j + 1 : n;
    const inner = s.slice(lt + 1, j < n ? j : n);
    if (inner[0] === '/') {
      const q = inner.slice(1).trim();
      tags.push({ name: localName(q), qname: q, attrs: '', kind: 'close', start: lt, end });
    } else {
      const self = inner.endsWith('/');
      const body = self ? inner.slice(0, -1) : inner;
      const m = /^\s*([^\s/>]+)/.exec(body);
      const q = m ? m[1]! : '';
      tags.push({
        name: localName(q),
        qname: q,
        attrs: m ? body.slice(m[0].length) : '',
        kind: self ? 'self' : 'open',
        start: lt,
        end,
      });
    }
    if (tags.length > SVG_LAYERS_MAX_TAGS) return null;
    i = end;
  }
  return tags;
}

/** Read one attribute out of a raw attribute string. Quoted forms only. */
function attrOf(attrs: string, name: string): string | undefined {
  if (!attrs) return undefined;
  const re = new RegExp(`(?:^|\\s)${escapeRe(name)}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(attrs);
  return m ? (m[2] ?? m[3]) : undefined;
}

/** `id` is read once per tag when building the index — keep its regex hoisted. */
const ID_ATTR_RE = /(?:^|\s)id\s*=\s*("([^"]*)"|'([^']*)')/i;
function idOf(attrs: string): string | undefined {
  if (!attrs) return undefined;
  const m = ID_ATTR_RE.exec(attrs);
  return m ? (m[2] ?? m[3]) : undefined;
}

const numAttr = (attrs: string, name: string, def: number): number => {
  const v = attrOf(attrs, name);
  const x = v != null ? parseFloat(v) : NaN;
  return Number.isFinite(x) ? x : def;
};

/** Declarations of an inline `style` attribute, lower-cased property names. */
function styleProps(attrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = attrOf(attrs, 'style');
  if (!s) return out;
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

/**
 * Does this group composite its children as a unit? Returns the offending
 * property name, or ''. `opacity="1"` and `filter="none"` are no-ops and do not
 * count — over-refusing here means never descending through Figma's outer `<g>`.
 */
function unitCompositing(attrs: string): string {
  const style = styleProps(attrs);
  for (const prop of UNIT_PROPS) {
    const v = (style[prop] ?? attrOf(attrs, prop) ?? '').trim().toLowerCase();
    if (v === '' || v === 'none' || v === 'normal' || v === 'auto') continue;
    if (prop === 'opacity') {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 1) continue;
    }
    return prop;
  }
  return '';
}

// ─── a node: one direct child, with its span and its subtree ────────────────

interface Node {
  tag: Tag;
  /** Index into the tag list of this node's opening tag. */
  ti: number;
  /** Byte span of the whole element, verbatim. */
  start: number;
  end: number;
}

/** Index one past the closing tag of the subtree opened at `i`, or null. */
function skipSubtree(tags: Tag[], i: number): number | null {
  if (tags[i]!.kind === 'self') return i + 1;
  let depth = 0;
  for (let j = i; j < tags.length; j++) {
    const t = tags[j]!;
    if (t.kind === 'open') {
      depth++;
      if (depth > SVG_LAYERS_MAX_DEPTH) return null;
    } else if (t.kind === 'close') {
      depth--;
      if (depth === 0) return j + 1;
      if (depth < 0) return null;
    }
  }
  return null;
}

/**
 * The direct element children of the element opened at `openIdx`.
 * Returns null when the nesting under it is broken beyond repair.
 */
function directChildren(tags: Tag[], openIdx: number): Node[] | null {
  if (tags[openIdx]?.kind !== 'open') return [];
  const children: Node[] = [];
  for (let i = openIdx + 1; i < tags.length; i++) {
    const t = tags[i]!;
    if (t.kind === 'close') return children;          // the element's own close
    if (t.kind === 'self') {
      children.push({ tag: t, ti: i, start: t.start, end: t.end });
      continue;
    }
    const after = skipSubtree(tags, i);
    if (after == null) return null;
    children.push({ tag: t, ti: i, start: t.start, end: tags[after - 1]!.end });
    i = after - 1;
  }
  return null;                                        // never closed
}

// ─── analytic bounds ────────────────────────────────────────────────────────

type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function matMul(m1: Mat, m2: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * Parse an SVG `transform` attribute.
 *
 * Unlike `svg-custgeom.ts`'s version this one handles `rotate`/`skew` too: a
 * bounding box under a rotation is still a perfectly good bounding box. That
 * module refuses them because it has to REPRODUCE the shape in PowerPoint
 * geometry; this one only has to measure it. Anything unrecognised yields null,
 * which propagates as "unmeasurable" — never as a wrong number.
 */
function parseTransform(v: string | undefined): Mat | null {
  if (v == null) return IDENTITY;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none') return IDENTITY;
  let acc: Mat = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  let saw = false;
  while ((m = re.exec(trimmed)) !== null) {
    saw = true;
    const name = m[1]!.toLowerCase();
    const a = (m[2] ?? '').trim().split(/[\s,]+/).filter((x) => x !== '').map(Number);
    if (a.some((x) => !Number.isFinite(x))) return null;
    let t: Mat;
    if (name === 'translate') t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
    else if (name === 'scale') t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
    else if (name === 'matrix' && a.length >= 6) t = [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!];
    else if (name === 'rotate') {
      const rad = ((a[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rot: Mat = [cos, sin, -sin, cos, 0, 0];
      if (a.length >= 3) {
        const cx = a[1]!, cy = a[2]!;
        t = matMul(matMul([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
      } else t = rot;
    } else if (name === 'skewx') t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (name === 'skewy') t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    else return null;
    acc = matMul(acc, t);
  }
  return saw ? acc : null;
}

function boxUnion(a: SvgLayerBox | null, b: SvgLayerBox | null): SvgLayerBox | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function boxOfPoints(pts: number[][], m: Mat): SvgLayerBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    const x = m[0] * p[0]! + m[2] * p[1]! + m[4];
    const y = m[1] * p[0]! + m[3] * p[1]! + m[5];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (minX > maxX) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const rectPts = (x: number, y: number, w: number, h: number): number[][] =>
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/**
 * The ink of ONE element, in its parent's coordinates.
 *
 * A curve is bounded by its control polygon rather than solved for extrema — a
 * superset, never a subset, which is the right side to be wrong on here: it
 * merges slightly more eagerly and can never mistake overlap for separation.
 * Stroke width is not added: a hairline's half-width does not decide which
 * cluster a shape belongs to.
 */
function elementBox(tags: Tag[], node: Node, depth: number): SvgLayerBox | null {
  const tag = node.tag;
  const m = parseTransform(attrOf(tag.attrs, 'transform'));
  if (!m) return null;
  const name = tag.name;

  if (CONTAINER_TAGS.has(name)) {
    if (depth >= SVG_LAYERS_MAX_DEPTH) return null;
    const kids = directChildren(tags, node.ti);
    if (!kids) return null;
    let acc: SvgLayerBox | null = null;
    for (const k of kids) {
      if (DROP_TAGS.has(k.tag.name) || CARRY_TAGS.has(k.tag.name)) continue;
      const b = elementBox(tags, k, depth + 1);
      // A group with anything unmeasurable in it is itself unmeasurable:
      // reporting only the measurable part would UNDERSTATE its extent, and
      // understating extent is exactly what makes the paint-order safety check
      // below say "safe" when it is not.
      if (!b) return null;
      acc = boxUnion(acc, b);
    }
    return acc ? transformBox(acc, m) : null;
  }

  if (name === 'rect' || name === 'image' || name === 'foreignobject' || name === 'svg') {
    const w = numAttr(tag.attrs, 'width', NaN), h = numAttr(tag.attrs, 'height', NaN);
    if (!(w > 0 && h > 0)) return null;
    return boxOfPoints(rectPts(numAttr(tag.attrs, 'x', 0), numAttr(tag.attrs, 'y', 0), w, h), m);
  }
  if (name === 'circle') {
    const r = numAttr(tag.attrs, 'r', NaN);
    if (!(r > 0)) return null;
    const cx = numAttr(tag.attrs, 'cx', 0), cy = numAttr(tag.attrs, 'cy', 0);
    return boxOfPoints(rectPts(cx - r, cy - r, 2 * r, 2 * r), m);
  }
  if (name === 'ellipse') {
    const rx = numAttr(tag.attrs, 'rx', NaN), ry = numAttr(tag.attrs, 'ry', NaN);
    if (!(rx > 0 && ry > 0)) return null;
    const cx = numAttr(tag.attrs, 'cx', 0), cy = numAttr(tag.attrs, 'cy', 0);
    return boxOfPoints(rectPts(cx - rx, cy - ry, 2 * rx, 2 * ry), m);
  }
  if (name === 'line') {
    return boxOfPoints([
      [numAttr(tag.attrs, 'x1', 0), numAttr(tag.attrs, 'y1', 0)],
      [numAttr(tag.attrs, 'x2', 0), numAttr(tag.attrs, 'y2', 0)],
    ], m);
  }
  if (name === 'polyline' || name === 'polygon') {
    const nums = (attrOf(tag.attrs, 'points') ?? '').trim().split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x));
    if (nums.length < 4) return null;
    const pts: number[][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
    return boxOfPoints(pts, m);
  }
  if (name === 'path') {
    const d = attrOf(tag.attrs, 'd');
    if (!d) return null;
    const pts: number[][] = [];
    for (const sub of parseSvgPath(d)) {
      for (const seg of sub.segments) {
        if (seg.op === 'C') pts.push([seg.x1, seg.y1], [seg.x2, seg.y2], [seg.x, seg.y]);
        else pts.push([seg.x, seg.y]);
      }
    }
    if (!pts.length) return null;
    return boxOfPoints(pts, m);
  }
  // <text>, <use>, <tspan>, anything exotic: no bounds without a renderer.
  return null;
}

function transformBox(b: SvgLayerBox, m: Mat): SvgLayerBox | null {
  return boxOfPoints(rectPts(b.x, b.y, b.w, b.h), m);
}

// ─── clustering (the pdf-artwork.ts shape, in user units) ───────────────────

const expandBox = (r: SvgLayerBox, by: number): SvgLayerBox =>
  ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 });

const boxesOverlap = (a: SvgLayerBox, b: SvgLayerBox): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Cluster stray leaves by proximity, returning one member-index list per cluster.
 *
 * `pdf-artwork.ts`'s union-find over expanded boxes, minus its group-rejoin pass
 * (a stray leaf has no group to rejoin by — that is what makes it stray). A leaf
 * with no measurable box is its own cluster: we will not guess where it is.
 */
function clusterLeaves(idx: number[], boxes: Array<SvgLayerBox | null>): number[][] {
  const measurable = idx.filter((i) => boxes[i]);
  const alone = idx.filter((i) => !boxes[i]).map((i) => [i]);
  if (measurable.length < 2) return [...alone, ...measurable.map((i) => [i])];

  const parent = measurable.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const join = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  const typical = median(measurable.map((i) => Math.min(boxes[i]!.w, boxes[i]!.h)));
  const gap = Math.min(MAX_CLUSTER_GAP, Math.max(CLUSTER_GAP, typical * GAP_FACTOR));

  for (let a = 0; a < measurable.length; a++) {
    const grown = expandBox(boxes[measurable[a]!]!, gap);
    for (let b = a + 1; b < measurable.length; b++) {
      if (find(a) === find(b)) continue;
      if (boxesOverlap(grown, boxes[measurable[b]!]!)) join(a, b);
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let a = 0; a < measurable.length; a++) {
    const r = find(a);
    const got = byRoot.get(r);
    if (got) got.push(measurable[a]!);
    else byRoot.set(r, [measurable[a]!]);
  }
  return [...alone, ...byRoot.values()];
}

/**
 * Paint-order safety.
 *
 * Layers composite in the order of their first member, so a cluster whose member
 * indices straddle a NON-member that overlaps it would reorder ink. Rather than
 * reason about whether that particular reorder is visible, such a cluster is
 * split back into its contiguous index runs — `pdf-artwork.ts`'s "refuse when
 * unsure" bias, applied to ordering instead of to detection. An unmeasurable
 * non-member counts as overlapping: unknown means refuse.
 */
function splitUnsafeClusters(clusters: number[][], boxes: Array<SvgLayerBox | null>, count: number): number[][] {
  const out: number[][] = [];
  for (const c of clusters) {
    if (c.length < 2) { out.push(c); continue; }
    const sorted = [...c].sort((a, b) => a - b);
    const member = new Set(sorted);
    let bb: SvgLayerBox | null = null;
    for (const i of sorted) bb = boxUnion(bb, boxes[i] ?? null);
    let unsafe = false;
    for (let i = sorted[0]! + 1; i < sorted[sorted.length - 1]! && i < count; i++) {
      if (member.has(i)) continue;
      const ob = boxes[i];
      if (!ob || !bb || boxesOverlap(ob, bb)) { unsafe = true; break; }
    }
    if (!unsafe) { out.push(sorted); continue; }
    let run: number[] = [sorted[0]!];
    for (let k = 1; k < sorted.length; k++) {
      if (sorted[k] === sorted[k - 1]! + 1) run.push(sorted[k]!);
      else { out.push(run); run = [sorted[k]!]; }
    }
    out.push(run);
  }
  return out;
}

// ─── the pass ───────────────────────────────────────────────────────────────

interface Candidate {
  /** Member nodes in document order — one for a group, N for a cluster. */
  members: Node[];
  bbox: SvgLayerBox | null;
  /** Document index of the first member: the candidate's place in paint order. */
  order: number;
}

/**
 * Enumerate an SVG's layers and derive a standalone document for each.
 *
 * Never throws. A document it cannot make sense of yields `layers: []` and a
 * warning saying why, in words a person can read in a dialog.
 *
 * @param markup  SVG source text — the shell's DOMPurify-sanitised string.
 * @param opts    {@link SvgLayerOptions}
 */
export function enumerateSvgLayers(markup: string, opts: SvgLayerOptions = {}): SvgLayersResult {
  const warnings: string[] = [];
  try {
    return enumerate(markup, opts, warnings);
  } catch {
    // Defence in depth: the body is written not to throw, so reaching here is a
    // bug — but a bug in a lift must not take down the editor that called it.
    warnings.push('could not read this SVG');
    return { layers: [], warnings };
  }
}

function enumerate(markup: string, opts: SvgLayerOptions, warnings: string[]): SvgLayersResult {
  const empty = (why: string): SvgLayersResult => { warnings.push(why); return { layers: [], warnings }; };

  if (typeof markup !== 'string' || markup.length === 0) return empty('no SVG markup');
  if (markup.length > SVG_LAYERS_MAX_CHARS) {
    return empty(`SVG is too large to lift (over ${Math.round(SVG_LAYERS_MAX_CHARS / 1e6)} MB)`);
  }
  const tags = scanTags(markup);
  if (!tags) return empty(`SVG has more than ${SVG_LAYERS_MAX_TAGS} elements`);

  const rootIdx = tags.findIndex((t) => t.name === 'svg' && t.kind !== 'close');
  if (rootIdx < 0) return empty('no <svg> root');
  const root = tags[rootIdx]!;
  if (root.kind === 'self') return empty('this SVG is empty');

  const rootKids = directChildren(tags, rootIdx);
  if (!rootKids) return empty('this SVG is not well-formed enough to lift');

  // Split the root's children three ways: carried (paints nothing, goes into
  // every layer), dropped (names + scripts), candidates (the artwork).
  const carry: Node[] = [];
  let candidateNodes: Node[] = [];
  for (const k of rootKids) {
    if (DROP_TAGS.has(k.tag.name)) continue;
    if (CARRY_TAGS.has(k.tag.name)) { carry.push(k); continue; }
    candidateNodes.push(k);
  }
  if (!candidateNodes.length) return empty('nothing to lift — this SVG draws nothing at its root');

  // ── descend through transparent single wrappers ───────────────────────────
  const wrappers: Tag[] = [];
  for (let d = 0; d < SVG_LAYERS_MAX_DESCENT; d++) {
    if (candidateNodes.length !== 1) break;
    const only = candidateNodes[0]!;
    if (only.tag.name !== 'g' || only.tag.kind !== 'open') break;
    const unit = unitCompositing(only.tag.attrs);
    if (unit) {
      warnings.push(`kept the outer group whole — its \`${unit}\` applies to all of it at once`);
      break;
    }
    const kids = directChildren(tags, only.ti);
    if (!kids) break;
    const inner: Node[] = [];
    // Staged, not appended: if the descent turns out not to happen, the wrapper
    // stays whole and ITS OWN markup already contains these — hoisting them into
    // `carry` as well would emit every id in it twice.
    const innerCarry: Node[] = [];
    for (const k of kids) {
      if (DROP_TAGS.has(k.tag.name)) continue;
      if (CARRY_TAGS.has(k.tag.name)) { innerCarry.push(k); continue; }
      inner.push(k);
    }
    if (!inner.length) break;
    carry.push(...innerCarry);
    wrappers.push(only.tag);
    candidateNodes = inner;
  }

  // ── bound the clustering before it bounds us ──────────────────────────────
  // The overflow is a contiguous run at the END of the document, which is why
  // folding it into one layer is safe: paint order within it is preserved and
  // nothing painted before it moves. Its bbox is left unmeasured — a bucket does
  // not have a meaningful outline, and measuring it would reinstate the linear
  // scan over the very nodes the cap exists to skip.
  let overflow: Node[] = [];
  if (candidateNodes.length > SVG_LAYERS_MAX_CANDIDATES) {
    overflow = candidateNodes.slice(SVG_LAYERS_MAX_CANDIDATES - 1);
    candidateNodes = candidateNodes.slice(0, SVG_LAYERS_MAX_CANDIDATES - 1);
    warnings.push(
      `this SVG has more than ${SVG_LAYERS_MAX_CANDIDATES} shapes at its root; ` +
      `everything past the first ${SVG_LAYERS_MAX_CANDIDATES - 1} is one layer`,
    );
  }

  // ── one candidate per group; stray leaves cluster ─────────────────────────
  // Bounds are reported in ROOT user units, so anything the descent walked
  // through has to be folded back in — a wrapper's `transform` is exactly the
  // difference between "where this shape is in the file" and "where it is in the
  // picture". An unparseable wrapper transform makes every box unmeasurable
  // rather than wrong, which the clustering then treats as "refuse to merge".
  let wrapperMat: Mat | null = IDENTITY;
  for (const w of wrappers) {
    if (!wrapperMat) break;
    const m: Mat | null = parseTransform(attrOf(w.attrs, 'transform'));
    wrapperMat = m ? matMul(wrapperMat, m) : null;
  }
  const boxes = candidateNodes.map((nd) => {
    const local = elementBox(tags, nd, 0);
    return local && wrapperMat ? transformBox(local, wrapperMat) : null;
  });
  const groupIdx: number[] = [];
  const leafIdx: number[] = [];
  candidateNodes.forEach((nd, i) => { (CONTAINER_TAGS.has(nd.tag.name) ? groupIdx : leafIdx).push(i); });

  let clusters: number[][] = [...groupIdx.map((i) => [i]), ...clusterLeaves(leafIdx, boxes)];
  const beforeSplit = clusters.length;
  clusters = splitUnsafeClusters(clusters, boxes, candidateNodes.length);
  if (clusters.length > beforeSplit) {
    warnings.push('split a cluster that another layer paints through, to keep the stacking order');
  }

  // Paint order: a candidate's place is its FIRST member's document position.
  const candidates: Candidate[] = clusters
    .map((members): Candidate => {
      const sorted = [...members].sort((a, b) => a - b);
      let bb: SvgLayerBox | null = null;
      for (const i of sorted) bb = boxUnion(bb, boxes[i] ?? null);
      return { members: sorted.map((i) => candidateNodes[i]!), bbox: bb, order: sorted[0]! };
    })
    .sort((a, b) => a.order - b.order);
  if (overflow.length) candidates.push({ members: overflow, bbox: null, order: Number.MAX_SAFE_INTEGER });

  // ── cap: the TAIL merges, so no artwork is ever dropped ───────────────────
  const cap = Math.max(1, Math.min(SVG_LAYERS_MAX, opts.maxLayers ?? SVG_LAYERS_MAX));
  let final = candidates;
  if (candidates.length > cap) {
    const tail = candidates.slice(cap - 1);
    final = [...candidates.slice(0, cap - 1), {
      members: tail.flatMap((c) => c.members).sort((a, b) => a.start - b.start),
      bbox: tail.reduce<SvgLayerBox | null>((acc, c) => boxUnion(acc, c.bbox), null),
      order: tail[0]!.order,
    }];
    warnings.push(`found ${candidates.length} layers; the last ${tail.length} were merged into one (the limit is ${cap})`);
  }

  // ── derive one document per layer ─────────────────────────────────────────
  const rootAttrs = rootAttributes(root.attrs);
  const carryMarkup = carry.map((c) => markup.slice(c.start, c.end)).join('');
  const openWrappers = wrappers.map((w) => `<${w.qname}${w.attrs}>`).join('');
  const closeWrappers = wrappers.map((w) => `</${w.qname}>`).reverse().join('');
  let ids: Map<string, number> | null = null;

  const layers: SvgLayer[] = final.map((c, i) => {
    const body = c.members.map((m) => markup.slice(m.start, m.end)).join('');
    const wanted = referencedIds(body);
    let fixups = '';
    if (wanted.length) {
      ids ??= buildIdIndex(tags);
      fixups = borrowedDefs(wanted, body, carryMarkup, ids, tags, markup, warnings, i + 1);
    }
    const boxId = c.members.length === 1 ? attrOf(c.members[0]!.tag.attrs, 'data-box-id') : undefined;
    return {
      markup: `<${root.qname}${rootAttrs}>${carryMarkup}${fixups}${openWrappers}${body}${closeWrappers}</${root.qname}>`,
      bbox: c.bbox,
      label: `Layer ${i + 1}`,
      index: i,
      nodes: c.members.length,
      ...(boxId ? { boxId } : {}),
    };
  });

  return { layers, warnings };
}

/**
 * The root's attributes, verbatim, with `xmlns` guaranteed.
 *
 * Verbatim matters: `viewBox`, `preserveAspectRatio`, `width`/`height` and any
 * `xmlns:*` declaration a `<use>` needs are all in there, and reproducing them
 * exactly is what keeps every derived layer in the SOURCE's coordinate system —
 * which is what lets the shell stack N boxes at identical geometry and get the
 * original picture back.
 */
function rootAttributes(attrs: string): string {
  if (attrOf(attrs, 'xmlns') != null) return attrs;
  return ` xmlns="http://www.w3.org/2000/svg"${attrs}`;
}

/** Every `#id` this markup points at, via `url(#…)` or `href="#…"`. */
function referencedIds(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(?:url\(\s*['"]?#([^)'"\s]+)|(?:xlink:)?href\s*=\s*["']#([^"']+)["'])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const id = (m[1] ?? m[2] ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= SVG_LAYERS_MAX_REFS) break;
  }
  return out;
}

/** id → tag index, built once per document and only when something asks. */
function buildIdIndex(tags: Tag[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < tags.length; i++) {
    if (tags[i]!.kind === 'close') continue;
    const id = idOf(tags[i]!.attrs);
    if (id && !map.has(id)) map.set(id, i);
  }
  return map;
}

/**
 * Repair cross-layer `#id` references — §11's pathological `<use>` case.
 *
 * `<g id="a"><path id="p"/></g><g id="b"><use href="#p"/></g>`: lift those two
 * groups apart and layer 2 references a path that is no longer in its document,
 * so it renders nothing. The referenced element is copied into a `<defs>` of the
 * borrowing layer, where it PAINTS NOTHING — so the copy cannot double-draw —
 * and `<use>`'s own semantics (render the referent as if cloned here, WITHOUT
 * its original ancestors' transforms) are exactly what a `<defs>` copy
 * reproduces.
 *
 * Returns the `<defs>` fragment to insert, or ''.
 */
function borrowedDefs(
  wanted: string[],
  body: string,
  carryMarkup: string,
  ids: Map<string, number>,
  tags: Tag[],
  markup: string,
  warnings: string[],
  layerNo: number,
): string {
  const out: string[] = [];
  for (const id of wanted) {
    // Already resolvable from this layer's own body or the carried defs? Then
    // there is nothing to repair — and re-adding it would duplicate an id.
    const has = new RegExp(`\\sid\\s*=\\s*("${escapeRe(id)}"|'${escapeRe(id)}')`);
    if (has.test(body) || has.test(carryMarkup)) continue;
    const at = ids.get(id);
    if (at == null) continue;                 // dangling in the source; not ours to invent
    const after = skipSubtree(tags, at);
    if (after == null) continue;
    out.push(markup.slice(tags[at]!.start, tags[after - 1]!.end));
    if (out.length >= SVG_LAYERS_MAX_REFS) break;
  }
  if (!out.length) return '';
  warnings.push(`layer ${layerNo}: copied ${out.length} referenced ${out.length === 1 ? 'element' : 'elements'} it shares with another layer`);
  return `<defs>${out.join('')}</defs>`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
