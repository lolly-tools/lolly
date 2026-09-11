// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: selection, ids, frames, commit, ground and ink legibility, sequence poses.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { num, resolveFrame, withRect } from '../free-canvas-math.ts';
import type { Box, FrameFields, SeqPose } from '../free-canvas-math.ts';
import { pickTopmost } from '../canvas-scene.ts';
import { colorToHexString, parseColor } from '@lolly/engine';
import { ensureRowIds, ulid } from '../../lib/row-id.ts';
import { openDesignShortcuts } from '../design-shortcuts.ts';
import { contrastText } from '../../brand-vars.ts';
import { boolOf } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function notifySelection(fc: FcCtx): void {
  const { selListeners } = fc;
  if (!selListeners.size) return;
  const k = [...fc.selection].sort().join(',');
  if (k === fc.selNotifyKey) return;
  fc.selNotifyKey = k;
  const ids = [...fc.selection];
  for (const f of [...selListeners]) {
    try {
      f(ids);
    } catch (e) {
      console.error(e);
    }
  }
}
// ── model access ─────────────────────────────────────────────────────────
export const getBoxes = (fc: FcCtx): Box[] => {
  const { blockId, runtime } = fc;
  const e = runtime.getModel().find((i) => i.id === blockId);
  return Array.isArray(e?.value) ? e!.value : [];
};
export const getBg = (fc: FcCtx): any => { const { bgInputId, runtime } = fc; return runtime.getModel().find((i) => i.id === bgInputId)?.value ?? '#ffffff'; };
/** The frame-primitive field names as the pure artboard helpers want them. Only
 *  meaningful with `frameCfg`; every caller is gated on it. */
export const frameFields = (fc: FcCtx): FrameFields => { const { cfg, frameCfg } = fc; return ({
  idField: cfg.idField,
  kindField: cfg.kindField,
  xField: cfg.xField,
  yField: cfg.yField,
  wField: cfg.wField,
  hField: cfg.hField,
  frameField: frameCfg?.frameField || 'frame',
  orderField: frameCfg?.orderField || 'order',
  frameKind: frameCfg?.frameKind || 'frame',
}); };
/** Does this document have artboards at all? Decides between "artboard fill" and
 *  "canvas background", and gates every housekeeping path below. */
export const hasFrames = (fc: FcCtx, boxes: Box[]): boolean =>
  { const { cfg, frameCfg } = fc; return !!frameCfg && boxes.some((b) => b && String(b[cfg.kindField]) === frameCfg.frameKind); };
export const docTransitionValue = (fc: FcCtx): string => {
  const { DOC_TRANSITION_INPUT, runtime } = fc;
  const v = runtime.getModel().find((i) => i.id === DOC_TRANSITION_INPUT)?.value;
  return v == null ? '' : String(v);
};
export const setLollyAnchor = (fc: FcCtx, el: HTMLElement): void => {
  fc.lollyAnchor = el;
};
/** One sheet at a time, whether it was opened from `?` or the document menu. */
export const showShortcuts = (fc: FcCtx, opener?: HTMLElement | null): void => {
  if (fc.shortcutsModal) return;
  fc.shortcutsModal = openDesignShortcuts({
    opener,
    onClose: () => { fc.shortcutsModal = null; },
  });
};
export const idOf = (fc: FcCtx, b: Box | undefined, i: number): string => {
  const { cfg, hasIdField } = fc;
  const v = b ? b[cfg.idField] : undefined;
  if (v != null && v !== '') return String(v);
  return hasIdField ? '' : String(i);
};
export const selIndices = (fc: FcCtx, boxes: Box[]): number[] =>
  boxes.reduce<number[]>((a, b, i) => (fc.selection.has(idOf(fc, b, i)) ? (a.push(i), a) : a), []);
export const indexOfId = (fc: FcCtx, boxes: Box[], id: string | undefined): number =>
  boxes.findIndex((b, i) => idOf(fc, b, i) === id);
export const groupOf = (fc: FcCtx, b: Box | undefined): string =>
  { const { cfg } = fc; return cfg.groupField && b?.[cfg.groupField] ? String(b[cfg.groupField]) : ''; };
export const groupMemberIds = (fc: FcCtx, boxes: Box[], g: string): string[] =>
  boxes.reduce<string[]>((a, b, i) => (groupOf(fc, b) === g ? (a.push(idOf(fc, b, i)), a) : a), []);
