// SPDX-License-Identifier: MPL-2.0
/**
 * Vector artwork detection - find the logos on a page full of shapes.
 *
 * Most logos in a PDF are not images. They are what they were in Illustrator: a
 * group of filled and stroked paths. Extracting them as SVG gives an asset that
 * scales to any size. The alternative is a blurry screenshot of the same logo.
 * That makes vector artwork the most valuable thing on the page. It is also the
 * hardest to pick out, because the page is full of vector shapes that are not
 * artwork at all.
 *
 * The interpreter returns one flat, paint-ordered list. In that list a logo's
 * petals, a table's cell borders, a hairline rule, a grey callout panel and a
 * redaction bar are structurally identical: `kind:'box'` with a `shape`, or a
 * node carrying a baked `_vectorPath`. Nothing marks which is which. This module
 * tells them apart.
 *
 * ### Why grouping alone does not work
 *
 * `PdfNode.group` looks like the answer. The interpreter already resolves OCG
 * layers, form XObjects and `q…Q` frames into it. For Illustrator-placed art it
 * usually is the answer, because such a logo arrives as one form XObject.
 *
 * But "usually" is not "always". A generator that draws paths straight onto the
 * page with no wrapping frame produces artwork with no group at all. This was
 * verified against a real generated file, where a three-path mark came back
 * entirely ungrouped. So `group` is used as a strong hint when present, never
 * as a requirement. Spatial clustering catches the rest.
 *
 * ### The bias
 *
 * The detector is biased toward missing artwork rather than inventing it. A
 * missed logo is a gap the user can see and work around. A "logo" that is
 * really the page's table borders looks extractable, downloads, and turns out
 * to be junk. That teaches the user not to trust the feature at all. Every
 * threshold here is set to refuse when unsure.
 */

import type { PdfNode } from './pdf-map.ts';
import { pdfNodeExtent } from './pdf-svg.ts';

// ── tunables ──────────────────────────────────────────────────────────────────

/** Shapes closer than this many points are part of the same mark. */
const CLUSTER_GAP = 6;
/**
 * …but a mark made of big shapes tolerates bigger internal gaps than one made of
 * small ones. The working gap scales with the typical shape on the page, so a
 * 200pt monogram whose counters sit 20pt apart stays one mark, while a row of
 * 8pt icons 20pt apart stays several.
 */
const GAP_FACTOR = 0.4;
/** …clamped, so a page of sparse decoration cannot collapse into one blob. */
const MAX_CLUSTER_GAP = 48;
/**
 * How far a shared group may reach to REJOIN two proximity clusters, as a
 * multiple of the smaller cluster's diagonal.
 *
 * A group is a hint, not an instruction. An Illustrator OCG layer ("Layer 1")
 * routinely contains every graphic on the page, so honouring it unconditionally
 * merges a header logo with an unrelated footer mark into one useless asset.
 * Gating the rejoin on proximity keeps the case where the group is genuinely
 * useful: a symbol and its wordmark placed as one form XObject, side by side.
 * It still refuses the page-spanning layer.
 */
const GROUP_REACH = 1.5;
/** A mark needs at least this many shapes - one shape is a rule or a panel. */
const MIN_SHAPES = 2;
/** Thinner than this in either axis is a rule, an underline or a table border. */
const MIN_SIDE = 8;
/** Wider than this fraction of the page is a background, not a mark. */
const MAX_PAGE_FRACTION = 0.55;
/** Longer:shorter beyond this is a bar, not a mark. */
const MAX_ASPECT = 12;
/** Guard against a pathological page turning into thousands of candidates. */
const MAX_NODES = 4000;
const MAX_CANDIDATES = 60;

export interface ArtworkRect { x: number; y: number; w: number; h: number }

export interface VectorArtwork {
  /** Indices into the input array, in PAINT order - the order they must re-draw. */
  indices: number[];
  /** Bounding box in the page's top-left y-down point space. */
  rect: ArtworkRect;
  /** Distinct fill colours, most-used first. Useful as a palette preview. */
  fills: string[];
  /** The interpreter's group id, when the artwork carried one. */
  group?: string;
  /** Why this cluster was believed - shown in the UI and in test failures. */
  reason: string;
}

