// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the pen tool - drawing, node editing, path arrangement, bindings and pen chrome.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, edgeArrowHead, pathEndPoints, pathEndTangents, seedBox } from '../free-canvas-math.ts';
import type { Box, Rect as MathRect } from '../free-canvas-math.ts';
import { pickTopmost } from '../canvas-scene.ts';
import { segHtml, wireSegs } from '../free-canvas-fields.ts';
import type { AuthoredPath, Continuity, Cubic, SplineKind, SplineNode } from '@lolly/engine';
import { PEN_KINDS, alignPoints, convertKind, decodePathContours, defaultContinuity, deleteNodes, denormNodes, distributePoints, encodePathField, encodePathFields, frameToLocal, handlePoint, insertNodeOnCurve, kindReadsHandles, localToFrame, lowerAuthored, nodeAt, normNodes, pathPaintIsVisible, pathPaintSeed, penCommitFromNative, penFrame, pickPathPaint, refitFrame, resolveDrawnInk, setNodeContinuity } from '../free-canvas-pen.ts';
import type { InsertResult, NodeAlignEdge, PenPointRef } from '../free-canvas-pen.ts';
import { announce } from '../../a11y.ts';
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { centreCtxBar, ctxTopBand } from './shared.ts';
import type { PenPart, Point, PopItem } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/** One set of spline-type names for every surface that offers them - the pen bar's
 *  `<select>` and the rail button's hold menu. Built per call rather than frozen at
 *  module load so a language switch renames them. */
export function penKindLabels(_fc: FcCtx): Record<string, string> {
  return {
    hyperbezier: t('Smooth (auto)'),
    spiro: t('Spiro'),
    cubic: t('Bezier handles'),
    'catmull-rom': t('Through the points'),
    bspline: t('B-spline'),
    line: t('Straight lines'),
  };
}
/**
 * The spline type, chosen from the rail BEFORE anything is drawn.
 *
 * Until this existed the switcher only appeared in the pen bar, which only appears once
 * there is a draft - so choosing the type meant drawing a path in the wrong one first
 * and converting, and `hyperbezier → cubic` is the only conversion that is lossless.
 * Picking up the pen already knowing what you want to draw is the normal case for
 * tracing, so it gets a normal path to it.
 */
export function openPenKindMenu(fc: FcCtx, anchor: HTMLElement): void {
  const labels = penKindLabels(fc);
  fc.menus.spawnPopover(
    anchor,
    PEN_KINDS.map((k) => ({
      label: labels[k] || k,
      on: k === fc.penDrawKind,
      run: () => setPenDrawKind(fc, k),
    }))
  );
}
/** Choose the type and arm the pen, so the menu leaves you ready to draw rather than
 *  back where you started. An in-progress draft follows the choice, exactly as it does
 *  from the pen bar's own switcher. */
export function setPenDrawKind(fc: FcCtx, to: SplineKind): void {
  fc.penDrawKind = to;
  if (fc.penDraft) {
    fc.penDraft = { ...fc.penDraft, kind: to };
    fc.penWarm = null;
  }
  if (fc.mode !== 'pen') fc.modes.setMode('pen');
  else fc.chromeSync.renderChrome();
  announce(tRaw('Spline type: {name}', { name: penKindLabels(fc)[to] || to }));
}
export const penScale = (fc: FcCtx): number => fc.stage.metrics().scale || 1;
export const penTol = (fc: FcCtx): number => { const { PEN_HIT_PX } = fc; return PEN_HIT_PX / penScale(fc); };
// Entering/leaving pen mode. Neither is called directly - `setMode` owns the transition,
// which is what guarantees the other three modes are down before this one is up.
export function enterPen(fc: FcCtx): void {
  const { stageEl } = fc;
  fc.edges.deselectEdge();
  fc.selection = new Set<string>();
  stageEl.classList.add('fc-penning');
  announce(
    t(
      'Pen on - click to place points, drag to curve them, click the first point to close. Enter finishes, Esc cancels.'
    )
  );
  fc.chromeSync.renderChrome();
}
export function exitPen(fc: FcCtx): void {
  const { stageEl } = fc;
  fc.penDraft = null;
  fc.penCursor = null;
  fc.penWarm = null;
  stageEl.classList.remove('fc-penning');
  fc.gestures.clearGuides();
  fc.chromeSync.renderChrome();
}
// ── drawing ───────────────────────────────────────────────────────────────────

/** Place a node at a (already snapped) native point and start the drag that pulls its
 *  handles out. `corner` is the Alt modifier - see the button's tooltip. */
export function penPlaceNode(fc: FcCtx, e: PointerEvent, at: Point, corner: boolean): void {
  const kind = fc.penDraft ? fc.penDraft.kind : fc.penDrawKind;
  const nodes = fc.penDraft ? fc.penDraft.nodes.slice() : [];
  nodes.push({ x: at.x, y: at.y, continuity: corner ? 'corner' : defaultContinuity(kind) });
  fc.penDraft = { kind, nodes, closed: false };
  fc.penCursor = null;
  fc.penPullBroken = corner; // Alt held at placement arms the break for the drag that follows
  fc.gestures.beginGesture(e, { type: 'pendraw', origin: at, index: nodes.length - 1 });
  paintPen(fc);
  syncPenChrome(fc);
}
/** Drop the last placed node (Backspace/Delete while drawing). The last one leaving
 *  ends the draw, because an empty draft is not a draft. */
export function penUndoNode(fc: FcCtx): void {
  if (!fc.penDraft) return;
  const nodes = fc.penDraft.nodes.slice(0, -1);
  if (!nodes.length) {
    fc.penDraft = null;
    fc.penCursor = null;
    fc.penWarm = null;
    fc.chromeSync.renderChrome();
    return;
  }
  fc.penDraft = { ...fc.penDraft, nodes, closed: false };
  fc.penWarm = null; // the node count changed, so the warm start is stale
  fc.chromeSync.renderChrome();
}
/**
 * End the draw and commit - ONE `setInput`, so one undo step removes the whole path.
 *
 * A draft with fewer than two nodes commits nothing: a single click with the pen selected
 * is a mis-click, and materialising a one-node box for it would leave the user something
 * invisible to find and delete.
 */
export function penFinishDraw(fc: FcCtx): void {
  const draft = fc.penDraft;
  fc.penDraft = null;
  fc.penCursor = null;
  fc.penWarm = null;
  fc.gestures.clearGuides();
  if (!draft) {
    fc.chromeSync.renderChrome();
    return;
  }
  if (!commitPathBox(fc, draft)) fc.chromeSync.renderChrome();
}
/**
 * A finished authored path → a committed path box. ONE `setInput`, so one undo step
 * removes the whole thing.
 *
 * Extracted from `penFinishDraw` for plan 96 P2: the Line tool draws the same primitive
 * with a different gesture (one drag, two nodes) and must land the same box - same
 * seeding, same paint fallback, same single commit - or a line would be a second-class
 * shape the moment anyone tried to node-edit or restyle it. `extra` is the per-gesture
 * decoration the line adds on top (its default arrowhead and its empty bindings).
 *
 * Returns false when nothing was committed (fewer than two nodes, an unlowerable kind, a
 * tool with no `pathField`) - the caller's cue to repaint its own chrome.
 */