// The ids selected when box `i` is clicked: its whole group (if any), unless
// `soloBox` (Alt-click) drills in to just that one box.
export function selectionForHit(fc: FcCtx, boxes: Box[], i: number, soloBox: boolean): string[] {
  const g = groupOf(fc, boxes[i]);
  return soloBox || !g ? [idOf(fc, boxes[i], i)] : groupMemberIds(fc, boxes, g);
}
/**
 * Frame-aware selection pick (plan 92, ISSUE 2a). Two passes over the SAME hitTest:
 * first the topmost NON-frame box under the point, and only when none is hit does the
 * topmost frame (artboard) take the click. So clicking a child selects the child, and
 * clicking an artboard's own empty area / edge selects the artboard - regardless of
 * array order, which fixes the appended-frame-swallows-its-children bug (an Add-menu
 * frame is pushed last → topmost → a plain hitTest would let it eat every child click).
 * Frame-agnostic docs (no frameCfg) fall straight through to the ordinary hitTest, and
 * the shared hitTest used by connect/line/node modes is deliberately NOT routed here.
 */
export function selectHit(fc: FcCtx, boxes: Box[], px: number, py: number): number {
  const { cfg, frameCfg } = fc;
  const skip = seqHiddenSkip(fc, boxes);
  if (!frameCfg) return pickTopmost(boxes, px, py, cfg, skip);
  const fk = frameCfg.frameKind;
  const isFrame = (i: number): boolean => String(boxes[i]?.[cfg.kindField]) === fk;
  const nonFrame = pickTopmost(boxes, px, py, cfg, (i) => (skip ? skip(i) : false) || isFrame(i));
  if (nonFrame >= 0) return nonFrame;
  return pickTopmost(boxes, px, py, cfg, skip);
}
export function freshId(fc: FcCtx, boxes: Box[]): string {
  // ULID (plan 100 section 3): the old id was a per-mount counter plus 4 random base-36
  // digits, so two devices opening the SAME saved session and adding a box each
  // could mint the same id - which is exactly the case a collab makes routine. The
  // collision check stays because it costs one pass over an array we already walk.
  const used = new Set(boxes.map((b, i) => idOf(fc, b, i)));
  let id = ulid();
  while (used.has(id)) id = ulid();
  return id;
}
/** Fill in ids for rows that carry none - an import, a paste, or a hook patch that
 *  minted rows without one. Returns the SAME array when nothing was missing, so a
 *  caller commits only on a real change. Inert for a tool with no id field. */
export const withIds = (fc: FcCtx, boxes: Box[]): Box[] => { const { cfg, hasIdField } = fc; return (hasIdField ? ensureRowIds(boxes, cfg.idField) : boxes); };
export function commit(fc: FcCtx, nextBoxes: Box[]): void {
  const { blockId, onDirty, runtime } = fc;
  onDirty?.(blockId);
  runtime.setInput(blockId, withIds(fc, nextBoxes));
}
// ── frame containment-on-drop (plan 93 F1b-1) ────────────────────────────────
// Re-bucket the boxes TOUCHED by a gesture (by array index) into the frame their
// centre now falls inside - the drop half of the frame primitive. Pure + gated on
// `frameCfg`: dead (returns nextBoxes unchanged) for every tool whose canvas
// declares no frameField, so no-frames documents are untouched. A frame-kind box
// never gets a `frame` membership here (its own move/cascade is a later slice);
// resolveFrame is idempotent, so a box that didn't change frames keeps its identity
// (no spurious new object → no needless re-render churn). `touched` are indices into
// `nextBoxes`; every gesture that calls this preserves index alignment (append for
// create, in-place map for move/resize/scale), so indices stay valid.
export function assignFrames(fc: FcCtx, nextBoxes: Box[], touched: Set<number>): Box[] {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return nextBoxes;
  const ff = frameCfg.frameField;
  const fk = frameCfg.frameKind;
  const frameBoxes = nextBoxes.filter((b) => String(b?.[cfg.kindField]) === fk);
  return nextBoxes.map((b, i) => {
    if (!touched.has(i) || !b) return b;
    if (String(b[cfg.kindField]) === fk) return b; // a frame keeps frame='' (no self-nesting)
    const fid = resolveFrame(b, frameBoxes);
    return String(b[ff] ?? '') === fid ? b : { ...b, [ff]: fid };
  });
}
// ── legible ink on a new text box ────────────────────────────────────────────
// A text add-kind seeds ONE authored ink (Design: `fg: '#11141f'`), so the first text
// placed on a dark artboard was near-black on near-black - at fit zoom on a phone that
// is not "hard to read", it is nothing on screen at all, and typing changes nothing.
//
// The flip is `contrastText`, the shell's ONE inversion rule (brand-vars.ts), used
// twice: once on the ground and once on the seeded ink. When both want the SAME overlay
// ink they sit on the same side of the flip point, which is exactly the dark-on-dark /
// light-on-light case - and it is the only case that gets rewritten. A seed that already
// reads on its ground is left byte-identical, so a light artboard (every shipped default)
// keeps the authored colour.

