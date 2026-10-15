// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the selection transforms of plan 311: which rows a transform covers, each
 * frame of a selection resize or Scale (the modifier table, the uniform fallback and
 * the snapping), the live Scale preview of a set, the content and composed text half of
 * a Scale commit, the Scale popover's commit, the readout, and the size label drawn
 * beside the selection while it is resized or scaled.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling calls in
 * this file are direct; anything in another module goes through `fc.<module>.<fn>`.
 *
 * A Scale computes from its start rows and merges, by stable id, only the fields it owns
 * onto the current rows, the rule the group commit has followed since PR #118: an edit
 * another participant made to any other field during the drag is kept.
 */
import { parseTextDocument, scaleTextFrame, scaleTextStory, serializeTextDocument } from '@lolly/engine';
import { HANDLE_SIGN, boxRect, num, snapPoint, withRect } from '../free-canvas-math.ts';
import type { AABB as MathAABB, Box, Guide } from '../free-canvas-math.ts';
import {
  anchorPoint, canResizeNonUniform, clampScaleK, contentScaleSpec, handleDragPoint, touchedGuides, rectsAABB, scaleBoxContent,
  scaleChildOffset, scaleLength, scaleMembersAt, scaleRectAt, scaledLayoutAxes, transformRules, transformSelection,
} from '../free-canvas-transform.ts';
import type { ContentScaleSpec, ModifierKeys, ScaleAnchor } from '../free-canvas-transform.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { canvasInteractions } from '../../lib/canvas-interaction.ts';
import type { GScaleGesture, Gesture, Rect, ResizeGesture } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// ── which rows a transform covers ────────────────────────────────────────────

const scopes = new WeakMap<Box[], Map<string, number[]>>();

/**
 * The rows a selection transform moves: the selection plus a selected group's
 * descendants, and in Scale mode also what a selected artboard or layout container
 * holds, so the content inside a container scales with the container. Resize leaves an
 * artboard's members to ride along with the page, as they always have. Cached per row array, like the
 * hierarchy's own transform set.
 */
export function transformSet(fc: FcCtx, boxes: Box[]): number[] {
  const base = fc.hierarchy?.transformIndices(boxes) || fc.select.selIndices(boxes);
  if (!fc.scaleContent || !base.length) return base;
  let cache = scopes.get(boxes);
  if (!cache) {
    cache = new Map();
    scopes.set(boxes, cache);
  }
  const key = base.join(',');
  const saved = cache.get(key);
  if (saved) return saved;
  const idOf = (i: number): string => fc.select.idOf(boxes[i], i);
  const ids = new Set(base.map(idOf));
  const frameKind = fc.frameCfg?.frameKind, frameField = fc.frameCfg?.frameField;
  // An artboard's members can be groups or containers with members of their own, so the
  // three expansions run until nothing new joins.
  for (let round = 0; round < 8; round++) {
    const size = ids.size;
    if (frameKind && frameField) {
      const pages = new Set(boxes.flatMap((b, i) => (String(b?.[fc.cfg.kindField] ?? '') === frameKind && ids.has(idOf(i)) ? [idOf(i)] : [])));
      if (pages.size) boxes.forEach((b, i) => { if (pages.has(String(b?.[frameField] ?? ''))) ids.add(idOf(i)); });
    }
    for (const id of fc.layout?.dynamicScope(boxes, ids) ?? []) ids.add(id);
    for (const id of fc.hierarchy?.scopeIds(boxes, ids) ?? []) ids.add(id);
    if (ids.size === size) break;
  }
  const result = boxes.flatMap((_, i) => (ids.has(idOf(i)) ? [i] : []));
  if (cache.size > 32) cache.clear();
  cache.set(key, result);
  return result;
}

/** Does a locked row in the transform set stop the selection from scaling? In Scale mode
 *  that includes a locked layer inside a selected artboard or layout container. */
export function scaleLocked(fc: FcCtx, boxes: Box[]): boolean {
  const sel = transformSet(fc, boxes);
  return sel.length > 0 && fc.gestures.selectionLocked(boxes, sel);
}

// ── the live frame ───────────────────────────────────────────────────────────

const proportions = new WeakMap<Box[], Map<string, boolean>>();