export function commitPathBox(fc: FcCtx, draft: AuthoredPath, extra?: Box): boolean {
  const { addKinds, cfg, penPaintFields } = fc;
  if (!cfg.pathField) return false;
  const made = penCommitFromNative(draft);
  const value = made ? encodePathField(made.path) : '';
  if (!made || !value) return false;
  const boxes = fc.select.getBoxes();
  const id = fc.select.freshId(boxes);
  const pathSeed: Box = { ...(addKinds.find((k) => k.id === 'path')?.seed || {}) };
  // Paint: what the user last used on a path, then this tool's own `path` seed - and
  // nothing else. Other add-kinds are deliberately NOT consulted: a `path` seed's empty
  // fill is a statement ("paths in this brand are stroke-only"), so letting a box seed
  // fill it in would overrule the brand, and where there is no `path` seed at all the
  // nearest kind's colour is chosen for a filled rectangle, not for a curve - Sequence
  // Studio's card is #14181d on a #0b1220 artboard, i.e. invisible. The honest fallback
  // for that case is the ink the path was drawn in, below.
  const seed: Box = {
    ...pathSeed,
    ...pathPaintSeed(penPaintFields, [fc.penLastPaint, pathSeed]),
  };
  // Last resort: stroke it in the colour it was DRAWN in. The preview strokes the draft
  // in `currentColor` off .fc-pen-layer (the brand primary), so this is the shape the user
  // was just looking at rather than an invented hue - and it is resolved to a concrete
  // hex here because a box field has to render headlessly, where a CSS variable cannot.
  if (cfg.strokeField && !pathPaintIsVisible(penPaintFields, seed)) {
    seed[cfg.strokeField] = drawnInkHex(fc);
    if (cfg.strokeWField && !(Number(seed[cfg.strokeWField]) > 0)) seed[cfg.strokeWField] = 4;
  }
  const box = seedBox(
    cfg,
    {},
    seed,
    { x: made.x, y: made.y, w: made.w, h: made.h } as MathRect,
    id
  );
  box[cfg.kindField] = 'path';
  if (cfg.shapeField) box[cfg.shapeField] = 'rect';
  box[cfg.pathField] = value;
  // The gesture's own decoration goes on LAST so it beats the tool's `path` seed: the
  // Line tool's arrowhead is what the user asked for by picking that tool, and a brand
  // seed that says "paths are plain" should not silently take it off.
  if (extra) for (const k of Object.keys(extra)) box[k] = extra[k];
  fc.selection = new Set([id]);
  fc.penLastPaint = pickPathPaint(penPaintFields, box);
  fc.select.commit([...boxes, box]);
  return true;
}
/** The colour the pen preview is drawn in, as a concrete hex - always a usable value, since
 *  a shape in the wrong colour still beats a shape in none. Computed at commit time rather
 *  than cached: the brand, and so this colour, can change mid-session. The resolution is
 *  pure (`resolveDrawnInk`) so it can be tested without a stylesheet, which is also the one
 *  case that reaches its fallback - jsdom applies no CSS, a real browser always resolves. */
export function drawnInkHex(fc: FcCtx): string {
  const { penLayer } = fc;
  try {
    return resolveDrawnInk(getComputedStyle(penLayer).color);
  } catch {
    return resolveDrawnInk(null);
  }
}
/** Abandon the draw. Nothing was ever written, so there is nothing to undo. */
export function penCancelDraw(fc: FcCtx): void {
  fc.penDraft = null;
  fc.penCursor = null;
  fc.penWarm = null;
  fc.gestures.clearGuides();
  fc.chromeSync.renderChrome();
}
// ── node-edit mode ────────────────────────────────────────────────────────────

/** Enter node editing on a path box. Entered like `startTextEdit` - a double-click or an
 *  explicit affordance - and left just as explicitly, so ordinary selection behaviour is
 *  never silently different. */
// ── Multi-contour node editing: combined flat view ↔ per-contour split ─────────
// Join per-contour paths into ONE combined path (nodes concatenated) + the parts
// descriptor that splits it back. The combined kind is the first part's - see the
// penEdit declaration for why that is correct for every producer here.
export function penJoin(_fc: FcCtx, paths: AuthoredPath[]): { path: AuthoredPath; parts: PenPart[] } {
  const parts: PenPart[] = paths.map((p) => ({
    count: p.nodes.length,
    kind: p.kind,
    closed: p.closed,
  }));
  const first = paths[0]!;
  return {
    path: { kind: first.kind, closed: first.closed, nodes: paths.flatMap((p) => [...p.nodes]) },
    parts,
  };
}
// Split a flat run of nodes back into per-contour paths by the given parts. Used to turn a
// position-op result (same node count, same parts) back into real contours for the write.
export function penSplitWith(_fc: FcCtx, flat: AuthoredPath, parts: PenPart[]): AuthoredPath[] {
  const out: AuthoredPath[] = [];
  let i = 0;
  for (const part of parts) {
    out.push({
      kind: part.kind,
      closed: part.closed,
      nodes: flat.nodes.slice(i, i + part.count),
    });
    i += part.count;
  }
  return out;
}
// The current edit's contours as real per-contour paths (render / insert / delete read this).
export function penContours(fc: FcCtx): AuthoredPath[] {
  return fc.penEdit ? penSplitWith(fc, fc.penEdit.path, fc.penEdit.parts) : [];
}
// Cumulative flat start index of each part, and the part a flat node index falls in.
export function penPartStarts(_fc: FcCtx, parts: PenPart[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const p of parts) {
    starts.push(acc);
    acc += p.count;
  }
  return starts;
}
export function startPenEdit(fc: FcCtx, id: string): void {
  const { cfg, stageEl } = fc;
  if (!cfg.pathField) return;
  if (fc.editing) fc.textEdit.commitTextEdit();
  if (fc.mode === 'pen') fc.modes.toPointer();
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, id);
  if (i < 0) return;
  const decoded = decodePathContours(boxes[i]![cfg.pathField]);
  if (!decoded.length) {
    fc.stage.flash(t('That shape has no editable path.'));
    return;
  }
  const frame = penFrame(boxes[i], cfg);
  const local = decoded.map((p) => denormNodes(p, frame.w, frame.h));
  const joined = penJoin(fc, local);
  fc.penEdit = { id, frame, path: joined.path, parts: joined.parts };
  fc.penSel = new Set<number>();
  fc.penHandleSel = new Set<string>();
  fc.penWarm = null;
  fc.selection = new Set([id]);
  stageEl.classList.add('fc-node-editing');
  fc.document.closeMorePanel();
  fc.toolbox.closePopover();
  announce(
    t(
      'Editing points - drag a point or its handle, click the curve to add a point, Esc to finish.'
    )
  );
  fc.chromeSync.renderChrome();
}
export function endPenEdit(fc: FcCtx): void {
  const { stageEl } = fc;
  if (!fc.penEdit) return;
  setPathSvgHidden(fc, false);
  fc.penEdit = null;
  fc.penSel = new Set<number>();
  fc.penHandleSel = new Set<string>();
  fc.penWarm = null;
  stageEl.classList.remove('fc-node-editing');
  fc.rail.clearPenChrome();
  paintPen(fc);
  fc.ctxSelKey = null; // force the ordinary object bar to rebuild
  fc.chromeSync.scheduleSync();
}
/** Re-read the edited path from the MODEL, so an undo, a resize or a sibling edit while
 *  node-editing is reflected rather than overwritten by stale local state. Skipped
 *  mid-gesture, where the local path IS the truth until the drop commits. */
