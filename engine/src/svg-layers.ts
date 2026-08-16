// SPDX-License-Identifier: MPL-2.0
/**
 * Lift layers - enumerate an SVG's own layers and derive a standalone document
 * for each one (plans/104 section 7).
 *
 * The action a user sees is "Lift layers" on a box holding an SVG: the artwork
 * comes apart into N stacked boxes at staggered depth, so a camera move gets
 * real parallax over real vector groups instead of an ML-inferred depth map.
 * This module is the half of that which has to be right - everything the shell
 * does afterwards (mint ids, sanitise, write rows) is bookkeeping over what is
 * returned here.
 *
 * ## Why the engine owns it
 *
 * Wire formats and the maths every shell must agree on live in the engine, and
 * a lifted layer is both: the derived markup is what gets stored in a box, and
 * a headless posed still (the CLI's Tier-A path) has to be able to produce the
 * same layers from the same bytes. So this is DOM-free - no `DOMParser`, no
 * `getBBox` - which is also why the bounding boxes here are *analytic and
 * best-effort*: computed from geometry attributes and path control points, not
 * measured by a renderer. They are used for CLUSTERING and for the picker's
 * preview, never for placement (a derived layer keeps the ROOT coordinate
 * system verbatim, so placement is the source box's, unchanged).
 *
 * ## What a layer is
 *
 * The root's direct children, in paint order:
 *
 *   • every `<g>` is a layer - that is what a designer's "layer" already is;
 *   • stray leaves (`<path>`, `<rect>`, … dropped straight onto the root by a
 *     generator that never grouped anything) are clustered SPATIALLY, the
 *     `pdf-artwork.ts` posture verbatim: *group is a hint, never a
 *     requirement*. That module's reasoning applies unchanged here - an
 *     Illustrator export routinely wraps a whole drawing in one `<g>` while a
 *     plotter or a chart library emits fifty ungrouped paths;
 *   • a single wrapping `<g>` with nothing beside it is DESCENDED THROUGH
 *     (`<g id="Layer_1">` around the entire drawing is the most common structure of
 *     SVG there is, and lifting "1 layer" out of it is useless). The wrapper is
 *     reproduced as an ancestor in every derived document, so geometry and
 *     inherited paint are preserved exactly - and descent REFUSES a wrapper
 *     whose attributes composite its children as a unit (`opacity` below 1,
 *     `filter`, `mask`, `mix-blend-mode`, `isolation`), because splitting those
 *     changes the picture wherever children overlap;
 * • a layer holding almost ALL of the artwork is descended into as well -
 *     see "the hero problem" below.
 *
 * ## The hero problem (1.121)
 *
 * A lone-wrapper descent stops the moment a level has two children, and a real
 * page routinely has a level like that: `docs/shots/brand-colours.svg` enumerated
 * into 5 layers of which ONE held 472 of the document's 492 paint elements -
 * 96 %. Four hairlines and the page. Nothing about that stack is wrong (it is
 * exactly what the markup groups), and nothing about it is a lift either: there
 * is one surface to elevate, so a flythrough over it is a flythrough over a
 * picture.
 *
 * So a candidate whose share of the paint elements is above
 * {@link SVG_LAYERS_HERO_SHARE} is DESCENDED INTO and re-clustered, repeatedly,
 * up to {@link SVG_LAYERS_HERO_ROUNDS}. Two things are different one level down,
 * both deliberate:
 *
 * • **groups cluster too.** At the root a `<g>` is always its own candidate -
 *     the author's grouping is the only signal there is. Below a hero it has
 *     already been measured as uninformative (that is what "96 % in one group"
 *     means), so geometry decides instead, and a card's icon parts rejoin their
 *     card. `pdf-artwork.ts`'s "group is a hint" taken at its word.
 *   • **the count is budgeted.** A raw descent of that same file yields 80
 *     candidates, which is not a proposal a person can accept - the dialog would
 *     be asking whether to turn one box into eighty. The clustering gap is
 *     doubled (up to {@link SVG_LAYERS_HERO_GAP_STEPS} times) until the level
 *     fits {@link SVG_LAYERS_HERO_BUDGET}, so the answer stays a stack somebody
 *     can read. Measured on the six banked acceptance shots: 5 → 14 layers on
 *     brand-colours, every other shot unchanged (no hero).
 *
 * ## Cropping a derived layer to its ink (1.121)
 *
 * A derived document used to keep the source's viewBox verbatim - which made
 * every layer a full-stage box, whatever it actually drew. That is correct and
 * ruinous: `shadow: depth` on a 16×16 icon then costs a full-frame gaussian, and
 * eleven of them abort the encoder watchdog (plans/104 section 9 P3.1 item 1, measured).
 *
 * When a layer's ink is measurable AND the crop is provably safe, the derived
 * document's viewBox (and width/height) is the layer's own bounds instead, and
 * `SvgLayer.viewBox` reports the rect so the caller can place the row over
 * exactly that part of the source box ({@link SvgLayersResult.viewBox} carries
 * the source's own for the mapping). Geometry is unchanged - a smaller viewBox
 * over a proportionally smaller box is the same picture - and the effects that
 * follow the box now follow the ink.
 *
 * "Provably safe" is the whole of it, because a viewBox is also a CLIP: every
 * member measured (no `<text>`, no `<use>`, nothing exotic), no percentage
 * length in the body (percentages resolve against the viewport, which is the
 * thing being changed), no `filter`/`marker` on the layer (both paint outside
 * the geometry), a pad for stroke half-widths and miters, and the result
 * intersected with the SOURCE viewBox - ink already clipped away by the original
 * must not reappear because its layer got a bigger window. Anything unproven
 * keeps the full-stage document it had in 1.119.
 *
 * ## The identity property
 *
 * The layers are a PARTITION of the root's rendered children, in order, with
 * every non-rendering sibling (`<defs>`, `<style>`, paint servers) carried into
 * each derived document whole. So stacking the N derived documents in order
 * reproduces the original: `source-over` is associative, and a `<defs>` paints
 * nothing, so repeating it N times costs bytes and changes no pixel. That is
 * `plans/104` section 7's "N lifted layers at z = 0 render byte-identical to the
 * un-lifted original", and it is asserted both ways - the structural partition
 * BYTE-EXACTLY in `tests/svg-layers.test.ts`, the rendered composite in a real
 * engine in `tests/svg-lift-identity.browser.test.ts`.
 *
 * ⚑ The rendered half is exact to within compositing rounding, not to the byte,
 * and the reason is not ours: a browser rasterises each layer into its own 8-bit
 * PREMULTIPLIED buffer before compositing, so it rounds twice where the
 * single-pass render rounds once. Measured (Chromium, 320×240): every channel
 * within ±1 except at most 0.025 % of them, worst single channel 56/255 - a
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
 *      DIFFERENT layer is the pathological case section 11 names. The referenced
 *      element is copied into the borrowing layer's own `<defs>` - where it
 *      paints nothing, so the copy cannot double-draw - and a warning says so.
 *
 * ## Names
 *
 * Labels are `Layer 1..N`, always: this module never reads a name out of the
 * file, and `<title>`, `<desc>` and `<metadata>` are dropped from a derived
 * document ANYWHERE they appear, not merely at its top level - a name hides
 * inside a `<g>` at least as often as beside one. The shell localises by index;
 * `label` is the untranslated fallback.
 *
 * ⚑ What this module does NOT do, stated because the sentence it replaces was
 * wrong: there is no ingest-time PII strip for SVG to preserve. `stripMetadata`
 * runs on PNG/JPEG only (and behind a flag); an uploaded vector goes through
 * DOMPurify, which keeps `data-*`. So `data-name`/`inkscape:label` survive an
 * upload today, lift or no lift. Dropping the three metadata ELEMENTS is a
 * property this module owns; the attributes are not, and claiming otherwise
 * described a guarantee nothing implemented.
 *
 * ## Untrusted input
 *
 * The input is a user's uploaded SVG (already DOMPurify-sanitised by the shell,
 * but this module assumes nothing about that). Every bound is a named constant
 * below, and NOTHING here throws: junk yields fewer layers and more warnings.
 * Work is linear in the input length, with exactly one deliberate exception -
 * the spatial clustering is a pairwise union-find, quadratic in the number of
 * stray root leaves, which is what `SVG_LAYERS_MAX_CANDIDATES` exists to bound.
 * Every other pass here (id resolution included) is bounded by the document, NOT
 * by the product of two caps. See `docs/parser-inventory.md`.
 */