/**
 * Does a Resize of this set keep its proportions, one factor for both axes? It does when
 * a group row is in the set, when a member is a circle (an ellipse the editor keeps
 * square, which one factor per axis would stretch while it still reads Circle), and when
 * a member is turned off a quarter turn, which could not take a different factor per
 * axis without shearing. Otherwise a corner resizes the width and the height freely and
 * an edge one axis only. Cached per row array, as `transformSet` is, because the chrome
 * asks on every frame it paints.
 */
export function proportional(fc: FcCtx, boxes: Box[], sel: readonly number[]): boolean {
  let cache = proportions.get(boxes);
  if (!cache) {
    cache = new Map();
    proportions.set(boxes, cache);
  }
  const key = sel.join(',');
  const saved = cache.get(key);
  if (saved !== undefined) return saved;
  const result = sel.some((i) => fc.hierarchy?.isGroup(boxes[i]) || fc.fieldPanels.isCircle(boxes[i]))
    || !canResizeNonUniform(sel.map((i) => boxRect(boxes[i], fc.cfg)));
  if (cache.size > 32) cache.clear();
  cache.set(key, result);
  return result;
}

/** One frame of a selection resize or Scale: the rows as the frame leaves them, the
 *  content factor, and the snap guides the moving edges reached. */
export interface SelectionFrame {
  next: Box[];
  k: number;
  guides: Guide[];
}

/**
 * One frame of the gscale gesture, from the pointer's travel since the press and the
 * modifiers the frame was taken with. In Resize a corner changes the width and the
 * height freely and an edge one axis, unless the set keeps its proportions (see
 * `proportional`), where the dragged axis drives one factor. A Scale is always uniform.
 * Shift keeps the aspect, Alt works from the centre, and ⌘ or Ctrl suspends snapping.
 * The rows are computed from the start rows every frame, geometry only: Scale mode's
 * content follows `k` in the preview and the commit.
 */
export function scaleFrame(fc: FcCtx, g: GScaleGesture, keys: ModifierKeys, dx: number, dy: number): SelectionFrame {
  const { cfg, minSize } = fc;
  const rules = transformRules(g.content ? 'scale' : 'resize', keys);
  const members = g.sel.map((i) => boxRect(g.startBoxes[i], cfg));
  const [hx, hy] = HANDLE_SIGN[g.handle];
  // A free corner (both axes, one factor each) can meet a slope; one factor for both
  // axes, or an edge driving one axis, cannot.
  const slope = hx !== 0 && hy !== 0 && !rules.keepAspect && !g.proportional;
  const snapped = rules.snap ? snapDrag(fc, g, dx, dy, slope) : { dx, dy, guides: [] };
  const res = transformSelection(members, g.aabb, g.handle, snapped.dx, snapped.dy, {
    keepAspect: rules.keepAspect, fromCentre: rules.fromCentre, uniformOnly: !!g.content || !!g.proportional, minSize,
  });
  const at = new Map(g.sel.map((i, j) => [i, res.rects[j]!]));
  const next = g.startBoxes.map((b, i) => {
    const r = at.get(i);
    return r ? withRect(b, { x: r.x, y: r.y, w: r.w, h: r.h }, cfg) : b;
  });
  const corner = slope && !res.uniform ? anchorPoint(res.aabb, g.handle) : undefined;
  return { next, k: res.k, guides: touchedGuides(snapped.guides, res.aabb, { x: hx !== 0, y: hy !== 0 }, corner) };
}

/**
 * The pointer's travel snapped so the dragged edges meet the targets a single box
 * resize snaps to (sibling edges and centres, the artboard and the authored guides),
 * after the grid when "Snap to grid" is on. Only the axes the handle drives are moved.
 * Angled guides are offered to a free corner drag only (`slope`), as a single box's
 * corner takes them.
 */
function snapDrag(fc: FcCtx, g: GScaleGesture, dx: number, dy: number, slope: boolean): { dx: number; dy: number; guides: Guide[] } {
  const p = handleDragPoint(g.aabb, g.handle, dx, dy);
  const grid = (v: number | null): number | null => (v !== null && fc.gridOn ? fc.stage.gridRound(v) : v);
  const gx = grid(p.x), gy = grid(p.y);
  const lines = fc.authoringGuides?.snapTargets();
  const snap = snapPoint(
    gx ?? (g.aabb.minX + g.aabb.maxX) / 2,
    gy ?? (g.aabb.minY + g.aabb.maxY) / 2,
    g.others as MathAABB[],
    fc.helpers.canvasWH(),
    fc.gestures.snapThreshNative(),
    { x: lines?.x, y: lines?.y, ...(slope && { angled: lines?.angled }) },
    fc.gestures.gestureSnapIndex()
  );
  return {
    dx: p.x === null ? dx : dx + snap.x - p.x,
    dy: p.y === null ? dy : dy + snap.y - p.y,
    guides: snap.guides,
  };
}

