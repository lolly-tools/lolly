// SPDX-License-Identifier: MPL-2.0
/**
 * Failed-redaction detection: text that is in the file but not on the page.
 *
 * The classic PDF problem: someone "redacts" a document by drawing black
 * rectangles over the sensitive parts and saving. The bars are graphics. The
 * words are still underneath them, fully intact, and any text extractor,
 * including this codebase's, reads them straight back out. This has leaked
 * court filings, contracts, medical records, and diplomatic cables,
 * repeatedly, for twenty years. It stays invisible to the person who did it,
 * because their PDF viewer shows exactly what they expect.
 *
 * We can prove it offline, because we already hold both halves: `interpretPdfPage`
 * gives the text runs AND the filled shapes, in PAINT ORDER. So the test is
 * geometric: is there an opaque shape, painted AFTER a text run, covering it?
 * If so the reader cannot see those words, and the file still contains them.
 *
 * ### Why paint order is the key signal
 *
 * Order is what separates a redaction from a highlight. A coloured box painted
 * BEFORE text is a background; the same box painted AFTER it is a cover. Without
 * that distinction, every highlighted heading, every table cell with a fill,
 * and every button-shaped label on the page would be a false positive, which
 * would make the check worthless. `interpretPdfPage` returns nodes in the
 * order the content stream painted them and never sorts them (see
 * tests/pdf-redaction.test.ts, which pins that invariant deliberately).
 *
 * ### What this deliberately does NOT claim
 *
 * It does not claim intent. A finding says "these words are present but not
 * visible", which is exactly what was measured, and is shown regardless of
 * whether it came from a botched redaction or from sloppy layering. Callers
 * should use that wording rather than accusing a document of a cover-up.
 *
 * It also does not catch every way to hide text: text rendered in invisible
 * mode (`Tr 3`), text scissored away by a clip path, or text in white on white
 * all stay hidden from this pass. `Tr` in particular is how a searchable scan
 * stores its OCR layer, so treating it as concealment would flag every scanned
 * document ever made. This checks only the one case that is unambiguous.
 */

import type { PdfNode } from './pdf-map.ts';

/** Below this the shape is see-through and the text under it is still legible. */
const OPAQUE_MIN = 90;
/** Fraction of a text run's box that must be covered before it is reported. */
const DEFAULT_MIN_COVERAGE = 0.7;
/** At or above this, the run is not merely obscured - it is gone. */
const FULLY_HIDDEN = 0.95;
/**
 * Covering shapes considered per text run; the largest overlaps win.
 *
 * Generous, because word-by-word redaction of a single line legitimately draws
 * one bar per word, and the union of all of them is the honest coverage. The cap
 * exists only to bound `unionArea`'s compressed grid, and it can only ever cause
 * UNDER-reporting. That is the safe direction for a cap: a missed finding is a
 * gap, but an invented one would poison the whole check.
 */
const MAX_COVERS = 64;

export interface Rect { x: number; y: number; w: number; h: number }

export interface HiddenTextFinding {
  /** The words that are present in the file but not visible on the page. */
  text: string;
  /** Where the run sits, in the page's own top-left y-down point space. */
  rect: Rect;
  /** Fraction of the run's box hidden, 0–1. */
  coverage: number;
  /** True once coverage passes the point where nothing legible is left. */
  fullyHidden: boolean;
  /** The covering shape's fill, so a report can say "behind a black bar". */
  fill: string;
  /** 0-based page index. Set by `findHiddenTextInPages`, absent per-page. */
  page?: number;
}

export interface RedactionOptions {
  /** Reporting floor for `coverage`. Defaults to 0.7. */
  minCoverage?: number;
}

// ── geometry ──────────────────────────────────────────────────────────────────

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bt > y ? { x, y, w: r - x, h: bt - y } : null;
}

/**
 * Area of the UNION of axis-aligned rectangles, by coordinate compression.
 *
 * A run split across two adjacent bars is covered by neither one alone, so
 * taking the largest single overlap would under-report exactly the case that
 * matters most: a long redacted line. Summing instead over-reports wherever
 * bars overlap each other. The union is the only answer that is right in both
 * cases, and with a handful of rectangles the compressed grid is cheap.
 */
function unionArea(rects: Rect[]): number {
  if (!rects.length) return 0;
  if (rects.length === 1) return rects[0]!.w * rects[0]!.h;

  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.h]))].sort((a, b) => a - b);

  let area = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i]!, x1 = xs[i + 1]!;
    for (let j = 0; j + 1 < ys.length; j++) {
      const y0 = ys[j]!, y1 = ys[j + 1]!;
      // A cell counts once if ANY rectangle covers it - that is the union.
      const covered = rects.some((r) => r.x <= x0 && r.x + r.w >= x1 && r.y <= y0 && r.y + r.h >= y1);
      if (covered) area += (x1 - x0) * (y1 - y0);
    }
  }
  return area;
}

