// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: grab zones round the selection (plan 311). Each side of the selection is
 * a resize strip along its full length, each corner is a resize zone, and a mouse or a
 * pen also gets a rotate zone just outside each corner. This module hit-tests them,
 * shows their cursor on hover and holds a transform's cursor for the whole drag.
 *
 * The zones are geometry, not elements. `zoneAt` tests the chrome's posed rect in
 * screen px when the canvas takes a press (or the backdrop takes a mouse press, or any
 * press in a large zone), so the overlay stays pointer-transparent and each `.fc-h-*`
 * locator stays unique. The maths stays on the authored rows, as it does for the
 * handles: a zone drag is the drag of the handle it stands for.
 *
 * A finger, or a mouse or a pen with "Large grab areas" on, gets the zones sized as
 * GIMP's crop tool sizes them (grab-zones.ts): large corners and sides inside the rect,
 * or outside a rect too small for them. While those large zones are on for the pointer
 * the chrome expects, its resize handles let the press through (`data-grab`), the zones
 * reach as far out as the handles took a press, and the zone a press would take is
 * washed.
 *
 * A zone claims a press only when the point holds a member of the selection or
 * nothing, and an artboard counts as nothing there (it only ever takes a press where
 * no object is). On a drawn handle the handle's press wins instead, as it did before the
 * handle let presses through. The claim is provisional. The press becomes a transform
 * once it travels 4 px (10 px for a finger or a pen); a release short of that replays
 * the press through the ordinary click path, so a click in a zone selects, toggles,
 * narrows or deselects exactly as before, and a click on a drawn handle does nothing.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling calls in
 * this file are direct; anything in another module goes through `fc.<module>.<fn>`.
 */
import type { Box } from '../free-canvas-math.ts';
import {
  drawnHandleReach, handleHitReach, inMoveBand, largeZoneSize, nativeToScreen, onDrawnHandle, resizeCursorFor, rotateCursorAt,
  rotateCursorFor, rotateStemFor, visibleRect, zoneAt, zoneDragThreshold, zoneRects, type HandleMedia, type PointerKind,
  type ScreenRect, type ViewRect, type ZoneHit, type ZoneOpts,
} from '../free-canvas-transform.ts';
import type { Gesture, HandleName, Metrics, Point, Rect } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/** Where a zone press was made: on the canvas, or on the backdrop round the artboard. */
export type ZoneFrom = 'canvas' | 'backdrop';

/** The selection chrome in native px, as the zones see the chrome. */
interface ZoneShape {
  /** The rows the chrome outlines. */
  idx: number[];
  /** Set chrome (an axis-aligned box over several rows), whose handles are the group's. */
  multi: boolean;
  /** The posed chrome rect: one box's, turned with the box, or the bounds of a set. */
  r: Rect;
  allowRotate: boolean;
  /** The drag scales in proportion (Scale mode, or a set's Resize fallback). */
  scaleCursor: boolean;
}
/** The chrome in client px, for one hit test. */
interface ZoneTarget extends ZoneShape {
  rect: ScreenRect;
  viewport: ViewRect;
}
interface ZoneFound {
  hit: ZoneHit;
  target: ZoneTarget;
  /** The options the hit was tested with, which the wash draws from. */
  opts: ZoneOpts;
  /** The point is on the drawn handle the zone stands for, which lets the press through. */
  onHandle: boolean;
}
/** The stage cursor: a resize or rotate cursor keyword, and the scale variant. */
interface ZoneCursor {
  cursor: string;
  scale: boolean;
}
interface Mods {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}
interface PendingPress {
  press: PointerEvent;
  from: ZoneFrom;
  found: ZoneFound;
  threshold: number;
  off: () => void;
}
interface HoverState {
  raf: number;
  /** The last hover point, and where it was: `from` is null over other stage UI. */
  at: (Mods & { x: number; y: number; kind: PointerKind; buttons: number; from: ZoneFrom | null }) | null;
  /** The last hover frame found a zone. */
  on: boolean;
  /** The chrome key the last hit test saw. */
  key: string | null;
  /** The frame was asked for by a chrome repaint, not by the pointer. */
  lazy: boolean;
}