export function penSyncFromModel(fc: FcCtx, boxes: Box[]): void {
  const { cfg } = fc;
  if (!fc.penEdit || fc.gesture) return;
  const i = fc.select.indexOfId(boxes, fc.penEdit.id);
  if (i < 0) {
    endPenEdit(fc);
    return;
  }
  const decoded = decodePathContours(boxes[i]![cfg.pathField]);
  if (!decoded.length) {
    endPenEdit(fc);
    return;
  }
  const frame = penFrame(boxes[i], cfg);
  const local = decoded.map((p) => denormNodes(p, frame.w, frame.h));
  const joined = penJoin(fc, local);
  fc.penEdit = { id: fc.penEdit.id, frame, path: joined.path, parts: joined.parts };
  const n = fc.penEdit.path.nodes.length;
  if ([...fc.penSel].some((k) => k >= n)) fc.penSel = new Set([...fc.penSel].filter((k) => k < n));
  // Handle-selection keys reference node indices; a structural change (insert/delete)
  // reshuffles them, so drop any that no longer point at a live node rather than
  // aligning the wrong control point.
  if ([...fc.penHandleSel].some((key) => Number(key.split(':')[0]) >= n)) {
    fc.penHandleSel = new Set([...fc.penHandleSel].filter((key) => Number(key.split(':')[0]) < n));
  }
}
/**
 * One completed edit → one model write, frame REFITTED to the curve.
 *
 * The frame is the curve's tight bounding box - that is the invariant every other part of
 * the editor reads (selection chrome, marquee, align/distribute, group bounds, the export
 * bbox) and the one `hooks.js` clips to. So an edit that put a node or a curve outside the
 * old frame grows it and an edit that pulled the shape inward shrinks it, and either way
 * `refitFrame` compensates the frame's own rotation so the RENDERED shape does not move by
 * a pixel. See `refitFrame` for the rotation and rounding arithmetic.
 *
 * This is the commit, not the drag: refitting per pointermove would make the box chase the
 * cursor. The live gesture paints on the native pen layer with the box's own `<svg>`
 * hidden, so nothing clips in between.
 *
 * Every contour is re-encoded, not just the edited one - see `penEdit`.
 *
 * `next` is the COMBINED path (all contours' nodes flat) that a position op returned - same
 * node count and same parts as `penEdit.path`, so it splits cleanly by the current parts.
 * A STRUCTURAL op (insert/delete/close/convert) that changes the parts calls
 * `penEditWritePaths` directly with the new per-contour array instead.
 */
export function penEditWrite(fc: FcCtx, next: AuthoredPath): void {
  if (!fc.penEdit) return;
  penEditWritePaths(fc, penSplitWith(fc, next, fc.penEdit.parts));
}
export function penEditWritePaths(fc: FcCtx, all: AuthoredPath[]): void {
  const { cfg } = fc;
  if (!fc.penEdit || !cfg.pathField || !all.length) return;
  // No refit when there is no curve to fit (an unlowerable kind): the old frame is then
  // the only frame there is, and it is better than a frame invented from nothing.
  const fit = refitFrame(all, fc.penEdit.frame, fc.penWarm);
  const frame = fit ? fit.frame : fc.penEdit.frame;
  const paths = fit ? fit.paths : all;
  const value = encodePathFields(paths.map((p) => normNodes(p, frame.w, frame.h)));
  if (!value) {
    fc.stage.flash(t('That edit could not be saved, so nothing was changed.'));
    return;
  }
  const joined = penJoin(fc, paths);
  fc.penEdit = { ...fc.penEdit, frame, path: joined.path, parts: joined.parts };
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, fc.penEdit.id);
  if (i < 0) {
    endPenEdit(fc);
    return;
  }
  fc.select.commit(
    boxes.map((b, k) =>
      k === i
        ? {
            ...b,
            [cfg.pathField]: value,
            [cfg.xField]: frame.x,
            [cfg.yField]: frame.y,
            [cfg.wField]: frame.w,
            [cfg.hField]: frame.h,
          }
        : b
    )
  );
}
/** The handle under a box-local point, or null. Handles are tested BEFORE nodes: they
 *  are smaller and sit outside the curve, so a node would otherwise shadow one that
 *  happens to be short. */
export function penHandleAt(fc: FcCtx, 
  x: number,
  y: number,
  tol: number
): { index: number; which: 'in' | 'out' } | null {
  if (!fc.penEdit || !kindReadsHandles(fc.penEdit.path.kind)) return null;
  let best: { index: number; which: 'in' | 'out' } | null = null;
  let bestD = tol;
  fc.penEdit.path.nodes.forEach((n, i) => {
    for (const which of ['in', 'out'] as const) {
      const p = handlePoint(n, which);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= bestD) {
        bestD = d;
        best = { index: i, which };
      }
    }
  });
  return best;
}
/** Insert a node where the pointer met the curve. Exact for `cubic` (a de Casteljau
 *  split), on-curve-but-reshaping for the derived kinds - see `insertNodeOnCurve`.
 *  Part-aware: the click may land on any contour, so each is tried and the nearest wins;
 *  the insert reshapes only THAT contour, and the new node's flat index is offset by the
 *  contour's start so the selection ends up on it. */
export function penInsertAt(fc: FcCtx, x: number, y: number): void {
  if (!fc.penEdit) return;
  const contours = penContours(fc);
  const starts = penPartStarts(fc, fc.penEdit.parts);
  let best: InsertResult | null = null;
  let bestPart = -1;
  for (let pi = 0; pi < contours.length; pi++) {
    // The warm hyperbezier start belongs to a single active contour; it is only valid
    // when there IS one contour. Multi-contour boxes are cubic, which needs no warm start.
    const res = insertNodeOnCurve(contours[pi]!, x, y, contours.length === 1 ? fc.penWarm : null);
    if (res && (!best || res.distance < best.distance)) {
      best = res;
      bestPart = pi;
    }
  }
  if (!best || bestPart < 0) return;
  fc.penWarm = null; // one more node → the warm start is stale
  fc.penSel = new Set([starts[bestPart]! + best.index]);
  fc.penHandleSel = new Set<string>(); // indices shifted; drop stale handle picks
  penEditWritePaths(fc, contours.map((c, pi) => (pi === bestPart ? best!.path : c)));
}
export function penDeleteSelected(fc: FcCtx): void {
  if (!fc.penEdit || !fc.penSel.size) return;
  const contours = penContours(fc);
  const starts = penPartStarts(fc, fc.penEdit.parts);
  // Bucket the flat selection into each contour's own local index set.
  const perPart: Array<Set<number>> = contours.map(() => new Set<number>());
  for (const g of fc.penSel) {
    for (let pi = contours.length - 1; pi >= 0; pi--) {
      if (g >= starts[pi]!) {
        perPart[pi]!.add(g - starts[pi]!);
        break;
      }
    }
  }
  const out: AuthoredPath[] = [];
  let anyDeleted = false;
  for (let pi = 0; pi < contours.length; pi++) {
    const sel = perPart[pi]!;
    const c = contours[pi]!;
    if (!sel.size) {
      out.push(c);
      continue;
    }
    // A wholly-selected contour is dropped outright (an intentional per-glyph erase), as
    // long as another survives (`out.length` guard below). A PARTIAL selection that would
    // orphan a contour under two points keeps it whole instead - the same floor as before.
    if (sel.size >= c.nodes.length) {
      anyDeleted = true;
      continue;
    }
    const nd = deleteNodes(c, sel);
    if (nd) {
      out.push(nd);
      anyDeleted = true;
    } else out.push(c);
  }
  if (!out.length || !anyDeleted) {
    fc.stage.flash(t('A path needs at least two points, so those were kept.'));
    return;
  }
  fc.penWarm = null;
  fc.penSel = new Set<number>();
  fc.penHandleSel = new Set<string>();
  penEditWritePaths(fc, out);
}
/**
 * Align / distribute the SELECTED NODES - the same six-plus-two operations the object
 * bar offers, and deliberately the same icons and the same grid shape, because "align
 * left" means the same thing to a user whether the things being aligned are boxes or
 * points. The two never collide: this button only exists while node editing, where
 * `selection` (boxes) is empty by construction.
 *
 * Straightening a traced outline is the reason this button exists. A hand-placed run of points
 * along a straight edge is never actually straight, and the alternative is nudging each
 * one with the arrow keys.
 */