// ── shape classification ──────────────────────────────────────────────────────

/**
 * Is this node vector paint at all?
 *
 * Text is excluded: a wordmark set in live type is a font problem, not a vector
 * one, and pulling it in would make every paragraph on the page a logo candidate.
 * Images are excluded because the Images pass already owns them.
 */
function isVectorPaint(n: PdfNode): boolean {
  if (!n || n.kind === 'text') return false;
  if (n._vectorPath) return true;
  // A filled primitive. `kind:'image'` nodes carrying _vectorPath are handled
  // above; a bare image node is a raster and belongs to the other pass.
  return n.kind === 'box' && !!(n.fill || n._vectorFill);
}

/** A curve in the baked path data. The interpreter emits only M/L/C/Z. */
const hasCurve = (n: PdfNode): boolean => /C/.test(String(n._vectorPath ?? ''));

/**
 * A shape that is *just* an axis-aligned rectangle.
 *
 * The single most useful negative signal on a page: rules, underlines, table
 * cell borders, background panels and redaction bars are all exactly this, and
 * essentially no logo is made only of them.
 */
function isPlainRect(n: PdfNode): boolean {
  if (n._vectorPath) return !hasCurve(n);
  return n.kind === 'box' && n.shape !== 'ellipse';
}

function fillOf(n: PdfNode): string {
  return String(n._vectorFill || n.fill || '');
}

// ── clustering ────────────────────────────────────────────────────────────────

function expand(r: ArtworkRect, by: number): ArtworkRect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

function overlaps(a: ArtworkRect, b: ArtworkRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function union(a: ArtworkRect, b: ArtworkRect): ArtworkRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

const diagonal = (r: ArtworkRect): number => Math.hypot(r.w, r.h);

/** Edge-to-edge gap between two boxes; 0 when they touch or overlap. */
function gapBetween(a: ArtworkRect, b: ArtworkRect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Cluster shapes into candidate marks.
 *
 * PROXIMITY decides the split. GROUP may only rejoin what proximity separated,
 * and only across a short reach. That ordering is the whole design. Doing it
 * the other way - group first, unconditionally - means one OCG layer covering
 * the page merges every graphic on it into a single candidate, which is
 * exactly the asset nobody wants. The case a group genuinely earns - a symbol
 * and its wordmark set as one form XObject a few points apart - is still
 * caught, because those shapes are close by construction.
 */
function cluster(items: Array<{ i: number; rect: ArtworkRect; group: string }>): Array<{ idx: number[]; rect: ArtworkRect; group: string }> {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const join = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  // The working gap, scaled to the page's typical shape. Using the SHORT side
  // keeps a page of long thin rules from inflating it.
  const typical = median(items.map((it) => Math.min(it.rect.w, it.rect.h)));
  const gap = Math.min(MAX_CLUSTER_GAP, Math.max(CLUSTER_GAP, typical * GAP_FACTOR));

  // 1. Proximity - the primary structure.
  for (let i = 0; i < items.length; i++) {
    const a = expand(items[i]!.rect, gap);
    for (let j = i + 1; j < items.length; j++) {
      if (find(i) === find(j)) continue;
      if (overlaps(a, items[j]!.rect)) join(i, j);
    }
  }

  const collect = (): Map<number, { idx: number[]; rect: ArtworkRect; group: string }> => {
    const m = new Map<number, { idx: number[]; rect: ArtworkRect; group: string }>();
    for (let i = 0; i < items.length; i++) {
      const root = find(i);
      const it = items[i]!;
      const got = m.get(root);
      if (got) { got.idx.push(it.i); got.rect = union(got.rect, it.rect); got.group ||= it.group; }
      else m.set(root, { idx: [it.i], rect: it.rect, group: it.group });
    }
    return m;
  };

  // 2. Group rejoin, gated on proximity. Repeated until it stops changing, since
  //    merging A+B can bring the result within reach of C.
  for (let pass = 0; pass < 4; pass++) {
    const clusters = [...collect().entries()];
    const byGroup = new Map<string, Array<[number, ArtworkRect]>>();
    for (const [root, c] of clusters) {
      if (!c.group) continue;
      const list = byGroup.get(c.group);
      if (list) list.push([root, c.rect]);
      else byGroup.set(c.group, [[root, c.rect]]);
    }
    let merged = false;
    for (const list of byGroup.values()) {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const [ra, rectA] = list[a]!;
          const [rb, rectB] = list[b]!;
          if (find(ra) === find(rb)) continue;
          const reach = Math.min(diagonal(rectA), diagonal(rectB)) * GROUP_REACH;
          if (gapBetween(rectA, rectB) <= Math.max(gap, reach)) { join(ra, rb); merged = true; }
        }
      }
    }
    if (!merged) break;
  }

  return [...collect().values()];
}