import { parseSvgPath } from './svg-path.ts';

// ─── caps (untrusted SVG text - every one of these is a refusal, not a crash) ──

/** Longest document scanned, in chars. Beyond it: no layers, one warning. */
export const SVG_LAYERS_MAX_CHARS = 4_000_000;
/**
 * Tag ceiling for one scan - the same bound `svg-custgeom.ts` uses.
 *
 * TAGS, not elements: `scanTags` emits one entry per `<g>` AND one per `</g>`, so a
 * document of N ordinary (non-self-closing) elements spends 2N of this budget. The
 * refusal says so, because "elements" reads as twice the headroom there really is.
 */
export const SVG_LAYERS_MAX_TAGS = 40_000;
/**
 * Most layers returned. A deeper stack is not a lift, it is clutter. Each
 * layer becomes a real box with its own plate at export time.
 *
 * At the ceiling the TAIL MERGES rather than truncating: trailing candidates are
 * always a contiguous run, so merging them preserves paint order and the
 * identity property survives the cap. A cap that dropped artwork would silently
 * produce a lift that no longer looks like the original.
 */
export const SVG_LAYERS_MAX = 64;
/**
 * Root children considered at all - `pdf-artwork.ts`'s `MAX_NODES` in a new
 * costume, and for the same reason: spatial clustering is a pairwise union-find,
 * so its cost is QUADRATIC in the number of stray leaves. Measured on this
 * module before the cap existed: 4 000 leaves 78 ms, 10 000 leaves 0.7 s,
 * 20 000 leaves 4.3 s, 39 000 leaves 16 s - a hang, on markup a stranger sends.
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
/**
 * Derived total (all layers' markup, summed) past which the caller is TOLD the
 * lift is heavy. A warning, never a refusal - the bytes are correct, and the
 * user is the one who knows whether the artwork is worth them.
 *
 * Carrying the whole `<defs>` into every layer is cheap in pixels and expensive
 * in bytes, and only the second one is bounded by anything: `SVG_LAYERS_MAX`
 * bounds the layer COUNT, so one embedded raster in `<defs>` multiplies by it.
 * Measured: an ordinary 1.0 MB file (one `<pattern>` holding a PNG, 24 real
 * groups) derives 24.0 MB - and the shell writes every byte of that into
 * IndexedDB on one confirm click. At the caps that is ~256 MB, silently. So the
 * enumerator prices the result and says so IN THE DIALOG, before the click.
 */
export const SVG_LAYERS_HEAVY_BYTES = 8_000_000;

/**
 * Share of a document's paint elements above which a layer is a HERO: nearly
 * all the artwork sits in one box, so it gets descended into. See the header.
 *
 * Two thirds, not "most": at 51 % a layer is merely the biggest of several and
 * the stack is already a stack. The measured failure was 96 %, and the second
 * worst of the six banked shots is 22 %, so the threshold sits in a wide empty
 * gap rather than on top of real data.
 */
export const SVG_LAYERS_HERO_SHARE = 2 / 3;
/** Descents attempted - a hero's replacement can itself be a hero. */
export const SVG_LAYERS_HERO_ROUNDS = 4;
/** Documents with less ink than this are never shredded to find a stack. */
export const SVG_LAYERS_HERO_MIN_INK = 8;
/** Layers a single hero descent may propose before its clustering coarsens. */
export const SVG_LAYERS_HERO_BUDGET = 20;
/**
 * Merge distances tried inside a hero descent, as multiples of the root's own
 * clustering gap, finest first. The first one whose result fits
 * {@link SVG_LAYERS_HERO_BUDGET} wins.
 */
export const SVG_LAYERS_HERO_GAP_SCALES: readonly number[] =
  Object.freeze([1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16]);
/**
 * How different in AREA two things may be inside a hero descent and still be
 * merged into one layer - 16, i.e. four times the size on each side.
 *
 * Below a hero, proximity alone is not a relation: a content pane overlaps every
 * card on it and every card overlaps its own icon, so unlimited union-find
 * bridges the whole level into one blob (measured: brand-colours' 80 candidates
 * became 1). Cards merge with cards and an icon's fragments merge with their
 * icon; the surface they sit on stays the surface.
 */
export const SVG_LAYERS_PEER_AREA_RATIO = 16;

// ─── clustering tunables (root user units; the pdf-artwork.ts shape) ─────────

/** Leaves closer than this are the same mark. */
const CLUSTER_GAP = 6;
/** …scaled by the typical shape, so big art tolerates bigger internal gaps. */
const GAP_FACTOR = 0.4;
/** …clamped, so sparse decoration cannot collapse into one blob. */
const MAX_CLUSTER_GAP = 48;

// ─── element vocabulary ─────────────────────────────────────────────────────

/**
 * Dropped from a derived document entirely - AT ANY DEPTH, not just at the root.
 *
 * Three of these are names or provenance (the PII posture), and `script` is
 * defence in depth - the shell sanitises before this module ever sees the
 * markup, and a script is inert inside an `<img>` anyway, but a lifted layer
 * must not be the path that reintroduces one.
 *
 * ⚑ "At any depth" is required and used not to be true. A layer's body is a
 * verbatim slice, so filtering only the nodes this module ENUMERATES (the root's
 * direct children, a wrapper's direct children) let `<g><script>…</script></g>`
 * and `<g><title>Andy's draft</title>…` ride through whole, while the header,
 * the changelog and a test all read as though they could not. The spans are
 * spliced out of the slice instead ({@link dropSpans}), which keeps every
 * emitted fragment verbatim - it just gives it holes.
 */
const DROP_TAGS = new Set(['title', 'desc', 'metadata', 'script']);

/**
 * Non-rendering top-level siblings, carried into EVERY derived layer whole.
 *
 * The plan's own call - "root attrs + the WHOLE `<defs>` per layer - cheap,
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
 * under the split - the wrapper is reproduced verbatim in every derived
 * document, and clipping each layer by the same path gives exactly the union of
 * the clipped layers - so refusing them would cost the descent for nothing.
 */
const UNIT_PROPS = ['opacity', 'filter', 'mask', 'mix-blend-mode', 'isolation'] as const;

/**
 * Elements that put ink on the page - the unit the hero test counts in.
 *
 * Paint elements rather than bytes or `<g>`s: bytes measure how a generator
 * writes numbers, and groups measure how it nests them, while "how much of this
 * picture is in that box" is a question about drawn things. `<tspan>` is
 * deliberately absent (it is ink inside `<text>`, already counted once).
 */
const PAINT_TAGS = new Set([
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'image', 'use', 'foreignobject',
]);

/**
 * Attributes whose value may be a percentage OF THE VIEWPORT, which a crop
 * changes. Gradient stop `offset` and filter-region percentages are relative to
 * their own units and are not here - they are why the test is per-attribute
 * rather than "does this markup contain a `%`" (every gradient in every walker
 * shot has `offset="100.00%"`, and refusing on that would crop nothing, ever).
 */
const VIEWPORT_PCT_RE =
  /\s(?:x|y|width|height|cx|cy|r|rx|ry|x1|y1|x2|y2|dx|dy|stroke-width|font-size|stroke-dasharray)\s*=\s*(?:"[^"]*%|'[^']*%)/i;