/** The selection as point refs - nodes ∪ selected control points - for align/distribute. */
export function penPointRefs(fc: FcCtx): PenPointRef[] {
  const refs: PenPointRef[] = [...fc.penSel].map((i) => ({ node: i }));
  for (const key of fc.penHandleSel) {
    const [i, which] = key.split(':');
    refs.push({ node: Number(i), handle: which as 'in' | 'out' });
  }
  return refs;
}
/** The align + distribute grids for the current node/control-point selection, shared by
 *  the node-edit bar's Arrange button and the node right-click menu. `disabled` reflects
 *  the combined count (align ≥2, distribute ≥3) so the SAME items read correctly in a
 *  context menu that stays a constant shape. */
export function penArrangeItems(fc: FcCtx): PopItem[] {
  const n = penPointRefs(fc).length;
  const align = (edge: NodeAlignEdge): void => {
    if (!fc.penEdit) return;
    fc.penWarm = null; // points moved, so a warm hyperbezier start is stale
    penEditWrite(fc, alignPoints(fc.penEdit.path, penPointRefs(fc), edge));
  };
  const dist = (axis: 'h' | 'v'): void => {
    if (!fc.penEdit) return;
    fc.penWarm = null;
    penEditWrite(fc, distributePoints(fc.penEdit.path, penPointRefs(fc), axis));
  };
  return [
    {
      cols: 3,
      grid: [
        {
          label: t('Align left'),
          icon: icon(SVG.alignL),
          run: () => align('left'),
          disabled: n < 2,
        },
        {
          label: t('Align centre'),
          icon: icon(SVG.alignC),
          run: () => align('hcentre'),
          disabled: n < 2,
        },
        {
          label: t('Align right'),
          icon: icon(SVG.alignR),
          run: () => align('right'),
          disabled: n < 2,
        },
        {
          label: t('Align top'),
          icon: icon(SVG.alignT),
          run: () => align('top'),
          disabled: n < 2,
        },
        {
          label: t('Align middle'),
          icon: icon(SVG.alignM),
          run: () => align('vcentre'),
          disabled: n < 2,
        },
        {
          label: t('Align bottom'),
          icon: icon(SVG.alignB),
          run: () => align('bottom'),
          disabled: n < 2,
        },
      ],
    },
    // Evenly spacing three points needs three points.
    {
      cols: 2,
      grid: [
        {
          label: t('Distribute horizontally'),
          icon: icon(SVG.distH),
          run: () => dist('h'),
          disabled: n < 3,
        },
        {
          label: t('Distribute vertically'),
          icon: icon(SVG.distV),
          run: () => dist('v'),
          disabled: n < 3,
        },
      ],
    },
  ];
}
export function openPenArrangeMenu(fc: FcCtx, anchor: HTMLElement): void {
  if (!fc.penEdit || penPointRefs(fc).length < 2) return;
  fc.menus.spawnPopover(anchor, penArrangeItems(fc));
}
/** Right-click menu WHILE node editing: the same align/distribute grids plus delete and
 *  continuity, at the cursor. Selects the node/handle under the pointer first (like the
 *  object menu selects the box under it) so a right-click acts on what it is over. */
export function openPenNodeMenu(fc: FcCtx, clientX: number, clientY: number): void {
  const { stageEl } = fc;
  if (!fc.penEdit) return;
  fc.toolbox.closePopover();
  const nat = fc.stage.clientToNative(clientX, clientY);
  const loc = frameToLocal(fc.penEdit.frame, nat.x, nat.y);
  const tol = penTol(fc);
  const hh = penHandleAt(fc, loc.x, loc.y, tol);
  if (hh) {
    const key = `${hh.index}:${hh.which}`;
    if (!fc.penHandleSel.has(key)) {
      fc.penHandleSel = new Set([key]);
      fc.penSel = new Set<number>();
    }
  } else {
    const ni = nodeAt(fc.penEdit.path, loc.x, loc.y, tol);
    if (ni >= 0 && !fc.penSel.has(ni)) {
      fc.penSel = new Set([ni]);
      fc.penHandleSel = new Set<string>();
    }
  }
  fc.chromeSync.renderChrome();
  const items: PopItem[] = [...penArrangeItems(fc)];
  if (fc.penSel.size && kindReadsHandles(fc.penEdit.path.kind)) {
    items.push({ sep: true });
    items.push({
      cols: 3,
      grid: [
        {
          label: t('Corner point - handles move independently'),
          icon: icon(SVG.contCorner),
          run: () => penSetContinuity(fc, 'corner'),
        },
        {
          label: t('Smooth point - handles stay in line'),
          icon: icon(SVG.contSmooth),
          run: () => penSetContinuity(fc, 'smooth'),
        },
        {
          label: t('Symmetric point - handles stay in line and equal'),
          icon: icon(SVG.contSymmetric),
          run: () => penSetContinuity(fc, 'symmetric'),
        },
      ],
    });
  }
  items.push({ sep: true });
  items.push({
    label: t('Delete the selected points'),
    icon: icon(SVG.trash),
    danger: true,
    disabled: !fc.penSel.size,
    run: () => penDeleteSelected(fc),
  });
  fc.popover = document.createElement('div');
  fc.popover.className = 'fc-popover fc-context-menu';
  // The rows carry `role="menuitem"`, so the container has to say `menu` - an orphan
  // menuitem tells a screen reader less than a plain button would.
  fc.popover.setAttribute('role', 'menu');
  fc.toolbox.fillPopover(fc.popover, items);
  fc.popover.addEventListener('pointerdown', (e) => e.stopPropagation());
  fc.popover.addEventListener('keydown', fc.menus.onPopoverKey);
  stageEl.appendChild(fc.popover);
  const sr = stageEl.getBoundingClientRect();
  fc.popover.style.left =
    Math.max(6, Math.min(clientX - sr.left, sr.width - fc.popover.offsetWidth - 6)) + 'px';
  fc.popover.style.top =
    Math.max(6, Math.min(clientY - sr.top, sr.height - fc.popover.offsetHeight - 6)) + 'px';
}
export function penSetContinuity(fc: FcCtx, c: Continuity): void {
  if (!fc.penEdit || !fc.penSel.size) return;
  penEditWrite(fc, setNodeContinuity(fc.penEdit.path, fc.penSel, c));
}
export function penToggleClosed(fc: FcCtx): void {
  if (!fc.penEdit) return;
  fc.penWarm = null; // open↔closed changes the segment count
  // Flip every contour to the SAME new state (based on the first), so a multi-contour box
  // toggles deterministically rather than leaving a mix. Single-contour is the old behaviour.
  const contours = penContours(fc);
  const closed = !contours[0]!.closed;
  penEditWritePaths(fc, contours.map((p) => ({ ...p, closed })));
}
/**
 * Switch the edited path's spline kind, warning first when that discards authored work.
 *
 * The asymmetry is `convertKind`'s: to `cubic` bakes the current lowering into explicit
 * handles and is lossless; to `hyperbezier` (or another derived kind) DROPS them and
 * cannot get them back. So the lossy direction asks, in the same `fc-panel` recipe the
 * one-number prompts use - the smallest confirmation this overlay has.
 */
export function penSetKind(fc: FcCtx, to: SplineKind): void {
  if (!fc.penEdit) return;
  const apply = (): void => {
    const warm = fc.penWarm;
    fc.penWarm = null;
    // Convert every contour. The warm start belongs to a single active contour, so it is
    // only passed when there is exactly one; multi-contour boxes are cubic and need none.
    const contours = penContours(fc);
    penEditWritePaths(fc, 
      contours.map(
        (p, pi) => convertKind(p, to, pi === 0 && contours.length === 1 ? warm : null).path
      )
    );
  };
  if (!penContours(fc).some((p) => convertKind(p, to).lossy)) {
    apply();
    return;
  }
  fc.dialogs.askConfirm({
    at: penCtxAnchorPoint(fc),
    title: t('Discard the handles?'),
    hint: t(
      'This spline works out its own handle lengths, so the ones you set will be dropped. Switching back cannot bring them back.'
    ),
    confirm: t('Discard and switch'),
    apply,
    cancel: () => {
      fc.ctxSelKey = null;
      fc.chromeSync.renderChrome();
    }, // put the menu back on the old kind
  });
}
// ── pen preview + node chrome ─────────────────────────────────────────────────

