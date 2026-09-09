// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: stage geometry (metrics, native/stage coordinates), guides, camera HUD, flashes and arm hints.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import type { Box } from '../free-canvas-math.ts';
import { announce } from '../../a11y.ts';
import { t, tRaw } from '../../i18n.ts';
import type { AddKind, Metrics, Point } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// `freshEdgeId` + `toggleEdge` (plan 90) lived here: Connect mode's write into the
// connectors input. Plan 96 P4 deleted both with the mode. An edge is not a thing any
// more - a connector is a path box whose `bindStart`/`bindEnd` name the boxes its ends
// are attached to, written by the endpoint-bind gesture below, and every tool's hook
// converts any surviving edge row to one of those on load. `commitEdges` above stays as
// the DRAIN: nothing calls it today, but a tool that still declares `canvas.connect`
// keeps its read-only inspector rather than silently losing the ability to delete a row.
// `createLine` (plan 90) lived here: the Line tool's write into the connectors input.
// Plan 96 P2 deleted it. A line is a PATH BOX now - `commitPathBox`, the same call the
// pen commits through - so there is no second place a line can come from, and the edge
// row it used to mint had no nodes to edit. `toggleEdge` above stays: it is the Connect
// mode's own write, which P4 migrates.
export const gridRound = (fc: FcCtx, v: number): number => { const { gridSize } = fc; return Math.round(v / gridSize) * gridSize; };
export function metrics(fc: FcCtx): Metrics {
  const { canvasEl, stageEl } = fc;
  if (fc.gestureMetrics && fc.gesture) return fc.gestureMetrics; // trust the cache only while the gesture is live
  const cr = canvasEl.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  const scale = cr.width / fc.helpers.canvasWH().w || 1;
  const m = { cr, sr, scale };
  fc.gestureMetrics = fc.gesture ? m : null; // hold for the rest of the gesture; drop when idle
  return m;
}
export const clientToNative = (fc: FcCtx, cx: number, cy: number): Point => {
  const { cr, scale } = metrics(fc);
  return { x: (cx - cr.left) / scale, y: (cy - cr.top) / scale };
};
export const nativeToStage = (fc: FcCtx, nx: number, ny: number, m: Metrics = metrics(fc)): Point => ({
  x: m.cr.left - m.sr.left + nx * m.scale,
  y: m.cr.top - m.sr.top + ny * m.scale,
});
export const frameOffsetOfEl = (fc: FcCtx, el: Element): Point => {
  const { frameCfg, pages } = fc;
  // No pages AND no frame primitive ⇒ no [data-pdf-page] frames exist, so skip the
  // ancestor walk entirely (a plain single-page editor hits this every gesture frame).
  // A frame-primitive tool (frameCfg) emits [data-pdf-page] pages at authored x/y even
  // with no `pages` config, so it must walk too - offsetLeft/offsetTop then report the
  // frame's own position and the frame-local drag math below works unchanged.
  if (!pages && !frameCfg) return { x: 0, y: 0 };
  const f = el.closest?.('[data-pdf-page]') as HTMLElement | null;
  // closest() matches the element ITSELF: a frame's own page element positions in
  // GLOBAL canvas space, so its offset is zero - subtracting its own offsetLeft/Top
  // here would teleport a dragged artboard to the canvas origin on the first move.
  if (!f || f === el) return { x: 0, y: 0 };
  if (fc.frameOffCache) {
    let c = fc.frameOffCache.get(f);
    if (!c) {
      c = { x: f.offsetLeft, y: f.offsetTop };
      fc.frameOffCache.set(f, c);
    }
    return c;
  }
  return { x: f.offsetLeft, y: f.offsetTop };
};
// The live DOM element for box `id`. A frame-kind box has no `.lolly-box` - its
// element IS the page (`.lolly-frame-page[data-frame-id]`), so fall back to it;
// gestures then move the page directly and its frame-local children ride along.
export const liveBoxEl = (fc: FcCtx, id: string): HTMLElement | null =>
  { const { canvasEl } = fc; return canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`) ??
  canvasEl.querySelector<HTMLElement>(`.lolly-frame-page[data-frame-id="${fc.keys.cssEscape(id)}"]`); };
export const readGuideVisibility = (fc: FcCtx): boolean => {
  const { GUIDE_VISIBILITY_KEY } = fc;
  try { return localStorage.getItem(GUIDE_VISIBILITY_KEY) !== 'false'; }
  catch { return true; }
};
export const setGuidesVisible = (fc: FcCtx, visible: boolean): void => {
  const { GUIDE_VISIBILITY_KEY } = fc;
  fc.authoringGuides?.setVisible(visible);
  try { localStorage.setItem(GUIDE_VISIBILITY_KEY, String(visible)); } catch { /* best effort */ }
};
export const camHudDeg = (_fc: FcCtx, n: number): string => `${n > 0 ? '+' : ''}${Math.round(n)}°`;
export const camHudPx = (_fc: FcCtx, n: number): string => `${n > 0 ? '+' : ''}${Math.round(n)}`;
// Built with DOM + textContent, never innerHTML: the values are numbers and the labels
// are `t()` strings, so nothing here needs escaping - and keeping it off the raw-HTML
// path is why this readout is not one more sink the R10 guard has to vouch for.
export const camHudSpan = (_fc: FcCtx, cls: string, text: string): HTMLElement => {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
};
/** Show the tilt the drop would land - absolute, clamped, straight from the panel. */
export function showCamTiltHud(fc: FcCtx, dRx: number, dRy: number): void {
  const { camHud } = fc;
  const p = fc.timelinePanel?.cameraTiltPreview(fc.select.getBoxes(), dRx, dRy) ?? null;
  camHud.replaceChildren(
    camHudSpan(fc, 'fc-cam-hud-k', t('Tilt')),
    ...(p
      ? [
          camHudSpan(fc, 'fc-cam-hud-v', `X ${camHudDeg(fc, p.rx)}`),
          camHudSpan(fc, 'fc-cam-hud-v', `Y ${camHudDeg(fc, p.ry)}`),
        ]
      : [camHudSpan(fc, 'fc-cam-hud-v', t('No keyframe here'))])
  );
  camHud.hidden = false;
}
/** Show the pan offset the drag has accumulated (native px - the model's own units). */
export function showCamPanHud(fc: FcCtx, dx: number, dy: number): void {
  const { camHud } = fc;
  camHud.replaceChildren(
    camHudSpan(fc, 'fc-cam-hud-k', t('Pan')),
    camHudSpan(fc, 'fc-cam-hud-v', `X ${camHudPx(fc, dx)}`),
    camHudSpan(fc, 'fc-cam-hud-v', `Y ${camHudPx(fc, dy)}`)
  );
  camHud.hidden = false;
}
export function hideCamHud(fc: FcCtx): void {
  const { camHud } = fc;
  if (camHud.hidden) return;
  camHud.hidden = true;
  camHud.replaceChildren();
}
/** Arm the HUD + a mode cursor at the start of a camera gesture. */
export function startCamHud(fc: FcCtx, tilt: boolean): void {
  const { stageEl } = fc;
  stageEl.style.cursor = tilt ? 'move' : 'grabbing';
  if (tilt) showCamTiltHud(fc, 0, 0);
  else showCamPanHud(fc, 0, 0);
}
export function flash(fc: FcCtx, message: string): void {
  const { flashEl } = fc;
  if (!message) return;
  flashEl.textContent = message;
  flashEl.hidden = false;
  if (fc.flashTimer) clearTimeout(fc.flashTimer);
  fc.flashTimer = setTimeout(() => {
  const { flashEl } = fc;
    flashEl.hidden = true;
    flashEl.textContent = '';
    fc.flashTimer = 0;
  }, 5200);
  announce(message, { assertive: true });
}
/** No cursor to carry a mode, and no hover to reveal one. Read live, because a hybrid
 *  device answers differently depending on what the user last touched. */
export const coarsePointer = (_fc: FcCtx): boolean => matchMedia('(pointer: coarse)').matches;
/**
 * Kinds whose gesture ends at an ASSET PICKER rather than at a finished object - the
 * drag places the frame, then the library opens. Worth saying, because a drag that
 * ends in a dialog is a different promise from one that ends in a shape.
 *
 * The noun is PER KIND, and it is the noun the picker itself will use a moment later
 * (`pickImage`'s dialog title): one sentence for the lot said "place an image" when the
 * user had just chosen Video, Animation or Clip - in the very chip whose point is to
 * say what the armed mode is waiting for. Keyed on the add-kind's `id`, because all
 * four of these seed the same `kind: 'image'`.
 */
export const assetArmHint = (_fc: FcCtx, id: string): string | null => {
  switch (id) {
    case 'video':
    case 'clip':
      return t('Drag on the canvas to place a video, then choose one.');
    case 'lottie':
      return t('Drag on the canvas to place an animation, then choose one.');
    case 'tool':
      return t('Drag on the canvas to place a tool, then choose one.');
    case 'image':
      return t('Drag on the canvas to place an image, then choose one.');
    default:
      return null;
  }
};
export function showArmHint(fc: FcCtx, kind: AddKind | null | undefined): void {
  const { armHintEl, armHintTxt, cfg } = fc;
  if (fc.armHintOff || !kind) {
    hideArmHint(fc);
    return;
  }
  const seedKind = kind.seed != null ? String(kind.seed[cfg.kindField] ?? '') : '';
  const asset = assetArmHint(fc, kind.id);
  if (coarsePointer(fc)) {
    // No cursor and no drag-to-size: a finger TAPS and the box appears at its seed size.
    const isText = kind.id === 'text' || seedKind === 'text';
    armHintTxt.textContent = isText
      ? t('Tap the canvas to place text')
      : t('Tap the canvas to place it');
  } else if (kind.id === 'audio' || seedKind === 'audio') {
    armHintTxt.textContent = t('Drag on the canvas to place a sound, then choose one.');
  } else if (asset) {
    armHintTxt.textContent = asset;
  } else if (seedKind === 'image') {
    armHintTxt.textContent = t('Drag on the canvas to place an image, then choose one.');
  } else {
    // The kind's own label, so the sentence names the thing the user just chose
    // ("draw: Circle", "draw: Artboard") rather than a generic "shape". No article and
    // no lowercasing: an article baked into the English source made "draw a artboard"
    // that no translator could repair, and `toLocaleLowerCase()` both destroyed a
    // German noun's capital and read the HOST locale rather than the app's.
    // tRaw, not t: this is a TEXT sink, where an escaped apostrophe in a translated
    // kind label would be shown literally as `&#39;`.
    armHintTxt.textContent = tRaw('Drag on the canvas to draw: {kind}. Press Escape to cancel.', {
      kind: kind.label ? t(kind.label) : kind.id,
    });
  }
  armHintEl.hidden = false;
}
export function hideArmHint(fc: FcCtx): void {
  const { armHintEl } = fc;
  if (!armHintEl.hidden) armHintEl.hidden = true;
}
/**
 * Raise the toast for an off-playhead selection. At the foot of the stage, beside the
 * timeline it is about (plans/184 section 6, S3) - it used to sit dead-centre on the
 * canvas, where it read as a stuck error over the work. The CSS owns the position.
 *
 * Two suppressions, both deliberate: no timeline panel means no clock means nothing is
 * ever `seq-off` (so this can only be a stale class), and during PLAYBACK a scene
 * leaving the screen is expected rather than a problem to report.
 */