/** Any authored colour value as `#rrggbb`, or null when it is absent, unparseable
 *  (an alias, a gradient) or too translucent to be the ground. */
export function inkHex(_fc: FcCtx, v: unknown): string | null {
  const c = parseColor(typeof v === 'string' ? v : null);
  return c && c.alpha > 0.5 ? colorToHexString(c) : null;
}
/** The painted ground behind the artboard: the first ancestor from the canvas up that
 *  actually paints something opaque. Read off the DOM rather than the `background`
 *  input because that input can hold an alias, a gradient or nothing at all, and what
 *  matters is what the user is looking at - the current theme's backdrop included. */
export function paintedGround(fc: FcCtx): string | null {
  const { canvasEl } = fc;
  for (let el: HTMLElement | null = canvasEl; el; el = el.parentElement) {
    const hex = inkHex(fc, getComputedStyle(el).backgroundColor);
    if (hex) return hex;
  }
  return null;
}
/** The ground under `box`: its OWN fill first (a card's text sits on the card, not on
 *  whatever is behind it - Design's card seeds a near-black `#14181d`), then the fill of
 *  the frame containing it when the document has frames (a light artboard over a dark
 *  pasteboard is the case that makes the difference), then the painted backdrop. */
export function groundUnder(fc: FcCtx, box: Box, boxes: Box[]): string | null {
  const { cfg, frameCfg } = fc;
  const own = cfg.fillField ? inkHex(fc, box[cfg.fillField]) : null;
  if (own) return own;
  if (frameCfg && cfg.fillField) {
    const fk = frameCfg.frameKind;
    const fid = resolveFrame(
      box,
      boxes.filter((b) => String(b?.[cfg.kindField]) === fk)
    );
    const frame = fid ? boxes.find((b) => b && String(b[cfg.idField]) === fid) : undefined;
    const hex = frame ? inkHex(fc, frame[cfg.fillField]) : null;
    if (hex) return hex;
  }
  return paintedGround(fc);
}
/** `box` with its text ink flipped to whichever of black/white reads on the ground it
 *  sits on - and only when the seeded ink does not already read there. */