/**
 * Scale mode's live frame for a set: each member at its rect, its content grown by `k`
 * through the element's own transform. A member drawn inside another member's element
 * (a box on an artboard's page) is recorded but not written, because the page's scale
 * already carries it and a second write would scale it twice.
 */
export function previewScale(fc: FcCtx, g: Pick<GScaleGesture, 'sel' | 'startBoxes'>, next: Box[], k: number): void {
  const ids = new Set(g.sel.map((i) => fc.select.idOf(g.startBoxes[i], i)));
  for (const i of g.sel) fc.gestures.applyLiveRect(i, boxRect(next[i], fc.cfg), k, !insideMember(fc, fc.select.idOf(next[i], i), ids));
}
function insideMember(fc: FcCtx, id: string, ids: ReadonlySet<string>): boolean {
  for (let el = fc.stage.liveBoxEl(id)?.parentElement; el && el !== fc.canvasEl; el = el.parentElement) {
    const owner = el.getAttribute('data-box-id') ?? el.getAttribute('data-frame-id');
    if (owner !== null && ids.has(owner)) return true;
  }
  return false;
}

/** "Scale NN%" while a Scale drag or pinch is live, for the object bar's readout and the size label. */
export function scaleReadout(fc: FcCtx): string | null {
  const g = fc.gesture;
  if (!g || (g.type !== 'resize' && g.type !== 'gscale' && g.type !== 'pinch') || !g.content) return null;
  return t('Scale {n}%', { n: Math.round((g.k ?? 1) * 100) });
}

/**
 * The object bar's readout and the size label while a selection transform is live:
 * "Scale NN%" for a Scale, and for a selection resize or a pinch the bounds' W x H, with
 * "Proportional" after it when the set keeps its proportions. Null otherwise, when the
 * readout shows its own text. `rects` are the frame's live rects of the transformed rows.
 */
export function transformReadout(fc: FcCtx, rects: ReadonlyMap<number, Rect> | null): string | null {
  const scale = scaleReadout(fc);
  if (scale) return scale;
  const g = fc.gesture;
  if ((g?.type !== 'gscale' && g?.type !== 'pinch') || !rects) return null;
  const a = rectsAABB([...rects.values()]);
  if (!a) return null;
  const size = `${Math.round(a.w)}×${Math.round(a.h)}`;
  return g.type === 'gscale' && g.proportional ? `${size}  ·  ${t('Proportional')}` : size;
}

const labels = new WeakMap<FcCtx, HTMLElement>();

/**
 * The label beside the selection while it is resized or scaled: W x H in the readout's
 * px (with "Proportional" for a set that keeps its proportions), or "Scale NN%" in Scale
 * mode, as the readout reads (see `transformReadout`). The object bar can be hidden (a
 * narrow stage, the chrome toggle), so the number also sits next to the pointer. Visual
 * only, like the readout, whose accessible name is its aria-label rather than this text:
 * a number spoken every frame would drown out everything else. What a screen reader
 * needs to know about the drag, that a set keeps its proportions, is announced once at
 * the press (chrome-sync's `onGroupHandleDown`).
 */
export function paintLabel(fc: FcCtx, rects: ReadonlyMap<number, Rect>): void {
  const g = fc.gesture;
  const a = g && (g.type === 'resize' || g.type === 'gscale' || g.type === 'pinch') ? rectsAABB([...rects.values()]) : null;
  if (!g || !a) {
    hideLabel(fc);
    return;
  }
  let el = labels.get(fc);
  if (!el) {
    el = document.createElement('div');
    el.className = 'fc-xform-label';
    el.setAttribute('aria-hidden', 'true');
    labels.set(fc, el);
  }
  if (el.parentNode !== fc.overlay) fc.overlay.appendChild(el);
  const one = g.type === 'resize' ? rects.get(g.index) : undefined;
  el.textContent = transformReadout(fc, rects) ?? `${Math.round(one?.w ?? a.w)}×${Math.round(one?.h ?? a.h)}`;
  const p = fc.stage.nativeToStage(a.maxX, a.maxY);
  el.style.left = `${Math.round(p.x + 8)}px`;
  el.style.top = `${Math.round(p.y + 8)}px`;
}
export function hideLabel(fc: FcCtx): void {
  labels.get(fc)?.remove();
}