export function showOffPlayhead(fc: FcCtx, boxes: Box[], idx: number[]): void {
  const { offPlayheadEl, timeCfg } = fc;
  if (!timeCfg || !fc.timelinePanel || fc.tlPlaying || !idx.length) {
    hideOffPlayhead(fc);
    return;
  }
  const b = boxes[idx[0]!];
  // A field read, not arithmetic: the box's own authored start, in ms.
  fc.offPlayheadAtMs = Math.max(0, Number(b?.[timeCfg.startField]) * 1000) || 0;
  const key = idx
    .map((k) => fc.select.idOf(boxes[k], k))
    .sort()
    .join(',');
  if (key !== fc.lastOffPlayheadKey) {
    fc.lastOffPlayheadKey = key;
    announce(t('This card is not on screen at the playhead. Go to it to edit it.'));
  }
  offPlayheadEl.hidden = key === fc.dismissedOffPlayheadKey;
}
export function hideOffPlayhead(fc: FcCtx): void {
  const { offPlayheadEl } = fc;
  if (!offPlayheadEl.hidden) offPlayheadEl.hidden = true;
  fc.lastOffPlayheadKey = '';
  fc.dismissedOffPlayheadKey = '';
}
export function stageOps(fc: FcCtx) {
  return {
    gridRound: bindOp(fc, gridRound),
    metrics: bindOp(fc, metrics),
    clientToNative: bindOp(fc, clientToNative),
    nativeToStage: bindOp(fc, nativeToStage),
    frameOffsetOfEl: bindOp(fc, frameOffsetOfEl),
    liveBoxEl: bindOp(fc, liveBoxEl),
    readGuideVisibility: bindOp(fc, readGuideVisibility),
    setGuidesVisible: bindOp(fc, setGuidesVisible),
    camHudDeg: bindOp(fc, camHudDeg),
    camHudPx: bindOp(fc, camHudPx),
    camHudSpan: bindOp(fc, camHudSpan),
    showCamTiltHud: bindOp(fc, showCamTiltHud),
    showCamPanHud: bindOp(fc, showCamPanHud),
    hideCamHud: bindOp(fc, hideCamHud),
    startCamHud: bindOp(fc, startCamHud),
    flash: bindOp(fc, flash),
    coarsePointer: bindOp(fc, coarsePointer),
    assetArmHint: bindOp(fc, assetArmHint),
    showArmHint: bindOp(fc, showArmHint),
    hideArmHint: bindOp(fc, hideArmHint),
    showOffPlayhead: bindOp(fc, showOffPlayhead),
    hideOffPlayhead: bindOp(fc, hideOffPlayhead),
  };
}