// ── the pass ──────────────────────────────────────────────────────────────────

export interface ArtworkOptions {
  width?: number;
  height?: number;
}

/**
 * Find the vector artwork on one page.
 *
 * `nodes` must be straight from `interpretPdfPage` - the returned `indices` are
 * positions in THAT array, and re-drawing them in that order is what reproduces
 * the mark (paint order is the z-order).
 *
 * Never throws; a page it cannot make sense of yields no candidates.
 */
export function findVectorArtwork(nodes: PdfNode[], opts: ArtworkOptions = {}): VectorArtwork[] {
  const out: VectorArtwork[] = [];
  if (!Array.isArray(nodes) || !nodes.length) return out;

  const pageArea = Math.max(1, (opts.width ?? 0) * (opts.height ?? 0));

  const items: Array<{ i: number; rect: ArtworkRect; group: string }> = [];
  for (let i = 0; i < nodes.length && items.length < MAX_NODES; i++) {
    const n = nodes[i]!;
    if (!isVectorPaint(n)) continue;
    const e = pdfNodeExtent(n);
    if (!e || !(e.w > 0) || !(e.h > 0)) continue;
    items.push({ i, rect: { x: e.x, y: e.y, w: e.w, h: e.h }, group: String(n.group ?? '') });
  }
  if (items.length < MIN_SHAPES) return out;

  for (const c of cluster(items)) {
    if (out.length >= MAX_CANDIDATES) break;
    const members = c.idx.map((i) => nodes[i]!);
    const { rect } = c;

    // ── the refusals, each guarding a specific false positive ────────────────
    if (members.length < MIN_SHAPES) continue;                       // a lone rule or panel
    if (rect.w < MIN_SIDE || rect.h < MIN_SIDE) continue;            // hairlines, underlines
    if (pageArea > 1 && (rect.w * rect.h) / pageArea > MAX_PAGE_FRACTION) continue;  // a background
    const long = Math.max(rect.w, rect.h);
    const short = Math.max(1e-6, Math.min(rect.w, rect.h));
    if (long / short > MAX_ASPECT) continue;                         // a bar, a banner rule

    // The positive test. Table borders and rules are ALL plain rectangles, so a
    // cluster made only of those is furniture no matter how many pieces it has -
    // a 5x4 table is twenty perfectly aligned rectangles and would otherwise be
    // the most convincing "logo" on the page.
    const curved = members.some((n) => hasCurve(n) || n.shape === 'ellipse');
    const fillCounts = new Map<string, number>();
    for (const n of members) {
      const f = fillOf(n);
      if (f) fillCounts.set(f, (fillCounts.get(f) ?? 0) + 1);
    }
    const fills = [...fillCounts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
    const allRects = members.every(isPlainRect);

    let reason: string;
    if (curved) reason = 'curved shapes';
    else if (!allRects) reason = 'non-rectangular shapes';
    else if (fills.length >= 3) reason = 'a multi-colour arrangement of rectangles';
    else continue;   // rectangles in one or two colours: furniture
    if (c.group) reason += ', grouped in the document';

    out.push({
      indices: [...c.idx].sort((a, b) => a - b),   // paint order
      rect,
      fills,
      ...(c.group ? { group: c.group } : {}),
      reason,
    });
  }

  // Biggest first - the page's main mark should lead.
  out.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
  return out;
}