// ── the commit ───────────────────────────────────────────────────────────────

/** What a Scale commit reads from its gesture, or from the popover that stands in for one. */
export type ScaleSource =
  | Pick<ResizeGesture, 'type' | 'index' | 'content' | 'k' | 'startBox'>
  | Pick<GScaleGesture, 'type' | 'sel' | 'startBoxes' | 'content' | 'k'>
  | { type: Exclude<Gesture['type'], 'resize' | 'gscale'> };
/** The arguments a Scale hands `select.commit`: the rows, plus the text patch, the label
 *  and the text frames that grew with their story, whose auto size mode stays. */
export interface ScaledCommit {
  boxes: Box[];
  patch?: Record<string, unknown>;
  label?: string;
  frames?: ReadonlySet<string>;
}

const specs = new WeakMap<FcCtx, ContentScaleSpec>();
function specOf(fc: FcCtx): ContentScaleSpec {
  let spec = specs.get(fc);
  if (!spec) {
    const { cfg } = fc;
    spec = contentScaleSpec({
      fontSizeField: cfg.fontSizeField, radiusField: cfg.radiusField, strokeWField: cfg.strokeWField,
      padField: cfg.padField, trackingField: cfg.trackingField, shadowXField: cfg.shadowXField,
      shadowYField: cfg.shadowYField, shadowBlurField: cfg.shadowBlurField,
      declared: fc.declaredBoxFields, bounds: fc.boxFieldBounds,
    });
    specs.set(fc, spec);
  }
  return spec;
}

/**
 * The content half of a Scale commit, merged onto the rows the geometry commit already
 * built: each member's content lengths scaled on that row, its layout modes kept, and
 * for composed text the scaled stories and frames in a text document patch that commits
 * with the rows (one undo step). Anything that is not a Scale passes through untouched,
 * which is why every resize and group scale commit goes through here.
 *
 * The content comes from the row being committed, not from the start row: a drag never
 * writes content, so that row holds the current value, and a font size or stroke another
 * editor changed during the drag grows from its new value rather than being replaced.
 * The start row gives only the geometry the Scale began from.
 */
export function withScale(fc: FcCtx, g: ScaleSource, rows: Box[]): ScaledCommit {
  if ((g.type !== 'resize' && g.type !== 'gscale') || !g.content) return { boxes: rows };
  const k = g.k ?? 1;
  if (!(k > 0) || !Number.isFinite(k) || k === 1) return { boxes: rows };
  const starts = new Map<string, Box>();
  if (g.type === 'resize') {
    if (g.startBox) starts.set(fc.select.idOf(g.startBox, g.index), g.startBox);
  } else {
    for (const i of g.sel) {
      const b = g.startBoxes[i];
      if (b) starts.set(fc.select.idOf(b, i), b);
    }
  }
  const text = scaleStories(fc, starts, k);
  const spec = specOf(fc);
  const { cfg, cv } = fc;
  const boxes = rows.map((row, i) => {
    const id = fc.select.idOf(row, i), start = starts.get(id);
    if (!start || text.skip.has(id)) return row;
    const out: Box = { ...scaleBoxContent(row, k, spec, { startWidth: num(start[cfg.wField], 0) }) };
    const frame = text.frames.get(id);
    if (frame !== undefined && cv.textFrameField) out[cv.textFrameField] = frame;
    return keepLayout(fc, out, start, starts, k);
  });
  const patch = text.document !== undefined && cv.textDocumentInput ? { [cv.textDocumentInput]: text.document } : undefined;
  return { boxes, ...(patch && { patch }), label: t('Scale'), ...(text.frames.size > 0 && { frames: new Set(text.frames.keys()) }) };
}

const on = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

/**
 * A Scale keeps the layout modes of the rows it touches. A container or a child sizes
 * only its fixed axes and leaves a hug or fill axis to the layout. A flow child keeps
 * its place, because flow positions it and a moved flow child reads as a reorder. An
 * absolutely placed child's offset from its container grows by `k` with everything else.
 */