export function withLegibleInk(fc: FcCtx, box: Box, boxes: Box[]): Box {
  const { cfg } = fc;
  const f = cfg.textColorField;
  if (!f) return box;
  const ground = groundUnder(fc, box, boxes);
  if (!ground) return box;
  const ink = inkHex(fc, box[f]);
  const wanted = contrastText(ground);
  if (ink && contrastText(ink) !== wanted) return box; // the seed already reads
  return { ...box, [f]: wanted };
}
// F1b-2 frame-move cascade: when a gesture directly moves a frame-kind box, its members
// must travel with it in the SAME commit (one undo step). `prev` is the pre-gesture
// model, `next` the post-transform model - both index-aligned with `sel` (no commit
// happens mid-gesture, so getBoxes()/startBoxes and the transform output share indices).
// For every frame box whose index is in `sel` we read its OWN top-left delta (next−prev)
// and shift each member (frame === frame.id) that the gesture did NOT already move
// directly (index NOT in `sel`). This is why we compose the delta here rather than call
// cascadeFrameMove(next, id, dx, dy): moveBoxes/scaleGroup/rotateGroup already shifted the
// frame box AND any selected children, so re-running cascadeFrameMove over the frame id
// would double-apply to both. A frame box is never cascaded as a member (never
// self-nests). Deriving the delta from prev/next covers move (exact d.dx/d.dy) and the
// group transforms (each frame's own top-left translation) with one path. No-op without
// frameCfg. assignFrames then runs on the touched `sel` only - the cascaded members keep
// their frame because they moved with it (frame-local position unchanged), so they must
// NOT be in the touched set, which is what keeps cascade-then-assign consistent.
export function cascadeFrameChildren(fc: FcCtx, prev: Box[], next: Box[], sel: number[]): Box[] {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return next;
  const ff = frameCfg.frameField;
  const fk = frameCfg.frameKind;
  const selSet = new Set(sel);
  const deltas = new Map<string, { dx: number; dy: number }>();
  for (const i of sel) {
    const nb = next[i];
    const pb = prev[i];
    if (!nb || !pb || String(nb[cfg.kindField]) !== fk) continue;
    const fid = nb[cfg.idField] == null ? '' : String(nb[cfg.idField]);
    if (!fid) continue;
    const dx = num(nb[cfg.xField]) - num(pb[cfg.xField]);
    const dy = num(nb[cfg.yField]) - num(pb[cfg.yField]);
    if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) deltas.set(fid, { dx, dy });
  }
  if (deltas.size === 0) return next;
  return next.map((b, i) => {
    if (!b || selSet.has(i) || String(b[cfg.kindField]) === fk) return b;
    const d = deltas.get(String(b[ff] ?? ''));
    return d
      ? withRect(b, { x: num(b[cfg.xField]) + d.dx, y: num(b[cfg.yField]) + d.dy }, cfg)
      : b;
  });
}
// Reserve a bottom band of the stage for the docked panel, then re-fit the canvas.
// Mirrors deck-editor's syncFreeReserve exactly: a px STRING ('' releases), an
// equality guard so the stage ResizeObserver cannot loop, and a `canvas-resize`
// event (never a direct fitCanvas call) to trigger the re-fit.
export function reserveBottom(fc: FcCtx, px: number): void {
  const { canvasEl, stageEl } = fc;
  const next = px > 0 ? Math.round(px) + 'px' : '';
  if (stageEl.style.getPropertyValue('--stage-reserve-bottom') === next) return;
  if (next) stageEl.style.setProperty('--stage-reserve-bottom', next);
  else stageEl.style.removeProperty('--stage-reserve-bottom');
  // The right edge dock is a body-level fixed column that cannot read the stage's
  // inline style: publish the band on <html> too, so the column ends above the timeline.
  if (next) document.documentElement.style.setProperty('--design-timeline-h', next);
  else document.documentElement.style.removeProperty('--design-timeline-h');
  // The reserve is the timeline panel's open/close/height signal, so this is also
  // where the tool rail auto-docks (open) and returns to floating (close).
  fc.rail.dockRailForTimeline(px > 0);
  // …and it is the ONLY place free-canvas learns that the panel closed ITSELF
  // (plans/179 T2). Escape inside the panel calls its own `setOpen(false)` and never
  // comes back through `ensureTimeline`, so the rail button stayed armed, the chrome
  // kept the open-panel gate, and `timelineWantOpen` stayed true - which a later
  // chunk-load would have honoured by re-opening a panel the user had dismissed.
  // On the EDGE only: a resize drag rewrites the reserve every frame.
  if (px > 0 !== fc.timelineReserved) {
    fc.timelineReserved = px > 0;
    if (!fc.timelineReserved && fc.timelinePanel && !fc.timelinePanel.isOpen()) {
      fc.timelineWantOpen = false;
      fc.narration.hideSeqPrompt();
      fc.chromeSync.scheduleSync();
    }
    syncTimelineBtn(fc);
  }
  canvasEl.dispatchEvent(new Event('canvas-resize'));
}
export function syncTimelineBtn(fc: FcCtx): void {
  if (!fc.timelineBtn) return;
  const on = !!fc.timelinePanel?.isOpen();
  fc.timelineBtn.classList.toggle('is-armed', on);
  fc.timelineBtn.setAttribute('aria-pressed', String(on));
}
/**
 * The ONE DOM read behind the whole rule (see the file header): is the sequence
 * currently hiding the box carrying `id`? Everything else - hit-test skipping,
 * chrome suppression, the keyboard gate - is a caller of this, so there is exactly
 * one expression that can ever be wrong.
 */