const pending = new WeakMap<FcCtx, PendingPress>();
const hovers = new WeakMap<FcCtx, HoverState>();
/** Presses the zones have claimed, so one replayed into a handle stays the handle's. */
const claimed = new WeakSet<PointerEvent>();
/** The pointer kind the chrome is laid out for: the last to press or move on the stage. */
const kinds = new WeakMap<FcCtx, PointerKind>();
/** Large zones own the chrome's resize hits (`data-grab`), as last laid out. */
const grabbing = new WeakMap<FcCtx, boolean>();
/** The visible stage per metrics snapshot: a gesture holds one snapshot for its length,
 *  so the view is measured once per drag rather than every frame. */
const views = new WeakMap<Metrics, ViewRect>();
/** The shape per row array and chrome key, dropped whenever the chrome repaints. */
const shapes = new WeakMap<FcCtx, { boxes: Box[]; key: string; shape: ZoneShape | null }>();

function pointerKindOf(e: Pick<PointerEvent, 'pointerType'>): PointerKind {
  return e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse';
}
/** On a Mac a Ctrl-press opens the context menu, so a zone leaves it alone. */
function macPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
}
/** The media editor.css sizes the resize handles by; with none to ask, a fine pointer's. */
function handleMedia(): HandleMedia {
  if (typeof matchMedia !== 'function') return { coarse: false, fine: true };
  return { coarse: matchMedia('(any-pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches };
}

/**
 * The modes zones belong to: the pointer mode, for a person who may edit. Text edit,
 * pen and node edit, gradient edit and a text path being drawn turn them off.
 */
function zonesMode(fc: FcCtx): boolean {
  return fc.mode === 'select' && !fc.armedKind && !fc.editing && !fc.penDraft && !fc.penEdit &&
    !fc.nodeToolActive && !fc.textPathDrawing && fc.gradEdit == null && fc.opts?.canEdit?.() !== false;
}
/**
 * Zones exist only where the resize handles do: on a selection in a zone mode that the
 * playhead shows. A Space pan and a live gesture turn them off too, and a locked row
 * has no handles, so no zones either.
 */
function zonesLive(fc: FcCtx): boolean {
  return zonesMode(fc) && !fc.gesture && !fc.spacePan && fc.selection.size > 0 && !!fc.chromeNodes?.handles.length;
}

/** The visible stage in client px: the stage clips the canvas, and the view holds the stage. */
function viewportOf(fc: FcCtx, m: Metrics): ViewRect {
  const seen = views.get(m);
  if (seen) return seen;
  const view = visibleRect(m.sr, fc.viewEl.getBoundingClientRect());
  views.set(m, view);
  return view;
}

/**
 * The chrome the zones sit on, in native px: one box's posed rect, turned with the box,
 * or the axis-aligned bounds of a set. The rows and rules are the chrome's own
 * (`chromeSet`), so a zone is never offered where no handle is drawn. Measured once per
 * row array and chrome key, since a hover asks every frame and the chrome only changes
 * when it repaints (see `refreshZones`).
 */
function zoneShape(fc: FcCtx, boxes: Box[]): ZoneShape | null {
  const key = fc.chromeKey ?? '';
  const memo = shapes.get(fc);
  if (memo && memo.boxes === boxes && memo.key === key) return memo.shape;
  const shape = measureShape(fc, boxes);
  shapes.set(fc, { boxes, key, shape });
  return shape;
}
function measureShape(fc: FcCtx, boxes: Box[]): ZoneShape | null {
  if (!fc.select.selectionLive(boxes)) return null;
  const set = fc.chromeSync.chromeSet(boxes);
  if (!set.handles || !set.idx.length) return null;
  const rects = set.idx.map((i) => fc.chromeSync.chromeRect(boxes, i, null));
  let r: Rect = rects[0]!;
  if (rects.length > 1) {
    const a = fc.chromeSync.aabbOfRects(rects);
    r = { x: a.minX, y: a.minY, w: a.maxX - a.minX, h: a.maxY - a.minY, rot: 0 };
  }
  return { idx: set.idx, multi: set.idx.length > 1, r, allowRotate: set.rotate, scaleCursor: fc.scaleContent || set.proportional };
}
/** The chrome in client px under the current pan and zoom. */
function zoneTarget(fc: FcCtx, boxes: Box[]): ZoneTarget | null {
  if (!zonesLive(fc)) return null;
  const shape = zoneShape(fc, boxes);
  if (!shape) return null;
  const m = fc.stage.metrics();
  return { ...shape, rect: nativeToScreen(shape.r, m), viewport: viewportOf(fc, m) };
}

/**
 * The zone under a client point, or null. The zones are large for a finger, and for a
 * mouse or a pen with "Large grab areas" on. On a Mac a Ctrl-press is the context menu's.
 * Shift, ⌘ or Ctrl outside an edge means an additive click or marquee on whatever is
 * there, so the outer half of a strip steps aside; an outer corner and a rotate zone
 * stay, where Shift keeps the aspect or steps the turn. A zone never takes a press from
 * another object: the point must hold a member of the selection, an artboard or
 * nothing (plan 311 Amendment 1), and the interior is never a zone. The one exception is
 * a corner's old reach: within its handle's fat target the corner resizes, as before.
 *
 * Under the large zones a drawn resize handle lets the press through to the zone that
 * stands for the handle, and on the handle the handle's own press wins, as it did when
 * the handle took the press: over another object and with a modifier held. The zone
 * reaches as far as this pointer's press could take a handle, and "on the handle" is
 * the handle as drawn for these media, so a finger on a touch laptop meets a corner on
 * its square alone.
 */
function zoneUnder(fc: FcCtx, boxes: Box[], x: number, y: number, kind: PointerKind, mods: Mods): ZoneFound | null {
  if (mods.ctrlKey && macPlatform()) return null;
  const target = zoneTarget(fc, boxes);
  if (!target) return null;
  const large = fc.grabZones.largeFor(kind);
  const media = large ? handleMedia() : null;
  const reach = media ? handleHitReach(kind, media) : undefined;
  const opts: ZoneOpts = {
    pointerKind: kind, large, viewport: target.viewport, allowRotate: target.allowRotate, ...(reach && { handleReach: reach }),
  };
  const hit = zoneAt({ x, y }, target.rect, opts);
  if (!hit) return null;
  if (media && hit.kind !== 'rotate' && onDrawnHandle({ x, y }, target.rect, hit.handle, drawnHandleReach(media))) {
    return { hit, target, opts, onHandle: true };
  }
  if (hit.kind === 'edge' && hit.outside && (mods.shiftKey || mods.metaKey || mods.ctrlKey)) return null;
  const nat = fc.stage.clientToNative(x, y);
  const under = fc.select.selectHit(boxes, nat.x, nat.y);
  if (under >= 0 && !target.idx.includes(under) && !fc.gestures.isFrameRow(boxes[under]) &&
    !fc.select.selectionForHit(boxes, under, false).some((id) => fc.selection.has(id))) {
    // Over another object a corner still reaches as far as its handle's fat target always
    // did. Where the zones are live a fine pointer meets the corner handle on its square
    // alone (editor.css), for the rotate band past the corner, but no band takes a press
    // over another object, and that object would take the press instead.
    const corner = hit.kind === 'edge' ? null : hit.handle;
    const fat = drawnHandleReach({ coarse: (media ?? handleMedia()).coarse, fine: false });
    if (corner && onDrawnHandle({ x, y }, target.rect, corner, fat)) {
      return { hit: { kind: 'corner', handle: corner, outside: hit.outside }, target, opts, onHandle: true };
    }
    return null;
  }
  return { hit, target, opts, onHandle: false };
}
/**
 * The selected row a press moves from the band round a hairline or a tiny box, or -1:
 * the zones stand clear of a band at least MIN_MOVE_PX thick (inMoveBand), so a finger
 * or a mouse a few px off a 2 px rule still moves the rule. Only one box has a band; a
 * set's bounds hold empty space between its members.
 */
export function moveBandAt(fc: FcCtx, boxes: Box[], x: number, y: number): number {
  const target = zoneTarget(fc, boxes);
  if (!target || target.multi || target.idx.length !== 1) return -1;
  return inMoveBand({ x, y }, target.rect) ? target.idx[0]! : -1;
}
/** Wash the zone a press there takes, when the zones are large; otherwise none. */
function washZone(fc: FcCtx, found: ZoneFound | null): void {
  const zone = found?.opts.large
    ? zoneRects(found.target.rect, found.opts).find((z) => z.kind === found.hit.kind && z.handle === found.hit.handle)
    : undefined;
  if (zone) fc.grabZones.showWash(zone);
  else fc.grabZones.hideWash();
}

/**
 * A press on the canvas or the backdrop: claim the press when it is in a zone, and hold
 * the press until it travels or is released. Returns true when claimed, and the caller
 * goes no further with the press. Off the canvas the stage's own pan owns a finger or a
 * pen, so only a mouse press is claimed there, or a press in a large zone, whose handles
 * let the press through (`onStagePress` takes those before the pan sees them). A second
 * finger belongs to the stage.
 */
export function pressZone(fc: FcCtx, e: PointerEvent, from: ZoneFrom): boolean {
  if (e.button > 0 || pending.has(fc)) return false;
  const kind = pointerKindOf(e);
  if (kind !== 'mouse' && (fc.touchPts.size > 1 || (from === 'backdrop' && !fc.grabZones.largeFor(kind)))) return false;
  const win = fc.canvasEl.ownerDocument?.defaultView;
  if (!win) return false;
  const found = zoneUnder(fc, fc.select.getBoxes(), e.clientX, e.clientY, kind, e);
  if (!found) return false;
  claimed.add(e);
  // A finger has no hover, so the zone it pressed is washed now (a mouse's already is).
  washZone(fc, found);
  // Capture as a gesture does, so the travel and the release reach this press wherever
  // the pointer goes.
  try { fc.canvasEl.setPointerCapture(e.pointerId); } catch { /* the pointer can already be gone */ }
  const move = (ev: PointerEvent): void => zonePressMove(fc, ev);
  const up = (ev: PointerEvent): void => zonePressUp(fc, ev);
  // Any later press ends this one: a second finger, or a mouse whose release never
  // arrived (let go outside the window), whose next press must not resume the drag.
  const other = (): void => dropPress(fc);
  // The capture can go before a release does (the window lost focus): the press ends.
  // Only the canvas's own loss counts. The event bubbles, and a finger's implicit
  // capture on the box it touched passes to the canvas when this press captures the pointer.
  const lost = (ev: PointerEvent): void => { if (ev.pointerId === e.pointerId && ev.target === fc.canvasEl) dropPress(fc); };
  const key = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    // Escape abandons the press, as it cancels a live gesture, before any other rung.
    ev.preventDefault();
    ev.stopPropagation();
    dropPress(fc);
  };
  win.addEventListener('pointermove', move);
  win.addEventListener('pointerup', up);
  win.addEventListener('pointercancel', up);
  win.addEventListener('pointerdown', other, true);
  win.addEventListener('keydown', key, true);
  // A long press opens the context menu (Android sends one while the finger is still
  // down): the press ends there, so the lift does not replay a click that closes the menu.
  win.addEventListener('contextmenu', other, true);
  fc.canvasEl.addEventListener('lostpointercapture', lost);
  pending.set(fc, {
    press: e, from, found, threshold: zoneDragThreshold(kind),
    off: () => {
      win.removeEventListener('pointermove', move);
      win.removeEventListener('pointerup', up);
      win.removeEventListener('pointercancel', up);
      win.removeEventListener('pointerdown', other, true);
      win.removeEventListener('keydown', key, true);
      win.removeEventListener('contextmenu', other, true);
      fc.canvasEl.removeEventListener('lostpointercapture', lost);
    },
  });
  return true;
}

/** Is a zone press held, short of its drag? Its drag starts in the mode and on the chrome
 *  the press was measured on, so Scale mode keeps still until the press ends. */
export function zonePressHeld(fc: FcCtx): boolean {
  return pending.has(fc);
}
/** End a held press without a transform or a click: Escape, another press, a cancel. */
function dropPress(fc: FcCtx): void {
  const p = takePress(fc);
  if (p) releaseCapture(fc, p.press.pointerId);
}
function takePress(fc: FcCtx): PendingPress | undefined {
  const p = pending.get(fc);
  if (!p) return undefined;
  pending.delete(fc);
  p.off();
  fc.grabZones.hideWash();
  return p;
}
/**
 * A press on a resize handle of the chrome while the large zones are on for its pointer:
 * the zone under the handle takes the press, as it would had the handle let the press
 * through. The handles do let presses through once the chrome is laid out for that
 * pointer (`data-grab`), so this covers the first press of a new kind. A press the zones
 * already claimed, handed to the handle as a drag, stays with the handle.
 */
export function handleZonePress(fc: FcCtx, e: PointerEvent): boolean {
  if (claimed.has(e) || !fc.grabZones.largeFor(pointerKindOf(e))) return false;
  return pressZone(fc, e, 'canvas');
}
function releaseCapture(fc: FcCtx, pointerId: number): void {
  try { fc.canvasEl.releasePointerCapture(pointerId); } catch { /* never captured */ }
}

/**
 * The held press travels. Past the threshold it becomes the drag of the handle the zone
 * stands for, from the press point, with the current frame applied at once, so the
 * travel short of the threshold is not lost. A second finger hands the touch to the
 * stage, as it does for a gesture, and a mouse moving with its button up was let go
 * where no release reached the page, so the press is over.
 */
function zonePressMove(fc: FcCtx, e: PointerEvent): void {
  const p = pending.get(fc);
  if (!p || e.pointerId !== p.press.pointerId) return;
  if (fc.disposed || fc.touchPts.size > 1 || (p.press.pointerType === 'mouse' && !(e.buttons & 1))) {
    dropPress(fc);
    return;
  }
  if (Math.hypot(e.clientX - p.press.clientX, e.clientY - p.press.clientY) < p.threshold) return;
  takePress(fc);
  const { hit, target } = p.found;
  const name: HandleName | 'rotate' = hit.kind === 'rotate' ? 'rotate' : hit.handle;
  if (target.multi) fc.chromeSync.onGroupHandleDown(p.press, name);
  else fc.gestures.onHandlePointerDown(p.press, name);
  if (fc.gesture?.pointerId === e.pointerId) fc.gestures.applyGestureMove(e);
  else releaseCapture(fc, e.pointerId);
}

/**
 * The held press is released short of the threshold: it was a click. The press replays
 * through the canvas (or backdrop) handler with the zones skipped. A click on an object
 * settles there; one on empty space starts the marquee or tap it always did, which
 * ends at once with this release. A click on a drawn handle is the handle's, which
 * changes nothing.
 */
function zonePressUp(fc: FcCtx, e: PointerEvent): void {
  const p = pending.get(fc);
  if (!p || e.pointerId !== p.press.pointerId) return;
  takePress(fc);
  if (e.type === 'pointercancel' || fc.disposed || p.found.onHandle) { releaseCapture(fc, e.pointerId); return; }
  if (p.from === 'canvas') fc.gestures.onCanvasPointerDown(p.press, true);
  else fc.gestures.onBackdropPointerDown(p.press, true);
  // A finger or a pen tapped empty space (a tap on the canvas, or the bare stage).
  const empty = p.press.pointerType !== 'mouse' && (p.from === 'backdrop' || fc.gesture?.type === 'tap');
  if (fc.gesture?.pointerId === e.pointerId) fc.gestures.onGestureEnd(e);
  else releaseCapture(fc, e.pointerId);
  // The view's double-tap to fit never saw the press this zone held, so it is told of
  // the tap, at the press's own time.
  if (empty) tapToStage(fc, p.press);
}
/** Count a tap toward the stage's double-tap to fit (tool-stage-nav.ts `fc-touch-tap`). */
function tapToStage(fc: FcCtx, press: PointerEvent): void {
  // From the stage's own realm, as pinch.ts builds `fc-touch-handoff`.
  const Ev = (fc.stageEl.ownerDocument?.defaultView?.CustomEvent ?? CustomEvent) as typeof CustomEvent;
  fc.stageEl.dispatchEvent(new Ev('fc-touch-tap', { detail: { at: press.timeStamp } }));
}

// ── Cursors ──────────────────────────────────────────────────────────────────

/**
 * Set the stage cursor through data attributes, which the stylesheet maps to the resize,
 * scale and rotate cursors. `held` makes every element on the stage show it, for the
 * length of a drag.
 */
function setCursor(fc: FcCtx, c: ZoneCursor | null, held: boolean): void {
  const el = fc.stageEl;
  if (c) el.dataset.fcCursor = c.cursor;
  else delete el.dataset.fcCursor;
  el.toggleAttribute('data-fc-cursor-scale', !!c?.scale);
  el.toggleAttribute('data-fc-cursor-held', !!c && held);
}
/** A zone's cursor: the resize cursor nearest its direction on the turned box, the scale
 *  variant when the drag scales in proportion, or the rotate cursor round its corner. */
function zoneCursor({ hit, target }: ZoneFound): ZoneCursor {
  const rot = target.rect.rot || 0;
  return hit.kind === 'rotate'
    ? { cursor: rotateCursorFor(hit.handle, rot), scale: false }
    : { cursor: resizeCursorFor(hit.handle, rot), scale: target.scaleCursor };
}
/** The direction of `p` from `c`, in degrees clockwise from +x. */
const angleOf = (p: Point, c: Point): number => (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
/** The cursor a transform holds: its handle's resize cursor on the box as the playhead
 *  poses the box (what the handle and the zone showed at the press), or the rotate
 *  cursor round the corner nearest the press. Other gestures hold none. */
function gestureCursor(fc: FcCtx, g: Gesture): ZoneCursor | null {
  switch (g.type) {
    case 'resize': {
      const rot = fc.chromeSync.chromeRect(fc.select.getBoxes(), g.index, null).rot ?? g.startRect.rot;
      return { cursor: resizeCursorFor(g.handle, rot || 0), scale: !!g.content };
    }
    case 'gscale': return { cursor: resizeCursorFor(g.handle, 0), scale: !!g.content || !!g.proportional };
    case 'rotate': return { cursor: rotateCursorAt(angleOf(g.startClient, g.centerClient)), scale: false };
    case 'grotate': return { cursor: rotateCursorAt(angleOf(g.origin, g.centre)), scale: false };
    default: return null;
  }
}
/** A gesture began: a transform holds its cursor until it ends, whatever is under the
 *  pointer on the way; any other gesture clears the hover cursor. */
export function holdCursor(fc: FcCtx): void {
  const h = hovers.get(fc);
  if (h) h.on = false;
  fc.grabZones.hideWash(); // the drag's own chrome shows what it does
  setCursor(fc, fc.gesture ? gestureCursor(fc, fc.gesture) : null, true);
}
/** The gesture ended, committed or cancelled: the next hover sets the cursor again. */
export function releaseCursor(fc: FcCtx): void {
  setCursor(fc, null, false);
}

// ── Hover ────────────────────────────────────────────────────────────────────

function hoverOf(fc: FcCtx): HoverState {
  let h = hovers.get(fc);
  if (!h) { h = { raf: 0, at: null, on: false, key: null, lazy: false }; hovers.set(fc, h); }
  return h;
}
/** Where a hover is: on the canvas or the bare stage, which take a zone press, or on
 *  other stage UI (a handle, the object bar), which keeps a cursor of its own. */
function hoverFrom(fc: FcCtx, t: EventTarget | null): ZoneFrom | null {
  if (t === fc.stageEl || t === fc.viewEl) return 'backdrop';
  return t && fc.canvasEl.contains(t as Node) ? 'canvas' : null;
}
/** The pointer moved over the stage: show the zone's cursor, and its wash when the zones
 *  are large, one hit test per frame. A finger has no hover. */
export function onZoneHover(fc: FcCtx, e: PointerEvent): void {
  notePointer(fc, e);
  if (e.pointerType === 'touch') return;
  const h = hoverOf(fc);
  h.at = {
    x: e.clientX, y: e.clientY, kind: pointerKindOf(e), buttons: e.buttons || 0, from: hoverFrom(fc, e.target),
    shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey,
  };
  h.lazy = false;
  if (!h.raf) h.raf = requestAnimationFrame(fc.zones.paintHover);
}
export function paintHover(fc: FcCtx): void {
  const h = hoverOf(fc);
  h.raf = 0;
  // A drag holds its own cursor, and a held press keeps the one it was made under.
  if (fc.disposed || fc.gesture || pending.has(fc)) return;
  // A repaint under a still pointer looks again only when a zone cursor shows (the box
  // may have moved off the pointer) or the chrome changed (Escape, Delete, undo, K).
  const key = fc.chromeKey ?? '';
  if (h.lazy && !h.on && h.key === key) return;
  h.lazy = false;
  h.key = key;
  const at = h.at;
  // Off the canvas a pen finds only a large zone, as only a press there claims one.
  const found = at && !at.buttons &&
    (at.from === 'canvas' || (at.from === 'backdrop' && (at.kind === 'mouse' || fc.grabZones.largeFor(at.kind))))
    ? zoneUnder(fc, fc.select.getBoxes(), at.x, at.y, at.kind, at)
    : null;
  h.on = !!found;
  setCursor(fc, found ? zoneCursor(found) : null, false);
  washZone(fc, found);
  // A connector line under a zone gives way, so the cursor tells what a drag does.
  if (found) fc.edges.setHoverEdge(null);
}
/**
 * Shift, ⌘ or Ctrl went down or up with the pointer still: hit-test the hover again with
 * the new keys, since a held modifier drops the outer half of the edge strips (Amendment 2)
 * and the cursor has to show what a press there would now do.
 */
export function onZoneModifier(fc: FcCtx, e: KeyboardEvent): void {
  if (e.key !== 'Shift' && e.key !== 'Meta' && e.key !== 'Control') return;
  const h = hovers.get(fc);
  if (!h?.at || fc.disposed || fc.gesture || pending.has(fc)) return;
  if (h.at.shiftKey === e.shiftKey && h.at.metaKey === e.metaKey && h.at.ctrlKey === e.ctrlKey) return;
  h.at = { ...h.at, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey };
  h.lazy = false;
  if (!h.raf) h.raf = requestAnimationFrame(fc.zones.paintHover);
}
export function onZoneLeave(fc: FcCtx): void {
  const h = hoverOf(fc);
  h.at = null;
  if (fc.gesture || pending.has(fc)) return;
  h.on = false;
  setCursor(fc, null, false);
  fc.grabZones.hideWash();
}
/** Did the last hover frame find a zone? The connector hover defers to the zones. */
export function zoneHovered(fc: FcCtx): boolean {
  return hovers.get(fc)?.on ?? false;
}
/**
 * The chrome repainted (paintChrome): measure the zones afresh on the next hit test,
 * and look again under a still pointer, since what is under the pointer may have
 * changed with no pointer move at all.
 */
export function refreshZones(fc: FcCtx): void {
  shapes.delete(fc);
  syncGrab(fc);
  const h = hovers.get(fc);
  if (!h?.at || h.raf || fc.disposed || fc.gesture || pending.has(fc)) return;
  h.lazy = true;
  h.raf = requestAnimationFrame(fc.zones.paintHover);
}

// ── Large zones and the chrome ───────────────────────────────────────────────

/**
 * Lay the chrome out for the zones and the pointer it expects. In a zone mode the zones
 * stand round the handles (`data-zones` on the chrome), so on a fine pointer a corner
 * handle is hit on its own square and a turn starts where the square ends (editor.css).
 * While the large zones are on for that pointer, the resize handles also let presses
 * through to their zones (`data-grab`; still drawn). Both are kept through a drag, so
 * the handles do not flicker. A mode with no zones (an armed Add kind, a gradient,
 * text, pen or node edit) gives the handles back whole, and takes the zone's cursor and
 * wash away at once, since a tool switch need not repaint the chrome or move the
 * pointer. Every chrome paint and every tool switch (syncModeUI) calls this. Returns
 * whether the large zones are on.
 */
export function syncGrab(fc: FcCtx): boolean {
  const mode = zonesMode(fc);
  const on = mode && fc.grabZones.largeFor(kinds.get(fc) ?? 'mouse');
  grabbing.set(fc, on);
  fc.chrome?.toggleAttribute('data-zones', mode);
  fc.chrome?.toggleAttribute('data-grab', on);
  const h = hovers.get(fc);
  if (!mode && h?.on && !fc.gesture) {
    h.on = false;
    setCursor(fc, null, false);
    fc.grabZones.hideWash();
  }
  return on;
}
/**
 * A finger or a pen on the bare stage, in the capture phase: a large zone past the
 * artboard takes the press before the stage's pan and the backdrop's deselect, which
 * both listen on the stage after this. A mouse press is left to the backdrop handler,
 * which the pan leaves alone.
 */
export function onStagePress(fc: FcCtx, e: PointerEvent): void {
  if (e.target !== fc.stageEl || e.pointerType === 'mouse') return;
  if (pressZone(fc, e, 'backdrop')) e.stopImmediatePropagation();
}
/** A press or a move on the stage: a pointer of another kind lays the chrome out for its
 *  own zones, and the rotate handle's stem follows on the next frame. */
export function notePointer(fc: FcCtx, e: PointerEvent): void {
  const kind = pointerKindOf(e);
  if (kinds.get(fc) === kind) return;
  kinds.set(fc, kind);
  const was = grabbing.get(fc) ?? false;
  if (syncGrab(fc) === was || fc.disposed) return;
  requestAnimationFrame(() => {
    if (!fc.disposed && !fc.gesture && fc.selection.size) fc.chromeSync.renderChrome();
  });
}
/**
 * The rotate handle's stem below chrome round `r` (native px), in screen px. It hangs
 * past an `s` handle stood off a short box, and in narrow mode past the large zones
 * outside the selection (plan 311 Amendment 3), so it never covers either.
 */
export function rotateStem(fc: FcCtx, r: Rect, m: Metrics): number {
  const rect = nativeToScreen(r, m);
  const narrow = !!grabbing.get(fc) && largeZoneSize(rect, viewportOf(fc, m)).narrow;
  return rotateStemFor(rect.w, rect.h, narrow);
}

/** Bind the hover and stage press listeners; the returned function unbinds them and
 *  drops a held press. */
export function wireZones(fc: FcCtx): () => void {
  const { stageEl } = fc;
  const win = stageEl.ownerDocument?.defaultView;
  stageEl.addEventListener('pointerdown', fc.zones.notePointer, { capture: true, passive: true });
  stageEl.addEventListener('pointerdown', fc.zones.onStagePress, true);
  stageEl.addEventListener('pointermove', fc.zones.onHover, { passive: true });
  stageEl.addEventListener('pointerleave', fc.zones.onLeave);
  // The modifier keys reach the window wherever focus is, as the hover itself does not need focus.
  win?.addEventListener('keydown', fc.zones.onModifier, true);
  win?.addEventListener('keyup', fc.zones.onModifier, true);
  return () => {
    stageEl.removeEventListener('pointerdown', fc.zones.notePointer, { capture: true });
    stageEl.removeEventListener('pointerdown', fc.zones.onStagePress, true);
    stageEl.removeEventListener('pointermove', fc.zones.onHover);
    stageEl.removeEventListener('pointerleave', fc.zones.onLeave);
    win?.removeEventListener('keydown', fc.zones.onModifier, true);
    win?.removeEventListener('keyup', fc.zones.onModifier, true);
    const h = hovers.get(fc);
    if (h?.raf) cancelAnimationFrame(h.raf);
    hovers.delete(fc);
    shapes.delete(fc);
    dropPress(fc);
    setCursor(fc, null, false);
    fc.grabZones.hideWash();
    kinds.delete(fc);
    grabbing.delete(fc);
  };
}

export function zonesOps(fc: FcCtx) {
  return {
    press: bindOp(fc, pressZone),
    held: bindOp(fc, zonePressHeld),
    moveBand: bindOp(fc, moveBandAt),
    handlePress: bindOp(fc, handleZonePress),
    holdCursor: bindOp(fc, holdCursor),
    releaseCursor: bindOp(fc, releaseCursor),
    onHover: bindOp(fc, onZoneHover),
    onLeave: bindOp(fc, onZoneLeave),
    onModifier: bindOp(fc, onZoneModifier),
    paintHover: bindOp(fc, paintHover),
    hovered: bindOp(fc, zoneHovered),
    refresh: bindOp(fc, refreshZones),
    syncGrab: bindOp(fc, syncGrab),
    onStagePress: bindOp(fc, onStagePress),
    notePointer: bindOp(fc, notePointer),
    rotateStem: bindOp(fc, rotateStem),
    wire: bindOp(fc, wireZones),
  };
}