function keepLayout(fc: FcCtx, out: Box, start: Box, starts: ReadonlyMap<string, Box>, k: number): Box {
  const owner = start.layoutOwner ? String(start.layoutOwner) : '';
  if (start.layout !== 'flex' && start.layout !== 'grid' && !owner) return out;
  const { cfg } = fc;
  const axes = scaledLayoutAxes(start);
  if (!axes.w) out[cfg.wField] = start[cfg.wField];
  if (!axes.h) out[cfg.hField] = start[cfg.hField];
  if (!owner) return out;
  if (!on(start.layoutAbsolute)) {
    out[cfg.xField] = start[cfg.xField];
    out[cfg.yField] = start[cfg.yField];
    return out;
  }
  const parent = starts.get(owner);
  if (!parent) return out;
  // Whole px, as withRect writes every other place: the layout derives the child's
  // offset from this place, so a raw float here would come back as a float offset.
  const at = scaleChildOffset(boxRect(parent, cfg), boxRect(start, cfg), boxRect(out, cfg), k);
  out[cfg.xField] = Math.round(at.x);
  out[cfg.yField] = Math.round(at.y);
  // The offset rounds as content does: to 0.1 px, and never from a small offset to none.
  for (const f of ['layoutX', 'layoutY']) {
    const v = start[f];
    if (v !== '' && v != null && Number.isFinite(Number(v))) out[f] = scaleLength(Number(v), k);
  }
  return out;
}

interface StoryScale {
  /** The scaled text document, when a story scaled. */
  document?: string;
  /** Each scaled frame's settings, by frame id, for the box's frame field. */
  frames: Map<string, string>;
  /** Frames committed as geometry only, by id. */
  skip: Set<string>;
}

/**
 * Composed text under a Scale (plan 311 Amendment 10): each story whose frames are all
 * in the set scales once, its frames scale one by one, and its revision moves on. Text
 * keeps its size when its story is only partly in the set, while another participant
 * types anywhere in the text document, on a host that cannot write the stories with the
 * rows, or when the engine refuses the scaled story: those frames commit their geometry
 * only, under the Resize rule, and the reason is announced in one translated sentence.
 */
function scaleStories(fc: FcCtx, starts: ReadonlyMap<string, Box>, k: number): StoryScale {
  const out: StoryScale = { frames: new Map(), skip: new Set() };
  const { textStoryField: storyF, textFrameField: frameF, textDocumentInput: input } = fc.cv;
  if (!storyF || !frameF || !input) return out;
  const composed = [...starts].flatMap(([id, b]) => (b[storyF] != null && b[storyF] !== '' ? [id] : []));
  if (!composed.length) return out;
  const geometryOnly = (message: string): StoryScale => {
    for (const id of composed) out.skip.add(id);
    announce(message);
    return out;
  };
  // The stories commit with the rows as one patch, which needs a host that can write both.
  if (!fc.history?.commit && !fc.runtime.applyPatch)
    return geometryOnly(t('Text kept its size because this host cannot edit composed text.'));
  // Every story lives in the one text document, so anyone typing in any story holds the whole document.
  const claims = canvasInteractions(fc.runtime)?.foreignClaims?.() ?? [];
  if (claims.some((c) => c.target.kind === 'text' && c.target.param === input))
    return geometryOnly(t('Text kept its size because someone else is editing text in this design.'));
  try {
    const snapshot = fc.storyText.read();
    const full = new Set<string>();
    let partial = false;
    for (const story of snapshot.document.stories) {
      if (!story.frameIds.some((id) => starts.has(id))) continue;
      if (story.frameIds.every((id) => starts.has(id))) full.add(story.id);
      else {
        partial = true;
        for (const id of story.frameIds) if (starts.has(id)) out.skip.add(id);
      }
    }
    if (full.size) {
      let doc = snapshot.document;
      for (const id of full) doc = scaleTextStory(doc, id, k);
      doc = parseTextDocument({ ...doc, stories: doc.stories.map((s) => (full.has(s.id) ? { ...s, revision: s.revision + 1 } : s)) });
      for (const frame of snapshot.frames) {
        if (!full.has(frame.storyId)) continue;
        const { id, storyId: _story, width: _width, height: _height, hidden: _hidden, locked: _locked, ...settings } = scaleTextFrame(frame, k);
        out.frames.set(id, JSON.stringify(settings));
      }
      out.document = serializeTextDocument(doc);
    }
    if (partial) announce(t('Linked text kept its size because the selection does not hold every frame of its story.'));
  } catch (error) {
    out.frames.clear();
    delete out.document;
    console.warn('Scale text:', error);
    return geometryOnly(t('Text kept its size because the story could not be scaled.'));
  }
  return out;
}