/** Hide the box's own rendered `<svg>` while a node drag is live, so the (stale) committed
 *  shape does not double up with the pen layer's live one. Mirrors
 *  `setRealConnectorsHidden`; the commit re-renders it anyway. */
export function setPathSvgHidden(fc: FcCtx, hidden: boolean): void {
  const { canvasEl } = fc;
  if (!fc.penEdit) return;
  const el = canvasEl.querySelector<HTMLElement>(
    `.lolly-box[data-box-id="${fc.keys.cssEscape(fc.penEdit.id)}"] .lolly-box-path`
  );
  if (el) el.style.visibility = hidden ? 'hidden' : '';
}
/**
 * Lower a path to SVG path data for the preview, KEEPING the hyperbezier solution as the
 * next frame's warm start.
 *
 * This is why `toCubics(path, warm)` grew that parameter and why the pen path does not use
 * it: `toCubics` throws the solution it computed away, so every frame of a drag would
 * re-converge a 40-node Newton run from the chord-bend guess. Solving here and holding
 * the answer turns each subsequent frame into one or two steps.
 */
export function penPathD(fc: FcCtx, p: AuthoredPath): string {
  const low = lowerAuthored(p, fc.penWarm);
  if (low.solution) fc.penWarm = low.solution;
  return low.cubics.length ? cubicsToD(fc, low.cubics, p.closed) : '';
}
/** Cubics → `d`, in native/box-local units. `M` once, then one `C` per curve; the close
 *  is emitted as `Z` only when the contour really is closed, so an open path is not
 *  silently filled. */
export function cubicsToD(fc: FcCtx, cubics: Cubic[], closed: boolean): string {
  const first = cubics[0]!;
  let d = `M${fc.connectors.cf2(first[0])} ${fc.connectors.cf2(first[1])}`;
  for (const k of cubics)
    d += `C${fc.connectors.cf2(k[2])} ${fc.connectors.cf2(k[3])} ${fc.connectors.cf2(k[4])} ${fc.connectors.cf2(k[5])} ${fc.connectors.cf2(k[6])} ${fc.connectors.cf2(k[7])}`;
  return closed ? d + 'Z' : d;
}
/**
 * The arrowheads of the box being node-edited, as an SVG fragment in BOX-LOCAL px (the
 * caller wraps it in the frame transform, so a rotated box's heads rotate with it).
 *
 * Why it is here at all: a node drag hides the box's own `<svg>` and paints this hairline
 * outline instead, so without it the arrowheads blink out for the whole gesture - exactly
 * while you are moving the point one of them sits on. The geometry is the engine's
 * `edgeArrowHead`, the same call the committed render reaches through the host bridge, so
 * the preview head is the head.
 *
 * Heads go on a SINGLE OPEN contour only, matching pathHtmlFor: "the path's ends" is not
 * a thing a multi-contour boolean result or a closed loop has. The ink is `currentColor`
 * (the guide colour of the outline it decorates), not the box's stroke: this is chrome,
 * and a head painted in a stroke colour that happens to match the artboard would vanish.
 * No shaft pullback either - a 1.6px hairline cannot poke through a filled head visibly,
 * and the inset belongs to the committed render, which is what the export reads.
 */
export function penEditHeadsSvg(fc: FcCtx, contours: AuthoredPath[]): string {
  const { cfg, hasHeadCfg } = fc;
  if (!hasHeadCfg || !fc.penEdit || contours.length !== 1 || contours[0]!.closed) return '';
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, fc.penEdit.id);
  if (i < 0) return '';
  const b = boxes[i] || {};
  const hs = String(b[cfg.headStartField] || 'none');
  const he = String(b[cfg.headEndField] || 'none');
  if (hs === 'none' && he === 'none') return '';
  const low = lowerAuthored(contours[0]!, fc.penWarm);
  if (!low.cubics.length) return '';
  const tips = pathEndPoints(low.cubics);
  const dir = pathEndTangents(low.cubics);
  if (!tips || !dir) return '';
  // The same clamp `pathHeadSize` applies before the engine sizes a head, so the preview
  // head is the committed head at every stroke width, not just under 20.
  const size = Math.max(9, fc.keys.clampN(b[cfg.strokeWField], 2.5, 0.5, 20) * 4);
  return (
    (hs !== 'none'
      ? edgeArrowHead(tips.start, dir.start.x, dir.start.y, size, 'currentColor', hs)
      : '') +
    (he !== 'none' ? edgeArrowHead(tips.end, dir.end.x, dir.end.y, size, 'currentColor', he) : '')
  );
}
/** The pen layer: the draft (plus the segment under the cursor) while drawing, and the
 *  edited path's live outline while node-editing. */