/** …and the same lengths written in an inline `style`. */
const VIEWPORT_PCT_STYLE_RE =
  /(?:^|[;{\s])(?:width|height|font-size|stroke-width|stroke-dasharray|x|y|r|rx|ry|cx|cy)\s*:\s*[^;"'}]*%/i;
/**
 * Markers draw whole shapes at a path's vertices, at a size and orientation
 * only a renderer knows. A layer using one is not cropped - unlike `filter`,
 * whose region is declared and can be read (see {@link spillOf}), and unlike
 * `mask`/`clip-path`, which can only ever HIDE ink and so never spill.
 */
const MARKER_RE = /\smarker(?:-start|-mid|-end)?\s*=|(?:^|[;{\s])marker(?:-start|-mid|-end)?\s*:/i;
/** Stroke widths, wherever they are written, so the crop can pad by the widest. */
const STROKE_W_RE = /stroke-width\s*[=:]\s*["']?\s*([0-9]*\.?[0-9]+)/gi;
/**
 * A miter join can reach this many half-widths past the geometry (the SVG
 * default `stroke-miterlimit`), so the pad prices the worst legal join rather
 * than the average one. Over-padding costs a few user units of empty margin;
 * under-padding clips a corner off somebody's artwork.
 */
const STROKE_MITER_LIMIT = 4;
/** Antialiasing margin on a crop, in user units, on top of any stroke pad. */
const CROP_PAD = 1;
/**
 * A crop must save at least this much area to be worth having. At 90 % the
 * background layer of a screenshot - the one that IS the stage - keeps the
 * source's own root, which is both the honest document and the one the identity
 * property is easiest to read against.
 */
const CROP_MIN_GAIN = 0.9;

// ─── public shape ───────────────────────────────────────────────────────────

/** A rectangle in the source's ROOT user units (viewBox space). */
export interface SvgLayerBox { x: number; y: number; w: number; h: number }

export interface SvgLayer {
  /**
   * A standalone `<svg>` document rendering ONLY this layer, in the source's
   * root coordinate system - same root attributes, so it drops into a box of the
   * source's geometry with no fix-up at all.
   *
   * ⚑ Unless {@link viewBox} is present, in which case the document is CROPPED
   * to that rect (its `viewBox`, `width` and `height` say so) and drops into the
   * part of the source box that rect maps to. Same picture either way; the
   * cropped form is the one whose shadow, blur and plate follow its ink.
   */
  markup: string;
  /**
   * The crop this layer's document was given, in the SOURCE's root user units,
   * or absent when it kept the whole viewBox. Read with
   * {@link SvgLayersResult.viewBox} - the two together are the affine map from
   * the source box's rect to this row's.
   */
  viewBox?: SvgLayerBox;
  /**
   * Analytic bounds of the layer's ink in root user units, or null when nothing
   * in it could be measured without a renderer (`<text>`, `<use>`, filter
   * spill). Advisory: for previews and clustering, never for placement.
   */
  bbox: SvgLayerBox | null;
  /** `Layer 1`… - an index, never a name from the file. Shells localise it. */
  label: string;
  /** 0-based position in paint order (bottom first). */
  index: number;
  /** How many of the source's own top-level nodes this layer carries. */
  nodes: number;
  /**
 * The walker's `data-box-id`, when the layer is a single node carrying one -
   * the section 7 identity passthrough (`renderSvgFromHtml`'s `layerIds` option)
   * arriving at the other end. Absent for ordinary artwork.
   */
  boxId?: string;
}

export interface SvgLayersResult {
  layers: SvgLayer[];
  /** Everything refused, repaired or capped, in plain words. Never thrown. */
  warnings: string[];
  /**
   * The SOURCE document's own viewBox in user units - from its `viewBox`, else
   * from `width`/`height`, else null when it declares neither and there is no
   * coordinate system to map through. The denominator for every layer's
   * {@link SvgLayer.viewBox}.
   */
  viewBox: SvgLayerBox | null;
}

export interface SvgLayerOptions {
  /** Lower the layer ceiling (never raises it above {@link SVG_LAYERS_MAX}). */
  maxLayers?: number;
  /**
   * Descend into a layer that holds nearly all the artwork (the hero problem in
   * the header). Default on; `false` is for tests that want the raw levels.
   */
  heroDescent?: boolean;
  /**
   * Crop each derived document to its own ink where that is provably safe.
   * Default on; `false` reproduces 1.119's full-stage documents exactly.
   */
  cropToInk?: boolean;
  /**
   * User units → DESTINATION px, per axis: the scale at which the caller is
   * about to place the cropped rows. Default `1` on both axes, which is what
   * 1.121 assumed everywhere and what a 1:1 placement really has.
   *
   * It exists because a crop is only free if the row it maps to lands where the
   * uncropped picture already was. {@link cropFor} snaps the crop OUTWARDS to
   * whole units of this scale - i.e. whole px of the row - so the layer's
   * rectangle is an integer offset and an integer size in the space it will be
   * drawn in. Snapped in user units instead (1.121), a crop at any k ≠ 1 lands
   * the row between device pixels and the browser bilinear-filters the WHOLE
   * layer back onto the grid: measured on `docs/shots/brand-colours.svg` in a
   * 1000×625 box, 88 675 channels beyond ±1 (3.5 %, max 189) against 1 758
   * (0.07 %, max 63) for the same shot uncropped - every anti-aliased edge in
   * the layer, which on dense UI screenshots is all the text and every hairline.
   *
   * The resulting viewBox is usually FRACTIONAL, and that is fine: a viewBox
   * only has to be a superset of the ink, and it is the ROW that has to be whole.
   *
   * Per axis because `fit: 'fill'` scales x and y independently.
   *
   * ⚑ What this does NOT buy, stated because 1.121 over-claimed exactly here: a
   * crop is fidelity-neutral when the row lands ON the pixel grid. When the
   * SOURCE box's content rect is itself fractional (a 443.78-unit shot drawn
   * 550.625 px tall), the browser rounds that container to a bitmap and scales
   * it, while an integer-sized row does not - so the two differ by a fraction of
   * a pixel over the whole ink however the crop is snapped. Isolated: shortening
   * one layer's viewport 443.78 → 266 at scale 1 and origin 0 moves 283 px past
   * ±1 (max 89). That is the renderer's container rounding, and
   * `tests/svg-lift-identity.browser.test.ts` measures it rather than claiming it
   * away.
   */
  cropScale?: { x: number; y: number };
}

// ─── a minimal, bounded tag scanner ─────────────────────────────────────────
//
// Not a parser and not a DOM: a flat list of element tags with their byte spans,
// which is all the derivation needs - every emitted fragment is a VERBATIM SLICE
// of the input, so nothing is re-serialised and nothing can be corrupted on the
// way through. (`strip-metadata.ts` has a tokenizer of its own with a different
// job: it REBUILDS tags to drop attributes, and carries no spans and no nesting.
// Two small scanners beat one shared one that has to do both.)

interface Tag {
  /** Lower-cased local name, namespace prefix removed - what logic tests. */
  name: string;
  /** The name exactly as written, prefix and case intact - what is re-emitted. */
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

/** `id` is read once per tag when building the index - keep its regex hoisted. */
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
 * count - over-refusing here means never descending through Figma's outer `<g>`.
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
 * which propagates as "unmeasurable" - never as a wrong number.
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
 * A curve is bounded by its control polygon rather than solved for extrema - a
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
 * (a stray leaf has no group to rejoin by - that is what makes it stray). A leaf
 * with no measurable box is its own cluster: we will not guess where it is.
 *
 * `gapScale` multiplies the merge distance. It is 1 everywhere except inside a
 * hero descent, where doubling it is how a level of eighty becomes a level a
 * person can accept (header, "the count is budgeted").
 *
 * `sizeRatio` bounds how different in AREA two boxes may be and still merge -
 * `Infinity` at the root, where proximity is the only question. One level down
 * it is required and its absence was measured: a page's content pane
 * overlaps every card, icon and swatch on it, so plain proximity union-find
 * bridges the entire level into ONE cluster (brand-colours: 80 candidates → 1,
 * i.e. no descent at all). A surface that big is background, not a peer of the
 * things sitting on it.
 */
function clusterLeaves(
  idx: number[], boxes: Array<SvgLayerBox | null>, gapScale = 1, sizeRatio = Infinity,
): number[][] {
  const measurable = idx.filter((i) => boxes[i]);
  const alone = idx.filter((i) => !boxes[i]).map((i) => [i]);
  if (measurable.length < 2) return [...alone, ...measurable.map((i) => [i])];

  const parent = measurable.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const join = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  const typical = median(measurable.map((i) => Math.min(boxes[i]!.w, boxes[i]!.h)));
  const gap = Math.min(MAX_CLUSTER_GAP, Math.max(CLUSTER_GAP, typical * GAP_FACTOR)) * gapScale;

  const area = (r: SvgLayerBox): number => Math.max(1e-6, r.w * r.h);
  for (let a = 0; a < measurable.length; a++) {
    const ba = boxes[measurable[a]!]!;
    const grown = expandBox(ba, gap);
    for (let b = a + 1; b < measurable.length; b++) {
      if (find(a) === find(b)) continue;
      const bb = boxes[measurable[b]!]!;
      if (Number.isFinite(sizeRatio)) {
        const [lo, hi] = area(ba) < area(bb) ? [area(ba), area(bb)] : [area(bb), area(ba)];
        if (hi > lo * sizeRatio) continue;
      }
      if (boxesOverlap(grown, bb)) join(a, b);
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
 * split back into its contiguous index runs - `pdf-artwork.ts`'s "refuse when
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
  /** Member nodes in document order - one for a group, N for a cluster. */
  members: Node[];
  bbox: SvgLayerBox | null;
  /** Document index of the first member: the candidate's place in paint order. */
  order: number;
  /**
   * The open tags this candidate sits INSIDE, outermost first - the root's
   * descended wrappers plus, for a hero's children, the hero's own chain. Each
   * is re-emitted around the body so geometry and inherited paint survive.
   */
  wrappers: Tag[];
  /** Root-units matrix of that chain, or null when any link was unparseable. */
  mat: Mat | null;
  /** Every member's bounds were measurable - the crop's precondition. */
  measured: boolean;
  /** Paint elements inside it: the hero test's unit. */
  ink: number;
}

/**
 * Paint elements in a node's subtree - what the hero test counts.
 *
 * `<defs>` and friends are skipped WHOLE: a gradient with twelve stops is not
 * twelve drawings, and a document whose defs outnumber its artwork would
 * otherwise nominate a hero that draws nothing. Linear in the subtree, and
 * subtrees at one level are disjoint, so a round costs one pass over the tags.
 */
function inkOf(tags: Tag[], node: Node): number {
  const end = node.tag.kind === 'self' ? node.ti + 1 : (skipSubtree(tags, node.ti) ?? tags.length);
  let n = 0;
  for (let i = node.ti; i < end; i++) {
    const t = tags[i]!;
    if (t.kind === 'close') continue;
    if (DROP_TAGS.has(t.name) || CARRY_TAGS.has(t.name)) {
      const after = t.kind === 'self' ? i + 1 : (skipSubtree(tags, i) ?? end);
      i = after - 1;
      continue;
    }
    if (PAINT_TAGS.has(t.name)) n++;
  }
  return n;
}

/** The largest scale factor a chain matrix applies - how much a stroke grew. */
function matScale(m: Mat | null): number {
  if (!m) return 1;
  return Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])) || 1;
}

/**
 * One level's candidates: cluster, keep the stacking order safe, sort by paint
 * order. The top level calls this with `clusterGroups: false` (a `<g>` is a
 * layer, because the author said so); a hero descent calls it with `true` and a
 * budget (the author's grouping has just been measured as uninformative).
 */
function buildLevel(
  tags: Tag[], nodes: Node[], mat: Mat | null, wrappers: Tag[],
  clusterGroups: boolean, budget: number, onSplit: () => void,
): Candidate[] {
  const boxes = nodes.map((nd) => {
    const local = elementBox(tags, nd, 0);
    return local && mat ? transformBox(local, mat) : null;
  });
  const groupIdx: number[] = [];
  const leafIdx: number[] = [];
  nodes.forEach((nd, i) => {
    (!clusterGroups && CONTAINER_TAGS.has(nd.tag.name) ? groupIdx : leafIdx).push(i);
  });

  // Budgeted clustering: walk the merge distance UPWARDS and stop at the first
  // one that fits, which is the finest grouping the budget allows. Starting at
  // the root's own gap and only coarsening was measured to overshoot in the
  // other direction - 80 candidates collapsing to 3, a "descent" that swaps one
  // mega-layer for another. The budget is a ceiling on how many boxes a person
  // is asked to accept, not a target to hit from below.
  let clusters: number[][] = [];
  const steps = budget > 0 ? SVG_LAYERS_HERO_GAP_SCALES : [1];
  for (let s = 0; s < steps.length; s++) {
    const raw = [
      ...groupIdx.map((i) => [i]),
      ...clusterLeaves(leafIdx, boxes, steps[s]!, budget > 0 ? SVG_LAYERS_PEER_AREA_RATIO : Infinity),
    ];
    const before = raw.length;
    clusters = splitUnsafeClusters(raw, boxes, nodes.length);
    if (clusters.length > before) onSplit();
    if (budget <= 0 || clusters.length <= budget) break;
  }

  return clusters
    .map((members): Candidate => {
      const sorted = [...members].sort((a, b) => a - b);
      let bb: SvgLayerBox | null = null;
      for (const i of sorted) bb = boxUnion(bb, boxes[i] ?? null);
      const nds = sorted.map((i) => nodes[i]!);
      return {
        members: nds,
        bbox: bb,
        order: sorted[0]!,
        wrappers,
        mat,
        measured: sorted.every((i) => boxes[i] != null),
        ink: nds.reduce((a, nd) => a + inkOf(tags, nd), 0),
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** What a hero descent produced: its replacement candidates + defs to carry. */
interface Descent { candidates: Candidate[]; carry: Node[] }

/**
 * Take one candidate apart into the level below it - the hero problem's answer.
 *
 * Only a single-node container is descendable, and only when it does not
 * composite as a unit: the same two refusals the root-level wrapper descent
 * makes, for the same reason. Lone wrappers on the way down are walked through
 * (a hero is routinely `<g><g><g>…the page`), and each becomes an emitted
 * ancestor of every child, so nothing about the picture changes - only which
 * boxes it arrives in.
 */
function descendInto(tags: Tag[], c: Candidate, onSplit: () => void): Descent | null {
  if (c.members.length !== 1) return null;
  let node = c.members[0]!;
  let mat = c.mat;
  const chain = [...c.wrappers];
  const carry: Node[] = [];

  for (let d = 0; d < SVG_LAYERS_MAX_DESCENT; d++) {
    if (node.tag.kind !== 'open' || !CONTAINER_TAGS.has(node.tag.name)) return null;
    if (unitCompositing(node.tag.attrs)) return null;
    const kids = directChildren(tags, node.ti);
    if (!kids) return null;
    const inner: Node[] = [];
    for (const k of kids) {
      if (DROP_TAGS.has(k.tag.name)) continue;
      if (CARRY_TAGS.has(k.tag.name)) { carry.push(k); continue; }
      inner.push(k);
    }
    if (!inner.length) return null;
    const m = parseTransform(attrOf(node.tag.attrs, 'transform'));
    mat = mat && m ? matMul(mat, m) : null;
    chain.push(node.tag);
    if (inner.length === 1) { node = inner[0]!; continue; }
    return { candidates: buildLevel(tags, inner, mat, chain, true, SVG_LAYERS_HERO_BUDGET, onSplit), carry };
  }
  return null;
}

/**
 * Enumerate an SVG's layers and derive a standalone document for each.
 *
 * Never throws. A document it cannot make sense of yields `layers: []` and a
 * warning saying why, in words a person can read in a dialog.
 *
 * @param markup  SVG source text - the shell's DOMPurify-sanitised string.
 * @param opts    {@link SvgLayerOptions}
 */
export function enumerateSvgLayers(markup: string, opts: SvgLayerOptions = {}): SvgLayersResult {
  const warnings: string[] = [];
  try {
    return enumerate(markup, opts, warnings);
  } catch {
    // Defence in depth: the body is written not to throw, so reaching here is a
    // bug - but a bug in a lift must not take down the editor that called it.
    warnings.push('could not read this SVG');
    return { layers: [], warnings, viewBox: null };
  }
}

function enumerate(markup: string, opts: SvgLayerOptions, warnings: string[]): SvgLayersResult {
  const empty = (why: string, viewBox: SvgLayerBox | null = null): SvgLayersResult => {
    warnings.push(why);
    return { layers: [], warnings, viewBox };
  };

  if (typeof markup !== 'string' || markup.length === 0) return empty('no SVG markup');
  if (markup.length > SVG_LAYERS_MAX_CHARS) {
    return empty(`SVG is too large to lift (over ${Math.round(SVG_LAYERS_MAX_CHARS / 1e6)} MB)`);
  }
  const tags = scanTags(markup);
  // "tags", not "elements": opening and closing tags are counted separately (see
  // SVG_LAYERS_MAX_TAGS), so the number a reader can check against their own file is
  // the tag count, not the element count.
  if (!tags) return empty(`SVG has more than ${SVG_LAYERS_MAX_TAGS} tags (an opening and a closing tag count as two)`);

  const rootIdx = tags.findIndex((t) => t.name === 'svg' && t.kind !== 'close');
  if (rootIdx < 0) return empty('no <svg> root');
  const root = tags[rootIdx]!;
  if (root.kind === 'self') return empty('this SVG is empty');

  // The root composites its children AS A UNIT - exactly the test the descent
  // already applies to a wrapper `<g>`, applied to the element that wraps
  // everything. `rootAttributes()` re-emits the root verbatim into every derived
  // document, so an `opacity="0.55"` up here would be applied N times over
  // instead of once over the composite. Measured (Chromium, 320×240, two
  // overlapping groups): 45 203 channels beyond ±1 against a suite budget of 154,
  // mean absolute error 5.70 - a lift defect by the browser suite's own numbers,
  // and it produced no warning at all because nothing looked. `filter` on the
  // root: 12 952 channels. There is no split that preserves this picture (leaving
  // the property on each layer over-applies it, stripping it drops it), so the
  // honest answer is the wrapper's: keep the artwork whole.
  const rootUnit = unitCompositing(root.attrs);
  if (rootUnit) return empty(`kept the artwork whole — its \`${rootUnit}\` applies to all of it at once`);

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
    // stays whole and ITS OWN markup already contains these - hoisting them into
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
  // nothing painted before it moves. Its bbox is left unmeasured - a bucket does
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
  // through has to be folded back in - a wrapper's `transform` is exactly the
  // difference between "where this shape is in the file" and "where it is in the
  // picture". An unparseable wrapper transform makes every box unmeasurable
  // rather than wrong, which the clustering then treats as "refuse to merge".
  let wrapperMat: Mat | null = IDENTITY;
  for (const w of wrappers) {
    if (!wrapperMat) break;
    const m: Mat | null = parseTransform(attrOf(w.attrs, 'transform'));
    wrapperMat = m ? matMul(wrapperMat, m) : null;
  }
  let splitWarned = false;
  const onSplit = (): void => {
    if (splitWarned) return;
    splitWarned = true;
    warnings.push('split a cluster that another layer paints through, to keep the stacking order');
  };

  // Paint order: a candidate's place is its FIRST member's document position.
  const candidates = buildLevel(tags, candidateNodes, wrapperMat, wrappers, false, 0, onSplit);
  if (overflow.length) {
    candidates.push({
      members: overflow,
      bbox: null,
      order: Number.MAX_SAFE_INTEGER,
      wrappers,
      mat: wrapperMat,
      measured: false,
      ink: overflow.reduce((a, nd) => a + inkOf(tags, nd), 0),
    });
  }

  // The ceiling is needed BEFORE the descent, not only at the merge below: a
  // descent that overshot it would hand the tail merge members from two
  // different wrapper chains, and a merged layer can only re-emit one.
  const cap = Math.max(1, Math.min(SVG_LAYERS_MAX, opts.maxLayers ?? SVG_LAYERS_MAX));

  // ── the hero problem: one layer holding the artwork is not a stack ─────────
  // Spliced IN PLACE, never re-sorted: a hero's children all live inside its own
 // span, so putting them where it was is exactly their place in paint order -
  // and `order` below a descent is a different level's index, which a global
  // sort would happily interleave with this one's.
  if (opts.heroDescent !== false) {
    for (let round = 0; round < SVG_LAYERS_HERO_ROUNDS && candidates.length < cap; round++) {
      const total = candidates.reduce((a, c) => a + c.ink, 0);
      if (total < SVG_LAYERS_HERO_MIN_INK) break;
      let at = -1;
      let most = 0;
      candidates.forEach((c, i) => { if (c.ink > most) { most = c.ink; at = i; } });
      if (at < 0 || most <= total * SVG_LAYERS_HERO_SHARE) break;
      const sub = descendInto(tags, candidates[at]!, onSplit);
      // Fewer than two is not a descent, it is a rename: keep the layer whole.
      if (!sub || sub.candidates.length < 2) break;
      // …and neither is a descent that would immediately be merged back.
      if (candidates.length - 1 + sub.candidates.length > cap) break;
      candidates.splice(at, 1, ...sub.candidates);
      carry.push(...sub.carry);
      warnings.push(
        `one layer held ${Math.round((most / total) * 100)}% of this artwork, `
        + `so it was opened up into ${sub.candidates.length}`,
      );
    }
  }

  // ── cap: the TAIL merges, so no artwork is ever dropped ───────────────────
  let final = candidates;
  if (candidates.length > cap) {
    const tail = candidates.slice(cap - 1);
    // A tail merged across two levels has no single wrapper chain, so it takes
    // the outermost one it can: the root's own. Its members are re-emitted
    // verbatim, wrappers and all, because a hero's children are sliced INSIDE
    // the hero's span - the chain is in the bytes.
    final = [...candidates.slice(0, cap - 1), {
      members: tail.flatMap((c) => c.members).sort((a, b) => a.start - b.start),
      bbox: tail.reduce<SvgLayerBox | null>((acc, c) => boxUnion(acc, c.bbox), null),
      order: tail[0]!.order,
      wrappers: tail.every((c) => c.wrappers === tail[0]!.wrappers) ? tail[0]!.wrappers : wrappers,
      mat: wrapperMat,
      measured: false,
      ink: tail.reduce((a, c) => a + c.ink, 0),
    }];
    warnings.push(`found ${candidates.length} layers; the last ${tail.length} were merged into one (the limit is ${cap})`);
  }

  // ── derive one document per layer ─────────────────────────────────────────
  const drops = dropSpans(tags);
  const carryMarkup = carry.map((c) => sliceKeeping(markup, drops, c.start, c.end)).join('');
  const srcViewBox = viewBoxOf(root.attrs);
  // ⚑ A carried `<style>` takes cropping off the table for the WHOLE document.
  // CSS can set `filter`, `stroke-width`, and - since SVG 2, in every engine we
  // ship to - the geometry properties `width`/`height`/`r`/`cx`… in percentages
  // of the viewport, which is precisely what a crop changes. None of that is
  // visible to a per-element scan of the markup, and a stylesheet applies to
  // every layer, so the honest granularity is the document. Costs nothing on our
  // own walker output, which emits no `<style>` at all.
  const cropping = opts.cropToInk !== false && !!srcViewBox && !/<style\b/i.test(carryMarkup);
  // The scale the caller will PLACE the cropped rows at (see `cropScale`). Read
  // once, held to something sane here rather than in the per-layer loop, and 1:1
  // when the caller says nothing - which is both the honest default and the exact
  // arithmetic 1.121 shipped.
  const cropScale = {
    x: opts.cropScale && Number.isFinite(opts.cropScale.x) && opts.cropScale.x > 0 ? opts.cropScale.x : 1,
    y: opts.cropScale && Number.isFinite(opts.cropScale.y) && opts.cropScale.y > 0 ? opts.cropScale.y : 1,
  };

  // Everything that rides into EVERY derived document unchanged: the carried
  // non-rendering siblings and the descended wrappers' own open tags. Both can
  // POINT AT an id - a carried `<clipPath><use href="#s"/></clipPath>` (exactly
  // the shape Illustrator's `<clipPath><use href="#SVGID_1_"/>` takes), a
  // descended `<g clip-path="url(#c)">` whose `<clipPath>` lives inside one of
  // the layers - and the repair used to look at the layer BODY only. Measured:
  // a wrapper clip whose path lives in layer 2 left layer 1 rendering unclipped,
  // 76 800 channels different (Chromium paints an unresolvable `clip-path` as no
  // clip at all), warnings empty. They are the same bytes in every layer, so
  // they are scanned ONCE and unioned into each layer's wanted set.
  const carryRefs = referencedIds(carryMarkup);
  let index: IdIndex | null = null;
  let carryIds: Set<string> | null = null;
  const idIndex = (): IdIndex => (index ??= buildIdIndex(tags));
  const carryDefined = (): Set<string> => (carryIds ??= idsInSpans(
    idIndex(), carry.map((c) => [c.start, c.end] as const),
  ));

  const layers: SvgLayer[] = final.map((c, i) => {
    const spans = c.members.map((m) => [m.start, m.end] as const);
    const body = spans.map(([s, e]) => sliceKeeping(markup, drops, s, e)).join('');
    // Per candidate now, not per document: a hero's children sit inside the
    // hero's own chain and nobody else does.
    const openWrappers = c.wrappers.map((w) => `<${w.qname}${w.attrs}>`).join('');
    const closeWrappers = c.wrappers.map((w) => `</${w.qname}>`).reverse().join('');
    const wanted = mergeRefs(referencedIds(body + openWrappers), carryRefs);
    let fixups = '';
    if (wanted.ids.length) {
      const here = idsInSpans(idIndex(), spans);
      const shared = carryDefined();
      const inWrappers = idsInSpans(idIndex(), c.wrappers.map((w) => [w.start, w.end] as const));
      fixups = borrowedDefs(
        wanted, (id) => here.has(id) || shared.has(id) || inWrappers.has(id),
        idIndex().first, tags, markup, drops, warnings, i + 1,
      );
    }
    const boxId = c.members.length === 1 ? attrOf(c.members[0]!.tag.attrs, 'data-box-id') : undefined;
    const crop = cropping ? cropFor(tags, c, srcViewBox!, idIndex(), cropScale) : null;
    return {
      markup: `<${root.qname}${rootAttributes(root.attrs, crop)}>`
        + `${carryMarkup}${fixups}${openWrappers}${body}${closeWrappers}</${root.qname}>`,
      bbox: c.bbox,
      ...(crop ? { viewBox: crop } : {}),
      label: `Layer ${i + 1}`,
      index: i,
      nodes: c.members.length,
      ...(boxId ? { boxId } : {}),
    };
  });

  // ── price the result, because only the caller can decide it is worth it ────
  // The whole `<defs>` in every layer is free in pixels and not free in bytes,
  // and the shell writes each derived document into IndexedDB as a real user
  // asset. Nothing downstream bounds that total, so say the number here, where
  // the dialog can print it before the user commits. See SVG_LAYERS_HEAVY_BYTES.
  const total = layers.reduce((sum, l) => sum + l.markup.length, 0);
  if (total > SVG_LAYERS_HEAVY_BYTES && total > markup.length * 2) {
    warnings.push(
      `each of these ${layers.length} layers repeats this file's shared definitions, so together `
      + `they are ${(total / 1e6).toFixed(1)} MB from a ${(markup.length / 1e6).toFixed(1)} MB file`,
    );
  }

  return { layers, warnings, viewBox: srcViewBox };
}

/**
 * The root's attributes, verbatim, with `xmlns` guaranteed - and, for a cropped
 * layer, with `viewBox`/`width`/`height` replaced by the crop.
 *
 * Verbatim matters: `preserveAspectRatio` and any `xmlns:*` declaration a
 * `<use>` needs are in there, and reproducing them exactly is what keeps a
 * derived layer in the SOURCE's coordinate system. The crop does not leave that
 * system - it is a WINDOW onto it, and the row it lands in is the same window
 * over the source box, so the picture is unmoved and unscaled.
 *
 * `width`/`height` go with the viewBox necessarily: left at the source's, the
 * document would keep the source's intrinsic aspect ratio and an `object-fit`
 * of `contain` would letterbox the crop inside the row instead of filling it.
 */
function rootAttributes(attrs: string, crop?: SvgLayerBox | null): string {
  let out = attrOf(attrs, 'xmlns') != null ? attrs : ` xmlns="http://www.w3.org/2000/svg"${attrs}`;
  if (!crop) return out;
  out = out.replace(/(?:^|\s)(?:viewBox|width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  const n = (v: number): string => String(Math.round(v * 1000) / 1000);
  return `${out} viewBox="${n(crop.x)} ${n(crop.y)} ${n(crop.w)} ${n(crop.h)}"`
    + ` width="${n(crop.w)}" height="${n(crop.h)}"`;
}

/**
 * A document's coordinate rect, read WITHOUT enumerating it.
 *
 * The shell has to decide whether cropping is allowed before the documents are
 * derived (a cropped document needs a row cut to the same rect), and that
 * decision needs the source's viewBox - one regex over the root tag, rather than
 * a full enumeration thrown away. Same answer {@link SvgLayersResult.viewBox}
 * gives, from the same reader.
 */
export function svgRootViewBox(markup: string): SvgLayerBox | null {
  if (typeof markup !== 'string' || !markup) return null;
  const m = /<svg\b([^>]*)>/i.exec(markup);
  return m ? viewBoxOf(m[1]!) : null;
}

/**
 * The source's own coordinate system: its `viewBox`, else its `width`/`height`
 * (which is the same rect written the other way), else null - a document that
 * declares neither has no user-unit rect to map a crop through.
 */
function viewBoxOf(attrs: string): SvgLayerBox | null {
  const raw = attrOf(attrs, 'viewBox');
  if (raw) {
    const n = raw.trim().split(/[\s,]+/).map(Number);
    if (n.length >= 4 && n.every((v) => Number.isFinite(v)) && n[2]! > 0 && n[3]! > 0) {
      return { x: n[0]!, y: n[1]!, w: n[2]!, h: n[3]! };
    }
    return null;
  }
  const w = numAttr(attrs, 'width', NaN);
  const h = numAttr(attrs, 'height', NaN);
  return w > 0 && h > 0 ? { x: 0, y: 0, w, h } : null;
}

/** What a subtree walk found about ink that lands outside the geometry. */
interface Spill {
  /** False = something unbounded is in there; the layer keeps the whole stage. */
  ok: boolean;
  /** Filter regions, in root user units, unioned. */
  box: SvgLayerBox | null;
  /** Widest stroke half-width in the subtree, already scaled to root units. */
  stroke: number;
}

/**
 * Walk one member's subtree for everything a bounding box does not see.
 *
 * Three answers come out of the same walk because they need the same thing - the
 * live transform chain at each element:
 *
 *   • **filter regions.** A `filter` paints outside its element, but a filter
 *     also DECLARES the rect it may paint in, and `filterUnits="userSpaceOnUse"`
 *     makes that rect readable numbers (which is exactly what our own walker
 *     emits for every CSS box-shadow: `<filter … x="-80" y="426.88" width="260"
 *     height="264">`). Resolved and unioned in; anything else - a percentage
 *     region, `objectBoundingBox` units, a reference that does not resolve to a
 *     `<filter>` - refuses the crop rather than guessing.
 *   • **stroke half-widths**, scaled by the chain, because the measured box is
 *     the path and the stroke straddles it.
 *   • **percentage lengths**, which resolve against the viewport a crop is about
 *     to change. Tested per element rather than over the body text, so a
 *     gradient's `offset="100%"` in a carried `<defs>` cannot refuse a crop it
 *     has nothing to do with.
 *
 * `mask` and `clip-path` are deliberately not refusals: both can only hide ink,
 * never add it, so a box that bounds the unmasked element bounds the masked one.
 */
function spillOf(tags: Tag[], node: Node, base: Mat, index: IdIndex): Spill {
  const NO: Spill = { ok: false, box: null, stroke: 0 };
  const end = node.tag.kind === 'self' ? node.ti + 1 : (skipSubtree(tags, node.ti) ?? tags.length);
  const stack: Mat[] = [base];
  let box: SvgLayerBox | null = null;
  let stroke = 0;

  for (let i = node.ti; i < end; i++) {
    const t = tags[i]!;
    if (t.kind === 'close') { if (stack.length > 1) stack.pop(); continue; }
    if (DROP_TAGS.has(t.name) || CARRY_TAGS.has(t.name)) {
      // Defines rather than draws: nothing in here is this layer's ink, and its
      // percentages belong to its own units.
      const after = t.kind === 'self' ? i + 1 : (skipSubtree(tags, i) ?? end);
      i = after - 1;
      continue;
    }
    const own = parseTransform(attrOf(t.attrs, 'transform'));
    if (!own) return NO;
    const m = matMul(stack[stack.length - 1]!, own);
    if (t.kind === 'open') stack.push(m);

    const attrs = ` ${t.attrs}`;
    if (VIEWPORT_PCT_RE.test(attrs) || VIEWPORT_PCT_STYLE_RE.test(attrs)) return NO;
    if (MARKER_RE.test(attrs)) return NO;

    const style = styleProps(t.attrs);
    const fx = (style.filter ?? attrOf(t.attrs, 'filter') ?? '').trim();
    if (fx && fx.toLowerCase() !== 'none') {
      const region = filterRegion(tags, index, fx);
      if (!region) return NO;
      const r = transformBox(region, m);
      if (!r) return NO;
      box = boxUnion(box, r);
    }

    const sw = style['stroke-width'] ?? attrOf(t.attrs, 'stroke-width');
    const painted = (style.stroke ?? attrOf(t.attrs, 'stroke') ?? '').trim().toLowerCase();
    if (sw != null || (painted && painted !== 'none')) {
      const v = sw != null ? parseFloat(sw) : 1;
      // A percentage or a keyword stroke width is not a number we can pad by.
      if (sw != null && !Number.isFinite(v)) return NO;
      stroke = Math.max(stroke, ((Number.isFinite(v) ? v : 1) / 2) * matScale(m));
    }
  }
  return { ok: true, box, stroke };
}

/** A `url(#id)` filter reference resolved to an absolute user-space rect. */
function filterRegion(tags: Tag[], index: IdIndex, value: string): SvgLayerBox | null {
  const id = /url\(\s*['"]?#([^)'"\s]+)/.exec(value)?.[1];
  if (!id) return null;
  const at = index.first.get(id);
  if (at == null) return null;
  const f = tags[at]!;
  if (f.name !== 'filter') return null;
  if ((attrOf(f.attrs, 'filterUnits') ?? '').trim().toLowerCase() !== 'userspaceonuse') return null;
  const x = numAttr(f.attrs, 'x', NaN);
  const y = numAttr(f.attrs, 'y', NaN);
  const w = numAttr(f.attrs, 'width', NaN);
  const h = numAttr(f.attrs, 'height', NaN);
  if (!(Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0)) return null;
  return { x, y, w, h };
}

/**
 * The crop to give one layer's document, or null to leave it full-stage.
 *
 * Almost every line here is a refusal, because a viewBox is also a CLIP and this
 * module's whole promise is that the stack renders as the original: unmeasured
 * ink, an unbounded spill, a percentage length (all in {@link spillOf}); a pad
 * for stroke width times the worst legal miter; the result intersected with the
 * SOURCE viewBox, so ink the original clipped away cannot reappear because its
 * layer was handed a bigger window (a walker screenshot of a scrolling page has
 * layers taller than the picture); and no crop at all when it would save
 * nothing - a layer that fills the stage IS the stage, and rewriting its root to
 * say so is churn.
 */
function cropFor(
  tags: Tag[], c: Candidate, src: SvgLayerBox, index: IdIndex,
  scale: { x: number; y: number },
): SvgLayerBox | null {
  if (!c.bbox || !c.measured || !c.mat) return null;
  let box: SvgLayerBox | null = c.bbox;
  let half = 0;
  for (const nd of c.members) {
    const s = spillOf(tags, nd, c.mat, index);
    if (!s.ok) return null;
    box = boxUnion(box, s.box);
    half = Math.max(half, s.stroke);
  }
  // A wrapper's `stroke-width` is inherited by everything below it, and the walk
  // above starts below the wrappers.
  const chainScale = matScale(c.mat);
  for (const w of c.wrappers) {
    STROKE_W_RE.lastIndex = 0;
    const m = STROKE_W_RE.exec(` ${w.attrs}`);
    const v = m ? parseFloat(m[1]!) : NaN;
    if (Number.isFinite(v)) half = Math.max(half, (v / 2) * chainScale);
  }
  if (!box) return null;
  const pad = CROP_PAD + half * STROKE_MITER_LIMIT;

  // Snapped OUTWARDS in ROW SPACE - whole px of the rectangle this document will
  // be drawn into - before it is clamped to the source. A crop is rendered into a
  // row of the same rect, so a crop whose edges land between device pixels asks
  // the browser to resample the whole layer back onto the grid, and every
  // anti-aliased edge in it moves.
  //
  // ⚑ 1.121 SNAPPED IN USER UNITS, which is the same thing ONLY at scale 1. The
  // identity suite's fixtures are all 320×240 into a 320×240 box - k = 1 with an
  // integer viewBox, the single configuration where whole user units are also
  // whole row px - so the "fidelity-neutral, measured" claim was made on the one
  // case that could not see the defect. On real content the row scale is whatever
  // the box happens to be: `docs/shots/brand-colours.svg` in a 1000×625 box
  // (k = 0.694) measured 88 675 channels beyond ±1 with the crop on against 1 758
  // with it off, and `seq-studio-timeline` 48 355 against 518 with a MEAN of 1.54.
  // An integer viewBox is not a rescue and neither is an integer box: it is the
  // PRODUCT that has to be whole, which is why the scale has to be passed in.
  //
  // The preimage is `src.x + n/k`, so the crop is generally fractional and the row
  // is not - which is the right way round: a viewBox only has to be a superset of
  // the ink, a row has to be a rectangle of pixels.
  const kx = Number.isFinite(scale.x) && scale.x > 0 ? scale.x : 1;
  const ky = Number.isFinite(scale.y) && scale.y > 0 ? scale.y : 1;
  const lo = (v: number, origin: number, k: number): number => origin + Math.floor((v - origin) * k) / k;
  const hi = (v: number, origin: number, k: number): number => origin + Math.ceil((v - origin) * k) / k;
  const x = Math.max(src.x, lo(box.x - pad, src.x, kx));
  const y = Math.max(src.y, lo(box.y - pad, src.y, ky));
  const w = Math.min(src.x + src.w, hi(box.x + box.w + pad, src.x, kx)) - x;
  const h = Math.min(src.y + src.h, hi(box.y + box.h + pad, src.y, ky)) - y;
  if (!(w > 0 && h > 0)) return null;
  if (w * h >= src.w * src.h * CROP_MIN_GAIN) return null;
  return { x, y, w, h };
}

/**
 * References found, and whether there were MORE than the cap allows.
 *
 * The flag is the point: past `SVG_LAYERS_MAX_REFS` the extra references are not
 * repaired, and a layer that quietly stops being repaired is exactly the failure
 * this module is supposed to narrate rather than perform.
 */
interface Refs { ids: string[]; more: boolean }

/**
 * The layer's own references, plus the ones every layer inherits from the
 * carried markup and the descended wrappers. Deduped, and capped exactly like a
 * single scan is - the cap is on what one derived document may ask for, not on
 * where the asking came from.
 */
function mergeRefs(own: Refs, shared: Refs): Refs {
  if (!shared.ids.length) return own;
  const ids = [...own.ids];
  const seen = new Set(ids);
  let more = own.more || shared.more;
  for (const id of shared.ids) {
    if (seen.has(id)) continue;
    if (ids.length >= SVG_LAYERS_MAX_REFS) { more = true; break; }
    seen.add(id);
    ids.push(id);
  }
  return { ids, more };
}

/** Every `#id` this markup points at, via `url(#…)` or `href="#…"`. */
function referencedIds(body: string): Refs {
  const out: string[] = [];
  const seen = new Set<string>();
  let more = false;
  const re = /(?:url\(\s*['"]?#([^)'"\s]+)|(?:xlink:)?href\s*=\s*["']#([^"']+)["'])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const id = (m[1] ?? m[2] ?? '').trim();
    if (!id || seen.has(id)) continue;
    // Checked BEFORE the push, so the flag means "there is a 65th", not merely
    // "there is a 64th" - a document sitting exactly on the cap loses nothing and
    // is told nothing.
    if (out.length >= SVG_LAYERS_MAX_REFS) { more = true; break; }
    seen.add(id);
    out.push(id);
  }
  return { ids: out, more };
}

/**
 * Where every id in the document is, built once and only when something asks.
 *
 * Two views of the same walk, because the repair asks two different questions:
 * "where do I copy `#p` FROM" (`first`) and "is `#p` already resolvable in THIS
 * layer" (`at`, queried by byte span). The second one used to be a fresh
 * `RegExp` per (layer × reference) run over the whole layer body and the whole
 * carried markup - bounded on both axes, but by a PRODUCT: 64 layers × 64 refs ×
 * 4 MB is ~16 GB of character scanning, all of it inside the declared caps.
 * Measured on the shipped code, main thread, editor frozen behind "Reading the
 * artwork…": 1.8 s for plain filler, 10.7 s when the filler near-misses the
 * regex (` id="nope-63-63z"`), against 1 ms for the same document with no
 * references at all. That is the hazard `SVG_LAYERS_MAX_CANDIDATES` was
 * introduced to close, reappearing on a different axis.
 *
 * Spans answer it in O(log T) plus the ids actually inside them, and layer
 * bodies PARTITION the document, so the whole loop is linear again.
 */
interface IdIndex {
  /** id → tag index of its FIRST definition - what a borrow copies. */
  first: Map<string, number>;
  /** Every id-bearing tag, ascending by position - the span query's array. */
  at: Array<{ start: number; id: string }>;
}

function buildIdIndex(tags: Tag[]): IdIndex {
  const first = new Map<string, number>();
  const at: Array<{ start: number; id: string }> = [];
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i]!;
    if (t.kind === 'close') continue;
    const id = idOf(t.attrs);
    if (!id) continue;
    if (!first.has(id)) first.set(id, i);
    at.push({ start: t.start, id });
  }
  return { first, at };
}

/** Lowest index in `at` whose tag starts at or after `from`. */
function lowerBound(at: IdIndex['at'], from: number): number {
  let lo = 0, hi = at.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at[mid]!.start < from) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The ids DEFINED inside a set of byte spans - "already resolvable here?". */
function idsInSpans(index: IdIndex, spans: Array<readonly [number, number]>): Set<string> {
  const out = new Set<string>();
  for (const [from, to] of spans) {
    for (let i = lowerBound(index.at, from); i < index.at.length && index.at[i]!.start < to; i++) {
      out.add(index.at[i]!.id);
    }
  }
  return out;
}

/**
 * The byte spans of every {@link DROP_TAGS} subtree, outermost only, ascending.
 *
 * One pass over the already-scanned tag list; `guard` skips anything nested
 * inside a span already claimed, so the ranges are disjoint and a straight walk
 * can splice them.
 */
function dropSpans(tags: Tag[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let guard = -1;
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i]!;
    if (t.kind === 'close' || t.start < guard || !DROP_TAGS.has(t.name)) continue;
    const after = t.kind === 'self' ? i + 1 : skipSubtree(tags, i);
    if (after == null) continue;
    const end = tags[after - 1]!.end;
    out.push([t.start, end]);
    guard = end;
  }
  return out;
}

/**
 * `markup.slice(from, to)` with any dropped subtree inside it spliced out.
 *
 * Still verbatim - every character emitted is the input's own - and still
 * bounded: the drops are disjoint and sorted, so the walk visits only those that
 * intersect this span, and the spans a caller passes are themselves disjoint.
 */
function sliceKeeping(markup: string, drops: Array<[number, number]>, from: number, to: number): string {
  if (!drops.length) return markup.slice(from, to);
  let out = '';
  let at = from;
  // The first drop that could possibly intersect: binary search on END, which is
  // sound because the spans are disjoint and therefore sorted by end as well.
  let lo = 0, hi = drops.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (drops[mid]![1] <= from) lo = mid + 1; else hi = mid; }
  for (let i = lo; i < drops.length && drops[i]![0] < to; i++) {
    const [s, e] = drops[i]!;
    if (s > at) out += markup.slice(at, s);
    if (e > at) at = e;
  }
  return at < to ? out + markup.slice(at, to) : out;
}

/**
 * Repair cross-layer `#id` references - section 11's pathological `<use>` case.
 *
 * `<g id="a"><path id="p"/></g><g id="b"><use href="#p"/></g>`: lift those two
 * groups apart and layer 2 references a path that is no longer in its document,
 * so it renders nothing. The referenced element is copied into a `<defs>` of the
 * borrowing layer, where it PAINTS NOTHING - so the copy cannot double-draw -
 * and `<use>`'s own semantics (render the referent as if cloned here, WITHOUT
 * its original ancestors' transforms) are exactly what a `<defs>` copy
 * reproduces.
 *
 * Returns the `<defs>` fragment to insert, or ''.
 */
function borrowedDefs(
  wanted: Refs,
  resolvable: (id: string) => boolean,
  first: Map<string, number>,
  tags: Tag[],
  markup: string,
  drops: Array<[number, number]>,
  warnings: string[],
  layerNo: number,
): string {
  const out: string[] = [];
  for (const id of wanted.ids) {
    // Already resolvable from this layer's own body, the carried defs or a
    // descended wrapper? Then there is nothing to repair - and re-adding it
    // would duplicate an id.
    if (resolvable(id)) continue;
    const at = first.get(id);
    if (at == null) continue;                 // dangling in the source; not ours to invent
    const after = skipSubtree(tags, at);
    if (after == null) continue;
    out.push(sliceKeeping(markup, drops, tags[at]!.start, tags[after - 1]!.end));
  }
  // A reference the source itself never defined is left dangling in silence: it
  // was broken before the lift and the lift did not break it. References PAST THE
  // CAP are the lift's doing - nothing looked at them, so anything among them
  // that lived in another layer will not paint - and that is said out loud.
  if (wanted.more) {
    warnings.push(`layer ${layerNo}: more than ${SVG_LAYERS_MAX_REFS} shared references — the rest were left unrepaired`);
  }
  if (!out.length) return '';
  warnings.push(`layer ${layerNo}: copied ${out.length} referenced ${out.length === 1 ? 'element' : 'elements'} it shares with another layer`);
  return `<defs>${out.join('')}</defs>`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