/**
 * The Scale popover's commit, the single-pointer route to a Scale drag (WCAG 2.5.7):
 * the selection scaled by `k` about `anchor`, clamped as the drag clamps, through the
 * same commit paths and the same content helper, in one undo step. Content scales only
 * in Scale mode; with Scale off a multi-selection resizes its geometry. Returns whether
 * anything was written.
 */
export function applyScale(fc: FcCtx, k: number, anchor: ScaleAnchor): boolean {
  if (fc.opts?.canEdit?.() === false || fc.gesture || (fc.layout && !fc.layout.placementReady())) return false;
  const { cfg, minSize } = fc;
  const boxes = fc.select.getBoxes();
  const sel = transformSet(fc, boxes);
  if (!sel.length) return false;
  if (fc.gestures.selectionLocked(boxes, sel)) {
    announce(t('A locked layer in the selection keeps it from scaling.'));
    return false;
  }
  const rects = sel.map((i) => boxRect(boxes[i], cfg));
  const kk = clampScaleK(k, rects, minSize);
  if (Math.abs(kk - 1) < 1e-6) return false;
  const content = fc.scaleContent;
  const index = sel[0]!;
  if (sel.length === 1 && !fc.hierarchy?.isGroup(boxes[index])) {
    // One box: a keyframe diamond poses the size ('set' w/h, the origin shift as an
    // 'add'), as the drag does; anywhere else the base row takes the rect.
    const id = fc.select.idOf(boxes[index], index), start = rects[0]!;
    const live = scaleRectAt(start, anchor, kk, minSize);
    const panel = fc.timelinePanel;
    let next: Box[];
    if (panel && panel.kfPoseIds([id]).length > 0) {
      next = panel.kfPoseWrite(boxes, [id], { w: live.w, h: live.h }, 'set');
      const dx = live.x - start.x, dy = live.y - start.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) next = panel.kfPoseWrite(next, [id], { x: dx, y: dy });
    } else {
      const resized = boxes.map((b, i) => (i === index ? withRect(b, live, cfg) : b));
      next = fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, resized, [index]), new Set([index]));
    }
    commitScaled(fc, withScale(fc, { type: 'resize', index, content, k: kk, startBox: boxes[index] }, next));
    return true;
  }
  // A set: positions about the anchor, sizes uniformly, each side under the drag's own
  // floor. The content is the helper's, and only in Scale mode.
  const a = rectsAABB(rects);
  if (!a) return false;
  const scaled = scaleMembersAt(rects, anchorPoint(a, anchor), kk, minSize);
  const at = new Map(sel.map((i, j) => [i, scaled[j]!]));
  const set = new Set(sel);
  const merged = boxes.map((b, i) => {
    const r = at.get(i);
    return r ? withRect(b, { x: r.x, y: r.y, w: r.w, h: r.h }, cfg) : b;
  });
  const next = fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, merged, sel), set);
  commitScaled(fc, withScale(fc, { type: 'gscale', sel, startBoxes: boxes, content, k: kk }, next));
  return true;
}
function commitScaled(fc: FcCtx, scaled: ScaledCommit): void {
  fc.select.commit(scaled.boxes, scaled.patch, scaled.label, scaled.frames);
}

export function selectionTransformOps(fc: FcCtx) {
  return {
    transformSet: bindOp(fc, transformSet),
    scaleLocked: bindOp(fc, scaleLocked),
    proportional: bindOp(fc, proportional),
    scaleFrame: bindOp(fc, scaleFrame),
    previewScale: bindOp(fc, previewScale),
    scaleReadout: bindOp(fc, scaleReadout),
    transformReadout: bindOp(fc, transformReadout),
    paintLabel: bindOp(fc, paintLabel),
    hideLabel: bindOp(fc, hideLabel),
    withScale: bindOp(fc, withScale),
    applyScale: bindOp(fc, applyScale),
  };
}