// ── what counts as a cover ────────────────────────────────────────────────────

/**
 * Is this node an opaque, page-covering paint?
 *
 * Boxes and baked vector paths qualify by their fill; an image qualifies too,
 * because a photo pasted over a paragraph hides it just as completely as a black
 * bar does. Anything carrying a soft mask is refused: a masked shape's real
 * per-pixel alpha is unknown here, and a shape whose opacity cannot be
 * verified must not be presented as proof that text is concealed.
 */
function coverFill(n: PdfNode): string | null {
  if (n._softMask) return null;
  if (typeof n.opacity === 'number' && n.opacity < OPAQUE_MIN) return null;
  if (n.kind === 'image') return 'image';
  if (n.kind !== 'box') return null;
  // A gradient-filled shape is still opaque paint; `fill` carries its back-stop
  // colour, which is what a report should name.
  const fill = n._vectorFill || n.fill;
  return fill ? String(fill) : null;
}

/** A text run's box. Note `w` is pdf-map's ESTIMATE, never a measurement. */
function textRect(n: PdfNode): Rect | null {
  if (n.kind !== 'text' || !n.text || !n.text.trim()) return null;
  if (!isFinite(n.x) || !isFinite(n.y) || !(n.w > 0) || !(n.h > 0)) return null;
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

// ── the pass ──────────────────────────────────────────────────────────────────

/**
 * Find text on one page that an opaque shape painted over.
 *
 * `nodes` MUST be in paint order, i.e. straight from `interpretPdfPage`. A
 * sorted or filtered list silently turns this into nonsense, because "painted
 * after" is read from the array index and nothing else.
 *
 * Never throws; degenerate geometry simply yields no findings.
 */
export function findHiddenText(nodes: PdfNode[], opts: RedactionOptions = {}): HiddenTextFinding[] {
  const minCoverage = opts.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const out: HiddenTextFinding[] = [];

  // Index every opaque paint once, keeping its position in the paint order.
  const covers: Array<{ i: number; rect: Rect; fill: string }> = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const fill = coverFill(n);
    if (!fill || !isFinite(n.x) || !isFinite(n.y) || !(n.w > 0) || !(n.h > 0)) continue;
    covers.push({ i, rect: { x: n.x, y: n.y, w: n.w, h: n.h }, fill });
  }
  if (!covers.length) return out;

  for (let i = 0; i < nodes.length; i++) {
    const tr = textRect(nodes[i]!);
    if (!tr) continue;
    const area = tr.w * tr.h;
    if (area <= 0) continue;

    // Only paints that came AFTER this run can hide it. Everything earlier is a
    // background the text was drawn on top of.
    const hits: Array<{ rect: Rect; fill: string }> = [];
    for (const c of covers) {
      if (c.i <= i) continue;
      const hit = intersect(tr, c.rect);
      if (hit) hits.push({ rect: hit, fill: c.fill });
    }
    if (!hits.length) continue;

    // Largest overlaps first, so the cap keeps the shapes that actually matter.
    hits.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
    const kept = hits.slice(0, MAX_COVERS);
    const coverage = Math.min(1, unionArea(kept.map((h) => h.rect)) / area);
    if (coverage < minCoverage) continue;

    out.push({
      text: nodes[i]!.text!.replace(/\s+/g, ' ').trim(),
      rect: tr,
      coverage,
      fullyHidden: coverage >= FULLY_HIDDEN,
      fill: kept[0]!.fill,
    });
  }
  return out;
}

/** Run the page pass across a document, tagging each finding with its page. */
export function findHiddenTextInPages(pages: PdfNode[][], opts: RedactionOptions = {}): HiddenTextFinding[] {
  return pages.flatMap((nodes, page) =>
    findHiddenText(nodes, opts).map((f) => ({ ...f, page })));
}

/**
 * One-line summary of a scan, for a report header.
 *
 * Deliberately worded as an observation, never an accusation: the measurement is
 * "present but not visible", and the reason could as easily be a layering
 * mistake as a failed redaction.
 */
export function describeHiddenText(findings: HiddenTextFinding[]): string {
  if (!findings.length) return '';
  const words = findings.reduce((a, f) => a + (f.text.match(/\S+/g) ?? []).length, 0);
  const pages = new Set(findings.map((f) => f.page ?? 0)).size;
  const where = pages > 1 ? ` across ${pages} pages` : '';
  return `${words} word${words === 1 ? '' : 's'} in ${findings.length} run${findings.length === 1 ? '' : 's'} sit behind opaque shapes${where} — present in the file, not visible on the page`;
}