export function seqHiddenId(fc: FcCtx, id: string): boolean {
  const { SEQ_OFF_CLASS, canvasEl, timeCfg } = fc;
  if (!timeCfg) return false;
  const el = canvasEl.querySelector(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`);
  return el?.classList.contains(SEQ_OFF_CLASS) ?? false;
}
/**
 * The single ACQUISITION gate (see the file header): every pointer pick - click,
 * marquee, hover, drop - runs through this, so a box that must not be grabbed off the
 * canvas is excluded in ONE expression rather than at five call sites.
 *
 * Four exclusions:
 *   • SEQ-HIDDEN - the box is not on screen at the playhead, so a click falls through
 *     it to whatever is (the rule this function was written for).
 *   • CAMERA - a camera has NO canvas footprint at all (plans/104 section 5.4: "excluded
 *     from hit-testing, marquee…; selected via its bar/chip only"). It paints nothing
 *     and is minted with no geometry, so without this a zero-size marker at the origin
 *     is caught by any marquee crossing it and dragged around as if it were artwork.
 *   • HIDDEN - the layer flag (plans/179 M4). The hook leaves a hidden row out of the
 *     render entirely, so there is no element to hit - but the pick runs over the MODEL,
 *     which still holds the row at its geometry. Without this a hidden box is caught by
 *     a marquee and dragged around while nothing at all is on screen.
 *   • LOCKED - the other layer flag. It IS drawn, and drawn normally; what it refuses is
 *     acquisition. A locked frame is still selectable through its label, which is a
 *     separate element with its own handler and never reaches this pick.
 */
export function seqHiddenSkip(fc: FcCtx, boxes: Box[]): ((i: number) => boolean) | undefined {
  const { cfg, frameCfg, timeCfg } = fc;
  const hideF = frameCfg?.hiddenField;
  const lockF = frameCfg?.lockedField;
  if (!timeCfg && !hideF && !lockF) return undefined;
  return (i: number) => {
  const { timeCfg } = fc;
    const b = boxes[i];
    if (!b) return false;
    if (hideF && boolOf(b[hideF], false)) return true;
    if (lockF && boolOf(b[lockF], false)) return true;
    if (!timeCfg) return false;
    return String(b[cfg.kindField] ?? '') === 'camera' || seqHiddenId(fc, idOf(fc, b, i));
  };
}
/**
 * RETENTION, the half `seqHiddenSkip` cannot cover: a selection acquired while its
 * box was on screen SURVIVES the playhead moving away from it. True means "at least
 * one selected box is on screen at the playhead, so editing it means something".
 * An untimed tool, or an empty selection, is always live.
 */
export function selectionLive(fc: FcCtx, boxes: Box[]): boolean {
  const { timeCfg } = fc;
  if (!timeCfg || !fc.selection.size) return true;
  for (let i = 0; i < boxes.length; i++) {
    const id = idOf(fc, boxes[i], i);
    if (fc.selection.has(id) && !seqHiddenId(fc, id)) return true;
  }
  return false;
}
/**
 * The pose the playhead currently has box `id` in, or null.
 *
 * DOM truth on `seqHiddenId`'s exact terms: the numbers are the fold the applier
 * WROTE, not a second evaluation of the same track here, so the chrome cannot
 * disagree with the picture on the canvas (plans/104 section 6.5).
 */
export function seqPoseId(fc: FcCtx, id: string): SeqPose | null {
  const { canvasEl } = fc;
  if (!fc.seqPoseOf) return null;
  const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`);
  return el ? fc.seqPoseOf(el) : null;
}
export function selectOps(fc: FcCtx) {
  return {
    notifySelection: bindOp(fc, notifySelection),
    getBoxes: bindOp(fc, getBoxes),
    getBg: bindOp(fc, getBg),
    frameFields: bindOp(fc, frameFields),
    hasFrames: bindOp(fc, hasFrames),
    docTransitionValue: bindOp(fc, docTransitionValue),
    setLollyAnchor: bindOp(fc, setLollyAnchor),
    showShortcuts: bindOp(fc, showShortcuts),
    idOf: bindOp(fc, idOf),
    selIndices: bindOp(fc, selIndices),
    indexOfId: bindOp(fc, indexOfId),
    groupOf: bindOp(fc, groupOf),
    groupMemberIds: bindOp(fc, groupMemberIds),
    selectionForHit: bindOp(fc, selectionForHit),
    selectHit: bindOp(fc, selectHit),
    freshId: bindOp(fc, freshId),
    withIds: bindOp(fc, withIds),
    commit: bindOp(fc, commit),
    assignFrames: bindOp(fc, assignFrames),
    inkHex: bindOp(fc, inkHex),
    paintedGround: bindOp(fc, paintedGround),
    groundUnder: bindOp(fc, groundUnder),
    withLegibleInk: bindOp(fc, withLegibleInk),
    cascadeFrameChildren: bindOp(fc, cascadeFrameChildren),
    reserveBottom: bindOp(fc, reserveBottom),
    syncTimelineBtn: bindOp(fc, syncTimelineBtn),
    seqHiddenId: bindOp(fc, seqHiddenId),
    seqHiddenSkip: bindOp(fc, seqHiddenSkip),
    selectionLive: bindOp(fc, selectionLive),
    seqPoseId: bindOp(fc, seqPoseId),
  };
}