export function paintPen(fc: FcCtx): void {
  const { penLayer } = fc;
  if (!fc.penDraft && !fc.penEdit) {
    if (penLayer.style.display !== 'none') {
      penLayer.style.display = 'none';
      penLayer.innerHTML = '';
    }
    return;
  }
  const m = fc.stage.metrics();
  fc.connectors.placeNativeLayer(penLayer, m);
  const sw = 1.6 / (m.scale || 1); // constant SCREEN width at any zoom
  let body = '';
  if (fc.penDraft) {
    // The cursor is included as a real node, so the preview is what committing here
    // would actually produce - for a hyperbezier that means the WHOLE run re-solves,
    // which is the honest picture and the reason the warm start matters.
    const preview: AuthoredPath = fc.penCursor
      ? {
          ...fc.penDraft,
          nodes: [
            ...fc.penDraft.nodes,
            { x: fc.penCursor.x, y: fc.penCursor.y, continuity: defaultContinuity(fc.penDraft.kind) },
          ],
        }
      : fc.penDraft;
    const d = penPathD(fc, preview);
    if (d)
      body += `<path d="${escapeText(d)}" fill="none" stroke="currentColor" stroke-width="${fc.connectors.cf2(sw)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  } else if (fc.penEdit) {
    // Every contour is lowered and drawn (the box's own `<svg>` is hidden for the gesture,
    // so any contour left out would just vanish). A LONE contour keeps the warm hyperbezier
    // start for a smooth live drag; with several they are cubic and lower cold, and a warm
    // solution belongs to a single run anyway. Each keeps its OWN kind + closed via penPathD/
    // the cold lower, so a curve is never drawn ACROSS a contour boundary.
    const contours = penContours(fc);
    const ds = contours
      .map((p) => {
        if (contours.length === 1) return penPathD(fc, p);
        const low = lowerAuthored(p);
        return low.cubics.length ? cubicsToD(fc, low.cubics, p.closed) : '';
      })
      .filter(Boolean);
    const fr = fc.penEdit.frame;
    if (ds.length) {
      const tf =
        `translate(${fc.connectors.cf2(fr.x)} ${fc.connectors.cf2(fr.y)})` +
        (fr.rot ? ` rotate(${fc.connectors.cf2(fr.rot)} ${fc.connectors.cf2(fr.w / 2)} ${fc.connectors.cf2(fr.h / 2)})` : '');
      body +=
        `<g transform="${tf}"><path d="${escapeText(ds.join(' '))}" fill="none" stroke="currentColor" stroke-width="${fc.connectors.cf2(sw)}" stroke-linejoin="round" stroke-linecap="round"/>` +
        penEditHeadsSvg(fc, contours) +
        '</g>';
    }
  }
  penLayer.innerHTML = body;
  penLayer.style.display = '';
}
// ── endpoint binding (plan 96 P3) ─────────────────────────────────────────────
//
// Dragging one END of a path onto a box ATTACHES that end to it: the path becomes a
// connector and the engine routes it from that box's border, re-solving as the box moves.
// Dragging the same end off every box detaches it and the path is a plain spline again.
// There is no mode and no separate tool - the gesture is the one the shape suggests, and
// it is the thing Connect mode used to be (plan 96 P4 deleted that).

/** Which end of the edited path a node-drag is moving, or undefined when it is not a
 *  single END node (an interior node has nothing to attach; two at once is a reshape).
 *  A CLOSED path has no ends, and a multi-contour path has no single pair of them. */
export function bindEndFor(fc: FcCtx, indices: number[]): 'start' | 'end' | undefined {
  const { hasBindCfg } = fc;
  if (!hasBindCfg || !fc.penEdit || indices.length !== 1) return undefined;
  if (fc.penEdit.parts.length !== 1 || fc.penEdit.path.closed) return undefined;
  const i = indices[0]!,
    n = fc.penEdit.path.nodes.length;
  if (n < 2) return undefined;
  return i === 0 ? 'start' : i === n - 1 ? 'end' : undefined;
}
/** The box an end node would attach to at this native point: the topmost hit that is not
 *  the path itself and not a frame (a page is a container, not a thing to point at). */
export function bindableAt(fc: FcCtx, x: number, y: number, selfId: string): string | null {
  const { cfg, frameCfg } = fc;
  const boxes = fc.select.getBoxes();
  const hit = pickTopmost(boxes, x, y, cfg, fc.select.seqHiddenSkip(boxes));
  if (hit < 0) return null;
  const b = boxes[hit] || {};
  const id = fc.select.idOf(b, hit);
  if (id === selfId) return null;
  if (frameCfg && String(b[cfg.kindField]) === (frameCfg.frameKind || 'frame')) return null;
  return id;
}
/** The snap ring over the box an end would attach to. Drawn in the connector preview
 *  layer (native coordinates, already placed) so it pans and zooms with everything else.
 *  Same dashed outline Connect mode used to put round its pending source card - the
 *  affordance survived the mode. */
export function setBindHover(fc: FcCtx, id: string | null): void {
  const { cfg, connectLayer } = fc;
  if (id === fc.bindHover) return;
  fc.bindHover = id;
  if (!id) {
    if (!fc.penEdit) fc.connectors.hideConnectLayer();
    else {
      connectLayer.innerHTML = '';
    }
    return;
  }
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, id);
  if (i < 0) {
    fc.bindHover = null;
    return;
  }
  const r = boxRect(boxes[i], cfg);
  fc.connectors.placeConnectLayer(fc.stage.metrics());
  connectLayer.innerHTML =
    `<rect x="${fc.connectors.cf2(r.x - 4)}" y="${fc.connectors.cf2(r.y - 4)}" width="${fc.connectors.cf2(r.w + 8)}" height="${fc.connectors.cf2(r.h + 8)}" rx="10"` +
    ' fill="none" stroke="#30ba78" stroke-width="3" stroke-dasharray="7 5"/>';
  connectLayer.style.display = '';
}
/**
 * Write one end's binding - the whole commit, one `setInput`, one undo step.
 *
 * A no-op write is skipped so re-dragging an already-attached end does not mint an undo
 * step that changes nothing. Attaching also seeds a head on the far end when the path has
 * neither: an undecorated connector reads as a divider rather than as a link, and this is
 * the moment the user said "this points at that".
 */
export function applyBinding(fc: FcCtx, id: string, which: 'start' | 'end', to: string): void {
  const { cfg, hasHeadCfg } = fc;
  const field = which === 'start' ? cfg.bindStartField : cfg.bindEndField;
  if (!field) return;
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, id);
  if (i < 0) return;
  const b = boxes[i] || {};
  if (String(b[field] ?? '') === to) return;
  const next: Box = { ...b, [field]: to };
  if (
    to &&
    hasHeadCfg &&
    String(b[cfg.headStartField] || 'none') === 'none' &&
    String(b[cfg.headEndField] || 'none') === 'none'
  ) {
    next[which === 'start' ? cfg.headStartField : cfg.headEndField] = 'triangle';
  }
  fc.select.commit(boxes.map((row, k) => (k === i ? next : row)));
  announce(
    to
      ? t('Attached to {name}. The line routes to it now, and follows it.', { name: to })
      : t('Detached. The line is a free shape again.')
  );
}
/** Every node's position in NATIVE px, in node order - the one place the two modes'
 *  coordinate spaces are reconciled. */
export function penNodePoints(fc: FcCtx): Array<{
  node: SplineNode;
  at: Point;
  hIn: Point | null;
  hOut: Point | null;
}> {
  const p = fc.penEdit ? fc.penEdit.path : fc.penDraft;
  if (!p) return [];
  const fr = fc.penEdit ? fc.penEdit.frame : null;
  const toNative = (x: number, y: number): Point => (fr ? localToFrame(fr, x, y) : { x, y });
  return p.nodes.map((node) => {
    const hi = handlePoint(node, 'in'),
      ho = handlePoint(node, 'out');
    return {
      node,
      at: toNative(node.x, node.y),
      hIn: hi ? toNative(hi.x, hi.y) : null,
      hOut: ho ? toNative(ho.x, ho.y) : null,
    };
  });
}
/**
 * Build-once / reposition-many for node chrome, keyed on the node COUNT plus which path
 * is being edited - nothing else. Repositioning is pure style writes, so a drag, a pan
 * and a zoom all cost the same handful of them; only placing or deleting a node (or
 * changing which box is edited) recreates elements and rebinds their pointerdown. This
 * is the discipline `chromeNodes` documents, and it matters more here: a 40-node path
 * rebuilt per frame is 120 elements and 80 listeners per pointermove.
 */
export function syncPenChrome(fc: FcCtx): void {
  const p = fc.penEdit ? fc.penEdit.path : fc.penDraft;
  if (!p) {
    if (fc.penChromeKey) fc.rail.clearPenChrome();
    return;
  }
  // Handles are drawn while DRAWING as well as while editing. A pen's click-drag is the
  // one gesture whose whole feedback is the arm you are pulling, and on the very first
  // node of a path there is no segment yet, so without the arm the drag has no visible
  // effect at all - you are aiming a tangent blind. `handlePoint` returns null for a node
  // with no authored handle, so a click-only node still shows a bare dot and only the
  // nodes actually dragged grow arms.
  const withHandles = kindReadsHandles(p.kind);
  const key = `${fc.penEdit ? 'e:' + fc.penEdit.id : 'd'}:${p.nodes.length}:${withHandles ? 'h' : '-'}`;
  if (key !== fc.penChromeKey) {
    fc.penChromeKey = key;
    buildPenChrome(fc, p.nodes.length, withHandles);
  }
  positionPenChrome(fc);
}
/**
 * The node chrome carries NO listeners, unlike the selection handles.
 *
 * Every pen hit test already has to happen in box-local coordinates and be
 * rotation-aware - a handle can be anywhere, including under another node - so
 * `onCanvasPointerDown` does it with `penHandleAt`/`nodeAt`/`nearestOnPath` against the
 * real geometry. Binding a second, element-based path on top would give two answers to
 * the same question, and it is precisely the per-node listener rebinding that the
 * build-once discipline exists to avoid. The elements are therefore pointer-transparent
 * (see `.fc-pen-chrome` in editor.css) and this function only ever mints divs.
 */
export function buildPenChrome(fc: FcCtx, count: number, withHandles: boolean): void {
  const { penChrome } = fc;
  penChrome.innerHTML = '';
  const arms: HTMLElement[] = [];
  const dots: HTMLElement[] = [];
  const nodes: HTMLElement[] = [];
  // Arms below dots below nodes: paint order is tree order in this container.
  for (let k = 0; withHandles && k < count * 2; k++) {
    const arm = document.createElement('div');
    arm.className = 'fc-pen-arm';
    arm.hidden = true;
    penChrome.appendChild(arm);
    arms.push(arm);
  }
  for (let k = 0; withHandles && k < count * 2; k++) {
    const dot = document.createElement('div');
    dot.className = 'fc-pen-handle';
    dot.hidden = true;
    penChrome.appendChild(dot);
    dots.push(dot);
  }
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'fc-pen-node';
    penChrome.appendChild(el);
    nodes.push(el);
  }
  fc.penChromeNodes = { nodes, arms, dots };
}
/** The MODEL row of the box being node-edited (the bindings live there, not on the
 *  denormalised local path `penEdit` holds). null when the edit is over. */
export function penEditBox(fc: FcCtx): Box | null {
  if (!fc.penEdit) return null;
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, fc.penEdit.id);
  return i >= 0 ? boxes[i] || null : null;
}
export function positionPenChrome(fc: FcCtx): void {
  const nodes = fc.penChromeNodes;
  if (!nodes) return;
  const m = fc.stage.metrics();
  const pts = penNodePoints(fc);
  for (let i = 0; i < nodes.nodes.length; i++) {
    const el = nodes.nodes[i]!;
    const pt = pts[i];
    if (!pt) {
      el.hidden = true;
      continue;
    }
    el.hidden = false;
    const s = fc.stage.nativeToStage(pt.at.x, pt.at.y, m);
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
    const cont =
      pt.node.continuity ?? defaultContinuity(fc.penEdit ? fc.penEdit.path.kind : fc.penDraft!.kind);
    el.classList.toggle('is-corner', cont === 'corner');
    el.classList.toggle('is-symmetric', cont === 'symmetric');
    el.classList.toggle('is-on', fc.penSel.has(i));
    // The first node of an OPEN draft is the one a click closes on, so it reads as a
    // target rather than as another placed point.
    el.classList.toggle('is-close-target', !!fc.penDraft && i === 0 && pts.length >= 3);
    // plan 96 P3 - an ATTACHED end reads as filled, so a pinned-to-a-box endpoint
    // is visible without dragging it to find out. Only the two ends can carry one.
    const end = fc.penEdit ? (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : null) : null;
    el.classList.toggle('is-bound', !!end && !!penEditBox(fc) && fc.connectors.bindOf(penEditBox(fc)!, end) !== '');
  }
  for (let k = 0; k < nodes.dots.length; k++) {
    const i = k >> 1;
    const which: 'in' | 'out' = k % 2 === 0 ? 'in' : 'out';
    const dot = nodes.dots[k]!;
    const arm = nodes.arms[k]!;
    const pt = pts[i];
    const h = pt ? (which === 'in' ? pt.hIn : pt.hOut) : null;
    if (!pt || !h) {
      dot.hidden = true;
      arm.hidden = true;
      continue;
    }
    const a = fc.stage.nativeToStage(pt.at.x, pt.at.y, m);
    const b = fc.stage.nativeToStage(h.x, h.y, m);
    dot.hidden = false;
    dot.classList.toggle('is-on', fc.penHandleSel.has(`${i}:${which}`));
    dot.style.left = b.x + 'px';
    dot.style.top = b.y + 'px';
    arm.hidden = false;
    arm.style.left = a.x + 'px';
    arm.style.top = a.y + 'px';
    arm.style.width = Math.hypot(b.x - a.x, b.y - a.y) + 'px';
    arm.style.transform = `rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}deg)`;
  }
}
// ── the pen's contextual bar ───────────────────────────────────────────────────

/** Where the pen bar's own panels (the lossy-switch confirmation) anchor. */
export function penCtxAnchorPoint(fc: FcCtx): Point {
  const { ctxbar } = fc;
  const r = ctxbar.getBoundingClientRect();
  return { x: r.left || fc.lastMenuAt.x, y: r.bottom || fc.lastMenuAt.y };
}
/**
 * The paint section + kind switcher + continuity control, in `ctxbar` - which is the
 * contextual control bar that already rebuilds on a selection-signature change, so the
 * pen's signature just joins that scheme rather than inventing a second bar.
 *
 * The paint controls are the SAME `paintCtxHtml` the object bar uses. This bar replaces
 * `ctxbar.innerHTML`, so before that sharing existed fill and stroke disappeared the
 * instant node editing began - which is the thing the bug report was actually about.
 */
export function penCtxBar(fc: FcCtx): void {
  const p = fc.penEdit ? fc.penEdit.path : fc.penDraft;
  if (!p) return;
  const contSig = [...fc.penSel]
    .sort((a, b) => a - b)
    .map((i) => p.nodes[i]?.continuity ?? '')
    .join(',');
  const handleSig = [...fc.penHandleSel].sort().join(',');
  const key = `pen:${fc.penEdit ? fc.penEdit.id : 'draft'}:${p.kind}:${p.closed ? 'c' : 'o'}:${p.nodes.length}:${contSig}:${handleSig}:${fc.penSelectHandles ? 'h' : '-'}`;
  if (key !== fc.ctxSelKey) {
    fc.ctxSelKey = key;
    buildPenCtxBar(fc, p);
  }
  fc.rail.showCtxBar();
  positionPenCtxBar(fc);
}
export function buildPenCtxBar(fc: FcCtx, p: AuthoredPath): void {
  const { ctxbar } = fc;
  fc.document.closeMorePanel();
  const drawing = !!fc.penDraft;
  const selN = fc.penSel.size;
  // Align/distribute act on nodes ∪ selected control points, so the arrange button
  // enables on the COMBINED count (delete + continuity stay node-only via selN).
  const selPts = fc.penSel.size + fc.penHandleSel.size;
  const cont = selN
    ? String(p.nodes[[...fc.penSel][0]!]?.continuity ?? defaultContinuity(p.kind))
    : '';
  const kindLabel = penKindLabels(fc);
  // Paint belongs to the BOX, so it only appears once there is one: a draft lives in JS
  // state until it commits, and its paint comes from the add-kind's seed.
  const painted = !drawing && !!fc.penEdit;
  let editBox: Box = {};
  if (painted) {
    const rows = fc.select.getBoxes();
    editBox = rows[fc.select.indexOfId(rows, fc.penEdit!.id)] || {};
  }
  ctxbar.innerHTML =
    (painted ? fc.contextBar.paintCtxHtml(editBox, true) + '<span class="fc-sep fc-sep-v"></span>' : '') +
    `<select class="field-select field-select--sm fc-pen-kind" data-pen="kind" data-tip="${escapeText(t('Spline type'))}" aria-label="${escapeText(t('Spline type'))}">` +
    PEN_KINDS.map(
      (k) =>
        `<option value="${k}"${k === p.kind ? ' selected' : ''}>${escapeText(kindLabel[k] || k)}</option>`
    ).join('') +
    '</select>' +
    (drawing
      ? ''
      : '<span class="fc-sep fc-sep-v"></span>' +
        segHtml('pen-cont', cont, [
          ['corner', t('Corner point - handles move independently'), SVG.contCorner],
          ['smooth', t('Smooth point - handles stay in line'), SVG.contSmooth],
          ['symmetric', t('Symmetric point - handles stay in line and equal'), SVG.contSymmetric],
        ]) +
        `<button type="button" class="fc-cbtn${p.closed ? ' is-on' : ''}" data-pen="closed" aria-pressed="${p.closed}" data-tip="${escapeText(t('Closed path'))}" aria-label="${escapeText(t('Closed path'))}">${icon(SVG.penClose)}</button>` +
        // Marquee selection mode: nodes only, or nodes + control points. Only meaningful
        // where control points exist (cubic / hyperbezier).
        (kindReadsHandles(p.kind)
          ? `<button type="button" class="fc-cbtn${fc.penSelectHandles ? ' is-on' : ''}" data-pen="handlesel" aria-pressed="${fc.penSelectHandles}" data-tip="${escapeText(fc.penSelectHandles ? t('Selecting nodes and control points - click for nodes only') : t('Selecting nodes only - click to include control points'))}" aria-label="${escapeText(t('Include control points in a marquee selection'))}">${icon(SVG.nodes)}</button>`
          : '') +
        `<button type="button" class="fc-cbtn" data-pen="arrange"${selPts >= 2 ? '' : ' disabled'} data-tip="${escapeText(t('Align and distribute the selected points'))}" aria-label="${escapeText(t('Align and distribute the selected points'))}">${icon(SVG.align)}</button>` +
        `<button type="button" class="fc-cbtn fc-danger" data-pen="del"${selN ? '' : ' disabled'} data-tip="${escapeText(t('Delete the selected points'))}" aria-label="${escapeText(t('Delete the selected points'))}">${icon(SVG.trash)}</button>`) +
    '<span class="fc-sep fc-sep-v"></span>' +
    `<button type="button" class="fc-cbtn" data-pen="done" data-tip="${escapeText(drawing ? t('Finish this path (Enter)') : t('Finish editing points (Esc)'))}" aria-label="${escapeText(drawing ? t('Finish this path') : t('Finish editing points'))}">${icon(SVG.penDone)}</button>` +
    `<span class="fc-readout">${escapeText(
        drawing
          ? p.nodes.length === 1
            ? t('1 point - hold Alt for a corner')
            : t('{n} points - hold Alt for a corner', { n: p.nodes.length })
          : selN
            ? t('{k} of {n} points', { k: selN, n: p.nodes.length })
            : t('{n} points', { n: p.nodes.length })
      )}</span>`;
  const kindSel = ctxbar.querySelector<HTMLSelectElement>('[data-pen="kind"]');
  kindSel?.addEventListener('change', () => {
    const to = kindSel.value as SplineKind;
    if (fc.penDraft) {
      fc.penDraft = { ...fc.penDraft, kind: to };
      fc.penDrawKind = to;
      fc.penWarm = null;
      fc.chromeSync.renderChrome();
      return;
    }
    penSetKind(fc, to);
  });
  wireSegs(ctxbar, (field, v) => {
    if (field === 'pen-cont' && v) penSetContinuity(fc, v as Continuity);
  });
  if (painted) {
    fc.contextBar.wirePaintCtx(ctxbar);
    ctxbar.querySelectorAll<HTMLElement>('[data-cx="stroke"]').forEach((b) =>
      { b.addEventListener('click', (e) => {
        e.stopPropagation();
        fc.dialogs.openStrokePanel(b);
      }); }
    );
  }
  ctxbar.querySelectorAll<HTMLElement>('[data-pen]').forEach((b) =>
    { b.addEventListener('click', (e) => {
      e.stopPropagation();
      const which = b.dataset.pen;
      if (which === 'closed') penToggleClosed(fc);
      else if (which === 'handlesel') {
        fc.penSelectHandles = !fc.penSelectHandles;
        fc.ctxSelKey = null;
        fc.chromeSync.renderChrome();
      } else if (which === 'arrange') openPenArrangeMenu(fc, b);
      else if (which === 'del') penDeleteSelected(fc);
      else if (which === 'done') {
        if (fc.penDraft) penFinishDraw(fc);
        else endPenEdit(fc);
      }
    }); }
  );
}
/** Pinned to the top chrome row, centred between the back pill and zoom HUD - the same
 *  perch the object bar takes, so the bar does not jump when a draw becomes a selection
 *  and never sits over the path the user is shaping. */
export function positionPenCtxBar(fc: FcCtx): void {
  const { ctxbar } = fc;
  const m = fc.stage.metrics();
  const band = ctxTopBand({ w: m.sr.width, h: m.sr.height }, fc.keys.ctxBarBlockers(m.sr), {
    reserve: fc.contextBar.stageReserves(),
  });
  ctxbar.style.maxWidth = Math.max(0, band.hi - band.lo) + 'px';
  const bw = ctxbar.offsetWidth || 0;
  if (bw <= 0) return; // not laid out yet - next frame, rather than a half-width-off jump
  const pos = centreCtxBar(bw, band);
  ctxbar.style.left = pos.left + 'px';
  ctxbar.style.top = pos.top + 'px';
}
export function penToolOps(fc: FcCtx) {
  return {
    penKindLabels: bindOp(fc, penKindLabels),
    openPenKindMenu: bindOp(fc, openPenKindMenu),
    setPenDrawKind: bindOp(fc, setPenDrawKind),
    penScale: bindOp(fc, penScale),
    penTol: bindOp(fc, penTol),
    enterPen: bindOp(fc, enterPen),
    exitPen: bindOp(fc, exitPen),
    penPlaceNode: bindOp(fc, penPlaceNode),
    penUndoNode: bindOp(fc, penUndoNode),
    penFinishDraw: bindOp(fc, penFinishDraw),
    commitPathBox: bindOp(fc, commitPathBox),
    drawnInkHex: bindOp(fc, drawnInkHex),
    penCancelDraw: bindOp(fc, penCancelDraw),
    penJoin: bindOp(fc, penJoin),
    penSplitWith: bindOp(fc, penSplitWith),
    penContours: bindOp(fc, penContours),
    penPartStarts: bindOp(fc, penPartStarts),
    startPenEdit: bindOp(fc, startPenEdit),
    endPenEdit: bindOp(fc, endPenEdit),
    penSyncFromModel: bindOp(fc, penSyncFromModel),
    penEditWrite: bindOp(fc, penEditWrite),
    penEditWritePaths: bindOp(fc, penEditWritePaths),
    penHandleAt: bindOp(fc, penHandleAt),
    penInsertAt: bindOp(fc, penInsertAt),
    penDeleteSelected: bindOp(fc, penDeleteSelected),
    penPointRefs: bindOp(fc, penPointRefs),
    penArrangeItems: bindOp(fc, penArrangeItems),
    openPenArrangeMenu: bindOp(fc, openPenArrangeMenu),
    openPenNodeMenu: bindOp(fc, openPenNodeMenu),
    penSetContinuity: bindOp(fc, penSetContinuity),
    penToggleClosed: bindOp(fc, penToggleClosed),
    penSetKind: bindOp(fc, penSetKind),
    setPathSvgHidden: bindOp(fc, setPathSvgHidden),
    penPathD: bindOp(fc, penPathD),
    cubicsToD: bindOp(fc, cubicsToD),
    penEditHeadsSvg: bindOp(fc, penEditHeadsSvg),
    paintPen: bindOp(fc, paintPen),
    bindEndFor: bindOp(fc, bindEndFor),
    bindableAt: bindOp(fc, bindableAt),
    setBindHover: bindOp(fc, setBindHover),
    applyBinding: bindOp(fc, applyBinding),
    penNodePoints: bindOp(fc, penNodePoints),
    syncPenChrome: bindOp(fc, syncPenChrome),
    buildPenChrome: bindOp(fc, buildPenChrome),
    penEditBox: bindOp(fc, penEditBox),
    positionPenChrome: bindOp(fc, positionPenChrome),
    penCtxAnchorPoint: bindOp(fc, penCtxAnchorPoint),
    penCtxBar: bindOp(fc, penCtxBar),
    buildPenCtxBar: bindOp(fc, buildPenCtxBar),
    positionPenCtxBar: bindOp(fc, positionPenCtxBar),
  };
}
